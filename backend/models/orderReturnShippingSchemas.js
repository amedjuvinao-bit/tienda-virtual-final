'use strict';

const mongoose = require('mongoose');
const {
  LogisticsPackageSchema,
  ShippingIntegrationSchema,
} = require('./order/fulfillmentSupportSchemas');

const ReturnDestinationSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '', maxlength: 140 },
    code: { type: String, trim: true, uppercase: true, default: '', maxlength: 30 },
    phone: { type: String, trim: true, default: '', maxlength: 40 },
    email: { type: String, trim: true, lowercase: true, default: '', maxlength: 160 },
    addressLine: { type: String, trim: true, default: '', maxlength: 250 },
    neighborhood: { type: String, trim: true, default: '', maxlength: 100 },
    city: { type: String, trim: true, default: '', maxlength: 100 },
    cityCode: { type: String, trim: true, default: '', maxlength: 20 },
    department: { type: String, trim: true, default: '', maxlength: 80 },
    departmentCode: { type: String, trim: true, default: '', maxlength: 20 },
    country: { type: String, trim: true, default: '', maxlength: 80 },
    postalCode: { type: String, trim: true, default: '', maxlength: 30 },
  },
  { _id: false }
);

const ReturnOriginSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '', maxlength: 180 },
    email: { type: String, trim: true, lowercase: true, default: '', maxlength: 160 },
    phone: { type: String, trim: true, default: '', maxlength: 80 },
    addressLine: { type: String, trim: true, default: '', maxlength: 250 },
    city: { type: String, trim: true, default: '', maxlength: 120 },
    departmentCode: { type: String, trim: true, default: '', maxlength: 20 },
    countryCode: { type: String, trim: true, uppercase: true, default: '', maxlength: 2 },
    postalCode: { type: String, trim: true, default: '', maxlength: 30 },
  },
  { _id: false }
);

const OrderReturnShippingSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['pending', 'drop_off', 'carrier', 'customer_arranged'],
      default: 'pending',
    },
    carrierName: { type: String, trim: true, default: '', maxlength: 160 },
    trackingNumber: { type: String, trim: true, default: '', maxlength: 180 },
    trackingUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    labelUrl: { type: String, trim: true, default: '', maxlength: 1000 },
    labelType: {
      type: String,
      enum: ['none', 'internal_rma', 'carrier'],
      default: 'none',
    },
    instructions: { type: String, trim: true, default: '', maxlength: 1600 },
    destinationBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
    destinationSnapshot: {
      type: ReturnDestinationSnapshotSchema,
      default: () => ({}),
    },
    originSnapshot: {
      type: ReturnOriginSnapshotSchema,
      default: () => ({}),
    },
    packages: { type: [LogisticsPackageSchema], default: [] },
    integration: { type: ShippingIntegrationSchema, default: () => ({}) },
    carrierDeliveredAt: { type: Date, default: null },
    awaitingWarehouseReceipt: { type: Boolean, default: false },
  },
  { _id: false }
);

module.exports = {
  OrderReturnShippingSchema,
  ReturnDestinationSnapshotSchema,
  ReturnOriginSnapshotSchema,
};
