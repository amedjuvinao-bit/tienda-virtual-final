'use strict';

function emptyFinancialSummary() {
  return {
    totalOrders: 0,
    totalSales: 0,
    pendingAmount: 0,
    paidOrders: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    averageTicket: 0,
    withoutInvoiceOrders: 0,
    ordersWithoutInvoice: 0,
    validatedInvoiceOrders: 0,
    validatedInvoices: 0,
    validatedDianOrders: 0,
  };
}

function emptyOperationalSummary() {
  return {
    total: 0,
    attention: 0,
    awaitingPayment: 0,
    prepare: 0,
    dispatch: 0,
    transit: 0,
    incidents: 0,
    slaRisk: 0,
    completed: 0,
  };
}

function normalizeOperationalSummary(row) {
  const empty = emptyOperationalSummary();
  if (!row) return empty;
  return Object.fromEntries(
    Object.keys(empty).map((key) => [key, Number(row[key] || 0)])
  );
}

function normalizeFinancialSummary(row) {
  if (!row) return emptyFinancialSummary();
  const totalOrders = Number(row.totalOrders || 0);
  const withInvoiceOrders = Number(row.withInvoiceOrders || 0);
  const invoiceRequiredOrders = Number(
    row.invoiceRequiredOrders ?? totalOrders
  );
  const validatedInvoiceOrders = Number(row.validatedInvoiceOrders || 0);
  const withoutInvoiceOrders = Math.max(
    0,
    invoiceRequiredOrders - withInvoiceOrders
  );

  return {
    totalOrders,
    totalSales: Number(row.totalSales || 0),
    pendingAmount: Number(row.pendingAmount || 0),
    paidOrders: Number(row.paidOrders || 0),
    pendingOrders: Number(row.pendingOrders || 0),
    cancelledOrders: Number(row.cancelledOrders || 0),
    averageTicket: Number(row.averageTicket || 0),
    withoutInvoiceOrders,
    ordersWithoutInvoice: withoutInvoiceOrders,
    validatedInvoiceOrders,
    validatedInvoices: validatedInvoiceOrders,
    validatedDianOrders: validatedInvoiceOrders,
  };
}

module.exports = {
  emptyFinancialSummary,
  emptyOperationalSummary,
  normalizeFinancialSummary,
  normalizeOperationalSummary,
};
