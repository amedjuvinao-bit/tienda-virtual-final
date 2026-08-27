const MAX_TAGS = 8;
const MIN_TAG_LENGTH = 2;
const MAX_TAG_LENGTH = 24;

const ORDER_SOURCES = ['online', 'admin', 'pos', 'manual', 'import', 'system'];
const ORDER_CHANNELS = ['web', 'physical_store', 'manual', 'import', 'system'];
const ORDER_SALE_TYPES = [
  'online_order',
  'pos_sale',
  'manual_order',
  'imported_order',
  'system_order',
];
const ORDER_FULFILLMENT_STATUSES = [
  'pending',
  'reserved',
  'processing',
  'delivered',
  'partially_delivered',
  'cancelled',
  'returned',
];

const LOGISTICS_SHIPMENT_STATUSES = [
  'ready_to_pick',
  'picking',
  'picked',
  'packing',
  'packed',
  'dispatched',
  'in_transit',
  'delivered',
  'exception',
  'cancelled',
];

module.exports = {
  LOGISTICS_SHIPMENT_STATUSES,
  MAX_TAGS,
  MAX_TAG_LENGTH,
  MIN_TAG_LENGTH,
  ORDER_CHANNELS,
  ORDER_FULFILLMENT_STATUSES,
  ORDER_SALE_TYPES,
  ORDER_SOURCES,
};
