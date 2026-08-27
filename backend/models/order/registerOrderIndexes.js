const {
  ORDER_ADMIN_CURSOR_INDEX_DEFINITION,
} = require('./orderAdminIndexDefinitions');
const {
  ORDER_POST_COMMIT_INDEX_DEFINITIONS,
} = require('./orderPostCommitIndexDefinitions');

function registerOrderIndexes(OrderSchema) {
  OrderSchema.index(
    { ...ORDER_ADMIN_CURSOR_INDEX_DEFINITION.key },
    { ...ORDER_ADMIN_CURSOR_INDEX_DEFINITION.options }
  );
  OrderSchema.index({ sessionId: 1, createdAt: -1 });
  OrderSchema.index({ 'customer.customerId': 1, createdAt: -1 });
  OrderSchema.index({ status: 1, createdAt: -1 });
  OrderSchema.index({ fulfillmentStatus: 1, createdAt: -1 });
  OrderSchema.index({ 'timeline.type': 1, createdAt: -1 });
  OrderSchema.index({ tags: 1, createdAt: -1 });
  OrderSchema.index({ printed: 1, createdAt: -1 });
  OrderSchema.index({ archived: 1, createdAt: -1 });
  OrderSchema.index({ 'payment.provider': 1, createdAt: -1 });
  OrderSchema.index({ 'payment.status': 1, createdAt: -1 });
  OrderSchema.index({ 'payment.method': 1, createdAt: -1 });
  OrderSchema.index({ 'payment.transactionId': 1 }, { sparse: true });
  OrderSchema.index({ 'payment.reference': 1 }, { sparse: true });
  OrderSchema.index({ branch: 1, createdAt: -1 });
  OrderSchema.index({ 'inventoryAllocations.branch': 1, createdAt: -1 });
  OrderSchema.index(
    {
      'fulfillment.shipments.branch': 1,
      'fulfillment.shipments.status': 1,
      'fulfillment.shipments.sla.dispatchDueAt': 1,
    },
    { name: 'orders_logistics_branch_status_sla' }
  );
  OrderSchema.index(
    { 'fulfillment.shipments.carrier.trackingNumber': 1 },
    {
      name: 'orders_shipping_tracking_number',
      partialFilterExpression: {
        'fulfillment.shipments.carrier.trackingNumber': { $gt: '' },
      },
    }
  );
  OrderSchema.index(
    { branch: 1, status: 1, createdAt: -1 },
    { name: 'orders_admin_branch_status_date' }
  );
  OrderSchema.index(
    { 'inventoryAllocations.branch': 1, status: 1, createdAt: -1 },
    { name: 'orders_admin_allocation_status_date' }
  );
  OrderSchema.index(
    { archived: 1, status: 1, createdAt: -1 },
    { name: 'orders_admin_archive_status_date' }
  );
  OrderSchema.index({
    'inventoryAllocationSummary.splitAcrossBranches': 1,
    createdAt: -1,
  });
  OrderSchema.index({ source: 1, createdAt: -1 });
  OrderSchema.index({ channel: 1, createdAt: -1 });
  OrderSchema.index({ saleType: 1, createdAt: -1 });
  OrderSchema.index({ createdByAdmin: 1, createdAt: -1 });
  OrderSchema.index({ cashier: 1, createdAt: -1 });
  OrderSchema.index({ cashSession: 1, createdAt: -1 });
  OrderSchema.index({ cashRegister: 1, createdAt: -1 });
  OrderSchema.index({ 'branchSnapshot.code': 1, createdAt: -1 });
  OrderSchema.index({ 'pos.receiptNumber': 1 }, { sparse: true });
  OrderSchema.index({ 'pos.saleNumber': 1 }, { sparse: true });
  ORDER_POST_COMMIT_INDEX_DEFINITIONS.forEach(({ key, options }) => {
    OrderSchema.index({ ...key }, { ...options });
  });
}

module.exports = { registerOrderIndexes };
