// backend/scripts/testBillingModuleClosure.js
/* eslint-disable no-console */
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const BACKEND_ROOT = path.join(__dirname, '..');
const PROJECT_ROOT = path.join(BACKEND_ROOT, '..');
const NPM_EXEC_PATH = String(process.env.npm_execpath || '').trim();
const NPM_COMMAND = NPM_EXEC_PATH
  ? process.execPath
  : process.platform === 'win32'
    ? 'npm.cmd'
    : 'npm';

const BILLING_TESTS = [
  ['Estructura del panel administrativo', 'testBillingAdminShellModule.js'],
  ['Factura electrónica y modal', 'testBillingElectronicInvoiceModule.js'],
  ['Resumen de Facturación', 'testBillingSummaryFrontendModule.js'],
  ['Órdenes pendientes por facturar', 'testBillingPendingOrdersFrontendModule.js'],
  ['Escalabilidad de consultas', 'testBillingScalabilityModule.js'],
  ['Monitoreo operativo', 'testBillingOperationalMonitoringModule.js'],
  ['Reportes de Facturación', 'testBillingReportsModule.js'],
  ['Generación administrativa de factura', 'testBillingGenerateInvoiceModule.js'],
  ['Bandeja de documentos', 'testBillingDocumentsFrontendModule.js'],
  ['Sincronización con Factus', 'testBillingSyncModule.js'],
  ['Documentos oficiales PDF y XML', 'testBillingOfficialDocumentsModule.js'],
  ['Correo de documentos oficiales', 'testBillingEmailDocumentsModule.js'],
  ['Notas crédito en la interfaz', 'testBillingCreditNotesModule.js'],
  ['Notas crédito oficiales', 'testBillingCreditNotesOfficialModule.js'],
  ['Totales, IVA y cupones', 'testBillingTotalsModule.js'],
  ['Datos fiscales del checkout', 'testBillingFiscalCheckoutModule.js'],
  ['Motor único e idempotencia', 'testBillingIdempotencyModule.js'],
  ['Recuperación y conciliación de facturas', 'testBillingInvoiceRecoveryModule.js'],
  ['Limpieza segura de pendientes en habilitación', 'testFactusPendingCleanup.js'],
  ['Seguridad y permisos', 'testBillingSecurityModule.js'],
  ['Configuración segura de facturación', 'testBillingConfigurationModule.js'],
  ['Conexión real y readiness de Factus', 'testBillingConnectionModule.js'],
  ['Compatibilidad de datos fiscales históricos', 'testBillingFiscalCompatibilityModule.js'],
  ['Rangos oficiales de numeración Factus', 'testBillingNumberingRangesModule.js'],
  ['Activación productiva por cliente', 'testBillingClientActivationModule.js'],
];

const results = { ok: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, detail = '') {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (detail) console.error(`     ${detail}`);
}

function run(command, args, label, cwd = PROJECT_ROOT) {
  console.log('');
  console.log(`--- ${label} ---`);

  const requiresWindowsShell =
    process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);

  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: requiresWindowsShell,
  });

  if (result.error) {
    const error = new Error(result.error.message || `No se pudo iniciar ${label}.`);
    error.code = 'BILLING_CLOSURE_PROCESS_ERROR';
    throw error;
  }

  if (result.status !== 0) {
    const error = new Error(`${label} terminó con código ${result.status}.`);
    error.code = 'BILLING_CLOSURE_CHECK_FAILED';
    throw error;
  }

  ok(label);
}

function runBillingTests() {
  BILLING_TESTS.forEach(([label, scriptName]) => {
    run(
      process.execPath,
      [path.join(BACKEND_ROOT, 'scripts', scriptName)],
      label,
      BACKEND_ROOT
    );
  });
}

function runFrontendBuild() {
  const npmArgs = [
    '--prefix',
    path.join(PROJECT_ROOT, 'frontend'),
    'run',
    'build',
  ];

  run(
    NPM_COMMAND,
    NPM_EXEC_PATH ? [NPM_EXEC_PATH, ...npmArgs] : npmArgs,
    'Compilación de producción del frontend',
    PROJECT_ROOT
  );
}

function printSummary() {
  console.log('');
  console.log(
    `Resumen cierre Facturación -> OK: ${results.ok} FAIL: ${results.fail}`
  );
}

function main() {
  console.log('Validando cierre integral del módulo Facturación...');
  console.log('Esta prueba no genera facturas o notas reales, no envía correos y no ejecuta billing:sync:live.');

  try {
    runBillingTests();
    runFrontendBuild();
  } catch (error) {
    fail('Cierre integral del módulo Facturación', error?.message || String(error));
    printSummary();
    process.exit(1);
  }

  printSummary();
}

main();
