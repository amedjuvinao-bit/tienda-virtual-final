'use strict';

// Pruebas locales reproducibles: nunca conecta con la tienda, MongoDB ni Factus.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
const vitest = path.join(frontend, 'node_modules', 'vitest', 'vitest.mjs');
const vite = path.join(frontend, 'node_modules', 'vite', 'bin', 'vite.js');

const checks = [
  {
    name: 'Pago manual rápido, evidencia exacta y confirmación sin duplicados',
    cwd: backend,
    script: 'scripts/testManualPaymentConfirmationContract.js',
  },
  {
    name: 'Error fiscal, pausas entre reintentos y límite de cinco intentos',
    cwd: backend,
    script: 'scripts/testOrderPostCommitOutboxWorker.js',
  },
  {
    name: 'Pago, inventario y factura independientes en todos los proveedores',
    cwd: backend,
    script: 'scripts/testOrderCreationPostCommitIntegrity.js',
  },
  {
    name: 'Webhook Wompi concurrente sin duplicar factura ni saltar el intervalo',
    cwd: backend,
    script: 'scripts/testWompiWebhookInventoryIntegrity.js',
  },
  {
    name: 'Datos fiscales y política de facturación de cada sede',
    cwd: backend,
    script: 'scripts/testBillingInvoicePreflightModule.js',
  },
  {
    name: 'Factura única y omisión cuando la sede tiene facturación desactivada',
    cwd: backend,
    script: 'scripts/testBillingIdempotencyModule.js',
  },
  {
    name: 'Conciliación de respuesta incierta de Factus sin reemitir a ciegas',
    cwd: backend,
    script: 'scripts/testBillingInvoiceRecoveryModule.js',
  },
  {
    name: 'Esquema de órdenes con el estado durable de reintentos',
    cwd: backend,
    script: 'scripts/testOrderModelCompositionParity.js',
  },
  {
    name: 'Panel: aceptación, corrección, espera y cierre del detalle',
    cwd: frontend,
    script: vitest,
    args: [
      'run',
      'src/admin/orders/components/orderDetail/hooks/useOrderInvoiceStatusWatcher.test.jsx',
      'src/admin/orders/components/orderDetail/OrderDetailStoryOverview.test.jsx',
    ],
  },
  {
    name: 'Panel: respuesta de pago y conciliación de respuesta ambigua',
    cwd: frontend,
    script: vitest,
    args: ['run', 'src/admin/orders/components/orderDetail/hooks/useOrderManualPaymentConfirmation.test.jsx'],
  },
  {
    name: 'Facturación: lista de pendientes y acción para corregir y reintentar',
    cwd: frontend,
    script: vitest,
    args: ['run', 'src/admin/billing/panels/BillingPendingOrdersPanel.test.jsx'],
  },
  {
    name: 'Compilación de la interfaz para producción',
    cwd: frontend,
    script: vite,
    args: ['build'],
  },
];

function summaryOf(output, count) {
  return String(output || '').trim().split(/\r?\n/).slice(-count).join('\n');
}

function run() {
  if (!fs.existsSync(path.join(backend, 'node_modules')) ||
      !fs.existsSync(vitest) || !fs.existsSync(vite)) {
    console.error('Faltan dependencias. Desde la raíz del proyecto ejecuta:');
    console.error('npm --prefix backend ci');
    console.error('npm --prefix frontend ci');
    process.exitCode = 1;
    return;
  }

  let passed = 0;
  const failed = [];
  console.log('Validación local de pago y factura electrónica (casos simulados, sin emitir facturas)');
  for (const [index, check] of checks.entries()) {
    console.log(`\n[${index + 1}/${checks.length}] ${check.name}`);
    const file = path.isAbsolute(check.script)
      ? check.script
      : path.join(check.cwd, check.script);
    const result = spawnSync(process.execPath, [file, ...(check.args || [])], {
      cwd: check.cwd,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 16 * 1024 * 1024,
    });
    if (result.status === 0) {
      passed += 1;
      console.log('OK');
      if (process.argv.includes('--verbose')) console.log(result.stdout.trim());
    } else {
      failed.push(check.name);
      console.error('FALLÓ');
      console.error(summaryOf(result.stdout, 18));
      console.error(summaryOf(result.stderr, 18));
      if (result.error) console.error(result.error.message);
    }
  }

  console.log(`\nResultado: ${passed}/${checks.length} grupos aprobados.`);
  if (failed.length) {
    console.error('Revisa estos casos antes de probar el pago en el navegador:');
    failed.forEach((name) => console.error(`- ${name}`));
    process.exitCode = 1;
    return;
  }

  console.log('\nComprobación adicional en tu Factus sandbox (esta parte sí crea órdenes de prueba):');
  console.log('1. Sede con factura activa: crea una orden manual con nombre, apellido y datos fiscales completos. Confirma el pago una sola vez. Debe quedar pagada enseguida; deja el detalle abierto hasta ver la factura aceptada sin actualizar la página.');
  console.log('2. Sede con factura desactivada: crea otra orden y confirma el pago. Debe quedar pagada, sin factura automática, con el motivo visible. Reactiva la sede y emite desde Facturación si corresponde.');
  console.log('Los errores de apellido y fallas temporales ya se comprobaron de forma simulada: no alteres clientes reales ni desconectes Factus para provocarlos.');
}

run();
