'use strict';

const PRODUCT_COMMERCIAL_CODE_UNIQUE_INDEXES = Object.freeze([
  Object.freeze({
    name: 'uniq_product_sku_keys',
    key: Object.freeze({ skuKeys: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({
      skuKeys: Object.freeze({ $type: 'string' }),
    }),
  }),
  Object.freeze({
    name: 'uniq_product_barcode_keys',
    key: Object.freeze({ barcodeKeys: 1 }),
    unique: true,
    partialFilterExpression: Object.freeze({
      barcodeKeys: Object.freeze({ $type: 'string' }),
    }),
  }),
]);

module.exports = {
  PRODUCT_COMMERCIAL_CODE_UNIQUE_INDEXES,
};
