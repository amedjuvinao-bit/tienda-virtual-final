"use strict";
const assert = require("node:assert/strict");
const {
  requestRecovery,
  confirmRecovery,
  sendCaseReceipt,
  RECOVERY_MESSAGE,
  assistedRecovery,
} = require("../services/consumer/recovery");
const { digest } = require("../services/consumer/checkoutContract");
const { submitCase, normalizeCase } = require("../services/consumer/cases");
const {
  authorizedCaseOrder,
  casesForOrder,
  linkCaseToOrder,
} = require("../services/consumer/orderConnection");
const {
  createGuestOrderAccessToken,
} = require("../services/publicPaymentAccessService");
const {
  issueOrderReturnAccess,
} = require("../services/orderReturnAccessService");
const Case = require("../models/ConsumerCase");
const router = require("../routes/consumer");
process.env.JWT_SECRET = "consumer-tests-only-secret-not-a-real-credential";
process.env.ORDER_PAYMENT_ACCESS_SECRET = process.env.JWT_SECRET;
const clone = (x) => (x == null ? x : structuredClone(x));
const get = (obj, path) => path.split(".").reduce((v, k) => v?.[k], obj);
function match(doc, query) {
  return Object.entries(query).every(([k, v]) => {
    if (k === "$or") return v.some((q) => match(doc, q));
    if (k === "$and") return v.every((q) => match(doc, q));
    const actual = get(doc, k);
    if (v && typeof v === "object" && !(v instanceof Date))
      return Object.entries(v).every(([op, value]) =>
        op === "$exists"
          ? (actual !== undefined) === value
          : op === "$lt"
            ? actual < value
            : op === "$lte"
              ? actual <= value
              : op === "$gt"
                ? actual > value
                : false,
      );
    return v === null ? actual == null : actual === v;
  });
}
function mutate(doc, update) {
  for (const [op, fields] of Object.entries(update))
    for (const [path, value] of Object.entries(fields)) {
      const parts = path.split("."),
        last = parts.pop();
      let target = doc;
      for (const part of parts) target = target[part] ??= {};
      if (op === "$set") target[last] = clone(value);
      if (op === "$unset") delete target[last];
      if (op === "$inc") target[last] = (target[last] || 0) + value;
    }
}
function memory(initial) {
  let doc = clone(initial);
  const query = (value) => ({
    select() {
      return this;
    },
    lean: async () => clone(value),
    then: (resolve, reject) =>
      Promise.resolve(clone(value)).then(resolve, reject),
  });
  return {
    get: () => clone(doc),
    findOne: (filter) => query(doc && match(doc, filter) ? doc : null),
    updateOne: async (filter, update) => {
      if (!doc || !match(doc, filter))
        return { modifiedCount: 0, matchedCount: 0 };
      mutate(doc, update);
      return { modifiedCount: 1, matchedCount: 1 };
    },
    findOneAndUpdate: (filter, update) => {
      if (!doc || !match(doc, filter)) return query(null);
      mutate(doc, update);
      return query(doc);
    },
  };
}
const now = new Date("2026-10-28T02:00:00Z"),
  key = "a".repeat(64),
  nextKey = "b".repeat(64);
const original = {
  _id: "1",
  reference: "PQR-TEST",
  contact: "Prueba@example.com",
  accessHash: digest(key),
  requestHash: "original",
  subject: "Asunto de prueba",
  createdAt: now,
  history: [],
};
const mail = [];
const mailer = async (m) => {
  mail.push(m);
};
const params = { reference: "PQR-TEST", email: "prueba@example.com" };
let checks = 0;
async function check(name, fn) {
  await fn();
  console.log(`OK ${++checks}: ${name}`);
}
const failure = (e) => e.code === "CONSUMER_RECOVERY_INVALID";
(async () => {
  await check(
    "respuesta indistinguible para radicado inexistente o correo diferente; no envía a terceros",
    async () => {
      const model = memory(original);
      assert.equal(
        (
          await requestRecovery(
            model,
            { ...params, email: "otro@example.com" },
            mailer,
            now,
          )
        ).message,
        RECOVERY_MESSAGE,
      );
      assert.equal(
        (
          await requestRecovery(
            model,
            { ...params, reference: "otro" },
            mailer,
            now,
          )
        ).message,
        RECOVERY_MESSAGE,
      );
      assert.equal(mail.length, 0);
    },
  );
  await check(
    "código al correo original, hash protegido con secreto y cooldown por radicado",
    async () => {
      const model = memory(original);
      await Promise.all([
        requestRecovery(model, params, mailer, now),
        requestRecovery(model, params, mailer, now),
      ]);
      assert.equal(mail.length, 1);
      assert.equal(mail[0].to, "prueba@example.com");
      const code = mail[0].text.match(/recuperación: (\d{6})/)[1];
      assert.notEqual(model.get().recovery.hash, digest(code));
      assert(!JSON.stringify(model.get()).includes(`"${code}"`));
    },
  );
  await check(
    "cinco intentos fallidos bloquean el código y un código caducado no rota la clave",
    async () => {
      const model = memory(original);
      await requestRecovery(model, params, mailer, now);
      const code = mail.at(-1).text.match(/recuperación: (\d{6})/)[1],
        wrong = code === "000000" ? "111111" : "000000";
      for (let i = 0; i < 5; i++)
        await assert.rejects(
          () =>
            confirmRecovery(
              model,
              { ...params, code: wrong, accessKey: nextKey },
              now,
            ),
          failure,
        );
      await assert.rejects(
        () =>
          confirmRecovery(model, { ...params, code, accessKey: nextKey }, now),
        failure,
      );
      assert.equal(model.get().trackingHash, undefined);
      const expired = memory(original);
      await requestRecovery(expired, params, mailer, now);
      await assert.rejects(
        () =>
          confirmRecovery(
            expired,
            {
              ...params,
              code: mail.at(-1).text.match(/recuperación: (\d{6})/)[1],
              accessKey: nextKey,
            },
            new Date(+now + 600001),
          ),
        failure,
      );
    },
  );
  await check(
    "recuperación de un solo uso, reintento tras respuesta perdida y clave anterior revocada",
    async () => {
      const model = memory(original);
      await requestRecovery(model, params, mailer, now);
      const code = mail.at(-1).text.match(/recuperación: (\d{6})/)[1];
      const result = await confirmRecovery(
        model,
        { ...params, code, accessKey: nextKey },
        now,
      );
      assert.equal(result.reference, original.reference);
      assert.equal(model.get().trackingHash, digest(nextKey));
      assert.equal(model.get().accessHash, digest(key));
      assert.equal(model.get().recovery.hash, undefined);
      assert.equal(
        (
          await confirmRecovery(
            model,
            { ...params, code, accessKey: nextKey },
            now,
          )
        ).reference,
        result.reference,
      );
      await assert.rejects(
        () =>
          confirmRecovery(
            model,
            { ...params, code, accessKey: "c".repeat(64) },
            now,
          ),
        failure,
      );
      const saved = Case.findOne;
      Case.findOne = model.findOne;
      const track = router.stack
        .find((l) => l.route?.path === "/cases/track")
        .route.stack.at(-1).handle;
      const response = () => ({
        statusCode: 200,
        status(n) {
          this.statusCode = n;
          return this;
        },
        set() {
          return this;
        },
        json(b) {
          this.body = b;
          return this;
        },
      });
      try {
        let r = response();
        await track(
          { body: { reference: original.reference, accessKey: key } },
          r,
        );
        assert.equal(r.statusCode, 404);
        r = response();
        await track(
          { body: { reference: original.reference, accessKey: nextKey } },
          r,
        );
        assert.equal(r.statusCode, 200);
        assert(!JSON.stringify(r.body).includes(nextKey));
        assert.equal(r.body.trackingHash, undefined);
      } finally {
        Case.findOne = saved;
      }
    },
  );
  await check(
    "dos confirmaciones simultáneas con claves distintas solo permiten una recuperación",
    async () => {
      const model = memory(original);
      await requestRecovery(model, params, mailer, now);
      const code = mail.at(-1).text.match(/recuperación: (\d{6})/)[1];
      const results = await Promise.allSettled([
        confirmRecovery(model, { ...params, code, accessKey: nextKey }, now),
        confirmRecovery(
          model,
          { ...params, code, accessKey: "d".repeat(64) },
          now,
        ),
      ]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
    },
  );
  await check(
    "el fallo de correo no modifica el acceso y se conserva el cooldown",
    async () => {
      const model = memory(original);
      const result = await requestRecovery(
        model,
        params,
        async () => {
          throw Error("SMTP");
        },
        now,
      );
      assert.equal(result.message, RECOVERY_MESSAGE);
      assert.equal(model.get().trackingHash, undefined);
      assert.equal(model.get().recovery.hash, undefined);
      assert(model.get().recovery.sentAt);
      assert.equal(
        await sendCaseReceipt(original, key, async () => {
          throw Error("SMTP");
        }),
        "failed",
      );
      assert.equal(
        await sendCaseReceipt(
          { ...original, contact: "3001234567" },
          key,
          mailer,
        ),
        "not_available",
      );
      assert.equal(await sendCaseReceipt(original, key, mailer), "sent");
    },
  );
  const order = {
    _id: "012345678901234567890123",
    orderNumber: "000123",
    sessionId: "session-test-12345",
    customer: { email: "customer@example.com" },
    createdAt: now,
  };
  await check(
    "vínculo exige acceso firmado a esa compra; un número o id arbitrario no autoriza",
    async () => {
      const model = {
        findById: (id) => ({
          lean: async () => (id === order._id ? order : null),
        }),
      };
      assert.equal(await authorizedCaseOrder({ body: {} }, model), null);
      await assert.rejects(
        () =>
          authorizedCaseOrder(
            { body: { orderId: order._id }, headers: {} },
            model,
          ),
        (e) => e.code === "CONSUMER_ORDER_ACCESS_INVALID",
      );
      const token = issueOrderReturnAccess({
        order,
        secret: process.env.JWT_SECRET,
      }).token;
      const allowed = await authorizedCaseOrder(
        {
          body: { orderId: order._id },
          headers: { "x-order-return-token": token },
        },
        model,
      );
      assert.equal(allowed.orderNumber, "000123");
      await assert.rejects(
        () =>
          authorizedCaseOrder(
            {
              body: { orderId: "112345678901234567890123" },
              headers: { "x-order-return-token": token },
            },
            model,
          ),
        (e) => e.code === "CONSUMER_ORDER_ACCESS_INVALID",
      );
      const pay = createGuestOrderAccessToken({
        orderId: order._id,
        sessionId: order.sessionId,
        secret: process.env.JWT_SECRET,
      });
      const secured = order;
      const pmodel = { findById: () => ({ lean: async () => secured }) };
      assert.equal(
        (
          await authorizedCaseOrder(
            {
              body: { orderId: order._id },
              headers: {
                "x-order-access-token": pay.token || pay,
                "x-session-id": order.sessionId,
              },
            },
            pmodel,
          )
        )._id,
        order._id,
      );
    },
  );
  await check(
    "el servidor conserva el número canónico y no confía en el número escrito",
    async () => {
      const body = {
        name: "Cliente",
        contact: "prueba@example.com",
        type: "complaint",
        orderNumber: "FAKE",
        subject: "Prueba",
        message: "Descripción de una solicitud de prueba",
        privacyAuthorized: true,
        privacyVersion: "v1",
        accessKey: key,
      };
      let stored;
      const Model = {
        findOne: () => ({ select: async () => null }),
        create: async (d) => (stored = d),
      };
      const doc = { version: "v1", seller: {}, sections: [] };
      const receipt = await submitCase(Model, body, doc, now, { order });
      assert.equal(receipt.orderNumber, "000123");
      assert.equal(receipt.orderLinked, true);
      assert.equal(stored.order, order._id);
      assert.equal(stored.recoveryEmail, "prueba@example.com");
      assert.throws(() =>
        normalizeCase({ ...body, recoveryEmail: "no-es-correo" }),
      );
      const replay = {
        findOne: () => ({
          select: async () => ({ ...stored, trackingHash: digest(nextKey) }),
        }),
      };
      await assert.rejects(
        () => submitCase(replay, body, doc, now),
        (e) => e.code === "CONSUMER_CASE_ACCESS_CHANGED",
      );
    },
  );
  await check(
    "solo los radicados de esa compra aparecen y el vínculo manual exige revisión vigente",
    async () => {
      const filter = casesForOrder(order);
      assert(match({ order: order._id }, filter));
      assert(match({ orderNumber: "000123" }, filter));
      assert(!match({ orderNumber: "000999" }, filter));
      assert(!match({ order: "another", orderNumber: "000123" }, filter));
      const doc = { ...original, order: null, revision: 2 };
      const model = memory(doc);
      await assert.rejects(
        () => linkCaseToOrder(model, doc, order, "admin", 1),
        (e) => e.code === "CONSUMER_CASE_CONFLICT",
      );
      await linkCaseToOrder(model, doc, order, "admin", 2);
      assert.equal(model.get().order, order._id);
      assert.equal(model.get().orderLink.method, "admin_verified");
      assert.equal(model.get().revision, 3);
      await assert.rejects(() =>
        linkCaseToOrder(model, model.get(), order, "admin", 3),
      );
    },
  );
  await check(
    "recuperación asistida exige identidad verificada, registra motivo y soporta reintento sin exponer claves",
    async () => {
      const model = memory({ ...original, revision: 1 });
      const body = {
        identityVerified: true,
        reason: "Verificación por teléfono registrado",
        revision: 1,
        accessKey: nextKey,
      };
      await assert.rejects(() =>
        assistedRecovery(
          model,
          model.get(),
          { ...body, identityVerified: false },
          "admin",
        ),
      );
      await assert.rejects(
        () =>
          assistedRecovery(
            model,
            model.get(),
            { ...body, revision: 0 },
            "admin",
          ),
        (e) => e.code === "CONSUMER_CASE_CONFLICT",
      );
      const result = await assistedRecovery(model, model.get(), body, "admin");
      assert.equal(result.revision, 2);
      assert.equal(model.get().accessRecovery.admin, "admin");
      assert.equal(model.get().trackingHash, digest(nextKey));
      assert.equal(JSON.stringify(result).includes(nextKey), false);
      assert.equal(
        (await assistedRecovery(model, model.get(), body, "admin")).revision,
        2,
      );
    },
  );
  await check(
    "campos secretos no seleccionables y rutas administrativas conservan control de rol",
    () => {
      for (const field of [
        "accessHash",
        "trackingHash",
        "recovery",
        "recoveryEmail",
        "receiptEmail",
        "accessRecovery",
      ])
        assert.equal(Case.schema.path(field).options.select, false);
      for (const path of ["/admin/cases", "/admin/cases/:id/order"]) {
        const route = router.stack.find((l) => l.route?.path === path).route;
        assert(route.stack.length >= 3);
      }
    },
  );
  console.log(
    `PASS ${checks} grupos de acceso, recuperación y conexión de PQR; sin correos ni datos reales`,
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
