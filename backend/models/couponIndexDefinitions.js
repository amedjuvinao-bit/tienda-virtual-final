'use strict';

const COUPON_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ code: 1 }),
    options: Object.freeze({
      name: 'code_1',
      unique: true,
      partialFilterExpression: Object.freeze({ deletedAt: null }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({ type: 1 }),
    options: Object.freeze({ name: 'type_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ status: 1 }),
    options: Object.freeze({ name: 'status_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ deletedAt: 1, createdAt: -1, code: 1 }),
    options: Object.freeze({ name: 'deletedAt_1_createdAt_-1_code_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ active: 1, status: 1, startsAt: 1, endsAt: 1 }),
    options: Object.freeze({ name: 'active_1_status_1_startsAt_1_endsAt_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ appliesTo: 1, categories: 1 }),
    options: Object.freeze({ name: 'appliesTo_1_categories_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ productIds: 1 }),
    options: Object.freeze({ name: 'productIds_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ customerIds: 1 }),
    options: Object.freeze({ name: 'customerIds_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ allowedChannels: 1 }),
    options: Object.freeze({ name: 'allowedChannels_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ branchIds: 1 }),
    options: Object.freeze({ name: 'branchIds_1' }),
  }),
]);

const COUPON_REDEMPTION_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ coupon: 1, order: 1 }),
    options: Object.freeze({ name: 'coupon_1_order_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ coupon: 1, order: 1, code: 1 }),
    options: Object.freeze({
      name: 'coupon_1_order_1_code_1_unique',
      unique: true,
      partialFilterExpression: Object.freeze({ order: Object.freeze({ $type: 'objectId' }) }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({ order: 1 }),
    options: Object.freeze({ name: 'order_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ orderNumber: 1 }),
    options: Object.freeze({ name: 'orderNumber_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ coupon: 1, status: 1, customer: 1 }),
    options: Object.freeze({ name: 'coupon_1_status_1_customer_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ coupon: 1, status: 1, customerEmail: 1 }),
    options: Object.freeze({ name: 'coupon_1_status_1_customerEmail_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ coupon: 1, status: 1, customerDocument: 1 }),
    options: Object.freeze({ name: 'coupon_1_status_1_customerDocument_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ coupon: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'coupon_1_createdAt_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ status: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'status_1_createdAt_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ status: 1, reservedAt: 1 }),
    options: Object.freeze({ name: 'status_1_reservedAt_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ coupon: 1, status: 1, createdAt: -1, _id: -1 }),
    options: Object.freeze({ name: 'coupon_1_status_1_createdAt_-1__id_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ branch: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'branch_1_createdAt_-1' }),
  }),
]);

module.exports = {
  COUPON_INDEX_DEFINITIONS,
  COUPON_REDEMPTION_INDEX_DEFINITIONS,
};
