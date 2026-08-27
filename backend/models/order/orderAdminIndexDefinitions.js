'use strict';

const ORDER_ADMIN_CURSOR_INDEX_DEFINITION = Object.freeze({
  key: Object.freeze({ createdAt: -1, _id: -1 }),
  options: Object.freeze({ name: 'orders_admin_created_at_id_desc' }),
});

module.exports = { ORDER_ADMIN_CURSOR_INDEX_DEFINITION };
