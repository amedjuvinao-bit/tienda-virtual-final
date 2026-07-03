// frontend/src/admin/pos/posPreviewPayload.js

export function buildPosPreviewPayload({ branchId, cartItems = [] }) {
  return {
    branchId,
    customerMode: 'guest',
    items: cartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size || '',
      color: item.color || '',
    })),
    discount: {
      type: 'none',
      value: 0,
    },
  };
}

export function buildPosSalePayload({ branchId, cartItems = [], paymentMethod = 'cash', total = 0 }) {
  return {
    ...buildPosPreviewPayload({ branchId, cartItems }),
    registerCode: 'CAJA POS',
    payment: {
      method: paymentMethod,
      receivedAmount: Number(total || 0),
      amount: Number(total || 0),
    },
  };
}
