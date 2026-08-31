'use strict';

const {
  csvCell,
} = require('../orderCsvSerializationService');

function ordersToCsv(orders) {
  const rows = [
    [
      'orderNumber',
      '_id',
      'customerName',
      'customerEmailOrPhone',
      'itemsCount',
      'totalItems',
      'subtotal',
      'total',
      'status',
      'createdAt',
      'updatedAt',
    ].join(','),
  ];

  orders.forEach((order) => {
    const customer = order.customer || {};
    rows.push(
      [
        csvCell(order.orderNumber || ''),
        csvCell(order._id),
        csvCell(
          [customer.name, customer.lastname].filter(Boolean).join(' ').trim()
        ),
        csvCell(customer.emailOrPhone || customer.email || ''),
        csvCell(order.itemsCount || 0, { trustedNumber: true }),
        csvCell(order.totalItems || 0, { trustedNumber: true }),
        csvCell(order.subtotal || 0, { trustedNumber: true }),
        csvCell(order.total || 0, { trustedNumber: true }),
        csvCell(order.status || ''),
        csvCell(order.createdAt || ''),
        csvCell(order.updatedAt || ''),
      ].join(',')
    );
  });

  return rows.join('\n');
}

module.exports = { ordersToCsv };
