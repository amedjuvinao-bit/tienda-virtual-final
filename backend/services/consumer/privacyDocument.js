"use strict";
// One text source serves both the immutable purchase policy and its public reading sections.
function privacyDocument(c) {
  const responsible = `El responsable del tratamiento es el vendedor identificado en esta página.`;
  const purposes = `Tratamos los datos de contacto, identificación, compra y entrega necesarios para gestionar pedidos, pagos, facturación, logística, atención y obligaciones legales.`;
  const security = `No envíes contraseñas, datos de tarjetas ni información sensible en un reclamo.`;
  const marketing = `Las comunicaciones comerciales requieren una autorización independiente y opcional, que puedes retirar.`;
  const rights = `Puedes conocer, actualizar y rectificar tus datos, pedir prueba de la autorización, conocer su uso, acceder gratuitamente y solicitar revocatoria o supresión cuando proceda, así como acudir a la SIC después de agotar el trámite ante el responsable.`;
  const contact = `Presenta consultas o reclamos por el canal de Peticiones y reclamos o los datos de contacto publicados.`;
  const deadlines = `Las consultas se atienden en 10 días hábiles, prorrogables hasta 5 más con aviso previo motivado; los reclamos completos en 15 días hábiles, prorrogables hasta 8 más con aviso motivado y fecha de respuesta.`;
  const retention = `La conservación informada por el responsable es: ${c.retention || "pendiente de configurar"}.`;
  const processors = `Encargados y tratamiento mediante proveedores: ${c.processors || "pendiente de configurar"}.`;
  const transfers = `Las transmisiones o transferencias deben cumplir las reglas aplicables.`;
  const effective = `Vigencia de esta política: ${c.privacyEffectiveDate || "pendiente de configurar"}.`;
  return {
    body: [
      responsible,
      purposes,
      security,
      marketing,
      rights,
      contact,
      deadlines,
      retention,
      processors,
      transfers,
      effective,
    ].join(" "),
    sections: [
      {
        id: "datos",
        title: "Datos y finalidades",
        paragraphs: [purposes, responsible],
        note: security,
      },
      {
        id: "autorizacion",
        title: "Autorización y comunicaciones",
        paragraphs: [marketing],
      },
      {
        id: "conservacion",
        title: "Conservación y proveedores",
        paragraphs: [retention, processors, transfers, effective],
      },
      {
        id: "consultas",
        title: "Consultas y reclamos",
        paragraphs: [rights, contact, deadlines],
      },
    ],
  };
}
module.exports = { privacyDocument };
