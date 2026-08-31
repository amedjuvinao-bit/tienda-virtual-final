const mongoose = require('mongoose');

const OrderCustomerNotificationSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    sourceEventId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    sourceEventType: {
      type: String,
      trim: true,
      default: 'order_snapshot',
    },
    channel: {
      type: String,
      enum: ['whatsapp'],
      required: true,
      default: 'whatsapp',
    },
    status: {
      type: String,
      enum: ['opened'],
      required: true,
      default: 'opened',
    },
    templateVersion: {
      type: String,
      trim: true,
      required: true,
    },
    fingerprint: {
      type: String,
      trim: true,
      required: true,
    },
    recipientMasked: {
      type: String,
      trim: true,
      default: '',
    },
    stage: {
      type: String,
      trim: true,
      default: '',
    },
    openCount: {
      type: Number,
      min: 0,
      default: 0,
    },
    firstOpenedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastOpenedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    lastOpenedBy: {
      id: { type: String, trim: true, default: '' },
      label: { type: String, trim: true, default: 'admin' },
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

OrderCustomerNotificationSchema.index(
  {
    orderId: 1,
    sourceEventId: 1,
    channel: 1,
    fingerprint: 1,
  },
  {
    unique: true,
    name: 'order_customer_notification_idempotency',
  }
);

module.exports =
  mongoose.models.OrderCustomerNotification ||
  mongoose.model(
    'OrderCustomerNotification',
    OrderCustomerNotificationSchema
  );
