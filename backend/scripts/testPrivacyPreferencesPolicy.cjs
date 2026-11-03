"use strict";
const assert = require("node:assert/strict");
const test = require("node:test");
const preferences = require("../../shared/storefrontPrivacyPreferences.json");
const { privacyDocument } = require("../services/consumer/privacyDocument");

test("la política canónica contiene la información de los controles reales de preferencias", () => {
  const document = privacyDocument({ retention: "Conservación por finalidad", processors: "Proveedores configurados", privacyEffectiveDate: "2026-11-03" });
  const section = document.sections.find(row => row.id === "cookies");
  assert(section);
  assert(section.paragraphs.includes(preferences.notice));
  assert(section.paragraphs.includes(preferences.storageNotice));
  assert(section.paragraphs.includes(preferences.withdrawalNotice));
  for (const paragraph of section.paragraphs) assert(document.body.includes(paragraph));
  assert(document.body.includes("Instagram y TikTok"));
  assert(document.body.includes("OpenStreetMap"));
});
test("se conservan las secciones existentes y se publica un único texto íntegro", () => {
  const document = privacyDocument({});
  assert.deepEqual(document.sections.map(row => row.id), ["datos", "autorizacion", "conservacion", "consultas", "cookies"]);
  let remaining = document.body;
  for (const section of document.sections) {
    for (const fragment of [...section.paragraphs, ...(section.note ? [section.note] : [])]) {
      assert(remaining.includes(fragment));
      remaining = remaining.replace(fragment, "");
    }
  }
  assert.equal(remaining.trim(), "");
});
test("la política cabe en la constancia de suscripción con los máximos de configuración", () => {
  const document = privacyDocument({ retention: "r".repeat(1000), processors: "p".repeat(2000), privacyEffectiveDate: "2026-11-03" });
  assert(document.body.length < 12000);
});
test("el aviso no configura publicidad ni modifica por sí solo permisos de correo", () => {
  assert.deepEqual(Object.keys(preferences.categories), ["social", "maps"]);
  assert(preferences.notice.includes("Rechazarlos no impide comprar"));
  assert(preferences.withdrawalNotice.includes("independientes de la suscripción por correo"));
});
