"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildPlan, fingerprint, saveBackup, applyTransaction } = require("./repairNewsletterEmailIndex.cjs");
const EJSON = { serialize: v => JSON.parse(JSON.stringify(v)), stringify: JSON.stringify, parse: JSON.parse };
function fixture() {
  return Array.from({ length: 7 }, (_, i) => ({
    _id: String(i + 1), email: i < 3 ? "persona@example.test" : "correo-invalido",
    phone: i === 3 ? "3123" : "3001234567", sessionId: "sesion-" + i,
    origen: i % 2 ? "footer" : "checkout", createdAt: "2025-01-01T00:00:00Z",
    custom: { nested: [i, { preserve: true }] },
  }));
}
function database(initial, { events = 0, changedResult = false, corrupt = false, extraDuplicate = false } = {}) {
  let rows = structuredClone(initial), transactionRows;
  const trace = [];
  const source = options => options?.session ? transactionRows : rows;
  const collection = {
    aggregate(_pipeline, options) {
      return { async toArray() {
        const counts = new Map();
        for (const doc of source(options)) if (typeof doc.email === "string" && doc.email)
          counts.set(doc.email, (counts.get(doc.email) || 0) + 1);
        const result = [...counts].filter(([, n]) => n > 1).map(([email, count]) => ({ _id: email, count }));
        return result;
      }};
    },
    find(query, options) {
      return { async toArray() {
        return structuredClone(source(options).filter(doc => query.email
          ? query.email.$in.includes(doc.email) : query._id.$in.includes(doc._id)));
      }};
    },
    async updateOne(filter, operation, options) {
      trace.push({ filter, operation });
      const row = source(options).find(doc => doc._id === filter._id && doc.email === filter.email);
      if (!row || changedResult) return { matchedCount: 0, modifiedCount: 0 };
      delete row.email;
      if (corrupt) row.phone = "CORRUPTO";
      if (extraDuplicate && trace.length === 6) source(options).push(
        { _id: "8", email: "otro@example.test", phone: "a" },
        { _id: "9", email: "otro@example.test", phone: "b" },
      );
      return { matchedCount: 1, modifiedCount: 1 };
    },
  };
  const eventCollection = { async countDocuments() { return events; } };
  const session = {
    ended: false,
    async withTransaction(task) {
      transactionRows = structuredClone(rows);
      try { await task(); rows = transactionRows; }
      finally { transactionRows = undefined; }
    },
    async endSession() { this.ended = true; },
  };
  return { collection, eventCollection, mongoose: { async startSession() { return session; } },
    rows: () => structuredClone(rows), trace, session };
}

test("el plan conserva el registro mas antiguo y mantiene intactos los originales", () => {
  const docs = fixture(), before = structuredClone(docs);
  const plan = buildPlan([...docs].reverse());
  assert.equal(plan.affected, 7);
  assert.equal(plan.keep._id, "1");
  assert.equal(plan.detach.length, 6);
  assert.deepEqual(docs, before);
});
test("repeticion sin duplicados no propone cambios de contactos", () => assert.equal(buildPlan([]).detach.length, 0));
test("cambios inesperados de cantidad o composicion cancelan el plan", () => {
  assert.throws(() => buildPlan(fixture().slice(0, 6)));
  const docs = fixture(); docs[0].email = "otro@example.test";
  assert.throws(() => buildPlan(docs));
});
test("no selecciona un principal entre telefonos diferentes", () => {
  const docs = fixture(); docs[1].phone = "OTRO";
  assert.throws(() => buildPlan(docs));
});
test("impide contactos sin medios de contacto o emails con estructuras inesperadas", () => {
  for (const value of [undefined, "", [], null]) {
    const docs = fixture(); docs[4].phone = value;
    assert.throws(() => buildPlan(docs));
  }
  const docs = fixture(); docs[0].email = ["persona@example.test"];
  assert.throws(() => buildPlan(docs));
});
test("conserva evidencia: rechaza autorizaciones, retiros, historial y verificaciones", () => {
  for (const evidence of [{ status: "granted" }, { status: "withdrawn" }, { consent: {} },
    { consentHistory: [{ proofReference: "prueba" }] }, { verification: {} }]) {
    const docs = fixture(); Object.assign(docs[2], evidence);
    assert.throws(() => buildPlan(docs));
  }
});
test("respaldo completo se escribe fuera del proyecto y se verifica antes de mutar", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "test-suscriptores-"));
  try {
    const docs = fixture();
    const filename = saveBackup({ docs, database: "prueba", EJSON, directory });
    const backup = JSON.parse(fs.readFileSync(filename, "utf8"));
    assert.deepEqual(backup.records, docs);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o600);
  } finally { fs.rmSync(directory, { recursive: true }); }
});
test("un destino de respaldo inutilizable falla sin continuar", () => {
  assert.throws(() => saveBackup({ docs: fixture(), database: "test", EJSON, directory: __filename }));
});
test("la correccion conserva siete ids, telefonos, sesiones y todos los demas campos", async () => {
  const docs = fixture(), db = database(docs);
  await applyTransaction({ ...db, docs, plan: buildPlan(docs), EJSON });
  const after = db.rows();
  assert.equal(after.length, 7);
  assert.equal(after.filter(doc => doc.email).length, 1);
  assert.equal(db.trace.length, 6);
  for (const doc of after) {
    const original = docs.find(old => old._id === doc._id);
    const expected = { ...original }; if (doc._id !== "1") delete expected.email;
    assert.deepEqual(doc, expected);
  }
  assert.equal(db.session.ended, true);
});
test("una modificacion concurrente impide cualquier escritura", async () => {
  const docs = fixture(), changed = fixture(); changed[4].custom.nested.push("nuevo");
  const db = database(changed);
  await assert.rejects(applyTransaction({ ...db, docs, plan: buildPlan(docs), EJSON }), { code: "DATOS_CAMBIARON" });
  assert.deepEqual(db.rows(), changed); assert.equal(db.trace.length, 0);
});
test("los eventos de consentimiento bloquean cualquier cambio", async () => {
  const docs = fixture(), db = database(docs, { events: 1 });
  await assert.rejects(applyTransaction({ ...db, docs, plan: buildPlan(docs), EJSON }));
  assert.deepEqual(db.rows(), docs); assert.equal(db.trace.length, 0);
});
test("si falla una escritura se revierte toda la transaccion", async () => {
  const docs = fixture(), db = database(docs, { changedResult: true });
  await assert.rejects(applyTransaction({ ...db, docs, plan: buildPlan(docs), EJSON }));
  assert.deepEqual(db.rows(), docs);
});
test("la verificacion impide guardar cambios accidentales en otros campos", async () => {
  const docs = fixture(), db = database(docs, { corrupt: true });
  await assert.rejects(applyTransaction({ ...db, docs, plan: buildPlan(docs), EJSON }));
  assert.deepEqual(db.rows(), docs);
});
test("no confirma la transaccion si sigue habiendo correos duplicados", async () => {
  const docs = fixture(), db = database(docs, { extraDuplicate: true });
  await assert.rejects(applyTransaction({ ...db, docs, plan: buildPlan(docs), EJSON }));
  assert.deepEqual(db.rows(), docs);
});
test("la comparacion de respaldo no depende del orden de documentos ni de campos", () => {
  const docs = fixture();
  const reversed = docs.map(doc => Object.fromEntries(Object.entries(doc).reverse())).reverse();
  assert.equal(fingerprint(docs, EJSON), fingerprint(reversed, EJSON));
});
