'use strict';
const assert = require('node:assert/strict');
const { attachPublicCatalogAvailability } = require('../services/publicCatalogAvailabilityService');
const { listPublicProductFacets, ProductListQueryError } = require('../services/productListQueryService');
const mongoose = require('mongoose');
async function run() {
  assert.equal(mongoose.connection.readyState, 0);
  const ids = ['68a4a78a59706e44cade0501', '68a4a78a59706e44cade0502'];
  let queries = 0, pipeline;
  const products = [{ _id: ids[0], variants: [{ variantKey: 's__rojo' }, { variantKey: 'm__rojo' }] }, { _id: ids[1], variants: [] }, { _id: 'digital', productType: 'digital', variants: [] }, { _id: 'service', productType: 'service' }, { _id: 'not-tracked', trackInventory: false }];
  const enriched = await attachPublicCatalogAvailability(products, { StockModel: { aggregate: async value => { queries++; pipeline = value; return [{ _id: { product: ids[0], variantKey: 's__rojo' }, availableStock: 5 }]; } } });
  assert.equal(queries, 1);
  assert.equal(pipeline[0].$match.product.$in.length, 2);
  assert.equal(pipeline[0].$match.deletedAt, null);
  assert.deepEqual(pipeline[0].$match.active, { $ne: false });
  assert.equal(enriched[0].availableStock, 5);
  assert.deepEqual(enriched[0].variants.map(v => v.availableStock), [5, 0]);
  assert.equal(enriched[1].availableStock, 0);
  assert.equal(enriched[2].inventoryTracked, false);
  assert.equal(enriched[3].availableStock, null);
  assert.equal(enriched[4].inventoryTracked, false);
  assert.equal(products[0].variants[0].availableStock, undefined);
  await attachPublicCatalogAvailability(products.slice(2), { StockModel: { aggregate: () => { throw Error('Must not query untracked products'); } } });
  const filters = [];
  const model = { distinct: async (field, filter) => { filters.push(filter); return field === 'categories' ? ['Hogar', 'hogar'] : []; } };
  const facets = await listPublicProductFacets({ ProductModel: model, query: { categoryScope: 'Hogar', productKeys: 'uno', status: 'draft', category: 'No debe reducir las opciones' } });
  assert.deepEqual(facets.categories, ['Hogar']);
  for (const filter of filters) {
    assert.equal(filter.active, true); assert.deepEqual(filter.visible, { $ne: false }); assert.equal(filter.archivedAt, null);
    assert.equal(filter.$and.length, 2);
    assert.deepEqual(filter.$and[1].$or[0].slug.$in, ['uno']);
  }
  await assert.rejects(() => listPublicProductFacets({ ProductModel: model, query: { categoryScope: Array.from({ length: 31 }, (_, i) => `Category ${i}`) } }), ProductListQueryError);
  assert.equal(mongoose.connection.readyState, 0);
  console.log('OK Catalog Plus: scoped public facets, bounded batch availability, canonical variants, services, digital products and empty stock.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
