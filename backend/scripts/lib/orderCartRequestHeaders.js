'use strict';

const Cart = require('../../models/Cart');
const {
  defaultCartCanonicalValidationService,
} = require('../../services/cartCanonicalValidationService');
const {
  createOrderCartSnapshotFingerprint,
} = require('../../services/orderCartSnapshotService');

async function buildOrderCartRequestHeaders({
  cartId,
  access,
  idempotencyKey,
  CartModel = Cart,
  canonicalValidationService = defaultCartCanonicalValidationService,
} = {}) {
  const cart = await CartModel.findById(cartId).exec();
  if (!cart) throw new Error('No se encontró el carrito autorizado de prueba.');
  const validation = await canonicalValidationService.validateItems(cart.items, {
    mode: 'strict',
  });
  if (!validation.ok) {
    throw new Error('El carrito de prueba no superó la validación estricta.');
  }

  return {
    'X-Session-Id': access.sessionId,
    'X-Cart-Access-Token': access.token,
    'If-Match-Updated-At': new Date(cart.updatedAt).toISOString(),
    'X-Cart-Snapshot-Fingerprint':
      createOrderCartSnapshotFingerprint(validation.items),
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

module.exports = { buildOrderCartRequestHeaders };
