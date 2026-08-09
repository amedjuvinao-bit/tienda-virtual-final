'use strict';

const mongoose = require('mongoose');

const Product = require('../models/Product');
const ProductTaxonomy = require('../models/ProductTaxonomy');
const InventoryStock = require('../models/InventoryStock');
const {
  cleanMultiline,
  cleanText,
  slugify,
} = require('../lib/products/productCommercialConfig');

const MAX_TAXONOMY_SELECTION = 20;

class ProductTaxonomyInputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ProductTaxonomyInputError';
    this.status = status;
  }
}

function hasOwn(target, key) {
  return Object.prototype.hasOwnProperty.call(target || {}, key);
}

function toObjectId(value, label = 'clasificación') {
  const raw = mongoose.Types.ObjectId.isValid(value)
    ? value
    : value && typeof value === 'object'
      ? value._id || value.id
      : value;
  const text = String(raw || '').trim();

  if (!mongoose.Types.ObjectId.isValid(text)) {
    throw new ProductTaxonomyInputError(
      `La ${label} seleccionada no es válida.`
    );
  }

  return new mongoose.Types.ObjectId(text);
}

function normalizeTaxonomyIds(values, label) {
  if (!Array.isArray(values)) return [];

  const normalized = [];
  const seen = new Set();

  for (const value of values) {
    const id = toObjectId(value, label);
    const key = id.toHexString();

    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(id);

    if (normalized.length > MAX_TAXONOMY_SELECTION) {
      throw new ProductTaxonomyInputError(
        `Solo puedes seleccionar hasta ${MAX_TAXONOMY_SELECTION} ${label}.`
      );
    }
  }

  return normalized;
}

function taxonomyIdentity(value) {
  return String(value?._id || value || '');
}

function buildPath(item, byId, trail = new Set()) {
  if (!item) return '';

  const identity = taxonomyIdentity(item);
  if (!identity || trail.has(identity)) return item.name || '';

  const nextTrail = new Set(trail);
  nextTrail.add(identity);

  const parent = item.parent
    ? byId.get(taxonomyIdentity(item.parent))
    : null;

  return [buildPath(parent, byId, nextTrail), item.name]
    .filter(Boolean)
    .join(' / ');
}

function serializeTaxonomies(items = []) {
  const byId = new Map(
    items.map((item) => [taxonomyIdentity(item), item])
  );

  return items.map((item) => ({
    _id: taxonomyIdentity(item),
    kind: item.kind,
    name: item.name,
    slug: item.slug,
    description: item.description || '',
    parent: item.parent ? taxonomyIdentity(item.parent) : null,
    path:
      item.kind === 'category'
        ? buildPath(item, byId)
        : item.name,
    image: item.image || '',
    active: item.active !== false,
    sortOrder: Number(item.sortOrder || 0),
    seo: {
      title: item.seo?.title || '',
      description: item.seo?.description || '',
    },
  }));
}

async function listProductTaxonomies({
  includeInactive = false,
} = {}) {
  const filter = {
    archivedAt: null,
  };

  if (!includeInactive) {
    filter.active = { $ne: false };
  }

  const [items, legacyCategories] = await Promise.all([
    ProductTaxonomy.find(filter)
      .sort({
        kind: 1,
        sortOrder: 1,
        name: 1,
      })
      .lean(),
    Product.distinct('category', {
      archivedAt: null,
      category: { $type: 'string', $ne: '' },
    }),
  ]);
  const serialized = serializeTaxonomies(items);
  const knownNames = new Set(
    serialized
      .filter((item) => item.kind === 'category')
      .map((item) => item.name.toLowerCase())
  );

  return {
    categories: serialized.filter(
      (item) => item.kind === 'category'
    ),
    collections: serialized.filter(
      (item) => item.kind === 'collection'
    ),
    legacyCategories: legacyCategories
      .map((name) => cleanText(name, 120))
      .filter(
        (name) => name && !knownNames.has(name.toLowerCase())
      )
      .sort((a, b) => a.localeCompare(b, 'es')),
  };
}

async function validateParent({
  kind,
  parentId,
  currentId = null,
}) {
  if (kind !== 'category' || !parentId) return null;

  const parent = await ProductTaxonomy.findOne({
    _id: toObjectId(parentId, 'categoría superior'),
    kind: 'category',
    active: { $ne: false },
    archivedAt: null,
  }).lean();

  if (!parent) {
    throw new ProductTaxonomyInputError(
      'La categoría superior no existe o está inactiva.'
    );
  }

  if (currentId && taxonomyIdentity(parent) === String(currentId)) {
    throw new ProductTaxonomyInputError(
      'Una categoría no puede depender de sí misma.'
    );
  }

  if (currentId) {
    let ancestorId = parent.parent;
    const visited = new Set([taxonomyIdentity(parent)]);

    while (ancestorId) {
      const identity = taxonomyIdentity(ancestorId);

      if (identity === String(currentId)) {
        throw new ProductTaxonomyInputError(
          'La jerarquía produciría un ciclo entre categorías.'
        );
      }

      if (!identity || visited.has(identity)) break;
      visited.add(identity);

      const ancestor = await ProductTaxonomy.findOne({
        _id: ancestorId,
        kind: 'category',
        archivedAt: null,
      })
        .select('_id parent')
        .lean();

      ancestorId = ancestor?.parent || null;
    }
  }

  return parent._id;
}

async function createProductTaxonomy(payload = {}) {
  const kind = cleanText(payload.kind, 20).toLowerCase();
  const name = cleanText(payload.name, 120);

  if (!ProductTaxonomy.KINDS.includes(kind)) {
    throw new ProductTaxonomyInputError(
      'El tipo debe ser categoría o colección.'
    );
  }

  if (!name) {
    throw new ProductTaxonomyInputError(
      'El nombre es obligatorio.'
    );
  }

  const parent = await validateParent({
    kind,
    parentId: payload.parent,
  });

  try {
    return await ProductTaxonomy.create({
      kind,
      name,
      slug: slugify(payload.slug || name),
      description: cleanMultiline(payload.description, 800),
      parent,
      image: cleanText(payload.image, 1000),
      active: payload.active !== false,
      sortOrder: Math.max(
        0,
        Math.floor(Number(payload.sortOrder || 0))
      ),
      seo: payload.seo || {},
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ProductTaxonomyInputError(
        'Ya existe una clasificación con ese nombre o enlace.',
        409
      );
    }
    throw error;
  }
}

async function updateLegacyCategoryName(previousName, nextName) {
  if (!previousName || previousName === nextName) return;

  await Promise.all([
    Product.updateMany(
      {
        archivedAt: null,
        $or: [
          { category: previousName },
          { categories: previousName },
        ],
      },
      [
        {
          $set: {
            category: {
              $cond: [
                { $eq: ['$category', previousName] },
                nextName,
                '$category',
              ],
            },
            categories: {
              $map: {
                input: { $ifNull: ['$categories', []] },
                as: 'categoryName',
                in: {
                  $cond: [
                    { $eq: ['$$categoryName', previousName] },
                    nextName,
                    '$$categoryName',
                  ],
                },
              },
            },
          },
        },
      ]
    ),
    InventoryStock.updateMany(
      {
        'productSnapshot.category': previousName,
        deletedAt: null,
      },
      {
        $set: {
          'productSnapshot.category': nextName,
        },
      }
    ),
  ]);
}

async function updateProductTaxonomy(id, payload = {}) {
  const taxonomy = await ProductTaxonomy.findOne({
    _id: toObjectId(id),
    archivedAt: null,
  });

  if (!taxonomy) {
    throw new ProductTaxonomyInputError(
      'La clasificación no existe.',
      404
    );
  }

  const previousName = taxonomy.name;
  const nextKind = hasOwn(payload, 'kind')
    ? cleanText(payload.kind, 20).toLowerCase()
    : taxonomy.kind;

  if (!ProductTaxonomy.KINDS.includes(nextKind)) {
    throw new ProductTaxonomyInputError(
      'El tipo debe ser categoría o colección.'
    );
  }

  if (nextKind !== taxonomy.kind) {
    throw new ProductTaxonomyInputError(
      'No se puede cambiar una categoría a colección ni una colección a categoría.'
    );
  }

  if (hasOwn(payload, 'name')) {
    const name = cleanText(payload.name, 120);
    if (!name) {
      throw new ProductTaxonomyInputError(
        'El nombre es obligatorio.'
      );
    }
    taxonomy.name = name;
  }

  taxonomy.kind = nextKind;
  taxonomy.parent = await validateParent({
    kind: nextKind,
    parentId: hasOwn(payload, 'parent')
      ? payload.parent
      : taxonomy.parent,
    currentId: taxonomy._id,
  });

  if (hasOwn(payload, 'slug')) {
    taxonomy.slug = slugify(payload.slug || taxonomy.name);
  } else if (taxonomy.isModified('name')) {
    taxonomy.slug = slugify(taxonomy.name);
  }
  if (hasOwn(payload, 'description')) {
    taxonomy.description = cleanMultiline(
      payload.description,
      800
    );
  }
  if (hasOwn(payload, 'image')) {
    taxonomy.image = cleanText(payload.image, 1000);
  }
  if (hasOwn(payload, 'active')) {
    taxonomy.active = payload.active !== false;
  }
  if (hasOwn(payload, 'sortOrder')) {
    taxonomy.sortOrder = Math.max(
      0,
      Math.floor(Number(payload.sortOrder || 0))
    );
  }
  if (hasOwn(payload, 'seo')) {
    taxonomy.seo = payload.seo || {};
  }

  try {
    await taxonomy.save();
  } catch (error) {
    if (error?.code === 11000) {
      throw new ProductTaxonomyInputError(
        'Ya existe una clasificación con ese nombre o enlace.',
        409
      );
    }
    throw error;
  }

  if (taxonomy.kind === 'category') {
    await updateLegacyCategoryName(
      previousName,
      taxonomy.name
    );
  }

  return taxonomy;
}

async function archiveProductTaxonomy(id) {
  const taxonomyId = toObjectId(id);
  const taxonomy = await ProductTaxonomy.findOne({
    _id: taxonomyId,
    archivedAt: null,
  });

  if (!taxonomy) {
    throw new ProductTaxonomyInputError(
      'La clasificación no existe.',
      404
    );
  }

  const [productsUsingIt, childCategories] = await Promise.all([
    Product.countDocuments({
      archivedAt: null,
      $or: [
        { primaryCategoryRef: taxonomyId },
        { categoryRefs: taxonomyId },
        { collectionRefs: taxonomyId },
      ],
    }),
    ProductTaxonomy.countDocuments({
      parent: taxonomyId,
      archivedAt: null,
    }),
  ]);

  if (productsUsingIt > 0 || childCategories > 0) {
    throw new ProductTaxonomyInputError(
      'No se puede retirar porque todavía está asociada a productos o subcategorías.',
      409
    );
  }

  taxonomy.active = false;
  taxonomy.archivedAt = new Date();
  await taxonomy.save();

  return taxonomy;
}

async function resolveProductTaxonomyPayload(
  payload = {},
  currentProduct = null
) {
  const taxonomyWasProvided = [
    'primaryCategoryId',
    'categoryIds',
    'collectionIds',
  ].some((key) => hasOwn(payload, key));

  if (!taxonomyWasProvided) return null;

  const categoryIds = normalizeTaxonomyIds(
    payload.categoryIds || [],
    'categorías'
  );
  const collectionIds = normalizeTaxonomyIds(
    payload.collectionIds || [],
    'colecciones'
  );
  let primaryCategoryId = payload.primaryCategoryId
    ? toObjectId(payload.primaryCategoryId, 'categoría principal')
    : null;

  if (
    primaryCategoryId &&
    !categoryIds.some((id) => id.equals(primaryCategoryId))
  ) {
    categoryIds.unshift(primaryCategoryId);
  }

  const requestedIds = [...categoryIds, ...collectionIds];
  const items = requestedIds.length
    ? await ProductTaxonomy.find({
        _id: { $in: requestedIds },
        active: { $ne: false },
        archivedAt: null,
      }).lean()
    : [];
  const byId = new Map(
    items.map((item) => [taxonomyIdentity(item), item])
  );

  if (items.length !== requestedIds.length) {
    throw new ProductTaxonomyInputError(
      'Una categoría o colección ya no está disponible.'
    );
  }

  const categories = categoryIds.map((id) => byId.get(String(id)));
  const collections = collectionIds.map((id) => byId.get(String(id)));

  if (categories.some((item) => item?.kind !== 'category')) {
    throw new ProductTaxonomyInputError(
      'La selección de categorías contiene una colección.'
    );
  }
  if (collections.some((item) => item?.kind !== 'collection')) {
    throw new ProductTaxonomyInputError(
      'La selección de colecciones contiene una categoría.'
    );
  }

  if (!primaryCategoryId && categories.length) {
    primaryCategoryId = categories[0]._id;
  }

  const primaryCategory = primaryCategoryId
    ? byId.get(String(primaryCategoryId))
    : null;
  const fallbackCategory = cleanText(
    payload.category || currentProduct?.category,
    120
  );
  const legacyCategories = categories.length
    ? categories.map((item) => item.name)
    : Array.isArray(payload.categories)
      ? payload.categories
      : currentProduct?.categories || [];

  return {
    primaryCategoryRef: primaryCategory?._id || null,
    categoryRefs: categories.map((item) => item._id),
    collectionRefs: collections.map((item) => item._id),
    category: primaryCategory?.name || fallbackCategory,
    categories: legacyCategories,
  };
}

module.exports = {
  MAX_TAXONOMY_SELECTION,
  ProductTaxonomyInputError,
  archiveProductTaxonomy,
  createProductTaxonomy,
  listProductTaxonomies,
  resolveProductTaxonomyPayload,
  serializeTaxonomies,
  updateProductTaxonomy,
};
