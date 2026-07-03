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
