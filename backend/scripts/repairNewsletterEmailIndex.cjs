"use strict";

// Ejecutar desde backend: node scripts/repairNewsletterEmailIndex.cjs [--apply].
// Sin --apply solo muestra el resumen. No cambia el codigo de la tienda.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

function fail(message, code = "REQUIERE_REVISION") {
  throw Object.assign(new Error(message), { code, safeMessage: message });
}

function hasEvidence(doc) {
  return (
    ![undefined, null, "unknown"].includes(doc.status) ||
    doc.consent != null ||
    (doc.consentHistory != null &&
      (!Array.isArray(doc.consentHistory) || doc.consentHistory.length > 0)) ||
    doc.verification != null
  );
}

function buildPlan(docs) {
  const groups = new Map();
  for (const doc of docs) {
    if (typeof doc.email !== "string" || !doc.email.trim())
      fail("La estructura de los registros cambio. No se aplicaron cambios.");
    const group = groups.get(doc.email) || [];
    group.push(doc);
    groups.set(doc.email, group);
  }
  if (docs.length === 0) return { affected: 0, detach: [] };
  const grouped = [...groups.entries()];
  const valid = grouped.filter(([email]) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  const invalid = grouped.filter(([email]) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
  if (
    docs.length !== 7 || grouped.length !== 2 ||
    valid.length !== 1 || valid[0][1].length !== 3 ||
    invalid.length !== 1 || invalid[0][1].length !== 4
  ) fail("Los duplicados no coinciden con los dos grupos revisados. No se aplicaron cambios.");
  if (docs.some(hasEvidence))
    fail("Hay autorizaciones, historial o verificaciones activas. Se requiere conservar y conciliar esa evidencia antes de corregir.");
  const contacts = valid[0][1];
  if (new Set(contacts.map(doc => String(doc.phone || "").trim())).size !== 1)
    fail("El correo valido ahora tiene telefonos diferentes. No se eligio un registro principal automaticamente.");
  const keep = [...contacts].sort((a, b) => String(a._id).localeCompare(String(b._id)))[0];
  const detach = docs.filter(doc => doc !== keep);
  if (detach.some(doc => typeof doc.phone !== "string" || !doc.phone.trim()))
    fail("Uno de los contactos quedaria sin correo ni telefono. No se aplicaron cambios.");
  return { affected: docs.length, keep, detach };
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

function fingerprint(docs, EJSON) {
  const sorted = [...docs].sort((a, b) => String(a._id).localeCompare(String(b._id)));
  return JSON.stringify(canonical(EJSON.serialize(sorted, { relaxed: false })));
}

async function readDuplicates(collection, session) {
  const groups = await collection.aggregate([
    { $match: { email: { $type: "string", $gt: "" } } },
    { $group: { _id: "$email", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
  ], { ...(session ? { session } : {}), allowDiskUse: true }).toArray();
  if (!groups.length) return [];
  // Consultar documentos originales, sin defaults ni transformaciones de Mongoose.
  return collection.find({ email: { $in: groups.map(group => group._id) } },
    session ? { session } : {}).toArray();
}

function saveBackup({ docs, database, EJSON, directory }) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const filename = path.join(directory, "suscriptores-" + Date.now() + "-" + crypto.randomUUID() + ".json");
  const payload = EJSON.stringify({
    format: "newsletter-email-repair-v1",
    database, collection: "subscribers", capturedAt: new Date(), records: docs,
    operation: "Retirar solo el campo email de seis contactos, conservando documentos e identificadores.",
  }, null, 2, { relaxed: false });
  const descriptor = fs.openSync(filename, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, payload, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  const written = fs.readFileSync(filename, "utf8");
  const backup = EJSON.parse(written, { relaxed: false });
  if (written !== payload || fingerprint(backup.records, EJSON) !== fingerprint(docs, EJSON))
    fail("No se pudo verificar el respaldo. No se aplicaron cambios.", "RESPALDO_NO_VERIFICADO");
  return filename;
}

async function applyTransaction({ collection, eventCollection, mongoose, docs, plan, EJSON }) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const current = await readDuplicates(collection, session);
      if (fingerprint(current, EJSON) !== fingerprint(docs, EJSON))
        fail("Los registros cambiaron despues del respaldo. No se aplicaron cambios.", "DATOS_CAMBIARON");
      buildPlan(current);
      if (await eventCollection.countDocuments({ subscriber: { $in: docs.map(doc => doc._id) } }, { session }))
        fail("Existen eventos de autorizacion asociados. No se aplicaron cambios.");
      for (const doc of plan.detach) {
        const result = await collection.updateOne(
          { _id: doc._id, email: doc.email }, { $unset: { email: "" } }, { session },
        );
        if (result.matchedCount !== 1 || result.modifiedCount !== 1)
          fail("No coincidio un contacto con el respaldo. Se cancelo la transaccion.");
      }
      const after = await collection.find({ _id: { $in: docs.map(doc => doc._id) } }, { session }).toArray();
      const detachedIds = new Set(plan.detach.map(doc => String(doc._id)));
      const expected = docs.map(doc => {
        const copy = { ...doc };
        if (detachedIds.has(String(doc._id))) delete copy.email;
        return copy;
      });
      if (fingerprint(after, EJSON) !== fingerprint(expected, EJSON))
        fail("No se verifico la conservacion completa de los siete contactos. Se cancelo la transaccion.");
      if ((await readDuplicates(collection, session)).length)
        fail("Aparecieron otros correos repetidos. Se cancelo la transaccion.");
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
}

async function main(argv = process.argv.slice(2)) {
  if (argv.some(arg => arg !== "--apply")) fail("Uso: node scripts/repairNewsletterEmailIndex.cjs [--apply]", "ARGUMENTO_INVALIDO");
  const backend = path.resolve(__dirname, "..");
  if (!fs.existsSync(path.join(backend, "config", "env.js")))
    fail("El script debe estar en backend/scripts del proyecto.", "CARPETA_INCORRECTA");
  const mongoose = require("mongoose");
  const { env } = require(path.join(backend, "config", "env"));
  const { EMAIL_INDEX_OPTIONS, coversEmail } = require(path.join(backend, "services", "newsletter", "indexes"));
  const EJSON = mongoose.mongo.BSON.EJSON;
  let backup, committed = false;
  try {
    await mongoose.connect(env.mongoUri, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 15000 });
    const db = mongoose.connection.db;
    const collection = db.collection("subscribers");
    const Event = require(path.join(backend, "models", "NewsletterConsentEvent"));
    const eventCollection = db.collection(Event.collection.name);
    const docs = await readDuplicates(collection);
    const plan = buildPlan(docs);
    if (docs.length && await eventCollection.countDocuments({ subscriber: { $in: docs.map(doc => doc._id) } }))
      fail("Hay historial de autorizaciones asociado a estos contactos. No se aplicaron cambios.");
    console.log("Contactos revisados:", plan.affected);
    console.log("Contactos que conservaran solo su telefono:", plan.detach.length);
    if (!argv.includes("--apply")) {
      console.log("Solo revision. Para aplicar: node scripts/repairNewsletterEmailIndex.cjs --apply");
      return;
    }
    if (docs.length) {
      backup = saveBackup({ docs, database: db.databaseName, EJSON,
        directory: path.join(os.homedir(), "TiendaVirtual-respaldos") });
      console.log("Respaldo completo verificado:", backup);
      await applyTransaction({ collection, eventCollection, mongoose, docs, plan, EJSON });
      committed = true;
      console.log("Correccion aplicada. Se conservaron los siete documentos y sus identificadores.");
    }
    let indexes = await collection.listIndexes().toArray();
    if (!indexes.some(coversEmail)) await collection.createIndex({ email: 1 }, EMAIL_INDEX_OPTIONS);
    indexes = await collection.listIndexes().toArray();
    const unique = indexes.find(coversEmail);
    if (!unique || (await readDuplicates(collection)).length)
      fail("No se pudo verificar el indice unico de correo.", "INDICE_NO_VERIFICADO");
    console.log("Indice unico verificado:", unique.name);
    console.log("LISTO. Vuelve al formulario e intenta suscribirte. Falta comprobar que llegue el codigo.");
  } catch (error) {
    if (backup) console.error("Respaldo conservado:", backup);
    if (committed) console.error("Los cambios de datos se guardaron, pero el indice no quedo verificado. No se ha confirmado la reparacion completa.");
    else console.error("No se confirmaron cambios en los contactos.");
    throw error;
  } finally {
    await mongoose.disconnect();
  }
}

module.exports = { hasEvidence, buildPlan, fingerprint, readDuplicates, saveBackup, applyTransaction, main };
if (require.main === module) main().catch(error => {
  console.error(error.safeMessage || "No se completo la correccion. Copia los codigos de este resultado para revisar la causa.");
  console.error("Codigo:", error.code || error.name || "ERROR");
  if (error.codeName) console.error("Tipo:", error.codeName);
  process.exitCode = 1;
});
