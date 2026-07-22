const mongoose = require('mongoose');

const CreditNoteItemSchema = new mongoose.Schema(
  {
    productId: { type: String, default: '' },
    codeReference: { type: String, default: '' },
    name: { type: String, default: '' },
    quantity: { type: Number, default: 0 },
    price: { type: Number, default: 0 },
    taxRate: { type: String, default: '0.00' },
    isExcluded: { type: Boolean, default: false },
    reason: { type: String, default: '' },
    raw: { type: Object, default: {} },
  },
  { _id: false }
);

const BillingSyncSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['never', 'success', 'failed'],
      default: 'never',
    },
    provider: { type: String, default: '' },
    providerStatus: { type: String, default: '' },
    message: { type: String, default: '' },
    httpStatus: { type: Number, default: null },
    adminUser: { type: String, default: '' },
    lastAttemptAt: { type: Date, default: null },
    lastSuccessAt: { type: Date, default: null },
  },
  { _id: false }
);

const InvoiceEmissionSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      enum: ['processing', 'completed', 'failed'],
      default: 'processing',
    },
    source: { type: String, default: '' },
    initiatedBy: { type: String, default: 'system' },
    lockToken: { type: String, default: '', select: false },
    attempts: { type: Number, default: 1 },
    firstAttemptAt: { type: Date, default: null },
    lastAttemptAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
  },
  { _id: false }
);

const InvoiceTotalsSchema = new mongoose.Schema(
  {
    currency: { type: String, default: 'COP' },
    subtotal: { type: Number, default: 0 },
    productDiscount: { type: Number, default: 0 },
    subtotalAfterDiscount: { type: Number, default: 0 },
    originalShipping: { type: Number, default: 0 },
    shippingDiscount: { type: Number, default: 0 },
    shipping: { type: Number, default: 0 },
    totalDiscount: { type: Number, default: 0 },
    taxableBase: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false }
);

const CreditNoteSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['total', 'partial'],
      default: 'total',
    },

    status: {
      type: String,
      enum: [
        'pending',
        'sent',
        'validated',
        'rejected',
        'failed',
        'deleted',
      ],
      default: 'pending',
    },

    reasonCode: { type: String, default: '' },
    reasonText: { type: String, default: '' },

    referenceCode: { type: String, default: '' },
    billNumber: { type: String, default: '' },

    totalAmount: { type: Number, default: 0 },
    subtotal: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },

    items: {
      type: [CreditNoteItemSchema],
      default: [],
    },

    provider: {
      name: { type: String, default: 'factus' },
      status: { type: String, default: '' },
      number: { type: String, default: '' },
      cufe: { type: String, default: '' },
      isValidated: { type: Boolean, default: false },
      validatedAt: { type: String, default: '' },
      links: { type: Object, default: {} },
      raw: { type: Object, default: {} },
    },

    providerErrors: {
      type: Object,
      default: {},
    },

    errorMessage: { type: String, default: '' },

    sync: {
      type: BillingSyncSchema,
      default: () => ({}),
    },

    createdBy: { type: String, default: 'admin' },
    createdAt: { type: Date, default: Date.now },
    sentAt: Date,
    validatedAt: Date,
    rejectedAt: Date,
    failedAt: Date,
    deletedAt: Date,
  },
  { _id: true }
);

const ElectronicInvoiceSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },

    orderNumber: {
      type: String,
      required: true,
      index: true,
    },

    // Una clave estable por orden reserva la emisión antes de llamar al proveedor.
    // El índice parcial permite conservar documentos históricos que aún no la tienen.
    idempotencyKey: {
      type: String,
      trim: true,
    },

    required: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'processing',
        'generated',
        'sent',
        'accepted',
        'rejected',
        'failed',
        'error',
      ],
      default: 'pending',
      index: true,
    },

    emission: {
      type: InvoiceEmissionSchema,
      default: undefined,
    },

    totals: {
      type: InvoiceTotalsSchema,
      default: undefined,
    },

    customer: {
      documentType: String,
      documentNumber: String,
      dv: String,
      personType: String,
      firstName: String,
      lastName: String,
      businessName: String,
      email: String,
      phone: String,
      address: String,
      city: String,
      municipalityCode: String,
      department: String,
      departmentCode: String,
      country: String,
      countryCode: String,
      tributeCode: String,
    },

    fiscalInfo: {
      nit: { type: String, default: '' },
      taxRegime: { type: String, default: '' },
      legalRepresentative: { type: String, default: '' },
      billingEmail: { type: String, default: '' },
    },

    dianResolution: {
      resolutionNumber: { type: String, default: '' },
      prefix: { type: String, default: '' },
      rangeFrom: { type: Number, default: 1 },
      rangeTo: { type: Number, default: 1 },
      currentNumber: { type: Number, default: 1 },
      resolutionDate: { type: String, default: '' },
      expirationDate: { type: String, default: '' },
      documentType: { type: String, default: '' },
    },

    legalTexts: {
      invoiceLegalText: { type: String, default: '' },
      internalReceiptNote: { type: String, default: '' },
    },

    invoiceNumber: String,
    cufe: String,

    pdfUrl: String,
    xmlUrl: String,
    xmlContent: String,
    qrUrl: String,

    provider: {
      name: { type: String, default: '' },
      status: { type: String, default: '' },
      referenceCode: { type: String, default: '' },
      number: { type: String, default: '' },
      cufe: { type: String, default: '' },
      isValidated: { type: Boolean, default: false },
      validatedAt: { type: String, default: '' },
      links: { type: Object, default: {} },
      raw: { type: Object, default: {} },
    },

    dianResponse: {
      stage: { type: String, default: '' },
      environment: { type: String, default: '' },
      issueDate: { type: String, default: '' },
      issueTime: { type: String, default: '' },
      message: { type: String, default: '' },
      code: { type: String, default: '' },
      raw: { type: Object, default: {} },
    },

    errorMessage: String,

    providerErrors: {
      type: Object,
      default: {},
    },

    sync: {
      type: BillingSyncSchema,
      default: () => ({}),
    },

    creditNotes: {
      type: [CreditNoteSchema],
      default: [],
    },

    generatedAt: Date,
    sentAt: Date,
    acceptedAt: Date,
    rejectedAt: Date,
    failedAt: Date,
  },
  { timestamps: true }
);

ElectronicInvoiceSchema.index({ status: 1, createdAt: -1 });
ElectronicInvoiceSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
    name: 'uniq_electronic_invoice_idempotency_key',
  }
);
ElectronicInvoiceSchema.index({ invoiceNumber: 1 });
ElectronicInvoiceSchema.index({ cufe: 1 });
ElectronicInvoiceSchema.index({ 'creditNotes.referenceCode': 1 });
ElectronicInvoiceSchema.index({ 'creditNotes.status': 1 });

module.exports =
  mongoose.models.ElectronicInvoice ||
  mongoose.model('ElectronicInvoice', ElectronicInvoiceSchema);
