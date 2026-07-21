// backend/scripts/syncFactusLive.js
/* eslint-disable no-console */
'use strict';

const mongoose = require('mongoose');

const { env } = require('../config/env');
const ElectronicInvoice = require('../models/ElectronicInvoice');
const SiteSettings = require('../models/SiteSettings');
const {
  syncCreditNote,
  syncInvoice,
} = require('../services/adminBillingSyncService');

const SCRIPT_USER = 'script:billing-sync-live';

function cleanText(value, max = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function hasValue(value) {
  return value !== undefined && value !== null && cleanText(value) !== '';
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(cleanText(value, 120));
}

function usage() {
  console.log(`
Sincronización real con Factus

Uso:
  npm run billing:sync:live
  npm run billing:sync:live -- --invoice NUMERO_O_ID
  npm run billing:sync:live -- --credit-note FACTURA_O_ID NOTA_O_ID

Sin parámetros se usa la factura Factus más reciente.
El script solo consulta el estado remoto y actualiza ElectronicInvoice.
No genera, reenvía ni elimina documentos.
`);
}

function parseArguments(args = []) {
  if (!args.length) return { mode: 'latest-invoice' };

  if (args.includes('--help') || args.includes('-h')) {
    return { mode: 'help' };
  }

  if (args[0] === '--invoice') {
    const invoiceIdentifier = cleanText(args[1], 160);
    if (!invoiceIdentifier || args.length !== 2) {
      throw new Error('Usa: --invoice NUMERO_O_ID');
    }
    return { mode: 'invoice', invoiceIdentifier };
  }

  if (args[0] === '--credit-note') {
    const invoiceIdentifier = cleanText(args[1], 160);
    const noteIdentifier = cleanText(args[2], 160);
    if (!invoiceIdentifier || !noteIdentifier || args.length !== 3) {
      throw new Error('Usa: --credit-note FACTURA_O_ID NOTA_O_ID');
    }
    return { mode: 'credit-note', invoiceIdentifier, noteIdentifier };
  }

  throw new Error('Parámetros no reconocidos. Ejecuta con --help para ver el uso.');
}

async function loadSettings() {
  return SiteSettings.findOne().select('billing.electronicProvider').lean();
}

function resolveCredentials(settings = {}) {
  const panel = settings?.billing?.electronicProvider || {};

  return {
    apiUrl: cleanText(
      panel.apiUrl || process.env.FACTUS_API_URL || 'https://api-sandbox.factus.com.co',
      300
    ).replace(/\/+$/, ''),
    clientId: cleanText(panel.clientId || process.env.FACTUS_CLIENT_ID, 300),
    clientSecret: cleanText(panel.clientSecret || process.env.FACTUS_CLIENT_SECRET, 500),
    username: cleanText(panel.username || process.env.FACTUS_USERNAME, 300),
    password: cleanText(panel.password || process.env.FACTUS_PASSWORD, 500),
  };
}

function assertCredentials(settings) {
  const credentials = resolveCredentials(settings);
  const missing = ['clientId', 'clientSecret', 'username', 'password']
    .filter((field) => !credentials[field]);

  if (missing.length) {
    throw new Error(
      `Faltan credenciales Factus: ${missing.join(', ')}. ` +
      'Configúralas en el panel o en backend/.env antes de ejecutar la prueba.'
    );
  }

  return credentials;
}

function providerFor(invoice, settings) {
  return cleanText(
    invoice?.provider?.name || settings?.billing?.electronicProvider?.provider || 'mock',
    60
  ).toLowerCase();
}

function assertFactusDocument(invoice, settings, label = 'La factura') {
  const provider = providerFor(invoice, settings);
  if (provider !== 'factus') {
    throw new Error(`${label} usa el proveedor "${provider || 'mock'}", no Factus.`);
  }
}

function invoiceLookup(identifier) {
  const text = cleanText(identifier, 160);
  const conditions = [
    { invoiceNumber: text },
    { orderNumber: text.replace(/^#/, '') },
    { cufe: text },
    { 'provider.number': text },
    { 'provider.referenceCode': text },
    { 'provider.cufe': text },
  ];

  if (isObjectId(text)) conditions.unshift({ _id: text });
  return { $or: conditions };
}

async function findInvoice(identifier) {
  if (identifier) return ElectronicInvoice.findOne(invoiceLookup(identifier)).lean();

  return ElectronicInvoice.findOne({
    'provider.name': /^factus$/i,
    $or: [
      { 'provider.number': { $exists: true, $nin: ['', null] } },
      { invoiceNumber: { $exists: true, $nin: ['', null] } },
    ],
  })
    .sort({ acceptedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean();
}

function noteCandidates(invoice, index, note) {
  return [
    note?._id,
    `${invoice?._id || 'invoice'}-${index}`,
    note?.referenceCode,
    note?.billNumber,
    note?.provider?.number,
    note?.provider?.referenceCode,
    note?.provider?.cufe,
    note?.provider?.cude,
  ]
    .filter(hasValue)
    .map((value) => cleanText(value, 160));
}

function findNote(invoice, noteIdentifier) {
  const target = cleanText(noteIdentifier, 160);
  const notes = Array.isArray(invoice?.creditNotes) ? invoice.creditNotes : [];
  const index = notes.findIndex((note, noteIndex) => (
    noteCandidates(invoice, noteIndex, note).includes(target)
  ));

  return index >= 0 ? { index, note: notes[index] } : null;
}

function printInvoiceSummary(title, invoice = {}) {
  console.log(`\n${title}`);
  console.log(`  ID local:       ${invoice.id || invoice._id || '-'}`);
  console.log(`  Orden:          ${invoice.orderNumber || '-'}`);
  console.log(`  Número local:   ${invoice.invoiceNumber || '-'}`);
  console.log(`  Número Factus:  ${invoice?.provider?.number || '-'}`);
  console.log(`  Estado:         ${invoice.status || '-'}`);
  console.log(`  Estado Factus:  ${invoice?.provider?.status || '-'}`);
  console.log(`  Sincronización: ${invoice?.sync?.status || 'never'}`);
}

function printNoteSummary(title, note = {}) {
  console.log(`\n${title}`);
  console.log(`  ID local:       ${note.id || note._id || '-'}`);
  console.log(`  Número Factus:  ${note.noteNumber || note?.provider?.number || '-'}`);
  console.log(`  Referencia:     ${note.referenceCode || '-'}`);
  console.log(`  Estado:         ${note.status || '-'}`);
  console.log(`  Estado Factus:  ${note?.provider?.status || '-'}`);
  console.log(`  Sincronización: ${note?.sync?.status || 'never'}`);
}

function assertSuccessfulSync(sync = {}) {
  const httpStatus = Number(sync.httpStatus);
  if (sync.status !== 'success') {
    throw new Error(`La sincronización terminó con estado ${sync.status || 'desconocido'}.`);
  }
  if (!Number.isFinite(httpStatus) || httpStatus < 200 || httpStatus >= 300) {
    throw new Error(`Factus no devolvió un HTTP exitoso: ${sync.httpStatus ?? 'sin código'}.`);
  }
  if (!sync.lastSuccessAt) {
    throw new Error('No quedó registrada la fecha de sincronización exitosa.');
  }
}

async function runInvoice(options, settings, credentials) {
  const invoice = await findInvoice(options.invoiceIdentifier || '');
  if (!invoice) {
    throw new Error(
      options.invoiceIdentifier
        ? `No se encontró la factura ${options.invoiceIdentifier}.`
        : 'No hay facturas Factus con número remoto para probar.'
    );
  }

  assertFactusDocument(invoice, settings);
  printInvoiceSummary('ANTES', invoice);
  console.log(`\nConsultando Factus en ${credentials.apiUrl}...`);

  const result = await syncInvoice(String(invoice._id), { adminUser: SCRIPT_USER });
  assertSuccessfulSync(result?.invoice?.sync);
  printInvoiceSummary('DESPUÉS', result.invoice);
  console.log('\nOK: Factus respondió y el nuevo estado quedó guardado en MongoDB.');
}

async function runCreditNote(options, settings, credentials) {
  const invoice = await findInvoice(options.invoiceIdentifier);
  if (!invoice) throw new Error(`No se encontró la factura ${options.invoiceIdentifier}.`);

  assertFactusDocument(invoice, settings, 'La factura relacionada');
  const found = findNote(invoice, options.noteIdentifier);
  if (!found) throw new Error(`No se encontró la nota crédito ${options.noteIdentifier}.`);

  const noteProvider = cleanText(
    found.note?.provider?.name || providerFor(invoice, settings),
    60
  ).toLowerCase();
  if (noteProvider !== 'factus') {
    throw new Error(`La nota crédito usa el proveedor "${noteProvider || 'mock'}", no Factus.`);
  }

  printNoteSummary('ANTES', found.note);
  console.log(`\nConsultando Factus en ${credentials.apiUrl}...`);

  const result = await syncCreditNote(
    String(invoice._id),
    options.noteIdentifier,
    { adminUser: SCRIPT_USER }
  );
  assertSuccessfulSync(result?.creditNote?.sync);
  printNoteSummary('DESPUÉS', result.creditNote);
  console.log('\nOK: Factus respondió y la nota crédito quedó actualizada en MongoDB.');
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.mode === 'help') {
    usage();
    return;
  }

  if (!env.mongoUri) {
    throw new Error(
      'Falta MONGO_URI en backend/.env. También se aceptan MONGODB_URI, MONGO_URL o DATABASE_URL.'
    );
  }

  console.log('\nPRUEBA REAL DE SINCRONIZACIÓN FACTUS');
  console.log('Esta operación consulta un solo documento y actualiza únicamente su estado local.');

  await mongoose.connect(env.mongoUri);
  console.log('MongoDB: conectado');

  const settings = await loadSettings();
  const credentials = assertCredentials(settings);

  if (options.mode === 'credit-note') {
    await runCreditNote(options, settings, credentials);
  } else {
    await runInvoice(options, settings, credentials);
  }
}

main()
  .catch((error) => {
    console.error(`\nERROR: ${error?.message || error}`);
    if (error?.code) console.error(`Código: ${error.code}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => {});
    }
  });

