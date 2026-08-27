'use strict';

const IDEMPOTENCY_KEY_INDEX_DEFINITIONS = Object.freeze([
  Object.freeze({
    key: Object.freeze({ key: 1, endpoint: 1 }),
    options: Object.freeze({ unique: true, name: 'key_1_endpoint_1' }),
  }),
  Object.freeze({
    key: Object.freeze({ createdAt: 1 }),
    options: Object.freeze({
      expireAfterSeconds: 172800,
      name: 'ttl_createdAt_48h',
    }),
  }),
  Object.freeze({
    key: Object.freeze({ status: 1 }),
    options: Object.freeze({ name: 'status_1' }),
  }),
]);

module.exports = { IDEMPOTENCY_KEY_INDEX_DEFINITIONS };
