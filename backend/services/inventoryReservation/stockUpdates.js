const {
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = require('../../lib/products/productVariantConfig');
const { createServiceError } = require('./support');

function buildReservationStockUpdate(quantityToReserve) {
  return [
    {
      $set: {
        reservedStock: {
          $add: [
            {
              $ifNull: ['$reservedStock', 0],
            },
            quantityToReserve,
          ],
        },
        availableStock: {
          $max: [
            0,
            {
              $subtract: [
                '$stock',
                {
                  $add: [
                    {
                      $ifNull: ['$reservedStock', 0],
                    },
                    quantityToReserve,
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  ];
}

function resolveReservationStockVariant(stock, requestedVariantKey = '') {
  const stockIdentity = resolveVariantIdentity({
    variantKey: stock?.variantKey,
    size: stock?.variant?.size,
    color: stock?.variant?.color,
    attributes: stock?.variant?.attributes || [],
  });
  const requestedKey = canonicalizeVariantKey(requestedVariantKey);

  if (requestedVariantKey && requestedKey !== stockIdentity.variantKey) {
    throw createServiceError(
      'La variante solicitada no coincide con la fila de inventario seleccionada.',
      'VARIANT_KEY_MISMATCH',
      {
        inventoryStock: String(stock?._id || ''),
        requestedVariantKey,
        stockVariantKey: stockIdentity.variantKey,
      },
      409
    );
  }

  return stockIdentity;
}

function buildReleaseStockUpdate(quantityToRelease) {
  return [
    {
      $set: {
        reservedStock: {
          $max: [
            0,
            {
              $subtract: [
                {
                  $ifNull: ['$reservedStock', 0],
                },
                quantityToRelease,
              ],
            },
          ],
        },
      },
    },
    {
      $set: {
        availableStock: {
          $max: [
            0,
            {
              $subtract: [
                '$stock',
                {
                  $ifNull: ['$reservedStock', 0],
                },
              ],
            },
          ],
        },
      },
    },
  ];
}

function buildConfirmStockUpdate(quantityToConfirm) {
  return [
    {
      $set: {
        stock: {
          $max: [
            0,
            {
              $subtract: ['$stock', quantityToConfirm],
            },
          ],
        },
        reservedStock: {
          $max: [
            0,
            {
              $subtract: [
                {
                  $ifNull: ['$reservedStock', 0],
                },
                quantityToConfirm,
              ],
            },
          ],
        },
      },
    },
    {
      $set: {
        availableStock: {
          $max: [
            0,
            {
              $subtract: [
                '$stock',
                {
                  $ifNull: ['$reservedStock', 0],
                },
              ],
            },
          ],
        },
      },
    },
  ];
}

module.exports = {
  buildConfirmStockUpdate,
  buildReleaseStockUpdate,
  buildReservationStockUpdate,
  resolveReservationStockVariant,
};
