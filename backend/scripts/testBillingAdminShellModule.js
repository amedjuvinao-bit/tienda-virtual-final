// backend/scripts/testBillingAdminShellModule.js
/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..', '..');

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readProjectFile(relativePath) {
  const fullPath = path.join(PROJECT_ROOT, relativePath);
  assert(fs.existsSync(fullPath), `No existe el archivo ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content, expected, message) {
  assert(String(content).includes(expected), message || `No se encontró: ${expected}`);
}

function validateUnifiedBillingPage() {
  const page = readProjectFile('frontend/src/admin/billing/AdminBillingPage.jsx');

  [
    'FacturacionSection',
    'BILLING_TABS',
    'resumen',
    'documentos',
    'ordenes',
    'configuracion',
    'Módulo unificado de facturación',
  ].forEach((needle) => assertIncludes(page, needle, `AdminBillingPage.jsx no contiene ${needle}`));

  ok('Pantalla unificada de facturación existe y reutiliza la configuración actual');
}

function validateRoutes() {
  const app = readProjectFile('frontend/src/App.jsx');

  assert(
    app.includes("import AdminBillingPage from './admin/billing/AdminBillingPage';") ||
      app.includes("lazy(() => import('./admin/billing/AdminBillingPage'))"),
    'App.jsx no carga AdminBillingPage'
  );
  assertIncludes(app, 'path="facturacion"', 'App.jsx no registra /admin/facturacion');
  assertIncludes(app, 'path="facturacion/:tab"', 'App.jsx no registra /admin/facturacion/:tab');
  assertIncludes(
    app,
    'to="/admin/facturacion/configuracion"',
    'Configuración > Facturación no redirige al módulo unificado'
  );

  ok('Rutas de facturación unificada están registradas');
}

function validateMenuAndPermissions() {
  const layout = readProjectFile('frontend/src/admin/AdminLayout.js');
  const permissions = readProjectFile('frontend/src/admin/security/adminPermissions.js');

  assertIncludes(layout, "path: '/admin/facturacion'", 'AdminLayout.js no agrega Facturación al menú');
  assertIncludes(layout, "label: 'Facturación'", 'AdminLayout.js no muestra etiqueta Facturación');
  assertIncludes(layout, "slotAfter: '/admin/ordenes'", 'Facturación no queda cerca de órdenes');
  assertIncludes(permissions, "facturacion: ['billing:view', 'billing:settings']", 'Permisos de /admin/facturacion no están definidos');
  assertIncludes(permissions, "path.startsWith('facturacion/')", 'Subrutas de facturación no heredan permisos');

  ok('Menú y permisos de facturación unificada están configurados');
}

function validateConfigurationPreserved() {
  const billingSection = readProjectFile('frontend/src/admin/ConfiguracionPage.jsx');
  const settingsRoutes = readProjectFile('backend/routes/siteSettings.js');

  assertIncludes(billingSection, "import FacturacionSection", 'ConfiguracionPage perdió FacturacionSection');
  assertIncludes(billingSection, "case 'facturacion'", 'ConfiguracionPage perdió el caso facturacion');
  assertIncludes(settingsRoutes, 'billing:', 'siteSettings no conserva billing');
  assertIncludes(settingsRoutes, 'ensureBillingExists', 'siteSettings no conserva autocorrección billing');

  ok('Configuración de facturación existente se conserva sin borrarla');
}

function validatePackageScript() {
  const pkg = readProjectFile('backend/package.json');
  assertIncludes(pkg, 'test:billing-admin-shell', 'package.json no registra test:billing-admin-shell');
  ok('Script test:billing-admin-shell registrado');
}

function main() {
  console.log('Validando módulo unificado de Facturación...');

  [
    validateUnifiedBillingPage,
    validateRoutes,
    validateMenuAndPermissions,
    validateConfigurationPreserved,
    validatePackageScript,
  ].forEach((step) => {
    try {
      step();
    } catch (error) {
      fail(step.name, error);
    }
  });

  console.log('');
  console.log(`Resumen facturación admin shell -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);

  if (results.fail > 0) process.exit(1);
}

main();
