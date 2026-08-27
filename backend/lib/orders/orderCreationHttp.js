'use strict';

const { SAFE_CART_ACCESS_ERROR } = require('../../services/cartAccessService');
const {
  isDuplicateKeyError,
  isDuplicateOrderNumberError,
} = require('../../services/orderCreationIdempotencyService');

function sendOrderCreationError(res, error) {
  const code = String(error?.code || '');

  if (code === 'CART_ACCESS_ALREADY_USED') {
    return res.status(404).json(SAFE_CART_ACCESS_ERROR);
  }
  if (code === 'INSUFFICIENT_STOCK') {
    return res.status(error.statusCode || 409).json({
      error: 'No hay inventario suficiente para completar la compra.',
      code,
      details: error.details || {},
    });
  }
  if (code === 'CONCURRENT_STOCK_CHANGE') {
    return res.status(error.statusCode || 409).json({
      error:
        'El inventario cambió mientras se intentaba reservar. Intenta nuevamente.',
      code,
      details: error.details || {},
    });
  }
  if (
    [
      'INVALID_PRODUCT_ID',
      'MISSING_SIZE',
      'MISSING_COLOR',
      'INVALID_QUANTITY',
      'PRODUCT_NOT_AVAILABLE',
      'PRODUCT_PRICE_INVALID',
    ].includes(code)
  ) {
    return res.status(error.statusCode || 400).json({
      error: error.message || 'Datos inválidos para reservar inventario.',
      code,
      details: error.details || {},
    });
  }
  if (code.startsWith('COUPON_')) {
    return res.status(error.statusCode || error.status || 422).json({
      ok: false,
      error: code,
      code,
      message: error.message || 'El cupón no pudo aplicarse a la orden.',
      details: error.details || null,
    });
  }
  if (code.startsWith('STORE_CREDIT_')) {
    return res.status(error.statusCode || 409).json({
      ok: false,
      error: code,
      code,
      message:
        error.message ||
        'No fue posible aplicar el saldo a favor a esta compra.',
      details: error.details || null,
    });
  }
  if (isDuplicateOrderNumberError(error)) {
    return res.status(409).json({
      error: 'DUPLICATE_ORDER',
      code: 'ORDER_NUMBER_DUP',
      message: 'Esta orden ya fue creada anteriormente.',
    });
  }
  if (code === 'ORDER_NUMBER_DUP') {
    return res.status(409).json({
      error: 'Conflicto con el número de orden. Intenta nuevamente.',
      code: 'ORDER_NUMBER_DUP',
    });
  }
  if (code === 'IDEMPOTENT_IN_PROGRESS') {
    return res.status(409).json({
      error: 'IDEMPOTENT_IN_PROGRESS',
      message:
        'Existe una solicitud idéntica en progreso. Reintenta en unos segundos.',
    });
  }
  if (isDuplicateKeyError(error)) {
    return res.status(409).json({
      error: 'IDEMPOTENCY_CONFLICT',
      message: 'La clave de idempotencia ya fue usada para este endpoint.',
    });
  }

  return res.status(500).json({ error: 'Error al guardar la orden' });
}

module.exports = { sendOrderCreationError };
