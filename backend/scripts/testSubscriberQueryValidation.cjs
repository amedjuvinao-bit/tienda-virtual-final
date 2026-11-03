"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Subscriber = require("../models/Subscriber");

// Mongoose real: casting, subdocumentos y validadores de consulta completos.
// Solo se sustituye la frontera de persistencia; no se conecta a MongoDB.
const original = Subscriber.collection.findOneAndUpdate;
let writes = [];
Subscriber.collection.findOneAndUpdate = async (filter, update) => {
  writes.push({ filter, update });
  return {
    _id: new mongoose.Types.ObjectId(), email: "persona@example.test",
    status: "unknown", verification: update.$set?.verification,
  };
};
test.after(() => { Subscriber.collection.findOneAndUpdate = original; });
test.beforeEach(() => { writes = []; });

const options = { upsert: true, new: true, runValidators: true };
function verificationUpdate(email = "persona@example.test") {
  const now = new Date("2026-11-03T00:00:00Z");
  return {
    $set: { verification: {
      nonce: "test-nonce", hash: "a".repeat(64), attempts: 0,
      intent: "subscribe", sentAt: now, expiresAt: new Date(+now + 600000),
      proof: { version: "version-1", text: "Autorizacion de prueba.",
        privacyText: "Politica de prueba.", source: "web", channel: "email",
        method: "email_code", requestedAt: now },
    } },
    $setOnInsert: { email, origen: "web", fecha: now, status: "unknown" },
  };
}

test("solicitud de codigo con upsert valida el correo real y alcanza persistencia", async () => {
  const update = verificationUpdate();
  const result = await Subscriber.findOneAndUpdate({ email: "persona@example.test",
    $or: [{ "verification.sentAt": { $exists: false } }] }, update, options).select("+verification");
  assert.equal(writes.length, 1);
  assert.equal(result.status, "unknown");
  assert.equal(result.verification.nonce, "test-nonce");
  assert.equal(writes[0].update.$setOnInsert.email, "persona@example.test");
});
test("la misma actualizacion valida sobre un contacto existente sin conceder autorizacion", async () => {
  await Subscriber.findOneAndUpdate({ email: "persona@example.test" }, verificationUpdate(), options);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].update.$set.status, undefined);
  assert.equal(writes[0].update.$set.consent, undefined);
});
test("un contacto nuevo por telefono sigue siendo valido", async () => {
  await Subscriber.findOneAndUpdate({ phone: "3001234567" }, {
    $setOnInsert: { phone: "3001234567", status: "unknown" },
  }, options);
  assert.equal(writes.length, 1);
});
test("un correo actualizado conserva conversion a minusculas y espacios eliminados", async () => {
  await Subscriber.findOneAndUpdate({ _id: new mongoose.Types.ObjectId() }, {
    $set: { email: " PERSONA@EXAMPLE.TEST " },
  }, { new: true, runValidators: true });
  assert.equal(writes[0].update.$set.email, "persona@example.test");
});
test("correo vacio con telefono propuesto sigue teniendo un medio de contacto", async () => {
  await Subscriber.findOneAndUpdate({}, { $set: { email: "", phone: "3001234567" } }, options);
  assert.equal(writes.length, 1);
});
test("telefono vacio con correo de insercion valido conserva la regla de contacto", async () => {
  await Subscriber.findOneAndUpdate({}, {
    $set: { phone: "" }, $setOnInsert: { email: "persona@example.test" },
  }, options);
  assert.equal(writes.length, 1);
});
test("ambos contactos vacios se rechazan antes de persistir", async () => {
  await assert.rejects(Subscriber.findOneAndUpdate({}, {
    $set: { email: "", phone: "" },
  }, options), error => error.name === "ValidationError");
  assert.equal(writes.length, 0);
});
test("actualizar solo la verificacion no altera los medios de contacto", async () => {
  const update = verificationUpdate();
  delete update.$setOnInsert;
  await Subscriber.findOneAndUpdate({ email: "persona@example.test" }, update,
    { new: true, runValidators: true });
  assert.equal(writes.length, 1);
  assert.equal(writes[0].update.$set.email, undefined);
  assert.equal(writes[0].update.$set.phone, undefined);
});
test("no se desactivan otros validadores de la solicitud", async () => {
  const update = verificationUpdate();
  update.$set.verification.proof.privacyText = "x".repeat(12001);
  await assert.rejects(Subscriber.findOneAndUpdate({}, update, options), error => {
    assert.equal(error.name, "ValidationError");
    assert(error.errors["verification.proof.privacyText"]);
    return true;
  });
  assert.equal(writes.length, 0);
});
test("la validacion de documentos conserva correos, telefonos y rechazo de vacios", async () => {
  await new Subscriber({ email: "persona@example.test" }).validate();
  await new Subscriber({ phone: "3001234567" }).validate();
  await assert.rejects(new Subscriber({ email: "", phone: "" }).validate(), error => error.name === "ValidationError");
});
