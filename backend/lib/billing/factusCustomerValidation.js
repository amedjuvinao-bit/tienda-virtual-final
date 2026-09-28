'use strict';

function needsFactusLastName(customer = {}) {
  return (
    customer.isFinalConsumer !== true &&
    String(customer.personType || 'natural').trim().toLowerCase() !== 'juridica' &&
    !String(customer.lastName || '').trim()
  );
}

module.exports = { needsFactusLastName };
