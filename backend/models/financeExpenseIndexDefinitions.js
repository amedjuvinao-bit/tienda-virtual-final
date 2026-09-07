'use strict';

const FINANCE_EXPENSE_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ branch: 1, status: 1, date: -1 }),
    options: Object.freeze({ name: 'branch_1_status_1_date_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ createdBy: 1, status: 1, createdAt: -1 }),
    options: Object.freeze({ name: 'createdBy_1_status_1_createdAt_-1' }),
  }),
  Object.freeze({
    key: Object.freeze({ requestKey: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'requestKey_1_unique_present',
      partialFilterExpression: Object.freeze({
        requestKey: Object.freeze({ $exists: true }),
      }),
    }),
  }),
]);

module.exports = { FINANCE_EXPENSE_INDEX_DEFINITIONS };
