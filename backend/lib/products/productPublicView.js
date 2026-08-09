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
  'archivedAt',
  'archivedBy',
  'digitalDelivery.assetUrl',
  'digitalDelivery.customerMessage',
  'serviceDelivery.bookingUrl',
  'serviceDelivery.internalInstructions',
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
    archivedAt: null,
  };
}

const {
  getPublicFulfillmentView,
} = require('./productFulfillmentConfig');

function removeFields(target, fields) {
  for (const field of fields) {
    const parts = String(field).split('.');
    let current = target;

    for (let index = 0; index < parts.length - 1; index += 1) {
      current = current?.[parts[index]];
      if (!current || typeof current !== 'object') break;
    }

    if (current && typeof current === 'object') {
      delete current[parts[parts.length - 1]];
    }
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
    {
      ...plain,
      digitalDelivery:
        plain.digitalDelivery &&
        typeof plain.digitalDelivery === 'object'
          ? { ...plain.digitalDelivery }
          : plain.digitalDelivery,
      serviceDelivery:
        plain.serviceDelivery &&
        typeof plain.serviceDelivery === 'object'
          ? { ...plain.serviceDelivery }
          : plain.serviceDelivery,
    },
    PUBLIC_PRODUCT_PRIVATE_FIELDS
  );

  const primaryCategory =
    plain.primaryCategoryRef &&
    typeof plain.primaryCategoryRef === 'object' &&
    (plain.primaryCategoryRef.name ||
      plain.primaryCategoryRef.slug)
      ? plain.primaryCategoryRef
      : null;
  const categories = Array.isArray(plain.categoryRefs)
    ? plain.categoryRefs.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item.name || item.slug)
      )
    : [];
  const collections = Array.isArray(plain.collectionRefs)
    ? plain.collectionRefs.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          (item.name || item.slug)
      )
    : [];

  safeProduct.taxonomy = {
    primaryCategory,
    categories,
    collections,
  };
  delete safeProduct.primaryCategoryRef;
  delete safeProduct.categoryRefs;
  delete safeProduct.collectionRefs;

  if (Array.isArray(plain.commercialFields)) {
    safeProduct.commercialFields =
      plain.commercialFields.filter(
        (field) => field?.public !== false
      );
  }

  if (Array.isArray(plain.variants)) {
    safeProduct.variants = plain.variants
      .filter((variant) => variant?.active !== false)
      .map((variant) =>
        removeFields({ ...variant }, PUBLIC_VARIANT_PRIVATE_FIELDS)
      );
  }

  safeProduct.fulfillment =
    getPublicFulfillmentView(safeProduct);
  safeProduct.requiresShipping =
    safeProduct.fulfillment.requiresShipping;
  delete safeProduct.digitalDelivery;
  delete safeProduct.serviceDelivery;
  delete safeProduct.bundleComponents;

  return safeProduct;
}

module.exports = {
  PUBLIC_PRODUCT_PRIVATE_FIELDS,
  PUBLIC_VARIANT_PRIVATE_FIELDS,
  PUBLIC_PRODUCT_PROJECTION,
  buildPublicProductFilter,
  serializePublicProduct,
};
