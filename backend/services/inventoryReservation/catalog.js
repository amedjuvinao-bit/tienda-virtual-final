const Branch = require('../../models/Branch');
const Product = require('../../models/Product');
const { resolveVariantIdentity } = require('../../lib/products/productVariantConfig');
const { getObjectIdValue, isValidObjectId, toObjectId } = require('./support');

async function loadProductMap(items, session) {
  const productIds = [...new Set(items.map((item) => item.productId))];

  const products = await Product.find({
    _id: {
      $in: productIds.map((productId) => toObjectId(productId, 'productId')),
    },
  })
    .select(
      'title sku image images category productType trackInventory allowBackorder bundleComponents active visible archivedAt'
    )
    .session(session)
    .lean();

  return new Map(products.map((product) => [String(product._id), product]));
}

async function expandReservableItems(
  items = [],
  {
    session = null,
    ProductModel = Product,
  } = {}
) {
  const sourceItems = Array.isArray(items) ? items : [];
  if (!sourceItems.length) return [];

  const productIds = Array.from(
    new Set(
      sourceItems
        .map((item) =>
          getObjectIdValue(
            item.productId || item.product || item._id
          )
        )
        .filter((id) => isValidObjectId(id))
    )
  );

  let query = ProductModel.find({
    _id: {
      $in: productIds.map((id) => toObjectId(id, 'productId')),
    },
  }).select(
    'title sku image productType trackInventory allowBackorder bundleComponents active visible archivedAt'
  );

  if (session && typeof query.session === 'function') {
    query = query.session(session);
  }

  const products = await query.lean();
  const productMap = new Map(
    products.map((product) => [String(product._id), product])
  );
  const expanded = [];

  for (const item of sourceItems) {
    const productId = getObjectIdValue(
      item.productId || item.product || item._id
    );
    const product = productMap.get(productId);

    if (!product) continue;

    if (product.productType === 'bundle') {
      for (const component of product.bundleComponents || []) {
        if (
          component.trackInventory === false ||
          component.allowBackorder === true
        ) {
          continue;
        }

        const componentIdentity = resolveVariantIdentity({
          variantKey: component.variantKey,
          size: component.size,
          color: component.color,
          attributes:
            component.variantAttributes || component.attributes || [],
        });

        expanded.push({
          orderItem:
            getObjectIdValue(item.orderItem || item._id) || null,
          productId: getObjectIdValue(component.product),
          title: component.title || '',
          image: component.image || '',
          sku: component.sku || '',
          size: componentIdentity.size,
          color: componentIdentity.color,
          variantLabel: component.variantLabel || '',
          variantAttributes: componentIdentity.attributes,
          variantKey: componentIdentity.variantKey,
          quantity:
            Math.max(1, Number(item.quantity || item.qty || 1)) *
            Math.max(1, Number(component.quantity || 1)),
          unitPrice: 0,
          price: 0,
          bundleParentProduct: product._id,
          bundleParentTitle: product.title || item.title || '',
        });
      }
      continue;
    }

    if (
      product.trackInventory === false ||
      product.allowBackorder === true
    ) {
      continue;
    }

    expanded.push(item);
  }

  return expanded;
}

async function loadBranchMap(branchIds, session) {
  const cleanBranchIds = [...new Set(branchIds.map(String).filter(Boolean))];

  if (cleanBranchIds.length === 0) return new Map();

  const branches = await Branch.find({
    _id: {
      $in: cleanBranchIds.map((branchId) => toObjectId(branchId, 'branchId')),
    },
  })
    .select('name code type')
    .session(session)
    .lean();

  return new Map(branches.map((branch) => [String(branch._id), branch]));
}

module.exports = {
  expandReservableItems,
  loadBranchMap,
  loadProductMap,
};
