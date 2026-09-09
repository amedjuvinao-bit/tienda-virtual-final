'use strict';

const FINANCE_PERIOD_CLOSE_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ closeKey: 1 }),
    options: Object.freeze({ unique: true, name: 'closeKey_1_unique' }),
  }),
  Object.freeze({
    key: Object.freeze({ branch: 1, periodKey: 1 }),
    options: Object.freeze({
      unique: true,
      name: 'branch_1_periodKey_1_unique',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ certifiedAt: -1, status: 1 }),
    options: Object.freeze({ name: 'certifiedAt_-1_status_1' }),
  }),
]);

module.exports = { FINANCE_PERIOD_CLOSE_INDEX_DEFINITIONS };
