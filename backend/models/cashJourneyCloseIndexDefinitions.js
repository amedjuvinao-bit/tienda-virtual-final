'use strict';

const CASH_JOURNEY_CLOSE_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ branch: 1, businessDate: 1 }),
    options: Object.freeze({ unique: true, name: 'branch_1_businessDate_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ certifiedAt: -1 }),
    options: Object.freeze({ name: 'certifiedAt_-1' }),
  }),
]);

module.exports = { CASH_JOURNEY_CLOSE_INDEX_DEFINITIONS };
