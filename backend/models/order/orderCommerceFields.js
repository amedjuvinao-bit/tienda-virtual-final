const mongoose = require('mongoose');

const {
  OrderItemSchema,
  OrderVariantAttributeSchema,
  SummarySchema,
} = require('./coreSchemas');
const { cleanMoney, normalizeAttributes } = require('./normalizers');

function createOrderCommerceFields() {
  return {
  cart: {
    type: [
      {
        productId: String,
        title: String,
        image: String,
        color: String,
        colorLabel: { type: String, trim: true, default: '' },
        size: String,
        variantId: { type: String, trim: true, default: '' },
        variantKey: { type: String, trim: true, default: '' },
        variantLabel: { type: String, trim: true, default: '' },
        variantAttributes: {
          type: [OrderVariantAttributeSchema],
          default: [],
          set: normalizeAttributes,
        },
        quantity: {
          type: Number,
          default: 0,
          min: 0,
          set: (v) => Math.max(0, Math.floor(Number(v || 0))),
        },
        price: {
          type: Number,
          default: 0,
          min: 0,
          set: cleanMoney,
        },
      },
    ],
    default: [],
  },

  items: {
    type: [OrderItemSchema],
    default: [],
    validate: {
      validator(arr) {
        return Array.isArray(arr) && arr.length > 0;
      },
      message: 'La orden debe contener al menos un ítem.',
    },
    required: true,
  },

  summary: SummarySchema,
  subtotal: Number,
  shipping: Number,
  total: Number,

  taxes: {
    iva: {
      enabled: { type: Boolean, default: false },
      percent: { type: Number, default: 0 },
      code: { type: String, default: '01' },
      name: { type: String, default: 'IVA' },
      taxableBase: { type: Number, default: 0, min: 0, set: cleanMoney },
      amount: { type: Number, default: 0 },
    },
  },

  customer: {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    customerCode: { type: String, trim: true, uppercase: true, default: '' },
    name: String,
    lastname: String,
    id: String,
    documentType: String,
    emailOrPhone: String,
    email: String,
    phone: String,
    address: String,
    city: String,
    municipalityCode: String,
    municipalityId: String,
    municipality_id: String,
    postalCode: String,
    country: String,
    countryCode: String,
    department: String,
    departmentCode: String,
    deliveryType: String,
    wantsNewsletter: Boolean,
    isFinalConsumer: Boolean,
  },

  customerRelationship: {
    linkedAt: { type: Date, default: null },
    statsAppliedAt: { type: Date, default: null },
    source: {
      type: String,
      enum: ['', 'web', 'pos'],
      default: '',
    },
    matchedBy: {
      type: String,
      enum: ['', 'customer_id', 'document', 'email', 'phone', 'created'],
      default: '',
    },
  },

  billing: {
    useSameAddress: Boolean,
    isFinalConsumer: Boolean,
    personType: String,
    firstName: String,
    lastName: String,
    name: String,
    lastname: String,
    id: String,
    documentNumber: String,
    documentType: String,
    dv: String,
    businessName: String,
    address: String,
    city: String,
    cityCode: String,
    municipalityCode: String,
    department: String,
    departmentCode: String,
    postalCode: String,
    phone: String,
    email: String,
    extra: String,
    country: String,
    countryCode: String,
    tributeCode: String,
  },
  };
}

module.exports = { createOrderCommerceFields };
