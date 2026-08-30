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

async function verifyInvoiceDocuments(order, invoice) {
  const [pdf, xml] = await Promise.all([
    retry('PDF de factura no confirmado', () =>
      downloadOfficialInvoiceDocument({ orderId: order._id, type: 'pdf' })
    ),
    retry('XML de factura no confirmado', () =>
      downloadOfficialInvoiceDocument({ orderId: order._id, type: 'xml' })
    ),
  ]);
  assert(pdf.byteLength > 1000 && xml.byteLength > 500, 'Factura PDF/XML vacía.');
}

async function ensureFactusInvoice({ order, transaction, payments }) {
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
  await verifyInvoiceDocuments(order, invoice);
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
  ensureFactusInvoice,
  findValidatedCreditNote,
  retry,
  verifyCreditNoteDocuments,
};
