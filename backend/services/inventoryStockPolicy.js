'use strict';

function toStockNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function getStockAvailability(stockRow = {}) {
  const stock = toStockNumber(stockRow.stock);
  const reservedStock = Math.min(toStockNumber(stockRow.reservedStock), stock);

  return {
    stock,
    reservedStock,
    availableStock: Math.max(0, stock - reservedStock),
  };
}

function createInsufficientAvailableStockError({
  availableStock,
  reservedStock,
  quantity,
}) {
  const error = new Error(
    `Stock disponible insuficiente. Disponible: ${availableStock}. Reservado: ${reservedStock}. Solicitado: ${quantity}.`
  );
  error.code = 'INSUFFICIENT_AVAILABLE_STOCK';
  error.statusCode = 409;
  error.details = {
    availableStock,
    reservedStock,
    requestedQuantity: quantity,
  };
  return error;
}

function applyAvailableStockOut(stockRow, quantity) {
  const safeQuantity = Number(quantity);
  const availability = getStockAvailability(stockRow);

  if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) {
    const error = new Error('La cantidad debe ser mayor a cero.');
    error.code = 'INVALID_INVENTORY_QUANTITY';
    error.statusCode = 400;
    throw error;
  }

  if (availability.availableStock < safeQuantity) {
    throw createInsufficientAvailableStockError({
      availableStock: availability.availableStock,
      reservedStock: availability.reservedStock,
      quantity: safeQuantity,
    });
  }

  const after = availability.stock - safeQuantity;

  stockRow.stock = after;
  stockRow.reservedStock = availability.reservedStock;
  stockRow.availableStock = after - availability.reservedStock;

  return {
    before: availability.stock,
    quantity: safeQuantity,
    after,
  };
}

module.exports = {
  applyAvailableStockOut,
  createInsufficientAvailableStockError,
  getStockAvailability,
};
