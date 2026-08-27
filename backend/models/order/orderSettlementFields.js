const mongoose = require('mongoose');

const { cleanMoney } = require('./normalizers');
const {
  PaymentProcessingSchema,
  PaymentSchema,
  StoreCreditOrderSnapshotSchema,
} = require('./paymentSchemas');

function createOrderSettlementFields() {
  return {
  payment: {
    type: PaymentSchema,
    default: () => ({
      active: true,
      provider: '',
      providerLabel: '',
      mode: 'sandbox',
      currency: 'COP',
      checkoutLabel: '',
      enableWebhook: false,
      status: 'pending_gateway',
      methodType: '',
      method: '',
      methodLabel: '',
      transactionId: '',
      reference: '',
      amountInCents: 0,
      amount: 0,
      paidAt: null,
      receivedAmount: 0,
      changeAmount: 0,
      splitPayments: [],
      rawMethod: {},
    }),
  },

  storeCredit: {
    type: StoreCreditOrderSnapshotSchema,
    default: () => ({
      applied: false,
      usage: null,
      amount: 0,
      currency: 'COP',
      status: 'none',
      references: [],
    }),
  },

  paymentProcessing: {
    type: PaymentProcessingSchema,
    default: undefined,
  },

  inventoryControl: {
    reservationRequired: { type: Boolean, default: true },
    reservationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InventoryReservation',
      default: null,
    },
    discountedAtCheckout: { type: Boolean, default: true },
    restockedOnFailure: { type: Boolean, default: false },
    restockedAt: { type: Date, default: null },
  },

  refundControl: {
    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
      set: cleanMoney,
    },
    transactionCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    returnedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    restockedUnits: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRefundAt: {
      type: Date,
      default: null,
    },
    lastRefund: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderRefund',
      default: null,
    },
    reconciliationState: {
      type: String,
      enum: [
        'not_started',
        'pending',
        'action_required',
        'completed',
        'failed',
      ],
      default: 'not_started',
      index: true,
    },
    pendingActions: {
      type: [String],
      default: [],
    },
    lastReconciledAt: {
      type: Date,
      default: null,
    },
  },

  returnControl: {
    revision: {
      type: Number,
      default: 0,
      min: 0,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRequestedAt: {
      type: Date,
      default: null,
    },
    lastReturn: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'OrderReturn',
      default: null,
    },
  },
  };
}

module.exports = { createOrderSettlementFields };
