'use strict';

const POS_HELD_SALE_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ code: 1 }),
    options: Object.freeze({ unique: true, name: 'code_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ branch: 1, status: 1, updatedAt: -1 }),
    options: Object.freeze({ name: 'branch_1_status_1_updatedAt_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ cashier: 1, status: 1, updatedAt: -1 }),
    options: Object.freeze({ name: 'cashier_1_status_1_updatedAt_-1' }),
  }),
]);

module.exports = { POS_HELD_SALE_INDEX_DEFINITIONS };
