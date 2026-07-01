// backend/models/InventoryReservation.js

const mongoose = require('mongoose');

const { Schema } = mongoose;

const RESERVATION_STATUSES = [
  'pending',
  'confirmed',
  'released',
  'expired',
  'cancelled',
  'failed',
];

const RESERVATION_SOURCES = [
  'checkout',
  'payment',
  'admin',
  'system',
];

const reservationItemSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },

    inventoryStock: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryStock',
      required: true,
      index: true,
    },

    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      index: true,
    },

    productSnapshot: {
      title: {
        type: String,
        trim: true,
        default: '',
      },
      sku: {
        type: String,
        trim: true,
        default: '',
      },
      image: {
        type: String,
        trim: true,
        default: '',
      },
    },

    branchSnapshot: {
      name: {
        type: String,
        trim: true,
        default: '',
      },
      code: {
        type: String,
        trim: true,
        default: '',
      },
      type: {
        type: String,
        trim: true,
        default: '',
      },
    },

    size: {
      type: String,
      trim: true,
      required: true,
    },

    color: {
      type: String,
      trim: true,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    lineTotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    stockBeforeReservation: {
      type: Number,
      default: 0,
      min: 0,
    },

    reservedBeforeReservation: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableBeforeReservation: {
      type: Number,
      default: 0,
      min: 0,
    },

    saleMovement: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryMovement',
      default: null,
    },

    releasedAt: {
      type: Date,
      default: null,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: true,
    timestamps: false,
  }
);

const inventoryReservationSchema = new Schema(
  {
    reservationCode: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },

    sessionId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },

    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
      default: null,
    },

    orderNumber: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },

    paymentReference: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },

    paymentTransactionId: {
      type: String,
      trim: true,
      index: true,
      default: '',
    },

    source: {
      type: String,
      enum: RESERVATION_SOURCES,
      default: 'checkout',
      index: true,
    },

    status: {
      type: String,
      enum: RESERVATION_STATUSES,
      default: 'pending',
      index: true,
    },

    items: {
      type: [reservationItemSchema],
      default: [],
      validate: {
        validator(items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: 'La reserva debe tener al menos un producto.',
      },
    },

    totalQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    total: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      trim: true,
      uppercase: true,
      default: 'COP',
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    confirmedAt: {
      type: Date,
      default: null,
    },

    releasedAt: {
      type: Date,
      default: null,
    },

    expiredAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    failedAt: {
      type: Date,
      default: null,
    },

    releaseReason: {
      type: String,
      trim: true,
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      default: '',
    },

    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

inventoryReservationSchema.index({
  status: 1,
  expiresAt: 1,
});

inventoryReservationSchema.index({
  sessionId: 1,
  status: 1,
});

inventoryReservationSchema.index({
  order: 1,
  status: 1,
});

inventoryReservationSchema.index({
  paymentReference: 1,
  status: 1,
});

inventoryReservationSchema.index({
  'items.product': 1,
  'items.branch': 1,
  'items.size': 1,
  'items.color': 1,
  status: 1,
});

function getReservationReleaseDate(reservation) {
  return (
    reservation.releasedAt ||
    reservation.expiredAt ||
    reservation.cancelledAt ||
    reservation.failedAt ||
    null
  );
}

function getOrderInventoryPatchFromReservation(reservation) {
  const status = String(reservation?.status || '').trim().toLowerCase();
  const isConfirmed = status === 'confirmed';
  const isReleased = ['released', 'expired', 'cancelled', 'failed'].includes(status);

  const patch = {
    'inventoryControl.discountedAtCheckout': isConfirmed,
    'inventoryControl.restockedOnFailure': isReleased,
  };

  if (isReleased) {
    patch['inventoryControl.restockedAt'] = getReservationReleaseDate(reservation) || new Date();
  } else {
    patch['inventoryControl.restockedAt'] = null;
  }

  return patch;
}

async function syncOrderInventoryControlFromReservation(reservation) {
  if (!reservation) return;

  const orderId = reservation.order;
  const orderNumber = String(reservation.orderNumber || '').trim();

  if (!orderId && !orderNumber) return;

  const Order = mongoose.models.Order;

  if (!Order) return;

  const filter = orderId ? { _id: orderId } : { orderNumber };

  await Order.updateOne(filter, {
    $set: getOrderInventoryPatchFromReservation(reservation),
  });
}

inventoryReservationSchema.pre('validate', function calculateReservationTotals(next) {
  if (!Array.isArray(this.items)) {
    this.items = [];
  }

  this.totalQuantity = this.items.reduce((sum, item) => {
    return sum + Number(item.quantity || 0);
  }, 0);

  this.subtotal = this.items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unitPrice || 0);

    item.lineTotal = quantity * unitPrice;

    return sum + item.lineTotal;
  }, 0);

  this.total = Number(this.total || this.subtotal || 0);

  next();
});

inventoryReservationSchema.pre('validate', function generateReservationCode(next) {
  if (this.reservationCode) {
    next();
    return;
  }

  const date = new Date();
  const datePart = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');

  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  this.reservationCode = `RES-${datePart}-${randomPart}`;

  next();
});

inventoryReservationSchema.post('save', async function syncReservationOrderControl(doc) {
  try {
    await syncOrderInventoryControlFromReservation(doc);
  } catch (error) {
    console.error('❌ Error sincronizando reserva con control de inventario de orden:', {
      reservationId: doc?._id || null,
      reservationCode: doc?.reservationCode || '',
      orderNumber: doc?.orderNumber || '',
      status: doc?.status || '',
      error: error.message,
    });
  }
});

inventoryReservationSchema.methods.isExpired = function isExpired() {
  if (!this.expiresAt) return false;

  return new Date(this.expiresAt).getTime() <= Date.now();
};

inventoryReservationSchema.methods.canBeConfirmed = function canBeConfirmed() {
  return this.status === 'pending' && !this.isExpired();
};

inventoryReservationSchema.methods.canBeReleased = function canBeReleased() {
  return this.status === 'pending';
};

inventoryReservationSchema.statics.activeStatuses = function activeStatuses() {
  return ['pending'];
};

inventoryReservationSchema.statics.finalStatuses = function finalStatuses() {
  return ['confirmed', 'released', 'expired', 'cancelled', 'failed'];
};

module.exports =
  mongoose.models.InventoryReservation ||
  mongoose.model('InventoryReservation', inventoryReservationSchema);
