const PUBLIC_PRODUCT_PRIVATE_FIELDS = Object.freeze([
  'cost',
  'averageCost',
  'supplier',
  'notes',
  'taxRate',
  'taxIncluded',
  'reorderPoint',
  'reorderQty',
  'warehouseLocation',
  '__v',
]);

const PUBLIC_VARIANT_PRIVATE_FIELDS = Object.freeze([
  'cost',
]);

const PUBLIC_PRODUCT_PROJECTION = Object.freeze(
  [...PUBLIC_PRODUCT_PRIVATE_FIELDS, ...PUBLIC_VARIANT_PRIVATE_FIELDS.map((field) => `variants.${field}`)]
    .reduce((projection, field) => {
      projection[field] = 0;
      return projection;
    }, {})
);

function buildPublicProductFilter(criteria = {}) {
  const safeCriteria =
    criteria && typeof criteria === 'object' && !Array.isArray(criteria)
      ? criteria
      : {};

  return {
    ...safeCriteria,
    active: true,
    visible: { $ne: false },
  };
}

function removeFields(target, fields) {
  for (const field of fields) {
    delete target[field];
  }
  return target;
}

function serializePublicProduct(product) {
  if (!product) return null;

  const plain =
    typeof product.toObject === 'function'
      ? product.toObject({ virtuals: true })
      : { ...product };

  const safeProduct = removeFields(
    { ...plain },
    PUBLIC_PRODUCT_PRIVATE_FIELDS
  );

  if (Array.isArray(plain.variants)) {
    safeProduct.variants = plain.variants.map((variant) =>
      removeFields({ ...variant }, PUBLIC_VARIANT_PRIVATE_FIELDS)
    );
  }

  return safeProduct;
}

module.exports = {
  PUBLIC_PRODUCT_PRIVATE_FIELDS,
  PUBLIC_VARIANT_PRIVATE_FIELDS,
  PUBLIC_PRODUCT_PROJECTION,
  buildPublicProductFilter,
  serializePublicProduct,
};
