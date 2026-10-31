"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { policyDocument } = require("../services/consumer/policies");
const { buildConsumerOffer } = require("../services/consumer/checkoutContract");
// Golden hashes recorded before extracting the presentation topics.
const cases = [
  {
    settings: {},
    sectionsHash:
      "2ce5b77c5c0ef4e0c70098ccf5a6738970b3826d83f2cc2066c782039a7fa409",
    offerFingerprint:
      "6203244077b241c210aefe8e06c1139d168f8f4d49c74a7d80061af12a50ee0b",
  },
  {
    settings: {
      consumerProtection: {
        revision: 2,
        privacyEffectiveDate: "2026-10-27",
        retention: "Criterio de prueba",
        processors: "Proveedor de prueba",
      },
    },
    sectionsHash:
      "33ddae9f5483fd944f27039bd722c5178b0fa4e3ea56160e1c3fe4490dc3c9a5",
    offerFingerprint:
      "227bffbaee813b544ac4f714665a402ff95aa40ce18160276010aeff12d7ae27",
  },
  {
    settings: {
      consumerProtection: {
        revision: 9,
        privacyEffectiveDate: "2026-01-01",
        retention: "Conservación según documento. Revisión posterior.",
        processors: "Proveedor A\nProveedor B",
      },
      consumerReturnPolicy: {
        enabled: true,
        windowDays: 20,
        revision: 4,
        policyText: "Condiciones comerciales de prueba.",
      },
    },
    sectionsHash:
      "b610510914bea06d20bebd3dbb56cfe93612a756e2c47d116c3a394117253133",
    offerFingerprint:
      "a396ed8fc14bd02a709cfb6936fc44ffe2eecd5b969ee377e368d129c05eb76c",
  },
  {
    settings: {
      store: {
        name: "Negocio de prueba",
        businessName: "Identidad pública",
        supportEmail: "prueba@example.com",
        phone: "3001234567",
        address: "Dirección de prueba",
        city: "Bogotá",
      },
      consumerProtection: {
        nit: "900123456-7",
        privacyEffectiveDate: "2026-10-27",
        retention: "Vigencia de esta política: otro texto.",
        processors:
          "Las transmisiones o transferencias deben cumplir las reglas aplicables.",
      },
      theme: {
        global: {
          envios: {
            active: true,
            mode: "fixed",
            fixedPrice: 10000,
          },
          payments: {
            provider: "manual",
            currency: "COP",
          },
        },
      },
    },
    sectionsHash:
      "65214678047251b27e5a9e341b19cd098bf510f2b9289aa0312f8fba2250d02b",
    offerFingerprint:
      "8f1e6caaee88118d30bc1fa5a48353b479a14e76ba5f1b8726104996ddda1384",
  },
];
for (const [index, item] of cases.entries()) {
  const doc = policyDocument(item.settings);
  assert.equal(
    crypto
      .createHash("sha256")
      .update(JSON.stringify(doc.sections))
      .digest("hex"),
    item.sectionsHash,
    "Canonical purchase policies changed",
  );
  assert.equal(
    buildConsumerOffer({
      settings: item.settings,
      now: new Date("2026-10-28T12:00:00Z"),
    }).fingerprint,
    item.offerFingerprint,
    "Purchase fingerprint changed",
  );
  assert.deepEqual(
    doc.privacySections.map((section) => section.id),
    ["datos", "autorizacion", "conservacion", "consultas"],
  );
  let remaining = doc.sections.find(
    (section) => section.id === "privacidad",
  ).body;
  for (const section of doc.privacySections)
    for (const fragment of [
      ...section.paragraphs,
      ...(section.note ? [section.note] : []),
    ]) {
      const at = remaining.indexOf(fragment);
      assert(at >= 0, "Topic introduced text outside the canonical policy");
      remaining =
        remaining.slice(0, at) + remaining.slice(at + fragment.length);
    }
  assert.equal(
    remaining.trim(),
    "",
    "Topics omitted part of the canonical policy",
  );
  console.log(
    `OK ${index + 1}: políticas y huella histórica idénticas; lectura por temas íntegra`,
  );
}
console.log(
  "PASS 4 escenarios de compatibilidad de la política y sus condiciones de compra",
);
