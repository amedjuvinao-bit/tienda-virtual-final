'use strict';

const assert = require('node:assert/strict');

const ElectronicInvoice = require('../../models/ElectronicInvoice');
const {
  downloadOfficialCreditNoteDocument,
} = require('../../services/electronicCreditNoteDocumentService');
const {
  createElectronicInvoiceIssuanceService,
} = require('../../services/electronicInvoiceIssuanceService');
const {
  downloadOfficialInvoiceDocument,
} = require('../../services/electronicInvoiceDocumentService');
const {
  buildFactusInvoicePayload,
} = require('../../lib/dian/providers/factus/factusProvider');
const { clean } = require('./config');

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function retry(label, action, attempts = 6) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(attempt * 800);
    }
  }
  throw Object.assign(
    new Error(`${label}: ${lastError?.message || 'sin confirmación'}`),
    { code: lastError?.code || 'SANDBOX_DOCUMENT_RETRY_FAILED' }
  );
}

function assertValidatedInvoice(invoice) {
  assert(invoice, 'No se encontró la factura electrónica.');
  assert.strictEqual(clean(invoice?.provider?.name, 40).toLowerCase(), 'factus');
  assert.strictEqual(invoice?.provider?.isValidated, true, 'Factus no validó la factura.');
  assert(invoice.invoiceNumber && invoice.cufe, 'La factura no conserva número y CUFE.');
}

function assertIdentifiedFactusCustomer(order) {
  assert.strictEqual(
    order?.billing?.isFinalConsumer,
    false,
    'La orden de prueba no quedó marcada explícitamente como comprador identificado.'
  );

  const payload = buildFactusInvoicePayload({ order });
  const customer = payload?.customer || {};
  const expected = {
    documentNumber: clean(order?.billing?.documentNumber || order?.customer?.id, 60),
    name: clean(
      [
        order?.billing?.firstName || order?.customer?.name,
        order?.billing?.lastName || order?.customer?.lastname,
      ].filter(Boolean).join(' '),
      220
    ),
    email: clean(order?.billing?.email || order?.customer?.email, 220),
    address: clean(order?.billing?.address || order?.customer?.address, 220),
    municipalityCode: clean(
      order?.billing?.municipalityCode || order?.customer?.municipalityId,
      30
    ),
  };

  assert(expected.documentNumber, 'La prueba no creó documento fiscal para el comprador.');
  assert(expected.name, 'La prueba no creó nombre fiscal para el comprador.');
  assert(expected.email, 'La prueba no creó correo fiscal para el comprador.');
  assert(expected.address, 'La prueba no creó dirección fiscal para el comprador.');
  assert(expected.municipalityCode, 'La prueba no creó municipio fiscal para el comprador.');
  assert.notStrictEqual(
    customer.identification,
    '222222222222',
    'La prueba intentó facturar como consumidor final.'
  );
  assert.strictEqual(customer.identification, expected.documentNumber);
  assert.strictEqual(customer.names, expected.name);
  assert.strictEqual(customer.email, expected.email);
  assert.strictEqual(customer.address, expected.address);
  assert.strictEqual(customer.municipality_code, expected.municipalityCode);

  return expected;
}

function assertOfficialXmlCustomer(xmlDocument, expected) {
  assert(Buffer.isBuffer(xmlDocument?.buffer), 'Factus no devolvió el XML oficial.');
  const xml = xmlDocument.buffer.toString('utf8');

  [
    ['documento', expected.documentNumber],
    ['nombre', expected.name],
    ['correo', expected.email],
    ['dirección', expected.address],
    ['municipio', expected.municipalityCode],
  ].forEach(([label, value]) => {
    assert(
      xml.includes(value),
      `El XML oficial de Factus no contiene ${label} del comprador: ${value}`
    );
  });
  assert(
    !xml.includes('222222222222'),
    'El XML oficial de Factus sustituyó al comprador por consumidor final.'
  );
}

async function verifyInvoiceDocuments(order, invoice, expectedCustomer) {
  const [pdf, xml] = await Promise.all([
    retry('PDF de factura no confirmado', () =>
      downloadOfficialInvoiceDocument({ orderId: order._id, type: 'pdf' })
    ),
    retry('XML de factura no confirmado', () =>
      downloadOfficialInvoiceDocument({ orderId: order._id, type: 'xml' })
    ),
  ]);
  assert(pdf.byteLength > 1000 && xml.byteLength > 500, 'Factura PDF/XML vacía.');
  assertOfficialXmlCustomer(xml, expectedCustomer);
}

async function ensureFactusInvoice({ order, transaction, payments }) {
  const expectedCustomer = assertIdentifiedFactusCustomer(order);
  let invoice = await ElectronicInvoice.findOne({ orderId: order._id });
  if (!invoice || invoice?.provider?.isValidated !== true) {
    const service = createElectronicInvoiceIssuanceService();
    const result = await service.issueElectronicInvoiceForOrder({
      orderId: order._id,
      source: 'wompi-factus-sandbox-trace',
      initiatedBy: 'QA Wompi + Factus + Envia Sandbox',
      transaction,
      payments,
      skipWhenElectronicBillingIsInactive: false,
      allowRetry: true,
    });
    invoice = result?.invoice || (await ElectronicInvoice.findOne({ orderId: order._id }));
    if (result?.inProgress === true || invoice?.provider?.isValidated !== true) {
      invoice = await retry('La factura no alcanzó un estado validado', async () => {
        const current = await ElectronicInvoice.findOne({ orderId: order._id });
        assertValidatedInvoice(current);
        return current;
      });
    }
  }
  assertValidatedInvoice(invoice);
  assert.strictEqual(invoice?.customer?.documentNumber, expectedCustomer.documentNumber);
  assert.strictEqual(invoice?.customer?.email, expectedCustomer.email);
  assert.strictEqual(invoice?.customer?.address, expectedCustomer.address);
  assert.strictEqual(
    invoice?.customer?.municipalityCode,
    expectedCustomer.municipalityCode
  );
  await verifyInvoiceDocuments(order, invoice, expectedCustomer);
  return invoice;
}

function findValidatedCreditNote(invoice = {}) {
  return (invoice.creditNotes || []).find(
    (note) =>
      clean(note?.status, 40).toLowerCase() === 'validated' &&
      note?.provider?.number &&
      (note?.provider?.cude || note?.provider?.cufe)
  );
}

async function verifyCreditNoteDocuments(invoice) {
  const note = findValidatedCreditNote(invoice);
  assert(note, 'Factus no dejó una nota crédito validada con número y CUDE.');
  const [pdf, xml] = await Promise.all([
    retry('PDF de nota crédito no confirmado', () =>
      downloadOfficialCreditNoteDocument({
        invoiceId: invoice._id,
        noteId: note._id,
        type: 'pdf',
      })
    ),
    retry('XML de nota crédito no confirmado', () =>
      downloadOfficialCreditNoteDocument({
        invoiceId: invoice._id,
        noteId: note._id,
        type: 'xml',
      })
    ),
  ]);
  assert(pdf.byteLength > 1000 && xml.byteLength > 500, 'Nota crédito PDF/XML vacía.');
  return note;
}

module.exports = {
  assertValidatedInvoice,
  assertIdentifiedFactusCustomer,
  ensureFactusInvoice,
  findValidatedCreditNote,
  retry,
  verifyCreditNoteDocuments,
};
