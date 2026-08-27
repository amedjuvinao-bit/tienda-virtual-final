const { cleanLower, cleanText, cleanUpper } = require('./normalizers');

function normalizeOrderPosInventory(order) {
  if (!order.pos || typeof order.pos !== 'object') {
    order.pos = {
      saleNumber: '',
      receiptNumber: '',
      terminalId: '',
      registerCode: '',
      shiftCode: '',
      customerMode: 'guest',
      quickSale: true,
      notes: '',
      confirmedAt: null,
    };
  } else {
    order.pos.saleNumber = cleanText(order.pos.saleNumber);
    order.pos.receiptNumber = cleanText(order.pos.receiptNumber);
    order.pos.terminalId = cleanText(order.pos.terminalId);
    order.pos.registerCode = cleanUpper(order.pos.registerCode);
    order.pos.shiftCode = cleanUpper(order.pos.shiftCode);
    order.pos.customerMode =
      cleanLower(order.pos.customerMode) === 'identified'
        ? 'identified'
        : 'guest';
    order.pos.quickSale = order.pos.quickSale !== false;
    order.pos.notes = cleanText(order.pos.notes);

    if (
      order.source === 'pos' &&
      order.payment?.status === 'paid' &&
      !order.pos.confirmedAt
    ) {
      order.pos.confirmedAt = order.payment.paidAt || new Date();
    }
  }

  if (!order.inventoryControl || typeof order.inventoryControl !== 'object') {
    order.inventoryControl = {
      discountedAtCheckout: order.source !== 'pos',
      restockedOnFailure: false,
      restockedAt: null,
    };
    return;
  }

  order.inventoryControl.discountedAtCheckout =
    order.source === 'pos'
      ? false
      : typeof order.inventoryControl.discountedAtCheckout === 'boolean'
        ? order.inventoryControl.discountedAtCheckout
        : true;

  order.inventoryControl.restockedOnFailure =
    order.inventoryControl.restockedOnFailure === true;

  order.inventoryControl.restockedAt =
    order.inventoryControl.restockedAt instanceof Date ||
    order.inventoryControl.restockedAt === null
      ? order.inventoryControl.restockedAt
      : null;
}

module.exports = { normalizeOrderPosInventory };
