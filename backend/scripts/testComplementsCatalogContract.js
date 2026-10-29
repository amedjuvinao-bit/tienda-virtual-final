"use strict";
const assert = require("node:assert/strict");
const Page = require("../models/Page");
const router = require("../routes/pages");
const pages = new Map();
let nextId = 1;
const id = () => (nextId++).toString(16).padStart(24, "0");
function insert(value) {
  const page = { _id: id(), ...value, save: async () => page };
  pages.set(page._id, page);
  return page;
}
Page.findOne = async (query) =>
  [...pages.values()].find(
    (page) =>
      page.slug === query.slug &&
      (!query._id?.$ne || page._id !== query._id.$ne),
  ) || null;
Page.create = async (value) => insert(value);
Page.find = () => ({ sort: async () => [...pages.values()] });
Page.findById = async (key) => pages.get(key) || null;
Page.findOneAndUpdate = async (query, update) => {
  let page = await Page.findOne(query);
  if (!page) page = insert({ slug: query.slug, ...update.$setOnInsert });
  if (update.$set) Object.assign(page, update.$set);
  return page;
};
Page.findByIdAndUpdate = async (key, value) => {
  const page = pages.get(key);
  Object.assign(page, value);
  return page;
};
Page.findByIdAndDelete = async (key) => {
  const page = pages.get(key);
  pages.delete(key);
  return page;
};
async function call(method, path, req = {}) {
  const layer = router.stack.find(
    (layer) => layer.route?.path === path && layer.route.methods[method],
  );
  let body,
    status = 200;
  const res = {
    status(value) {
      status = value;
      return this;
    },
    json(value) {
      body = value;
      return this;
    },
  };
  await layer.route.stack[0].handle({ params: {}, body: {}, ...req }, res);
  return { status, body };
}
(async () => {
  let checks = 0;
  const list = await call("get", "/");
  const page = list.body.find((p) => p.slug === "complementos");
  assert(page);
  assert.equal(page.pageType, "catalog");
  assert.equal(page.catalogConfig.sourceMode, "categories");
  assert.equal(page.catalogConfig.allowedCategoriesText, "Complementos");
  assert.equal(page.catalogConfig.manualProductIdsText, "");
  assert.deepEqual(page.blocks, []);
  checks++;
  await call("get", "/");
  assert.equal(
    [...pages.values()].filter((p) => p.slug === "complementos").length,
    1,
  );
  assert.equal(
    (await call("get", "/:value", { params: { value: "complementos" } })).body
      ._id,
    page._id,
  );
  checks++;
  const config = {
    ...page.catalogConfig,
    title: "Selección propia",
    allowedCategoriesText: "Complementos, Detalles",
    collection: { ...page.catalogConfig.collection, extension: true },
    extension: { keep: true },
  };
  const saved = await call("put", "/:id", {
    params: { id: page._id },
    body: {
      name: "Selección",
      slug: "otra-direccion",
      pageType: "custom",
      catalogConfig: config,
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.slug, "complementos");
  assert.equal(saved.body.pageType, "catalog");
  assert.deepEqual(saved.body.catalogConfig, config);
  checks++;
  await call("get", "/");
  assert.deepEqual(page.catalogConfig, config);
  assert.equal(
    (await call("delete", "/:id", { params: { id: page._id } })).status,
    400,
  );
  assert.equal(
    (
      await call("post", "/", {
        body: { name: "Duplicada", slug: "complementos", pageType: "catalog" },
      })
    ).status,
    400,
  );
  checks++;
  const other = insert({ name: "Otra", slug: "otra", pageType: "catalog" });
  assert.equal(
    (
      await call("put", "/:id", {
        params: { id: other._id },
        body: { name: "Otra", slug: "complementos", pageType: "catalog" },
      })
    ).status,
    400,
  );
  checks++;
  const {
    buildPublicProductListFilter,
    parsePublicProductListQuery,
  } = require("../services/productListQueryService");
  const filter = buildPublicProductListFilter(
    parsePublicProductListQuery({
      categoryScope: "Complementos",
      category: "Detalles",
    }),
  );
  assert.equal(filter.active, true);
  assert.equal(filter.archivedAt, null);
  assert.equal(filter.$and.length, 2);
  assert(filter.$and[1].$or[0].category.$in[0].test("Complementos"));
  assert(!filter.$and[1].$or[0].category.$in[0].test("Ropa"));
  checks++;
  console.log(
    `PASS ${checks} grupos de Complementos: creación única, ruta, edición y conservación, protecciones y ámbito de categorías sin productos de ejemplo`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
