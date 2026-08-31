'use strict';

const mongoose = require('mongoose');

const ManualPaymentConfirmation = require('../../models/ManualPaymentConfirmation');
const Order = require('../../models/Order');
const OrderEvent = require('../../models/OrderEvent');
const OrderNote = require('../../models/OrderNote');
const PaymentAttempt = require('../../models/PaymentAttempt');
const {
  summarizeInventoryAllocations,
} = require('../../services/orderInventoryAllocationService');
const {
  applyScenarioLogistics,
} = require('../seedPersistentOrdersTrace');
const {
  buildAttemptDrafts,
  buildExternalEvents,
  buildManualEvidenceDraft,
  buildPaymentOrderDraft,
} = require('./plan');

function linkAllocationsToItems(order) {
  order.inventoryAllocations.forEach((allocation, index) => {
    allocation.orderItem = order.items[index]?._id || order.items[0]?._id || null;
  });
  order.inventoryAllocationSummary = summarizeInventoryAllocations(
    order.inventoryAllocations
  );
}

async function persistPaymentTraceEntry(entry, runId) {
  const evidenceId = entry.manualPayment
    ? new mongoose.Types.ObjectId()
    : null;
  const order = new Order(
    buildPaymentOrderDraft(entry, runId, { evidenceId })
  );
  linkAllocationsToItems(order);
  await order.save();

  const attemptDrafts = buildAttemptDrafts(entry, order, runId);
  if (attemptDrafts.length) await PaymentAttempt.insertMany(attemptDrafts);

  const evidenceDraft = buildManualEvidenceDraft(entry, order, evidenceId);
  if (evidenceDraft) await ManualPaymentConfirmation.create(evidenceDraft);

  const eventDrafts = buildExternalEvents(entry, order, runId);
  await OrderEvent.insertMany(eventDrafts);
  await OrderNote.create({
    orderId: order._id,
    text: `TRAZA DEMO ${runId}. ${entry.label}. No representa dinero, factura ni despacho real.`,
    author: {
      name: 'Simulador de pagos de Órdenes',
      id: 'orders-payment-trace-script',
    },
    pinned: true,
    createdAt: entry.activityAt,
    updatedAt: entry.activityAt,
  });

  await applyScenarioLogistics(
    order,
    { ...entry, actions: entry.logisticsActions },
    runId
  );

  const [persisted, attemptCount, eventCount, noteCount, evidenceCount] =
    await Promise.all([
      Order.findById(order._id).lean().exec(),
      PaymentAttempt.countDocuments({ order: order._id }).exec(),
      OrderEvent.countDocuments({ orderId: order._id }).exec(),
      OrderNote.countDocuments({ orderId: order._id }).exec(),
      ManualPaymentConfirmation.countDocuments({ order: order._id }).exec(),
    ]);
  if (!persisted || persisted.sessionId !== `${runId}_${entry.key}`.slice(0, 120)) {
    throw new Error(`No se pudo verificar la orden ${entry.label}.`);
  }
  if (attemptCount !== attemptDrafts.length || eventCount !== eventDrafts.length) {
    throw new Error(`La trazabilidad relacionada quedó incompleta para ${entry.label}.`);
  }
  if (noteCount !== 1 || evidenceCount !== (entry.manualPayment ? 1 : 0)) {
    throw new Error(`Las evidencias administrativas no coinciden para ${entry.label}.`);
  }
  return {
    order: persisted,
    attempts: attemptCount,
    events: eventCount,
    notes: noteCount,
    evidence: evidenceCount,
  };
}

module.exports = { persistPaymentTraceEntry };
