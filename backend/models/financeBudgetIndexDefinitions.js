'use strict';

const FINANCE_COST_CENTER_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ code: 1 }),
    options: Object.freeze({ unique: true, name: 'code_1_unique' }),
  }),
  Object.freeze({
    key: Object.freeze({ status: 1, name: 1 }),
    options: Object.freeze({ name: 'status_1_name_1' }),
  }),
]);

const FINANCE_BUDGET_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ budgetKey: 1 }),
    options: Object.freeze({ unique: true, name: 'budgetKey_1_unique' }),
  }),
  Object.freeze({
    key: Object.freeze({ periodStart: 1, branch: 1, status: 1 }),
    options: Object.freeze({ name: 'periodStart_1_branch_1_status_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ costCenter: 1, periodStart: 1, status: 1 }),
    options: Object.freeze({ name: 'costCenter_1_periodStart_1_status_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ 'approvalLock.expiresAt': 1 }),
    options: Object.freeze({ name: 'approvalLock.expiresAt_1' }),
  }),
]);

const FINANCE_EXPENSE_BUDGET_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ costCenter: 1, type: 1, date: -1, status: 1 }),
    options: Object.freeze({
      name: 'costCenter_1_type_1_date_-1_status_1',
    }),
  }),
]);

module.exports = {
  FINANCE_BUDGET_INDEX_DEFINITIONS,
  FINANCE_COST_CENTER_INDEX_DEFINITIONS,
  FINANCE_EXPENSE_BUDGET_INDEX_DEFINITIONS,
};
