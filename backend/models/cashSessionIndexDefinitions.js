'use strict';

const CASH_SESSION_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ sessionCode: 1 }),
    options: Object.freeze({ unique: true, name: 'sessionCode_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ branch: 1, cashRegisterCode: 1, status: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'branch_1_cashRegisterCode_1_status_1',
      partialFilterExpression: Object.freeze({ status: 'open' }),
    }),
  }),
  Object.freeze({
    key: Object.freeze({ branch: 1, status: 1, openedAt: -1 }),
    options: Object.freeze({ name: 'branch_1_status_1_openedAt_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ cashier: 1, openedAt: -1 }),
    options: Object.freeze({ name: 'cashier_1_openedAt_-1' }),
  }),
]);

module.exports = { CASH_SESSION_INDEX_DEFINITIONS };
