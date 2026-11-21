"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { policyDocument } = require("../services/consumer/policies");
const { buildConsumerOffer } = require("../services/consumer/checkoutContract");
// Huellas de la política vigente, que incorpora las preferencias de contenido externo.
// Una edición de su presentación debe conservar estos textos y esta oferta.
const cases = [
  {
    settings: {},
    sectionsHash:
      "54ed508948d9c77dbd7b8dd3c8d1d7a5a0d75501f21caced0a698a433d8536b5",
    offerFingerprint:
      "18dfef79309f4538a4c238ec4ac18b712e52cafabae652cde93b20f8955729ec",
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
      "9ecfe9fca56e18cafe2f714881bf0ebe3224c9a62aa84197a4e2d395543d1d73",
    offerFingerprint:
      "98765b9b4d2bdaa6c2bf2895c0c0bd17d8a8bf9cf1d7796ea9c2ae8f59a191d2",
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
      "fae5bc3bfbcd3fe0a26315fb33f4384a65c336edd7f920ad7f7b9424e4126b3c",
    offerFingerprint:
      "0588466d8d00c8ff0fd23a11e6f2b9ab571fad98ca7156402e7181f5476cc9d6",
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
      "76f5db23709ac6708dfba0f23e6c6d227446cf632b4a99f58d372ed2bea2303c",
    offerFingerprint:
      "2249c3a65ccffc088b9674a25e91fe779abe77e6bd16e12215f720c59f25da93",
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
    ["datos", "autorizacion", "conservacion", "consultas", "cookies"],
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
    `OK ${index + 1}: política vigente y huella de compra conservadas; lectura por temas íntegra`,
  );
}
console.log(
  "PASS 4 escenarios de compatibilidad de la política y sus condiciones de compra",
);
