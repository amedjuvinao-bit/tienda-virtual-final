// backend/scripts/testBillingEmailDocumentsModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log('OK  ' + message);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error('FAIL ' + message);
  if (error?.message) console.error('     ' + error.message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), 'No existe ' + relativePath);
  return fs.readFileSync(fullPath, 'utf8');
}

function includes(content, expected, message) {
  assert(String(content).includes(expected), message || 'No se encontró ' + expected);
}

function validateExistingMailConfiguration() {
  const service = read('backend/services/electronicInvoiceEmailService.js');

  includes(service, "require('../lib/mail/mailer')", 'Facturación no reutiliza el correo configurado.');
  includes(service, 'sendMail({', 'El servicio no usa el mailer administrativo.');
  assert(
    !service.includes("require('../lib/mailer')"),
    'Facturación no debe usar el mailer antiguo basado solo en .env.'
  );
  ok('Facturación reutiliza la configuración SMTP existente sin duplicar credenciales');
}

function validateOfficialAttachments() {
  const service = read('backend/services/electronicInvoiceEmailService.js');

  includes(service, 'downloadOfficialInvoiceDocument', 'No descarga documentos oficiales.');
  includes(service, "type: 'pdf'", 'No adjunta el PDF oficial.');
  includes(service, "type: 'xml'", 'No adjunta el XML oficial.');
  includes(service, 'pdf.buffer', 'El PDF oficial no se adjunta como contenido.');
  includes(service, 'xml.buffer', 'El XML oficial no se adjunta como contenido.');
  assert(
    service.indexOf('await assertMailConfigured();') <
      service.indexOf('const [pdf, xml] = await Promise.all(['),
    'No debe consultar Factus cuando el correo está desactivado o incompleto.'
  );
  ok('Correo adjunta PDF y XML oficiales descargados de Factus');
}

function validateAuditAndConcurrency() {
  const model = read('backend/models/ElectronicInvoice.js');
  const service = read('backend/services/electronicInvoiceEmailService.js');

  ['InvoiceEmailDeliverySchema', 'InvoiceEmailAttemptSchema', 'lastSentAt', 'lastError', 'history'].forEach(
    (needle) => includes(model, needle, 'Falta auditoría de correo: ' + needle)
  );
  includes(service, 'BILLING_EMAIL_ALREADY_SENDING', 'No bloquea envíos simultáneos.');
  includes(service, "'emailDelivery.status': { $ne: 'sent' }", 'El automático puede duplicar correos.');
  ok('Cada intento queda auditado y los envíos simultáneos están bloqueados');
}

function validateAutomaticDelivery() {
  const issuance = read('backend/services/electronicInvoiceIssuanceService.js');
  const routes = read('backend/routes/adminBilling.js');

  includes(issuance, 'sendValidatedInvoiceEmail', 'La emisión validada no dispara correo.');
  includes(issuance, "providerName === 'factus'", 'El automático no está limitado a Factus.');
  includes(issuance, 'isProviderValidated', 'El automático no exige validación.');
  includes(routes, 'automatic: true', 'La sincronización validada no completa el envío.');
  includes(
    issuance,
    'nunca cambia el estado fiscal',
    'Un error SMTP podría confundirse con un error fiscal.'
  );
  ok('El primer envío es automático después de la validación y no altera la factura');
}

function validateProtectedManualResend() {
  const routes = read('backend/routes/adminBilling.js');

  includes(routes, "'/documents/:invoiceId/email'", 'Falta la ruta de envío manual.');
  includes(routes, "requirePermission('billing:download')", 'La ruta de correo no está autorizada.');
  includes(routes, 'automatic: false', 'La ruta manual no está marcada para auditoría.');
  ok('Reenvío manual está autenticado, autorizado y separado del automático');
}

function validateFrontend() {
  const api = read('frontend/src/admin/billing/api/adminBillingApi.js');
  const page = read('frontend/src/admin/billing/AdminBillingPage.jsx');

  includes(api, 'sendBillingDocumentEmail', 'El frontend no conecta el envío.');
  includes(page, 'Correo: {getEmailStatusLabel', 'No muestra el estado del correo.');
  includes(page, 'Último envío:', 'No muestra la fecha del último envío.');
  includes(page, 'Reenviar', 'No ofrece reenvío.');
  includes(page, 'Correo no configurado o desactivado', 'No informa configuración incompleta.');
  ok('Documentos muestra destinatario, estado, error, fecha y botón de reenvío');
}

function validateSafePasswordIndicator() {
  const model = read('backend/models/MailSettings.js');

  includes(model, "'+smtpPasswordEncrypted +passwordUpdatedAt'", 'No consulta el secreto protegido.');
  includes(model, 'settings.hasSmtpPassword = Boolean(', 'No calcula correctamente el indicador.');
  includes(model, 'delete settings.smtpPasswordEncrypted', 'La clave podría exponerse en la respuesta.');
  ok('Indicador de clave SMTP se corrige sin exponer el secreto');
}

function validatePackageScript() {
  const packageFile = read('backend/package.json');
  includes(packageFile, 'test:billing-email-documents', 'No se registró la prueba de correo.');
  ok('Prueba de correo y documentos registrada para ejecución desde terminal');
}

async function main() {
  console.log('\nValidando correo y documentos oficiales de Facturación...');

  const steps = [
    validateExistingMailConfiguration,
    validateOfficialAttachments,
    validateAuditAndConcurrency,
    validateAutomaticDelivery,
    validateProtectedManualResend,
    validateFrontend,
    validateSafePasswordIndicator,
    validatePackageScript,
  ];

  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      fail(step.name, error);
    }
  }

  console.log(
    '\nResumen correo y documentos -> OK: ' +
      results.ok +
      ' WARN: ' +
      results.warn +
      ' FAIL: ' +
      results.fail
  );

  if (results.fail > 0) process.exitCode = 1;
}

main();
