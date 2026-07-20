'use strict';

// backend/models/Invoice.js
const mongoose = require('mongoose');

const INVOICE_DOCUMENT_TYPES = ['internal_receipt', 'electronic_invoice', 'credit_note', 'debit_note'];
const INVOICE_STATUSES = ['draft', 'issued', 'cancelled', 'failed'];
const INVOICE_ELECTRONIC_STATUSES = ['not_sent', 'pending', 'accepted', 'rejected', 'failed'];

const AdminActorSchema = new mongoose.Schema(
  {
    adminUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminUser', default: null },
    username: { type: String, trim: true, default: '' },
    displayName: { type: String, trim: true, default: '' },
    role: { type: String, trim: true, default: '' },
    adminRole: { type: String, trim: true, default: '' },
  },
  { _id: false }
);

const InvoiceItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    productId: { type: String, trim: true, default: '' },
    title: { type: String, trim: true, required: true },
    description: { type: String, trim: true, default: '' },
    sku: { type: String, trim: true, default: '' },
    color: { type: String, trim: true, default: '' },
    size: { type: String, trim: true, default: '' },
    quantity: { type: Number, min: 0, default: 1 },
    unitPrice: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    tax: {
      enabled: { type: Boolean, default: false },
      percent: { type: Number, default: 0 },
      code: { type: String, trim: true, default: '01' },
      name: { type: String, trim: true, default: 'IVA' },
    },
  },
  { _id: true }
);

const InvoiceTotalsSchema = new mongoose.Schema(
  {
    itemsSubtotal: { type: Number, min: 0, default: 0 },
    subtotal: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    shippingAmount: { type: Number, min: 0, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    total: { type: Number, min: 0, default: 0 },
    paidAmount: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const InvoiceNumberingSchema = new mongoose.Schema(
  {
    prefix: { type: String, trim: true, uppercase: true, default: 'CI' },
    number: { type: Number, min: 1, default: 1 },
    fullNumber: { type: String, trim: true, uppercase: true, required: true },
    resolutionNumber: { type: String, trim: true, default: '' },
    rangeFrom: { type: Number, default: 1 },
    rangeTo: { type: Number, default: 1 },
    resolutionDate: { type: String, trim: true, default: '' },
    expirationDate: { type: String, trim: true, default: '' },
    environment: { type: String, trim: true, default: '2' },
    source: { type: String, trim: true, default: 'site-settings.billing' },
  },
  { _id: false }
);

const InvoiceProviderSchema = new mongoose.Schema(
  {
    provider: { type: String, trim: true, default: 'mock' },
    mode: { type: String, trim: true, default: 'internal' },
    electronicStatus: { type: String, enum: INVOICE_ELECTRONIC_STATUSES, default: 'not_sent' },
    externalId: { type: String, trim: true, default: '' },
    cufe: { type: String, trim: true, default: '' },
    cude: { type: String, trim: true, default: '' },
    qrText: { type: String, default: '' },
    xmlUrl: { type: String, trim: true, default: '' },
    pdfUrl: { type: String, trim: true, default: '' },
    sentAt: { type: Date, default: null },
    response: { type: Object, default: () => ({}) },
  },
  { _id: false }
);

const InvoiceEventSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true, required: true },
    message: { type: String, trim: true, default: '' },
    by: { type: String, trim: true, default: 'system' },
    at: { type: Date, default: Date.now },
    meta: { type: Object, default: () => ({}) },
  },
  { _id: false }
);

const InvoiceSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      enum: INVOICE_DOCUMENT_TYPES,
      default: 'internal_receipt',
      index: true,
    },
    status: {
      type: String,
      enum: INVOICE_STATUSES,
      default: 'issued',
      index: true,
    },

    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    orderNumber: { type: String, trim: true, default: '', index: true },
    source: { type: String, trim: true, default: 'online', index: true },
    channel: { type: String, trim: true, default: 'web', index: true },
    saleType: { type: String, trim: true, default: 'online_order', index: true },

    numbering: { type: InvoiceNumberingSchema, required: true },
    fullNumber: { type: String, trim: true, uppercase: true, required: true, index: true },

    storeSnapshot: { type: Object, default: () => ({}) },
    fiscalSnapshot: { type: Object, default: () => ({}) },
    customerSnapshot: { type: Object, default: () => ({}) },
    billingSnapshot: { type: Object, default: () => ({}) },
    paymentSnapshot: { type: Object, default: () => ({}) },
    taxSnapshot: { type: Object, default: () => ({}) },
    couponSnapshot: { type: Object, default: () => ({}) },

    items: { type: [InvoiceItemSchema], default: [] },
    totals: { type: InvoiceTotalsSchema, default: () => ({}) },
    currency: { type: String, trim: true, uppercase: true, default: 'COP' },

    provider: { type: InvoiceProviderSchema, default: () => ({}) },

    pdf: {
      fileName: { type: String, trim: true, default: '' },
      url: { type: String, trim: true, default: '' },
      generatedAt: { type: Date, default: null },
    },

    notes: { type: String, trim: true, default: '' },
    error: {
      code: { type: String, trim: true, default: '' },
      message: { type: String, trim: true, default: '' },
      details: { type: Object, default: () => ({}) },
      at: { type: Date, default: null },
    },

    events: { type: [InvoiceEventSchema], default: [] },

    createdBy: { type: AdminActorSchema, default: null },
    updatedBy: { type: AdminActorSchema, default: null },
    cancelledBy: { type: AdminActorSchema, default: null },
    cancelledAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
    collection: 'invoices',
  }
);

InvoiceSchema.index(
  { order: 1 },
  { unique: true, partialFilterExpression: { order: { $type: 'objectId' }, deletedAt: null } }
);
InvoiceSchema.index(
  { fullNumber: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
InvoiceSchema.index({ status: 1, createdAt: -1 });
InvoiceSchema.index({ documentType: 1, createdAt: -1 });
InvoiceSchema.index({ source: 1, createdAt: -1 });
InvoiceSchema.index({ 'provider.provider': 1, 'provider.electronicStatus': 1, createdAt: -1 });

module.exports = mongoose.models.Invoice || mongoose.model('Invoice', InvoiceSchema);
module.exports.INVOICE_DOCUMENT_TYPES = INVOICE_DOCUMENT_TYPES;
module.exports.INVOICE_STATUSES = INVOICE_STATUSES;
module.exports.INVOICE_ELECTRONIC_STATUSES = INVOICE_ELECTRONIC_STATUSES;
