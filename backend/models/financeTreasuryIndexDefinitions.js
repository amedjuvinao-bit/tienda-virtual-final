'use strict';

const FINANCE_TREASURY_EXPENSE_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({
      branch: 1,
      paymentTerms: 1,
      'settlement.status': 1,
      dueDate: 1,
    }),
    options: Object.freeze({
      name: 'branch_1_paymentTerms_1_settlement.status_1_dueDate_1',
    }),
  }),
]);

const FINANCE_TREASURY_ORDER_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ branch: 1, 'payment.status': 1, createdAt: 1 }),
    options: Object.freeze({
      name: 'branch_1_payment.status_1_createdAt_1',
    }),
  }),
]);

module.exports = {
  FINANCE_TREASURY_EXPENSE_INDEX_DEFINITIONS,
  FINANCE_TREASURY_ORDER_INDEX_DEFINITIONS,
};
