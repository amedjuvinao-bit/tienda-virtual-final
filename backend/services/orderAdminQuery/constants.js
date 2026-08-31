'use strict';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'total', 'orderNumber']);
const PAID_STATUSES = ['paid', 'shipped', 'delivered'];
const PENDING_STATUSES = ['pending', 'processing'];
const CANCELLED_STATUSES = ['cancelled', 'canceled'];
const VALIDATED_INVOICE_STATUSES = ['validated', 'validada', 'validado'];
const OPERATIONAL_VIEWS = new Set([
  'all',
  'attention',
  'awaiting_payment',
  'prepare',
  'dispatch',
  'transit',
  'incidents',
  'sla_risk',
  'completed',
]);
const PREPARATION_SHIPMENT_STATUSES = [
  'ready_to_pick',
  'picking',
  'picked',
  'packing',
];
const TRANSIT_SHIPMENT_STATUSES = ['dispatched', 'in_transit'];
const ACTIVE_SLA_SHIPMENT_STATUSES = [
  ...PREPARATION_SHIPMENT_STATUSES,
  'packed',
  ...TRANSIT_SHIPMENT_STATUSES,
];

const STATUS_CANON = new Map([
  ['pendiente', 'pending'],
  ['pending', 'pending'],
  ['procesando', 'processing'],
  ['processing', 'processing'],
  ['pagado', 'paid'],
  ['pagada', 'paid'],
  ['paid', 'paid'],
  ['fallido', 'failed'],
  ['rechazado', 'failed'],
  ['failed', 'failed'],
  ['enviado', 'shipped'],
  ['enviada', 'shipped'],
  ['shipped', 'shipped'],
  ['entregado', 'delivered'],
  ['entregada', 'delivered'],
  ['delivered', 'delivered'],
  ['cancelado', 'cancelled'],
  ['cancelada', 'cancelled'],
  ['cancelled', 'cancelled'],
  ['canceled', 'cancelled'],
  ['reembolsado', 'refunded'],
  ['reembolsada', 'refunded'],
  ['refunded', 'refunded'],
]);

const ALLOWED_STATUSES = new Set([
  'pending',
  'processing',
  'paid',
  'failed',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
]);

const DIAN_VALIDATED_INVOICE_CRITERIA = [
  { cufe: { $exists: true, $nin: ['', null] } },
  { invoiceNumber: { $exists: true, $nin: ['', null] } },
  { validatedAt: { $exists: true, $nin: ['', null] } },
  { 'provider.cufe': { $exists: true, $nin: ['', null] } },
  { 'provider.number': { $exists: true, $nin: ['', null] } },
  { 'provider.isValidated': true },
  { 'provider.validatedAt': { $exists: true, $nin: ['', null] } },
  { 'provider.raw.cufe': { $exists: true, $nin: ['', null] } },
  { 'provider.raw.number': { $exists: true, $nin: ['', null] } },
  { 'provider.raw.is_validated': true },
  { 'provider.raw.validated_at': { $exists: true, $nin: ['', null] } },
  { 'dianResponse.raw.data.data.cufe': { $exists: true, $nin: ['', null] } },
  { 'dianResponse.raw.data.data.number': { $exists: true, $nin: ['', null] } },
  { 'dianResponse.raw.data.data.is_validated': true },
  { 'dianResponse.raw.data.data.validated_at': { $exists: true, $nin: ['', null] } },
];

const INVOICE_FILTER_CRITERIA = {
  validated: DIAN_VALIDATED_INVOICE_CRITERIA,
  pending: [
    { status: { $in: ['pending', 'sent', 'processing'] } },
    { 'provider.status': { $in: ['pending', 'sent', 'processing'] } },
  ],
  rejected: [
    { status: { $in: ['rejected', 'failed', 'error'] } },
    { 'provider.status': { $in: ['rejected', 'failed', 'error'] } },
    { errors: { $exists: true, $ne: [] } },
    { providerErrors: { $exists: true, $ne: [] } },
  ],
  credit_note: [
    { creditNotes: { $exists: true, $ne: [] } },
    { 'creditNotes.0': { $exists: true } },
  ],
};

module.exports = {
  ACTIVE_SLA_SHIPMENT_STATUSES,
  ALLOWED_SORT_FIELDS,
  ALLOWED_STATUSES,
  CANCELLED_STATUSES,
  DEFAULT_PAGE_SIZE,
  INVOICE_FILTER_CRITERIA,
  MAX_PAGE_SIZE,
  OPERATIONAL_VIEWS,
  PAID_STATUSES,
  PENDING_STATUSES,
  PREPARATION_SHIPMENT_STATUSES,
  STATUS_CANON,
  TRANSIT_SHIPMENT_STATUSES,
  VALIDATED_INVOICE_STATUSES,
};
