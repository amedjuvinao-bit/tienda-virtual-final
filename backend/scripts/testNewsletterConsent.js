"use strict";
const assert = require("node:assert/strict");
const {
  createNewsletterService,
  REQUEST_MESSAGE,
} = require("../services/newsletter/verification");
const { newsletterPolicy } = require("../services/newsletter/policy");
const {
  saveAdministrativeConsent,
  reconcileCustomer,
  canSendCommercialEmail,
} = require("../services/newsletter/consent");
const {
  normalizeNewsletterIntent,
  persistNewsletterSubscription,
} = require("../services/orderCreationNewsletterService");
const Subscriber = require("../models/Subscriber"),
  Customer = require("../models/Customer");
const settings = {
  store: {
    businessName: "Negocio",
    address: "Calle 1",
    city: "Bogotá",
    email: "ayuda@example.com",
    phone: "3001234567",
  },
  billing: { fiscalInfo: { nit: "900123456", businessName: "Negocio" } },
  consumerProtection: {
    privacyEffectiveDate: "2026-11-02",
    retention: "Conservación documentada por finalidad.",
    processors: "Proveedores configurados.",
  },
};
const copy = (value) => structuredClone(value);
const get = (doc, path) => path.split(".").reduce((v, k) => v?.[k], doc);
function set(doc, path, value) {
  const keys = path.split("."),
    last = keys.pop();
  let node = doc;
  for (const k of keys) node = node[k] ||= {};
  node[last] = copy(value);
}
function unset(doc, path) {
  const keys = path.split("."),
    last = keys.pop(),
    node = keys.reduce((v, k) => v?.[k], doc);
  if (node) delete node[last];
}
function matches(doc, filter) {
  return Object.entries(filter).every(([key, wanted]) => {
    if (key === "$or") return wanted.some((x) => matches(doc, x));
    const actual = get(doc, key);
    if (wanted && typeof wanted === "object" && !(wanted instanceof Date))
      return Object.entries(wanted).every(([op, value]) => {
        const a = actual instanceof Date ? +actual : actual,
          b = value instanceof Date ? +value : value;
        if (op === "$exists")
          return value ? actual !== undefined : actual === undefined;
        if (op === "$ne") return actual !== value;
        if (op === "$lte") return actual != null && a <= b;
        if (op === "$gt") return actual != null && a > b;
        if (op === "$lt") return actual != null && a < b;
        throw Error(op);
      });
    return wanted === null ? actual == null : String(actual) === String(wanted);
  });
}
function apply(doc, update, inserted = false) {
  for (const [k, v] of Object.entries(
    inserted ? update.$setOnInsert || {} : {},
  ))
    set(doc, k, v);
  for (const [k, v] of Object.entries(update.$set || {})) set(doc, k, v);
  for (const k of Object.keys(update.$unset || {})) unset(doc, k);
  for (const [k, v] of Object.entries(update.$inc || {}))
    set(doc, k, (get(doc, k) || 0) + v);
  for (const [k, v] of Object.entries(update.$push || {}))
    set(doc, k, [...(get(doc, k) || []), ...v.$each].slice(v.$slice));
}
function fixture() {
  const state = {
    subscribers: [],
    customers: [
      {
        _id: "c1",
        email: "persona@example.com",
        normalizedEmail: "persona@example.com",
        deletedAt: null,
        acceptsMarketing: false,
        marketingConsent: { status: "withdrawn" },
      },
    ],
    mails: [],
    failProjection: false,
    writes: [],
    events: [],
    settings: copy(settings),
  };
  let now = new Date("2026-11-02T20:00:00Z"),
    seq = 123000;
  const query = (task) => ({
    then(resolve, reject) {
      return Promise.resolve().then(task).then(resolve, reject);
    },
    select() {
      return this;
    },
    session() {
      return this;
    },
    lean() {
      return this;
    },
  });
  const SubscriberModel = {
    findOne(filter) {
      return query(() =>
        copy(state.subscribers.find((x) => matches(x, filter)) || null),
      );
    },
    findOneAndUpdate(filter, update, options = {}) {
      return query(() => {
        let doc = state.subscribers.find((x) => matches(x, filter)),
          inserted = false;
        if (!doc && options.upsert) {
          if (state.subscribers.some((x) => x.email === filter.email))
            throw Object.assign(Error("duplicate"), { code: 11000 });
          doc = {
            _id: "s" + (state.subscribers.length + 1),
            status: "unknown",
            consentHistory: [],
          };
          state.subscribers.push(doc);
          inserted = true;
        }
        if (!doc) return null;
        apply(doc, update, inserted);
        state.writes.push({ type: "subscriber", session: options.session });
        return copy(doc);
      });
    },
    async updateOne(filter, update) {
      const doc = state.subscribers.find((x) => matches(x, filter));
      if (doc) apply(doc, update);
      return { modifiedCount: doc ? 1 : 0 };
    },
  };
  const CustomerModel = {
    async exists(filter) {
      return state.customers.find((x) => matches(x, filter)) || null;
    },
    findOne(filter) {
      return query(() => {
        const raw = state.customers.find((x) => matches(x, filter));
        if (!raw) return null;
        const doc = copy(raw);
        Object.defineProperty(doc, "save", {
          value: async (options) => {
            state.customers[
              state.customers.findIndex((x) => x._id === doc._id)
            ] = copy(Object.fromEntries(Object.entries(doc)));
            state.writes.push({
              type: "customer-save",
              session: options.session,
            });
          },
        });
        return doc;
      });
    },
    async updateMany(filter, update, options) {
      if (state.failProjection) throw Error("Customer write unavailable");
      for (const doc of state.customers.filter((x) => matches(x, filter)))
        apply(doc, update);
      state.writes.push({ type: "customers", session: options.session });
    },
    async updateOne(filter, update) {
      const doc = state.customers.find((x) => matches(x, filter));
      if (doc) apply(doc, update);
    },
  };
  const EventModel = {
    async create(rows, options) {
      assert(options.session);
      state.events.push(...copy(rows));
    },
  };
  const session = { test: "transaction" };
  let tail = Promise.resolve();
  const runTransaction = (task) => {
    const next = tail.then(async () => {
      const saved = copy({
        subscribers: state.subscribers,
        customers: state.customers,
        writes: state.writes,
        events: state.events,
      });
      try {
        return await task(session);
      } catch (error) {
        Object.assign(state, saved);
        throw error;
      }
    });
    tail = next.catch(() => {});
    return next;
  };
  const deps = {
    SubscriberModel,
    CustomerModel,
    EventModel,
    runTransaction,
    ensureIndex: async () => {},
    readSettings: async () => state.settings,
    secret: () => "test-only-secret",
    clock: () => now,
    randomCode: () => String(++seq),
    mailer: async (mail) => state.mails.push(mail),
  };
  return {
    state,
    deps,
    service: createNewsletterService(deps),
    policy: newsletterPolicy(settings),
    advance: (ms) => {
      now = new Date(+now + ms);
    },
    code: () => state.mails.at(-1).text.match(/Tu código es: (\d{6})/)[1],
  };
}
let groups = 0;
const ok = (text) => {
  groups++;
  console.log("OK " + text);
};
const request = (f) =>
  f.service.request({
    email: " PERSONA@EXAMPLE.COM ",
    consent: true,
    version: f.policy.version,
  });
const confirm = (f, intent = "subscribe", code = f.code()) =>
  f.service.confirm({ email: "persona@example.com", code, intent });
async function main() {
  const {
    EMAIL_INDEX_OPTIONS,
    ensureEmailIndex,
    coversEmail,
  } = require("../services/newsletter/indexes");
  assert.equal(EMAIL_INDEX_OPTIONS.unique, true);
  assert.equal(EMAIL_INDEX_OPTIONS.partialFilterExpression.email.$gt, "");
  let indexCalls = 0;
  const indexed = {
    collection: {
      async createIndex() {
        indexCalls++;
        return "index";
      },
    },
  };
  await Promise.all([ensureEmailIndex(indexed), ensureEmailIndex(indexed)]);
  assert.equal(indexCalls, 1);
  const invalid = {
    collection: {
      async createIndex() {
        throw Error("legacy duplicates");
      },
    },
  };
  await assert.rejects(
    ensureEmailIndex(invalid),
    (error) => error.code === "NEWSLETTER_INDEX_UNAVAILABLE",
  );
  assert.equal(coversEmail({ key: { email: 1 }, unique: true }), true);
  assert.equal(
    coversEmail({
      key: { email: 1 },
      unique: true,
      partialFilterExpression: { email: {} },
    }),
    false,
  );
  assert.equal(
    coversEmail({
      key: { email: 1 },
      unique: true,
      partialFilterExpression: { status: "granted" },
    }),
    false,
  );
  assert.equal(
    await ensureEmailIndex({
      collection: {
        async indexes() {
          return [{ name: "email_existing", key: { email: 1 }, unique: true }];
        },
        async createIndex() {
          assert.fail("no debe sustituir un índice compatible");
        },
      },
    }),
    "email_existing",
  );
  ok(
    "índice válido, reutilización compatible, inicialización compartida y cierre seguro ante duplicados existentes",
  );
  assert.equal(new Subscriber({ email: "old@example.com" }).status, "unknown");
  assert.equal(
    new Customer({ fullName: "Persona" }).emailMarketingConsent.status,
    "unknown",
  );
  assert.equal(newsletterPolicy({}).ready, false);
  assert.notEqual(
    newsletterPolicy({
      ...settings,
      store: { ...settings.store, phone: "3010000000" },
    }).version,
    newsletterPolicy(settings).version,
  );
  ok(
    "registros antiguos desconocidos y versión ligada al responsable y contenido",
  );
  let f = fixture();
  for (const body of [
    { email: "x" },
    { email: "persona@example.com", consent: false, version: f.policy.version },
    { email: "persona@example.com", consent: true, version: "vieja" },
  ])
    await assert.rejects(f.service.request(body));
  assert.equal(f.state.subscribers.length, 0);
  assert.equal(f.state.mails.length, 0);
  ok("sin escritura ni correo sin autorización vigente");
  await request(f);
  assert.equal(f.state.subscribers[0].status, "unknown");
  assert(!JSON.stringify(f.state.subscribers).includes(f.code()));
  assert.equal(f.state.customers[0].acceptsMarketing, false);
  const first = f.code();
  await request(f);
  assert.equal(f.state.mails.length, 1);
  ok(
    "solicitud pendiente, resumen HMAC del código y enfriamiento por contacto",
  );
  await assert.rejects(
    f.service.confirm({
      email: "otra@example.com",
      code: first,
      intent: "subscribe",
    }),
  );
  await assert.rejects(confirm(f, "withdraw", first));
  ok("código ligado al contacto y la acción");
  assert.equal((await confirm(f, "subscribe", first)).status, "granted");
  assert.equal(f.state.subscribers[0].consent.text, f.policy.text);
  assert.equal(
    f.state.subscribers[0].consent.privacyText,
    f.policy.privacyText,
  );
  assert.equal(f.state.customers[0].emailMarketingConsent.status, "granted");
  assert.equal(f.state.customers[0].marketingConsent.status, "withdrawn");
  assert.equal(
    await canSendCommercialEmail("persona@example.com", f.deps),
    true,
  );
  assert.equal(f.state.subscribers[0].verification, undefined);
  assert(f.state.writes.slice(-2).every((x) => x.session));
  await assert.rejects(confirm(f, "subscribe", first));
  assert.equal(f.state.subscribers[0].consentHistory.length, 1);
  assert.equal(f.state.events.length, 1);
  ok(
    "prueba completa y permiso de email sin ampliar otros canales; consumo único",
  );
  await f.service.request({ email: "persona@example.com", intent: "withdraw" });
  await confirm(f, "withdraw");
  assert.equal(f.state.subscribers[0].status, "withdrawn");
  assert.equal(f.state.customers[0].emailMarketingConsent.status, "withdrawn");
  assert.equal(
    await canSendCommercialEmail("persona@example.com", f.deps),
    false,
  );
  await request(f);
  assert.equal(f.state.subscribers[0].status, "withdrawn");
  ok("retiro propagado; solicitar código no reactiva");
  f = fixture();
  await request(f);
  f.advance(11 * 60000);
  await assert.rejects(confirm(f));
  ok("caducidad a diez minutos");
  f = fixture();
  await request(f);
  for (let i = 0; i < 5; i++)
    await assert.rejects(confirm(f, "subscribe", "999999"));
  await assert.rejects(confirm(f));
  ok("cinco intentos agotan incluso el código correcto posterior");
  f = fixture();
  await request(f);
  f.state.failProjection = true;
  await assert.rejects(confirm(f));
  assert.equal(f.state.subscribers[0].status, "unknown");
  assert(f.state.subscribers[0].verification);
  assert.equal(f.state.customers[0].emailMarketingConsent, undefined);
  ok(
    "fallo en Clientes revierte la activación y conserva el código para reintento",
  );
  f = fixture();
  await request(f);
  const both = await Promise.allSettled([confirm(f), confirm(f)]);
  assert.equal(both.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(f.state.subscribers[0].status, "granted");
  assert.equal(f.state.events.length, 1);
  ok("confirmaciones concurrentes no duplican el permiso");
  f = fixture();
  const unknown = await f.service.request({
      email: "desconocida@example.com",
      intent: "withdraw",
    }),
    known = await f.service.request({
      email: "persona@example.com",
      intent: "withdraw",
    });
  assert.deepEqual(known, unknown);
  assert.equal(known.message, REQUEST_MESSAGE);
  assert.equal(f.state.mails.length, 1);
  await confirm(f, "withdraw");
  assert.equal(f.state.customers[0].emailMarketingConsent.status, "withdrawn");
  ok("retiro para Clientes antiguos sin suscriptor y respuesta uniforme");
  f = fixture();
  await saveAdministrativeConsent(
    f.state.customers[0],
    {
      status: "granted",
      source: "paper",
      proofReference: "acta-1",
      adminId: null,
    },
    f.deps,
  );
  assert.equal(f.state.subscribers.length, 0);
  await saveAdministrativeConsent(
    f.state.customers[0],
    {
      status: "granted",
      source: "paper",
      proofReference: "acta-2",
      emailMarketing: true,
      adminId: null,
    },
    f.deps,
  );
  assert.equal(f.state.subscribers[0].status, "granted");
  await request(f);
  const pending = f.code();
  await saveAdministrativeConsent(
    f.state.customers[0],
    { status: "withdrawn", source: "admin", proofReference: "", adminId: null },
    f.deps,
  );
  await assert.rejects(confirm(f, "subscribe", pending));
  assert.equal(f.state.subscribers[0].status, "withdrawn");
  ok(
    "permiso general no activa email; retiro administrativo invalida confirmaciones pendientes",
  );
  await reconcileCustomer("c1", "persona@example.com", f.deps);
  let count = 0;
  const noMarketing = normalizeNewsletterIntent(
    { emailOrPhone: "persona@example.com", wantsNewsletter: false },
    "session",
    { settings },
  );
  assert.equal(
    (
      await persistNewsletterSubscription(
        { ...noMarketing, customerId: "c1" },
        {
          reconcile: (id, email) => reconcileCustomer(id, email, f.deps),
          service: {
            request: async () => {
              count++;
            },
          },
        },
      )
    ).attempted,
    false,
  );
  assert.equal(count, 0);
  assert.equal(f.state.subscribers[0].status, "withdrawn");
  ok("comprar sin marketing no reactiva ni envía mensajes comerciales");
  const intent = normalizeNewsletterIntent(
    {
      emailOrPhone: "persona@example.com",
      wantsNewsletter: true,
      newsletterConsentVersion: f.policy.version,
    },
    "session",
    { settings },
  );
  assert(intent.proof);
  const result = await persistNewsletterSubscription(intent, {
    reconcile: async () => {},
    service: {
      request: async () => {
        count++;
      },
    },
  });
  assert.equal(result.pendingVerification, true);
  assert.equal(result.persisted, false);
  assert.equal(
    (
      await persistNewsletterSubscription(intent, {
        reconcile: async () => {},
        service: {
          request: async () => {
            throw Error("SMTP offline");
          },
        },
        logger: { warn() {} },
      })
    ).retryable,
    true,
  );
  ok("Checkout requiere confirmación; fallo opcional no invalida la compra");
  f = fixture();
  await request(f);
  f.state.settings.consumerProtection.retention =
    "Una finalidad de conservación actualizada.";
  await assert.rejects(
    confirm(f),
    (error) => error.code === "NEWSLETTER_POLICY_CHANGED",
  );
  assert.equal(f.state.subscribers[0].status, "unknown");
  const updated = await f.service.getPolicy();
  await f.service.request({
    email: "persona@example.com",
    consent: true,
    version: updated.version,
  });
  assert.equal((await confirm(f)).status, "granted");
  ok(
    "cambiar la política invalida un código pendiente sin autorizar contenido nuevo",
  );
  f = fixture();
  const failing = createNewsletterService({
    ...f.deps,
    mailer: async () => {
      throw Error("SMTP offline");
    },
  });
  await assert.rejects(
    failing.request({
      email: "persona@example.com",
      consent: true,
      version: f.policy.version,
    }),
    (error) => error.code === "NEWSLETTER_MAIL_UNAVAILABLE",
  );
  assert.equal(f.state.subscribers[0].verification, undefined);
  assert.equal(f.state.subscribers[0].status, "unknown");
  ok("fallo SMTP retira el código no entregado y permite solicitarlo de nuevo");
  f = fixture();
  for (let i = 0; i < 52; i++) {
    const intent = i % 2 ? "withdraw" : "subscribe";
    await f.service.request({
      email: "persona@example.com",
      intent,
      consent: true,
      version: f.policy.version,
    });
    await confirm(f, intent);
  }
  assert.equal(f.state.subscribers[0].consentHistory.length, 50);
  assert.equal(f.state.events.length, 52);
  ok("el historial reciente acotado no elimina las constancias duraderas");
  const {
    fillMissingCustomerFields,
  } = require("../services/customerOrderLink/matching");
  const old = {
    acceptsMarketing: false,
    marketingConsent: { status: "withdrawn" },
  };
  fillMissingCustomerFields(old, { acceptsMarketing: true });
  assert.equal(old.acceptsMarketing, false);
  const {
    buildCustomerPayloadFromOrder,
  } = require("../services/customerOrderLink/normalization");
  assert.equal(
    buildCustomerPayloadFromOrder({
      customer: { wantsNewsletter: true, emailOrPhone: "persona@example.com" },
    }).acceptsMarketing,
    false,
  );
  ok("una orden histórica no transforma su casilla en permiso comercial");
  const express = require("express"),
    { createNewsletterRouter } = require("../routes/newsletter");
  f = fixture();
  const app = express();
  app.use(express.json());
  app.use("/api/newsletter", createNewsletterRouter({ service: f.service }));
  const server = await new Promise((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  try {
    const base =
      "http://127.0.0.1:" + server.address().port + "/api/newsletter";
    const policy = await fetch(base + "/policy");
    assert.equal(policy.headers.get("cache-control"), "no-store");
    assert.equal((await policy.json()).policy.version, f.policy.version);
    const post = (path, body) =>
      fetch(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    for (let i = 0; i < 4; i++)
      assert.equal(
        (
          await post("/subscribe", {
            email: "persona@example.com",
            consent: true,
            version: f.policy.version,
          })
        ).status,
        200,
      );
    assert.equal(
      (
        await post("/subscribe", {
          email: "persona@example.com",
          consent: true,
          version: f.policy.version,
        })
      ).status,
      429,
    );
    const r = await post("/confirm", {
      email: "persona@example.com",
      code: f.code(),
      intent: "subscribe",
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).status, "granted");
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
  ok("HTTP real: política, no-store, confirmación y límite por contacto");
  console.log(
    `PASS ${groups} grupos. Base de datos y correo simulados; sin comunicaciones reales.`,
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
