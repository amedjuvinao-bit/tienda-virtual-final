"use strict";
const assert = require("node:assert/strict");
const {
  policyDocument,
  normalizeConfig,
} = require("../services/consumer/policies");
const {
  buildConsumerOffer,
  acceptConsumerOffer,
  digest,
} = require("../services/consumer/checkoutContract");
const {
  normalizeCase,
  publicCase,
  submitCase,
  normalizeReply,
} = require("../services/consumer/cases");
const {
  buildOrderCreationFingerprintPayload,
} = require("../lib/orders/orderCreationPayload");
const {
  buildPublicThanksResponse,
} = require("../services/publicPaymentAccessService");
const { sendOrderCreationError } = require("../lib/orders/orderCreationHttp");
const ConsumerCase = require("../models/ConsumerCase");
const requirePermission = require("../middleware/requirePermission");
const router = require("../routes/consumer");
const settings = {
  store: {
    businessName: "Empresa de prueba",
    address: "Dirección de prueba",
    city: "Bogotá",
    supportEmail: "prueba@example.com",
    phone: "3001234567",
  },
  consumerProtection: {
    nit: "900123456-7",
    revision: 2,
    privacyEffectiveDate: "2026-10-27",
    retention: "Criterios de prueba",
    processors: "Proveedor de prueba",
    deliveryDays: 5,
  },
  theme: {
    global: {
      envios: { active: true, mode: "fixed", fixedPrice: 10000 },
      payments: { provider: "manual", currency: "COP" },
    },
  },
};
const pricing = {
  items: [
    {
      productId: "p1",
      variantId: "v1",
      title: "Producto de prueba",
      quantity: 2,
      price: 40000,
      requiresShipping: true,
      consumerProductInfo: {
        description: "Descripción original",
        features: ["Característica original"],
      },
    },
  ],
  subtotal: 80000,
  shipping: 10000,
  totalDiscount: 0,
  total: 90000,
  tax: { amount: 0 },
};
const customer = {
  countryCode: "CO",
  departmentCode: "11",
  municipalityId: "11001",
  deliveryType: "envio",
};
const now = new Date("2026-10-28T02:00:00Z");
const offer = buildConsumerOffer({ settings, pricing, customer, now });
let checks = 0;
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`OK ${checks}: ${name}`);
}
function resMock() {
  return {
    statusCode: 200,
    status(n) {
      this.statusCode = n;
      return this;
    },
    set() {
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}
async function main() {
  await check(
    "plazo incluye preparación, respeta Colombia y cuenta desde el día siguiente",
    () => {
      assert.equal(offer.ready, true);
      assert.equal(offer.delivery.communicatedOn, "2026-10-27");
      assert.equal(offer.delivery.deadlineDate, "2026-11-01");
      assert.equal(offer.items[0].description, "Descripción original");
      const defaults = buildConsumerOffer({
        settings: {
          ...settings,
          consumerProtection: {
            ...settings.consumerProtection,
            deliveryDays: null,
          },
        },
        pricing,
        customer,
        now: new Date("2028-02-01T15:00:00Z"),
      });
      assert.equal(defaults.delivery.days, 30);
      assert.equal(defaults.delivery.deadlineDate, "2028-03-02");
    },
  );
  await check(
    "rechaza faltantes, consentimiento implícito y huella alterada",
    () => {
      assert.throws(
        () => acceptConsumerOffer(offer, {}),
        (e) => e.code === "CONSUMER_ACCEPTANCE_REQUIRED",
      );
      assert.throws(
        () =>
          acceptConsumerOffer(offer, {
            terms: true,
            privacy: true,
            fingerprint: "falso",
          }),
        (e) => e.code === "CONSUMER_OFFER_CHANGED",
      );
      const missing = buildConsumerOffer({
        settings: {},
        pricing,
        customer,
        now,
      });
      assert.equal(missing.ready, false);
      assert.throws(
        () => acceptConsumerOffer(missing, {}),
        (e) => e.code === "CONSUMER_CONFIGURATION_REQUIRED",
      );
      assert.equal(
        require("../services/consumer/sources").deliverySettings({})
          .deliveryDays,
        null,
      );
    },
  );
  await check(
    "cambio de precio, fecha, producto, política o destino exige nueva aceptación",
    () => {
      const alternatives = [
        { pricing: { ...pricing, total: 91000 } },
        {
          pricing: {
            ...pricing,
            items: [{ ...pricing.items[0], quantity: 3 }],
          },
        },
        {
          pricing: {
            ...pricing,
            items: [
              {
                ...pricing.items[0],
                consumerProductInfo: { description: "Nueva descripción" },
              },
            ],
          },
        },
        {
          settings: {
            ...settings,
            consumerProtection: {
              ...settings.consumerProtection,
              deliveryDays: 6,
            },
          },
        },
        { customer: { ...customer, municipalityId: "05001" } },
        { now: new Date("2026-10-29T02:00:00Z") },
      ];
      alternatives.forEach((change) => {
        const changed = buildConsumerOffer({
          settings,
          pricing,
          customer,
          now,
          ...change,
        });
        assert.notEqual(changed.fingerprint, offer.fingerprint);
        assert.throws(
          () =>
            acceptConsumerOffer(changed, {
              terms: true,
              privacy: true,
              fingerprint: offer.fingerprint,
            }),
          (e) => e.code === "CONSUMER_OFFER_CHANGED",
        );
      });
    },
  );
  await check(
    "la fotografía aceptada conserva fecha, condiciones y precios sin usar valores del cliente",
    () => {
      const saved = acceptConsumerOffer(
        offer,
        { terms: true, privacy: true, fingerprint: offer.fingerprint },
        now,
      );
      assert.equal(saved.acceptedAt, now);
      assert.equal(saved.pricing.total, 90000);
      assert.equal(saved.policies.length, 6);
      const thanks = buildPublicThanksResponse({
        order: { consumerContract: saved, items: [] },
      });
      assert.equal(thanks.consumerContract, saved);
      const a = buildOrderCreationFingerprintPayload(
        {},
        {
          consumerAcceptance: {
            fingerprint: offer.fingerprint,
            terms: true,
            privacy: true,
          },
        },
      );
      const b = buildOrderCreationFingerprintPayload(
        {},
        {
          consumerAcceptance: {
            fingerprint: "otra",
            terms: true,
            privacy: true,
          },
        },
      );
      assert.notDeepEqual(a, b);
    },
  );
  await check(
    "retiro, países y tarifas no se inventan; digital no cobra transporte",
    () => {
      assert.equal(
        buildConsumerOffer({
          settings,
          pricing,
          customer: { ...customer, deliveryType: "retiro" },
          now,
        }).ready,
        false,
      );
      assert.equal(
        buildConsumerOffer({
          settings,
          pricing,
          customer: { ...customer, countryCode: "US" },
          now,
        }).ready,
        false,
      );
      assert.equal(
        buildConsumerOffer({
          settings: { ...settings, theme: {} },
          pricing,
          customer,
          now,
        }).ready,
        false,
      );
      const digital = buildConsumerOffer({
        settings: { ...settings, theme: {} },
        pricing: {
          ...pricing,
          shipping: 0,
          items: [{ ...pricing.items[0], requiresShipping: false }],
        },
        customer,
        now,
      });
      assert.equal(digital.ready, true);
      assert.equal(digital.delivery.type, "electronic");
      const pickup = buildConsumerOffer({
        settings: {
          ...settings,
          consumerProtection: {
            ...settings.consumerProtection,
            pickupEnabled: true,
            pickupInstructions: "Recoger en la sede indicada",
          },
        },
        pricing,
        customer: { ...customer, deliveryType: "retiro" },
        now,
      });
      assert.equal(pickup.ready, true);
    },
  );
  await check(
    "retracto, garantía, reversión y PQR tienen información distinta y fuentes oficiales",
    () => {
      const doc = policyDocument(settings);
      assert(
        doc.sections
          .find((s) => s.id === "retracto")
          .body.includes("5 días hábiles"),
      );
      assert(
        doc.sections
          .find((s) => s.id === "retracto")
          .body.includes("15 días calendario"),
      );
      assert(
        doc.sections
          .find((s) => s.id === "garantia")
          .body.includes("garantía de un año"),
      );
      assert(
        doc.sections
          .find((s) => s.id === "reversion")
          .body.includes("notifica al emisor"),
      );
      assert.equal(doc.authorityUrl, "https://www.sic.gov.co/");
    },
  );
  const document = policyDocument(settings),
    key = "a".repeat(64);
  const body = {
    name: "Cliente de prueba",
    contact: "prueba@example.com",
    type: "withdrawal",
    subject: "Solicitud de prueba",
    message: "Descripción de prueba de una solicitud",
    privacyAuthorized: true,
    privacyVersion: document.version,
    accessKey: key,
  };
  const docs = new Map();
  const Model = {
    findOne: (filter) => ({
      select: async () => docs.get(filter.accessHash) || null,
    }),
    create: async (data) => {
      if (docs.has(data.accessHash))
        throw Object.assign(new Error("duplicate"), { code: 11000 });
      const value = { ...data, status: "received" };
      docs.set(data.accessHash, value);
      return value;
    },
  };
  await check(
    "radica sin pedido y conserva fecha, hora, consentimiento y texto exactos",
    async () => {
      const r = await submitCase(Model, body, document, now);
      assert.match(r.reference, /^PQR-20261027-[A-F0-9]{24}$/);
      assert.equal(r.createdAt, now);
      assert.equal(r.message, body.message);
      const stored = docs.get(digest(key));
      assert.equal(stored.authorization.version, document.version);
      assert.equal(stored.accessHash, digest(key));
      assert.equal(JSON.stringify(r).includes(key), false);
      assert.equal(publicCase(stored).history[0].admin, undefined);
    },
  );
  await check(
    "reintentos y carreras devuelven el mismo radicado sin duplicar; clave no reutilizable para otro texto",
    async () => {
      const [a, b] = await Promise.all([
        submitCase(Model, body, document, now),
        submitCase(Model, body, document, now),
      ]);
      assert.equal(a.reference, b.reference);
      assert.equal(docs.size, 1);
      await assert.rejects(
        () =>
          submitCase(
            Model,
            { ...body, message: "Un texto completamente diferente" },
            document,
            now,
          ),
        (e) => e.code === "CONSUMER_CASE_REPLAY_CONFLICT",
      );
      const fresh = { ...body, accessKey: "b".repeat(64) };
      const concurrent = await Promise.all([
        submitCase(Model, fresh, document, now),
        submitCase(Model, fresh, document, now),
      ]);
      assert.equal(concurrent[0].reference, concurrent[1].reference);
      assert.equal(docs.size, 2);
    },
  );
  await check(
    "sin autorización, contacto, clave o política vigente no se registra una solicitud nueva",
    async () => {
      assert.throws(() => normalizeCase({ ...body, privacyAuthorized: false }));
      assert.throws(() => normalizeCase({ ...body, contact: "(-----)" }));
      assert.throws(() => normalizeCase({ ...body, accessKey: "123" }));
      assert.throws(() => normalizeCase({ ...body, type: "constructor" }));
      await assert.rejects(
        () =>
          submitCase(
            Model,
            { ...body, accessKey: "c".repeat(64), privacyVersion: "anterior" },
            document,
            now,
          ),
        (e) => e.code === "CONSUMER_POLICY_CHANGED",
      );
    },
  );
  await check(
    "seguimiento exige radicado y clave; errores no revelan existencia ni datos privados",
    async () => {
      const original = ConsumerCase.findOne;
      ConsumerCase.findOne = (filter) => ({
        lean: async () =>
          [...docs.values()].find(
            (d) =>
              d.reference === filter.reference &&
              d.accessHash === filter.accessHash,
          ) || null,
      });
      const track = router.stack
        .find((l) => l.route?.path === "/cases/track")
        .route.stack.at(-1).handle;
      try {
        const r = resMock();
        await track(
          {
            body: {
              reference: [...docs.values()][0].reference,
              accessKey: key,
            },
          },
          r,
        );
        assert.equal(r.statusCode, 200);
        assert.equal(r.body.message, body.message);
        assert.equal(r.body.accessHash, undefined);
        assert.equal(r.body.authorization, undefined);
        const denied = resMock();
        await track(
          { body: { reference: r.body.reference, accessKey: "0".repeat(64) } },
          denied,
        );
        assert.equal(denied.statusCode, 404);
        assert.equal(denied.body.subject, undefined);
      } finally {
        ConsumerCase.findOne = original;
      }
    },
  );
  await check(
    "respuestas son públicas, exigen texto y revisión, y la gestión global protege el rol",
    async () => {
      assert.throws(() =>
        normalizeReply({ status: "closed", message: "", revision: 0 }),
      );
      assert.equal(
        normalizeReply({
          status: "answered",
          message: "Respuesta pública de prueba",
          revision: 0,
        }).status,
        "answered",
      );
      let next = false;
      const denied = resMock();
      await requirePermission.adminOrOwner()(
        { adminUserId: "id", adminRole: "staff" },
        denied,
        () => {
          next = true;
        },
      );
      assert.equal(denied.statusCode, 403);
      assert.equal(next, false);
      const allowed = resMock();
      await requirePermission.adminOrOwner()(
        { adminUserId: "id", adminRole: "owner" },
        allowed,
        () => {
          next = true;
        },
      );
      assert.equal(next, true);
      const r = resMock();
      sendOrderCreationError(r, {
        code: "CONSUMER_OFFER_CHANGED",
        statusCode: 409,
        message: "Revisar condiciones",
      });
      assert.equal(r.statusCode, 409);
      assert.equal(r.body.error, "CONSUMER_OFFER_CHANGED");
    },
  );
  await check(
    "la cotización usa precio y descripción del servidor e incluye la oferta verificable",
    async () => {
      const { buildOrderQuote } = require("../services/orderPricingService");
      const id = "123456789012345678901234";
      const ProductModel = {
        find: () => ({
          select() {
            return this;
          },
          lean: async () => [
            {
              _id: id,
              title: "Producto real de prueba",
              description: "Descripción del servidor",
              price: 40000,
              variants: [],
              productType: "physical",
            },
          ],
        }),
      };
      const quote = await buildOrderQuote(
        {
          items: [
            {
              productId: id,
              quantity: 2,
              price: 1,
              title: "Texto del cliente",
            },
          ],
          customer,
        },
        { settings, ProductModel, returnPolicy: {} },
      );
      assert.equal(quote.pricing.subtotal, 80000);
      assert.equal(quote.pricing.shipping, 10000);
      assert.equal(
        quote.consumerOffer.items[0].description,
        "Descripción del servidor",
      );
      assert.equal(quote.consumerOffer.pricing.total, quote.pricing.total);
      assert.equal(quote.consumerOffer.ready, true);
    },
  );
  await check(
    "la privacidad se guarda sin modificar los datos de Tienda, Facturación ni Envíos",
    async () => {
      const { saveSection } = require("../services/consumer/settingsService");
      const current = {
        ...settings,
        _id: "settings-test",
        shippingDelivery: { revision: 7, deliveryDays: 4 },
        consumerProtection: { ...settings.consumerProtection },
      };
      const Model = {
        findOne: () => ({ lean: async () => current }),
        updateOne: async (filter, update) => {
          if (
            filter["consumerProtection.revision"] !==
            current.consumerProtection.revision
          )
            return { matchedCount: 0 };
          Object.assign(current, update.$set);
          return { matchedCount: 1 };
        },
      };
      const config = normalizeConfig(current.consumerProtection);
      const saved = await saveSection(
        Model,
        { ...config, retention: "Criterio actualizado" },
        "privacy",
      );
      assert.equal(saved.consumerProtection.retention, "Criterio actualizado");
      assert.equal(saved.shippingDelivery.deliveryDays, 4);
      assert.equal(saved.consumerProtection.deliveryDays, 5); // previous data preserved, not edited by this form
      await assert.rejects(
        () => saveSection(Model, config, "privacy"),
        (e) => e.code === "CONSUMER_CONFIG_CONFLICT",
      );
      await assert.rejects(
        () =>
          saveSection(
            Model,
            { ...normalizeConfig(saved.consumerProtection), nit: "otro" },
            "privacy",
          ),
        (e) => e.statusCode === 400,
      );
    },
  );
  await check(
    "las cinco páginas se crean una sola vez y se reconocen como páginas del sistema",
    async () => {
      const {
        CONSUMER_PAGES,
        ensureConsumerPages,
      } = require("../services/pages/consumerPages");
      const pages = new Map();
      const Page = {
        findOne: async ({ slug }) => pages.get(slug),
        findOneAndUpdate: async ({ slug }, update) => {
          const page = update.$setOnInsert;
          pages.set(slug, page);
          return page;
        },
      };
      await ensureConsumerPages(Page);
      assert.equal(pages.size, 5);
      pages.get("envios").name = "Título personalizado";
      await ensureConsumerPages(Page);
      assert.equal(pages.get("envios").name, "Título personalizado");
      for (const definition of CONSUMER_PAGES)
        assert.equal(pages.get(definition.slug).systemRole, definition.role);
    },
  );
  await check(
    "Tienda y Facturación son la fuente actual y prevalecen sobre las copias antiguas",
    () => {
      const { sellerSource } = require("../services/consumer/sources");
      const source = {
        ...settings,
        billing: {
          fiscalInfo: {
            businessName: "Empresa fiscal vigente",
            nit: "800123456",
            dv: "2",
          },
        },
        consumerProtection: {
          ...settings.consumerProtection,
          legalName: "Nombre anterior",
          nit: "999999999",
          email: "anterior@example.com",
          phone: "1111111111",
        },
      };
      const current = sellerSource(source);
      assert.equal(current.legalName, "Empresa fiscal vigente");
      assert.equal(current.nit, "800123456-2");
      assert.equal(current.email, settings.store.supportEmail);
      assert.equal(current.phone, settings.store.phone);
      assert.equal(
        sellerSource({
          ...source,
          store: { ...source.store, phone: "3007654321" },
        }).phone,
        "3007654321",
      );
      assert.equal(
        sellerSource({
          ...source,
          billing: {
            fiscalInfo: {
              businessName: "Nueva razón social",
              nit: "700123456",
            },
          },
        }).legalName,
        "Nueva razón social",
      );
    },
  );
  await check(
    "las condiciones de Envíos se conservan al cambiar tarifas o privacidad",
    async () => {
      const { deliverySettings } = require("../services/consumer/sources");
      const { saveSection } = require("../services/consumer/settingsService");
      const current = {
        ...settings,
        _id: "test",
        consumerProtection: { ...settings.consumerProtection },
        theme: {
          global: {
            envios: { estimatedTime: "2 a 3 días hábiles", fixedPrice: 10000 },
          },
        },
      };
      const Model = {
        findOne: () => ({ lean: async () => current }),
        updateOne: async (filter, update) => {
          Object.assign(current, update.$set);
          return { matchedCount: 1 };
        },
      };
      const config = deliverySettings(current);
      assert.equal(config.deliveryDays, 5);
      await saveSection(Model, { ...config, deliveryDays: 8 }, "delivery");
      assert.equal(current.shippingDelivery.deliveryDays, 8);
      assert.equal(current.consumerProtection.deliveryDays, 5);
      assert.equal(
        current.theme.global.envios.estimatedTime,
        "2 a 3 días hábiles",
      );
      assert.equal(current.theme.global.envios.fixedPrice, 10000);
      const offer = buildConsumerOffer({
        settings: current,
        pricing,
        customer,
        now,
      });
      assert.equal(offer.delivery.days, 8);
      assert.equal(offer.delivery.estimate, "2 a 3 días hábiles");
    },
  );
  await check(
    "la política publicada y la compra usan la misma revisión de cambios de Órdenes",
    () => {
      const policy = {
        enabled: true,
        windowDays: 45,
        policyText: "Texto vigente guardado desde Órdenes",
        revision: 9,
      };
      const source = {
        ...settings,
        consumerReturnPolicy: policy,
        consumerProtection: {
          ...settings.consumerProtection,
          commercialChanges: "Texto duplicado antiguo",
        },
      };
      const page = policyDocument(source),
        original = buildConsumerOffer({
          settings: source,
          pricing,
          customer,
          now,
        });
      const text = page.sections.find((s) => s.id === "garantia").body;
      assert(text.includes("45 días calendario"));
      assert(text.includes(policy.policyText));
      assert(!text.includes("Texto duplicado antiguo"));
      const changed = buildConsumerOffer({
        settings: {
          ...source,
          consumerReturnPolicy: {
            ...policy,
            revision: 10,
            policyText: "Nueva política vigente",
          },
        },
        pricing,
        customer,
        now,
      });
      assert.notEqual(changed.fingerprint, original.fingerprint);
    },
  );
  console.log(`PASS ${checks} grupos de protección al consumidor`);
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
