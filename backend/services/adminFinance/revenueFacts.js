'use strict';

const ElectronicInvoice = require('../../models/ElectronicInvoice');
const Order = require('../../models/Order');
const OrderRefund = require('../../models/OrderRefund');

function createRevenueFacts(deps) {
  const {
    bucketKey,
    buildBranchFilter,
    clean,
    cleanLower,
    getOrderAmount,
    getOrderPaymentParts,
    money,
    pct,
    resolveDateRange,
    safeDate,
    signedMoney,
    toObjectId,
  } = deps;

  function dateWithinRange(value, dateRange) {
    const date = safeDate(value);
    return Boolean(date && date >= dateRange.from && date <= dateRange.to);
  }

  function getRefundFinancialDate(refund = {}) {
    return safeDate(refund.processedAt) || safeDate(refund.createdAt);
  }

  function isValidatedCreditNote(note = {}) {
    return (
      cleanLower(note.status) === 'validated' ||
      note.provider?.isValidated === true
    );
  }

  function getCreditNoteFinancialDate(note = {}) {
    return (
      safeDate(note.validatedAt) ||
      safeDate(note.provider?.validatedAt) ||
      safeDate(note.sentAt) ||
      safeDate(note.createdAt)
    );
  }

  function ensureCorrectionGroup(map, order) {
    const orderId = String(order?._id || '');
    if (!orderId) return null;

    if (!map.has(orderId)) {
      map.set(orderId, {
        orderId,
        order,
        amount: 0,
        processedRefundAmount: 0,
        validatedCreditNoteAmount: 0,
        events: [],
      });
    }

    return map.get(orderId);
  }

  async function loadFinancialCorrectionContext(query = {}, salesOrders = []) {
    const dateRange = resolveDateRange(query);
    const refundDateFilter = {
      $or: [
        { processedAt: { $gte: dateRange.from, $lte: dateRange.to } },
        {
          processedAt: null,
          createdAt: { $gte: dateRange.from, $lte: dateRange.to },
        },
      ],
    };

    const [refunds, invoiceDocs] = await Promise.all([
      OrderRefund.find({
        status: 'processed',
        ...refundDateFilter,
      })
        .select('order amount items processedAt createdAt reconciliation.creditNoteId')
        .lean(),
      ElectronicInvoice.find({
        creditNotes: {
          $elemMatch: {
            $and: [
              {
                $or: [
                  { status: 'validated' },
                  { 'provider.isValidated': true },
                ],
              },
              {
                $or: [
                  { validatedAt: { $gte: dateRange.from, $lte: dateRange.to } },
                  { createdAt: { $gte: dateRange.from, $lte: dateRange.to } },
                ],
              },
            ],
          },
        },
      })
        .select('orderId creditNotes')
        .lean(),
    ]);

    const candidateOrderIds = new Set();
    refunds.forEach((refund) => {
      if (refund.order) candidateOrderIds.add(String(refund.order));
    });
    invoiceDocs.forEach((invoice) => {
      if (invoice.orderId) candidateOrderIds.add(String(invoice.orderId));
    });

    const ordersById = new Map(
      salesOrders.map((order) => [String(order._id), order])
    );
    const missingOrderIds = [...candidateOrderIds]
      .filter((orderId) => !ordersById.has(orderId))
      .map(toObjectId)
      .filter(Boolean);

    if (missingOrderIds.length) {
      const correctionOrders = await Order.find({
        _id: { $in: missingOrderIds },
        ...buildBranchFilter(query),
      }).lean();
      correctionOrders.forEach((order) => {
        ordersById.set(String(order._id), order);
      });
    }

    const correctionsByOrder = new Map();
    for (const refund of refunds) {
      const order = ordersById.get(String(refund.order || ''));
      const financialDate = getRefundFinancialDate(refund);
      if (!order || !dateWithinRange(financialDate, dateRange)) continue;

      const group = ensureCorrectionGroup(correctionsByOrder, order);
      const amount = money(refund.amount);
      if (!group || amount <= 0) continue;

      group.processedRefundAmount += amount;
      group.events.push({
        kind: 'refund',
        amount,
        date: financialDate,
        items: Array.isArray(refund.items) ? refund.items : [],
        creditNoteId: String(refund.reconciliation?.creditNoteId || ''),
      });
    }

    for (const invoice of invoiceDocs) {
      const order = ordersById.get(String(invoice.orderId || ''));
      if (!order) continue;

      for (const note of Array.isArray(invoice.creditNotes) ? invoice.creditNotes : []) {
        const financialDate = getCreditNoteFinancialDate(note);
        if (
          !isValidatedCreditNote(note) ||
          !dateWithinRange(financialDate, dateRange)
        ) {
          continue;
        }

        const amount = money(note.totalAmount);
        if (amount <= 0) continue;

        const group = ensureCorrectionGroup(correctionsByOrder, order);
        group.validatedCreditNoteAmount += amount;
        group.creditNoteEvents = [
          ...(group.creditNoteEvents || []),
          {
            kind: 'credit_note',
            amount,
            date: financialDate,
            items: Array.isArray(note.items) ? note.items : [],
            creditNoteId: String(note._id || ''),
          },
        ];
      }
    }

    for (const [orderId, group] of correctionsByOrder.entries()) {
      const orderAmount = getOrderAmount(group.order);
      const effectiveAmount = Math.min(
        orderAmount,
        Math.max(
          group.processedRefundAmount,
          group.validatedCreditNoteAmount
        )
      );
      let acceptedAmount = 0;
      const acceptedEvents = [];

      for (const event of group.events) {
        const amount = Math.min(event.amount, effectiveAmount - acceptedAmount);
        if (amount <= 0) break;
        acceptedEvents.push({ ...event, amount });
        acceptedAmount += amount;
      }

      if (acceptedAmount < effectiveAmount) {
        const creditEvents = group.creditNoteEvents || [];
        const creditDate = creditEvents
          .map((event) => event.date)
          .filter(Boolean)
          .sort((a, b) => b.getTime() - a.getTime())[0] || dateRange.to;
        acceptedEvents.push({
          kind: 'credit_note',
          amount: effectiveAmount - acceptedAmount,
          date: creditDate,
          items: creditEvents.flatMap((event) => event.items || []),
        });
        acceptedAmount = effectiveAmount;
      }

      if (acceptedAmount <= 0) {
        correctionsByOrder.delete(orderId);
        continue;
      }

      group.amount = signedMoney(acceptedAmount);
      group.events = acceptedEvents;
      delete group.creditNoteEvents;
    }

    return {
      dateRange,
      correctionsByOrder,
      ordersById,
    };
  }

  function correctionTotal(correctionsByOrder = new Map()) {
    return [...correctionsByOrder.values()].reduce(
      (sum, group) => sum + signedMoney(group.amount),
      0
    );
  }

  function applyCorrectionToBreakdown(rows = [], correctionsByOrder, selector) {
    const map = new Map(
      rows.map((row) => [
        row.key,
        {
          ...row,
          grossAmount: money(row.amount),
          refunds: 0,
        },
      ])
    );

    for (const group of correctionsByOrder.values()) {
      for (const part of selector(group.order, group.amount)) {
        const key = cleanLower(part.key || 'sin_definir') || 'sin_definir';
        const current = map.get(key) || {
          key,
          label: part.label || key,
          orders: 0,
          items: 0,
          grossAmount: 0,
          refunds: 0,
          amount: 0,
        };
        current.refunds += money(part.amount);
        current.amount = signedMoney(current.grossAmount - current.refunds);
        map.set(key, current);
      }
    }

    const netTotal = [...map.values()].reduce(
      (sum, row) => sum + signedMoney(row.amount),
      0
    );

    return [...map.values()]
      .map((row) => ({
        ...row,
        grossAmount: money(row.grossAmount),
        refunds: money(row.refunds),
        amount: signedMoney(row.amount),
        percent: pct(row.amount, netTotal),
      }))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  }

  function applySalesCorrections(summary, correctionContext) {
    const corrections = correctionContext.correctionsByOrder;
    const refunds = correctionTotal(corrections);
    const grossRevenue = money(summary.revenue);
    const revenue = signedMoney(grossRevenue - refunds);

    const singlePartSelector = (field, fallback) => (order, amount) => [{
      key: order?.[field] || fallback,
      label: order?.[field] || fallback,
      amount,
    }];

    const dailyMap = new Map(
      summary.daily.map((row) => [
        row.date,
        {
          ...row,
          grossRevenue: money(row.revenue),
          refunds: 0,
        },
      ])
    );

    for (const group of corrections.values()) {
      for (const event of group.events) {
        const date = bucketKey(event.date);
        const row = dailyMap.get(date) || {
          date,
          orders: 0,
          grossRevenue: 0,
          refunds: 0,
          revenue: 0,
          subtotal: 0,
          shipping: 0,
          discounts: 0,
          taxes: 0,
        };
        row.refunds += money(event.amount);
        row.revenue = signedMoney(row.grossRevenue - row.refunds);
        dailyMap.set(date, row);
      }
    }

    return {
      ...summary,
      grossRevenue,
      refunds: money(refunds),
      refundedOrdersCount: corrections.size,
      revenue,
      averageTicket: summary.ordersCount
        ? signedMoney(revenue / summary.ordersCount)
        : 0,
      bySource: applyCorrectionToBreakdown(
        summary.bySource,
        corrections,
        singlePartSelector('source', 'online')
      ),
      byChannel: applyCorrectionToBreakdown(
        summary.byChannel,
        corrections,
        singlePartSelector('channel', 'web')
      ),
      bySaleType: applyCorrectionToBreakdown(
        summary.bySaleType,
        corrections,
        singlePartSelector('saleType', 'online_order')
      ),
      byPaymentMethod: applyCorrectionToBreakdown(
        summary.byPaymentMethod,
        corrections,
        (order, amount) => getOrderPaymentParts(order, amount)
      ),
      daily: [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  return {
    applySalesCorrections,
    correctionTotal,
    loadFinancialCorrectionContext,
  };
}

module.exports = { createRevenueFacts };
