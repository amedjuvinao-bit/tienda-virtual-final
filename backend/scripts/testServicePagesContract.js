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
  let count = 0;
  const list = await call("get", "/");
  assert.equal(list.status, 200);
  for (const [slug, pageType, key] of [
    ["devoluciones", "returns-page", "returnsPageConfig"],
    ["buscar", "search-page", "searchPageConfig"],
  ]) {
    const page = list.body.find((page) => page.slug === slug);
    assert.equal(page.pageType, pageType);
    count++;
    await Promise.all([
      call("get", "/"),
      call("get", "/:value", { params: { value: slug } }),
    ]);
    assert.equal(
      [...pages.values()].filter((value) => value.slug === slug).length,
      1,
    );
    count++;
    const config = {
      titleText: "Configurado",
      style: { cardBg: "#123456" },
      presentation: {
        backgroundMode: "custom",
        mobileBackgroundImage: "https://res.cloudinary.com/demo/mobile.webp",
      },
      extension: { keep: true },
    };
    const saved = await call("put", "/:id", {
      params: { id: page._id },
      body: {
        name: "Changed",
        slug: "changed",
        pageType: "custom",
        blocks: [{ id: "wrong" }],
        useHeader: false,
        useFooter: false,
        [key]: config,
      },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.slug, slug);
    assert.equal(saved.body.pageType, pageType);
    assert.deepEqual(saved.body.blocks, []);
    assert.equal(saved.body.useHeader, false);
    assert.deepEqual(saved.body[key], config);
    count++;
    const read = await call("get", "/:value", { params: { value: slug } });
    assert.deepEqual(read.body[key], config);
    count++;
    const deletion = await call("delete", "/:id", { params: { id: page._id } });
    assert.equal(deletion.status, 400);
    count++;
    const duplicate = await call("post", "/", {
      body: { name: "Duplicate", slug, pageType },
    });
    assert.equal(duplicate.status, 400);
    count++;
    const custom = insert({
      name: "Custom",
      slug: "custom-" + slug,
      pageType: "custom",
    });
    const conversion = await call("put", "/:id", {
      params: { id: custom._id },
      body: { name: "Fake", slug: "fake", pageType },
    });
    assert.equal(conversion.status, 400);
    count++;
    const omitted = await call("put", "/:id", {
      params: { id: page._id },
      body: { name: "Ignored" },
    });
    assert.deepEqual(omitted.body[key], config);
    count++;
    const model = new Page({ name: slug, slug, pageType, [key]: config });
    assert.equal(model.validateSync(), undefined);
    assert.deepEqual(model[key], config);
    count++;
  }
  console.log(
    `PASS ${count} service page persistence, identity, schema and reserved-route checks`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
