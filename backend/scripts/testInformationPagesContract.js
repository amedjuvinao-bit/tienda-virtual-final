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
  const about = list.body.find((page) => page.slug === "nosotros");
  assert.equal(about.pageType, "information");
  assert.equal(about.systemRole, "about");
  checks++;
  const contact = list.body.find(page => page.slug === "contacto");
  assert.equal(contact.pageType, "information");
  assert.equal(contact.systemRole, "contact");
  await Promise.all([call("get", "/"), call("get", "/")]);
  assert.equal([...pages.values()].filter(page => page.slug === "contacto").length, 1);
  checks++;
  const contactConfig = { layout: "contact", contact: { extension: true, whatsappSource: "custom", whatsappPhone: "+12025550123", latitude: "0", longitude: "0" }, presentation: { borderWidth: 0 } };
  const contactSaved = await call("put", "/:id", { params: { id: contact._id }, body: { name: "Atención", slug: "otra-direccion", pageType: "custom", systemRole: "", informationPageConfig: contactConfig } });
  assert.equal(contactSaved.status, 200);
  assert.equal(contactSaved.body.slug, "contacto");
  assert.equal(contactSaved.body.pageType, "information");
  assert.equal(contactSaved.body.systemRole, "contact");
  assert.deepEqual(contactSaved.body.informationPageConfig, contactConfig);
  checks++;
  assert.equal((await call("get", "/:value", { params: { value: "nuestra-sede" } })).body._id, contact._id);
  assert.equal((await call("delete", "/:id", { params: { id: contact._id } })).status, 400);
  assert.equal((await call("post", "/", { body: { name: "Duplicada", slug: "contacto", pageType: "information" } })).status, 400);
  checks++;
  await Promise.all([call("get", "/"), call("get", "/")]);
  assert.equal(
    [...pages.values()].filter((page) => page.slug === "nosotros").length,
    1,
  );
  checks++;
  const alias = await call("get", "/:value", {
    params: { value: "nuestra-historia" },
  });
  assert.equal(alias.body._id, about._id);
  checks++;
  const config = {
    titleText: "Nuestro negocio",
    sections: [{ id: "story", type: "text", body: "Historia propia" }],
    style: { cardBg: "#123456" },
    presentation: { reflection: 0 },
    extension: { keep: true },
  };
  config.journal = {
    featuredId: "memory-one",
    extension: { keep: true },
    moments: [
      {
        id: "memory-one",
        title: "Encuentro",
        date: "2026-06-03",
        category: "Equipo",
        image: "/business.webp",
        story: "Relato propio",
        gallery: [{ image: "/second.webp", caption: "Otra imagen" }],
      },
    ],
  };
  const saved = await call("put", "/:id", {
    params: { id: about._id },
    body: {
      name: "Nuestra identidad",
      slug: "otro",
      pageType: "custom",
      informationPageConfig: config,
      systemRole: "",
    },
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.slug, "nosotros");
  assert.equal(saved.body.pageType, "information");
  assert.equal(saved.body.systemRole, "about");
  assert.deepEqual(saved.body.informationPageConfig, config);
  checks++;
  await call("put", "/:id", {
    params: { id: about._id },
    body: { name: "Nuestra identidad" },
  });
  assert.deepEqual(about.informationPageConfig, config);
  checks++;
  assert.equal(
    (await call("delete", "/:id", { params: { id: about._id } })).status,
    400,
  );
  checks++;
  const created = await call("post", "/", {
    body: {
      name: "Ayuda",
      slug: "ayuda",
      pageType: "information",
      systemRole: "about",
      informationPageConfig: config,
    },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.pageType, "information");
  assert.notEqual(created.body.systemRole, "about");
  assert.deepEqual(created.body.informationPageConfig, config);
  checks++;
  const custom = created.body;
  assert.equal((await call("put", "/:id", { params: { id: custom._id }, body: { name: "Otra", slug: "contacto", pageType: "information", systemRole: "contact" } })).status, 400);
  checks++;
  const renamed = await call("put", "/:id", {
    params: { id: custom._id },
    body: {
      name: "Ayuda general",
      slug: "centro-ayuda",
      pageType: "information",
      enabled: false,
      useHeader: false,
      useFooter: false,
    },
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.slug, "centro-ayuda");
  assert.equal(renamed.body.enabled, false);
  assert.deepEqual(renamed.body.informationPageConfig, config);
  checks++;
  assert.equal(
    (
      await call("post", "/", {
        body: {
          name: "Inválida",
          slug: "con espacio",
          pageType: "information",
        },
      })
    ).status,
    400,
  );
  checks++;
  assert.equal(
    (
      await call("post", "/", {
        body: {
          name: "Inválida",
          slug: "invalida",
          pageType: "information",
          informationPageConfig: [],
        },
      })
    ).status,
    400,
  );
  checks++;
  assert.equal(
    (
      await call("post", "/", {
        body: { name: "Duplicada", slug: "nosotros", pageType: "information" },
      })
    ).status,
    400,
  );
  checks++;
  pages.delete(about._id);
  const legacy = insert({
    name: "Historia existente",
    slug: "nosotros",
    pageType: "custom",
    blocks: [
      { id: "original", type: "informacion", config: { extension: true } },
    ],
  });
  const readLegacy = await call("get", "/:value", {
    params: { value: "nosotros" },
  });
  assert.equal(readLegacy.body._id, legacy._id);
  assert.equal(readLegacy.body.pageType, "custom");
  assert.equal(readLegacy.body.blocks[0].id, "original");
  checks++;
  const ownAlias = insert({
    name: "Otra historia",
    slug: "nuestra-historia",
    pageType: "custom",
    blocks: [],
  });
  assert.equal(
    (await call("get", "/:value", { params: { value: "nuestra-historia" } }))
      .body._id,
    ownAlias._id,
  );
  checks++;
  assert.ok(Page.schema.path("pageType").enumValues.includes("information"));
  checks++;
  pages.delete(contact._id);
  const legacyContact = insert({ name: "Contacto anterior", slug: "contacto", pageType: "custom", blocks: [{ id: "original-contact" }] });
  assert.equal((await call("get", "/:value", { params: { value: "contacto" } })).body._id, legacyContact._id);
  assert.equal(legacyContact.pageType, "custom");
  assert.equal(legacyContact.blocks[0].id, "original-contact");
  checks++;
  const ownVenue = insert({ name: "Sede propia", slug: "nuestra-sede", pageType: "information", blocks: [] });
  assert.equal((await call("get", "/:value", { params: { value: "nuestra-sede" } })).body._id, ownVenue._id);
  assert.ok(Page.schema.path("systemRole").enumValues.includes("contact"));
  checks++;
  console.log(
    `PASS ${checks} information page persistence, aliases, safe adoption and identity checks`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
