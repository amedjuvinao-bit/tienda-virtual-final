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
  // A new category starts from the saved catalogue appearance, without inheriting its products.
  const firstBautizos = [...pages.values()].find(p => p.slug === "bautizos");
  assert(firstBautizos);
  pages.delete(firstBautizos._id);
  page.catalogConfig = {
    ...config,
    sourceMode: "manual",
    manualProductIdsText: "otro-producto",
    initialCategoriesText: "Detalles",
    presentation: { ...config.presentation, glassColor: "#b46a85", radius: 19 },
    collection: { ...config.collection, artworkWidthPx: 240 },
  };
  const { body: bautizos } = await call("get", "/:value", { params: { value: "bautizos" } });
  assert.equal(bautizos.pageType, "catalog");
  assert.equal(bautizos.catalogConfig.title, "Bautizos");
  assert.equal(bautizos.catalogConfig.allowedCategoriesText, "Bautizos");
  assert.equal(bautizos.catalogConfig.sourceMode, "categories");
  assert.equal(bautizos.catalogConfig.manualProductIdsText, "");
  assert.equal(bautizos.catalogConfig.initialCategoriesText, "");
  assert.equal(bautizos.catalogConfig.presentation.glassColor, "#b46a85");
  assert.equal(bautizos.catalogConfig.presentation.radius, 19);
  assert.equal(bautizos.catalogConfig.collection.artworkWidthPx, 240);
  assert.equal(bautizos.catalogConfig.collection.searchPlaceholder, "Buscar en Bautizos…");
  assert.deepEqual(bautizos.catalogConfig.extension, { keep: true });
  assert.notStrictEqual(bautizos.catalogConfig.presentation, page.catalogConfig.presentation);
  checks++;
  const ownConfig = { ...bautizos.catalogConfig, title: "Ceremonias", extension: { keep: "own" } };
  const updated = await call("put", "/:id", {
    params: { id: bautizos._id },
    body: { name: "Ceremonias", slug: "otra", pageType: "custom", catalogConfig: ownConfig },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.slug, "bautizos");
  assert.equal(updated.body.pageType, "catalog");
  page.catalogConfig.presentation.glassColor = "#123456";
  await call("get", "/");
  assert.deepEqual(updated.body.catalogConfig, ownConfig);
  assert.equal([...pages.values()].filter(p => p.slug === "bautizos").length, 1);
  assert.equal((await call("delete", "/:id", { params: { id: bautizos._id } })).status, 400);
  assert.equal((await call("post", "/", { body: { name: "Otra", slug: "bautizos", pageType: "catalog" } })).status, 400);
  assert.equal((await call("put", "/:id", { params: { id: other._id }, body: { name: "Otra", slug: "bautizos", pageType: "catalog" } })).status, 400);
  checks++;
  const { CATALOG_PAGES } = require("../services/pages/catalogPages");
  for (const slug of ["vestidos", "jeans", "calzado"]) {
    const definition = CATALOG_PAGES.find(item => item.slug === slug);
    const first = [...pages.values()].find(item => item.slug === slug);
    assert(first);
    pages.delete(first._id);
    const originalConfig = structuredClone(page.catalogConfig);
    const result = await call("get", "/:value", { params: { value: slug } });
    assert.equal(result.status, 200);
    const selection = result.body;
    assert.equal(selection.pageType, "catalog");
    assert.equal(selection.catalogConfig.title, definition.name);
    assert.equal(selection.catalogConfig.sourceMode, "categories");
    assert.equal(selection.catalogConfig.allowedCategoriesText, definition.category);
    assert.equal(selection.catalogConfig.initialCategoriesText, "");
    assert.equal(selection.catalogConfig.manualProductIdsText, "");
    assert.equal(selection.catalogConfig.collection.heroArtwork, "");
    assert.equal(selection.catalogConfig.collection.heroArtworkAlt, "");
    assert.deepEqual(selection.catalogConfig.presentation, originalConfig.presentation);
    assert.notStrictEqual(selection.catalogConfig.presentation, page.catalogConfig.presentation);
    const editedConfig = {
      ...selection.catalogConfig,
      title: `Selección ${definition.name}`,
      collection: { ...selection.catalogConfig.collection, heroArtwork: `https://res.cloudinary.com/store/image/upload/${slug}.png` },
    };
    const savedSelection = await call("put", "/:id", {
      params: { id: selection._id },
      body: { name: definition.name, slug: "otra-direccion", pageType: "custom", catalogConfig: editedConfig },
    });
    assert.equal(savedSelection.status, 200);
    assert.equal(savedSelection.body.slug, slug);
    assert.equal(savedSelection.body.pageType, "catalog");
    await call("get", "/");
    assert.deepEqual(selection.catalogConfig, editedConfig);
    assert.deepEqual(page.catalogConfig, originalConfig);
    assert.deepEqual(bautizos.catalogConfig, ownConfig);
    assert.equal([...pages.values()].filter(item => item.slug === slug).length, 1);
    assert.equal((await call("delete", "/:id", { params: { id: selection._id } })).status, 400);
    assert.equal((await call("post", "/", { body: { name: "Otra", slug, pageType: "catalog" } })).status, 400);
    assert.equal((await call("put", "/:id", { params: { id: other._id }, body: { name: "Otra", slug, pageType: "catalog" } })).status, 400);
    const scoped = buildPublicProductListFilter(parsePublicProductListQuery({ categoryScope: definition.category, category: "Complementos" }));
    assert.equal(scoped.active, true);
    assert.equal(scoped.archivedAt, null);
    assert.equal(scoped.$and.length, 2);
    const matchScope = scoped.$and[1].$or[0].category.$in[0];
    assert(matchScope.test(definition.category));
    for (const different of CATALOG_PAGES.filter(item => item.slug !== slug)) assert(!matchScope.test(different.category));
    checks++;
  }
  const firstNews = [...pages.values()].find(item => item.slug === "lo-nuevo");
  assert(firstNews);
  pages.delete(firstNews._id);
  page.catalogConfig.defaultSort = "price";
  page.catalogConfig.initialColorsText = "rojo";
  page.catalogConfig.initialMinPrice = 100000;
  const sourceBeforeNews = structuredClone(page.catalogConfig);
  const { body: news } = await call("get", "/:value", { params: { value: "lo-nuevo" } });
  assert.equal(news.name, "Novedades");
  assert.equal(news.pageType, "catalog");
  assert.equal(news.catalogConfig.sourceMode, "all");
  assert.equal(news.catalogConfig.allowedCategoriesText, "");
  assert.equal(news.catalogConfig.manualProductIdsText, "");
  assert.equal(news.catalogConfig.initialCategoriesText, "");
  assert.equal(news.catalogConfig.initialColorsText, "");
  assert.equal(news.catalogConfig.initialMinPrice, 0);
  assert.equal(news.catalogConfig.defaultSort, "-createdAt");
  assert.equal(news.catalogConfig.collection.heroArtwork, "");
  assert.deepEqual(news.catalogConfig.presentation, sourceBeforeNews.presentation);
  assert.deepEqual(parsePublicProductListQuery({ sort: news.catalogConfig.defaultSort }).sort, { createdAt: -1, _id: -1 });
  const ownNewsConfig = { ...news.catalogConfig, sourceMode: "manual", manualProductIdsText: "un-producto", defaultSort: "title" };
  await call("put", "/:id", { params: { id: news._id }, body: { name: "Novedades", slug: "otro", pageType: "custom", catalogConfig: ownNewsConfig } });
  await call("get", "/");
  assert.equal(news.slug, "lo-nuevo");
  assert.equal(news.pageType, "catalog");
  assert.deepEqual(news.catalogConfig, ownNewsConfig);
  assert.deepEqual(page.catalogConfig, sourceBeforeNews);
  assert.equal([...pages.values()].filter(item => item.slug === "lo-nuevo").length, 1);
  assert.equal((await call("delete", "/:id", { params: { id: news._id } })).status, 400);
  assert.equal((await call("post", "/", { body: { name: "Duplicada", slug: "lo-nuevo", pageType: "catalog" } })).status, 400);
  assert.equal((await call("put", "/:id", { params: { id: other._id }, body: { name: "Otra", slug: "lo-nuevo", pageType: "catalog" } })).status, 400);
  checks++;
  console.log(
    `PASS ${checks} grupos de catálogos: ${CATALOG_PAGES.map(item => item.name).join(", ")}, selección independiente, conservación y protecciones sin productos de ejemplo`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
