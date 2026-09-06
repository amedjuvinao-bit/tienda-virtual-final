// backend/scripts/testFinanceModuleClosure.js
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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

function warn(message) {
  results.warn += 1;
  console.warn(`WARN ${message}`);
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
  assert(String(content).includes(expected), message || `No se encontro: ${expected}`);
}

function assertIncludesAny(content, expectedList, message) {
  const text = String(content || '');
  const found = expectedList.some((expected) => text.includes(expected));
  assert(found, message || `No se encontro ninguna variante: ${expectedList.join(' | ')}`);
}

function validateBackendStaticWiring() {
  const indexFile = readProjectFile('backend/index.js');
  const routeFile = readProjectFile('backend/routes/adminFinance.js');
  const serviceFile = readProjectFile('backend/services/adminFinanceService.js');
  const modelFile = readProjectFile('backend/models/FinanceExpense.js');
  const dateRangeFile = readProjectFile('backend/utils/dateRange.js');
  const permissionFile = readProjectFile('backend/security/adminPermissionCatalog.js');

  assertIncludes(indexFile, './routes/adminFinance', 'index.js no carga adminFinance.');
  assertIncludes(indexFile, '/api/admin/finance', 'index.js no monta /api/admin/finance.');

  [
    '/summary',
    '/sales',
    '/profit',
    '/cash',
    '/expenses',
    '/export',
    'finance:view',
    'finance:expenses',
    'finance:export',
  ].forEach((needle) => assertIncludes(routeFile, needle, `adminFinance.js no contiene ${needle}`));

  [
    'getFinanceSummary',
    'getSalesReport',
    'getProfitReport',
    'getCashReport',
    'getExpensesReport',
    'createExpense',
    'updateExpense',
    'cancelExpense',
    'buildFinanceCsv',
    'resolveDateRange',
  ].forEach((needle) => assertIncludes(serviceFile, needle, `adminFinanceService no contiene ${needle}`));

  [
    'FinanceExpenseSchema',
    'amount',
    'category',
    'paymentMethod',
    'status',
    'branch',
    'createdBy',
    'updatedBy',
    'deletedBy',
    'deletedAt',
  ].forEach((needle) => assertIncludes(modelFile, needle, `FinanceExpense no contiene ${needle}`));

  [
    'resolveDateRange',
    'startOfLocalDay',
    'endOfLocalDay',
    'formatLocalDate',
  ].forEach((needle) => assertIncludes(dateRangeFile, needle, `dateRange util no contiene ${needle}`));

  [
    'finance:view',
    'finance:expenses',
    'finance:export',
  ].forEach((needle) => assertIncludes(permissionFile, needle, `Catalogo backend no contiene ${needle}`));

  ok('Backend Finanzas tiene rutas, servicio, modelo, permisos y fechas centralizadas');
}

function validateFrontendStaticWiring() {
  const appFile = readProjectFile('frontend/src/App.jsx');
  const permissionFile = readProjectFile('frontend/src/admin/security/adminPermissions.js');
  const apiFile = readProjectFile('frontend/src/admin/finance/api/financeApi.js');
  const pageFile = readProjectFile('frontend/src/admin/finance/AdminFinancePage.jsx');

  assertIncludes(
    appFile,
    "const AdminFinancePage = lazy(() => import('./admin/finance/AdminFinancePage'));",
    'App.jsx no carga AdminFinancePage mediante importación diferida.'
  );
  assertIncludes(appFile, 'path="finanzas"', 'App.jsx no registra /admin/finanzas.');
  assertIncludes(appFile, 'protectAdminContent(<AdminFinancePage />)', 'La ruta Finanzas no esta protegida por permisos.');

  assertIncludes(permissionFile, "finanzas: ['finance:view']", 'adminPermissions no protege finanzas con finance:view.');

  [
    '/api/admin/finance/summary',
    '/api/admin/finance/sales',
    '/api/admin/finance/profit',
    '/api/admin/finance/cash',
    '/api/admin/finance/expenses',
    '/api/admin/finance/export',
    'responseType',
    'blob',
    'api.post',
    'api.put',
    'api.delete',
  ].forEach((needle) => assertIncludes(apiFile, needle, `financeApi no contiene ${needle}`));

  [
    'createPortal',
    'document.body',
    'ExpenseModal',
    'expenseModalOpen',
    'openCreateExpenseForm',
    'openEditExpenseForm',
    'createFinanceExpense',
    'updateFinanceExpense',
    'cancelFinanceExpense',
    'exportFinanceCsv',
    'getFinanceSummary',
    'getFinanceSales',
    'getFinanceProfit',
    'getFinanceCash',
    'getFinanceExpenses',
    'Nuevo gasto',
    'Registrar gasto',
    'Ventas CSV',
    'Gastos CSV',
    'Ventas POS vs Web',
    'Resumen de caja',
    'Utilidad neta',
  ].forEach((needle) => assertIncludes(pageFile, needle, `AdminFinancePage no contiene ${needle}`));

  assertIncludesAny(pageFile, ['Métodos de pago', 'Metodos de pago'], 'AdminFinancePage no muestra metodos de pago.');
  assert(!pageFile.includes('showExpenseForm'), 'Quedo estado viejo showExpenseForm; el gasto debe abrirse en modal.');

  ok('Frontend Finanzas tiene ruta, permisos, API, modal, filtros, exportacion y acciones de gastos');
}

function runBackendFunctionalTest() {
  const scriptPath = path.join(PROJECT_ROOT, 'backend', 'scripts', 'testFinanceAdminModule.js');
  assert(fs.existsSync(scriptPath), 'No existe backend/scripts/testFinanceAdminModule.js');

  const output = execFileSync(process.execPath, [scriptPath], {
    cwd: path.join(PROJECT_ROOT, 'backend'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  process.stdout.write(output);

  assertIncludes(output, 'FAIL: 0', 'La prueba funcional backend Finanzas no termino en FAIL: 0.');
  assertIncludes(output, 'Reporte de ventas separa POS y Web correctamente', 'No se valido POS vs Web.');
  assertIncludes(output, 'Reporte de utilidad calcula ingresos, costos y margen bruto', 'No se valido utilidad/costos.');
  assertIncludes(output, 'Reporte de caja calcula ventas, efectivo y movimientos', 'No se valido caja.');
  assertIncludes(output, 'Reporte de gastos manuales funciona', 'No se valido gastos.');
  assertIncludes(output, 'Exportacion CSV financiera funciona', 'No se valido exportacion CSV.');
  assertIncludes(output, 'Anular gasto financiero funciona', 'No se valido anulacion de gasto.');

  ok('Prueba funcional backend Finanzas completa finalizo correctamente');
}

function main() {
  console.log('\n=== Prueba General Cierre Modulo Finanzas ===');

  try {
    validateBackendStaticWiring();
    validateFrontendStaticWiring();
    runBackendFunctionalTest();
    ok('Modulo Finanzas cumple condiciones tecnicas para cierre funcional');
  } catch (error) {
    fail('Error inesperado en prueba Cierre Finanzas', error);
  } finally {
    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    if (results.fail > 0) process.exit(1);
  }
}

main();
