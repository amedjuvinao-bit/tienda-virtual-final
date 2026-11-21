"use strict";
const assert = require("node:assert/strict");
const { reviewPrivacyPolicy, addProductReview } = require("../services/productReviewPrivacyService");
const { serializePublicProduct, PUBLIC_PRODUCT_PROJECTION } = require("../lib/products/productPublicView");
const settings = {
  store: { businessName: "Tienda de prueba", address: "Calle de prueba 1", city: "Ciudad", email: "soporte@example.com", phone: "3000000000" },
  billing: { fiscalInfo: { businessName: "Tienda de prueba SAS", nit: "900000000", dv: "1" } },
  consumerProtection: { privacyEffectiveDate: "2026-11-20", retention: "Criterio de conservación de prueba", processors: "Proveedores de prueba" },
};
const policy = reviewPrivacyPolicy(settings);
const body = { name: "Ana", comment: "La prenda corresponde a la descripción.", rating: 4,
  privacyAuthorized: true, privacyVersion: policy.version };
const now = new Date("2026-11-20T12:00:00Z");
function fixture(options = {}) {
  let saves = 0;
  const product = { _id: "507f1f77bcf86cd799439011", title: "Vestido", price: 100000,
    reviews: [{ name: "Anterior", comment: "Reseña anterior", rating: 5 }],
    async save() { if (options.failSave) throw new Error("write failed"); saves++; },
  };
  return { product, get saves() { return saves; },
    Product: { async findOne(filter) {
      assert.equal(filter.active, true); assert.deepEqual(filter.visible, { $ne: false }); assert.equal(filter.archivedAt, null);
      return options.missing ? null : product;
    } },
    SiteSettings: { findOne: () => ({ lean: async () => options.settings ?? settings }) },
  };
}
let passed = 0;
async function check(name, run) { await run(); passed++; console.log(`OK ${name}`); }
async function main() {
  await check("La información usa la identidad existente y explica la publicación sin marketing", () => {
    assert.equal(policy.ready, true); assert.equal(policy.seller.legalName, "Tienda de prueba SAS");
    assert.match(policy.text, /visibles en la página del producto/); assert.match(policy.text, /no incluye novedades/);
    assert.equal(policy.policyUrl, "/privacidad");
    assert.equal(reviewPrivacyPolicy({}).ready, false);
  });
  await check("Una edición de privacidad o del responsable cambia la versión; un color no", () => {
    assert.notEqual(reviewPrivacyPolicy({ ...settings, consumerProtection: { ...settings.consumerProtection, retention: "Otro criterio" } }).version, policy.version);
    assert.notEqual(reviewPrivacyPolicy({ ...settings, store: { ...settings.store, phone: "3000000001" } }).version, policy.version);
    assert.equal(reviewPrivacyPolicy({ ...settings, theme: { colors: { primary: "#fff" } } }).version, policy.version);
  });
  await check("Una llamada directa sin decisión expresa no guarda una reseña", async () => {
    for (const value of [false, undefined, "true", 1]) {
      const f = fixture();
      await assert.rejects(addProductReview({ ...f, productKey: "vestido", body: { ...body, privacyAuthorized: value } }), { code: "REVIEW_PRIVACY_REQUIRED", statusCode: 400 });
      assert.equal(f.saves, 0); assert.equal(f.product.reviews.length, 1);
    }
    for (const value of [null, [], "reseña"]) {
      const f = fixture();
      await assert.rejects(addProductReview({ ...f, productKey: "vestido", body: value }), { statusCode: 400 });
      assert.equal(f.saves, 0);
    }
  });
  await check("La versión anterior se rechaza antes de escribir", async () => {
    const f = fixture();
    await assert.rejects(addProductReview({ ...f, productKey: "vestido", body: { ...body, privacyVersion: "anterior" } }), { code: "REVIEW_PRIVACY_CHANGED", statusCode: 409 });
    assert.equal(f.saves, 0);
  });
  await check("Una tienda incompleta no confirma autorización ni publicación", async () => {
    const f = fixture({ settings: {} });
    await assert.rejects(addProductReview({ ...f, productKey: "vestido", body }), { code: "REVIEW_PRIVACY_UNAVAILABLE", statusCode: 503 });
    assert.equal(f.saves, 0);
  });
  await check("Guarda la prueba del servidor con la reseña sin inventar permisos anteriores", async () => {
    const f = fixture();
    const response = await addProductReview({ ...f, productKey: "vestido", body: { ...body, privacyAuthorization: { authorizedAt: "falsa", text: "falso" } }, now });
    assert.equal(f.saves, 1); assert.equal(response.privacyRecorded, true);
    const proof = f.product.reviews[1].privacyAuthorization;
    assert.deepEqual(proof.authorizedAt, now); assert.equal(proof.text, policy.text);
    assert.equal(proof.privacyText, policy.privacyText); assert.equal(proof.version, policy.version);
    assert.deepEqual(proof.seller, policy.seller); assert.equal(proof.reviewDigest.length, 64);
    assert.equal(f.product.reviews[0].privacyAuthorization, undefined);
    assert.equal(response.reviews[1].privacyAuthorization, undefined);
  });
  await check("La lectura pública excluye las constancias sin modificar la prueba guardada", async () => {
    const f = fixture(); await addProductReview({ ...f, productKey: "vestido", body, now });
    const publicProduct = serializePublicProduct(f.product);
    assert.equal(PUBLIC_PRODUCT_PROJECTION["reviews.privacyAuthorization"], 0);
    assert.equal(publicProduct.reviews[1].privacyAuthorization, undefined);
    assert.ok(f.product.reviews[1].privacyAuthorization);
    assert.equal(publicProduct.reviews[0].name, "Anterior");
  });
  await check("No confirma éxito cuando falla el guardado ni publica en un producto inexistente", async () => {
    await assert.rejects(addProductReview({ ...fixture({ failSave: true }), productKey: "vestido", body }), /write failed/);
    await assert.rejects(addProductReview({ ...fixture({ missing: true }), productKey: "vestido", body }), { statusCode: 404 });
  });
  console.log(`RESULTADO: ${passed}/${passed} grupos aprobados`);
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
