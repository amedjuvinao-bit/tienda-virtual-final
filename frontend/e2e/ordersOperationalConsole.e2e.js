import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = 4174;
const BASE_URL = `http://${HOST}:${PORT}`;
const ORDER_ID = '000000000000000000000101';

// Datos completamente ficticios. La prueba no usa servicios ni bases persistentes.
const ORDER = {
  _id: ORDER_ID,
  orderNumber: 'ORD-STAGE1-E2E-001',
  createdAt: '2026-08-20T14:00:00.000Z',
  updatedAt: '2026-08-20T14:20:00.000Z',
  source: 'online',
  status: 'paid',
  subtotal: 249900,
  shipping: 0,
  total: 249900,
  itemsCount: 1,
  totalItems: 1,
  tags: ['prioridad-normal'],
  customer: {
    name: 'Cliente',
    lastname: 'Fixture',
    email: 'orders.stage1@example.invalid',
    emailOrPhone: 'orders.stage1@example.invalid',
    phone: '3000000000',
  },
  billing: {
    name: 'Cliente Fixture',
    email: 'orders.stage1@example.invalid',
    documentType: 'CC',
    documentNumber: '0000000000',
    address: 'Dirección ficticia sin validez',
    city: 'Bogotá, D.C.',
    department: 'Bogotá, D.C.',
    municipalityCode: '11001',
  },
  items: [
    {
      _id: '000000000000000000000201',
      productId: '000000000000000000000301',
      title: 'Producto físico de prueba',
      quantity: 1,
      qty: 1,
      price: 249900,
      lineTotal: 249900,
      productType: 'physical',
      requiresShipping: true,
    },
  ],
  cart: [
    {
      _id: '000000000000000000000201',
      productId: '000000000000000000000301',
      title: 'Producto físico de prueba',
      quantity: 1,
      qty: 1,
      price: 249900,
      lineTotal: 249900,
      productType: 'physical',
      requiresShipping: true,
    },
  ],
  branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
  payment: {
    status: 'paid',
    provider: 'manual',
    paidAt: '2026-08-20T14:05:00.000Z',
  },
  inventoryAllocations: [
    {
      _id: '000000000000000000000401',
      orderItemId: '000000000000000000000201',
      soldQuantity: 1,
      returnedQuantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
    },
  ],
  fulfillment: {
    status: 'pending',
    shipments: [],
    services: [],
    digitalDeliveries: [],
    logisticsSummary: { status: 'not_initialized', shipmentCount: 0 },
  },
  operational: {
    queue: 'prepare',
    nextAction: 'Preparar logística',
    progress: 20,
    shipmentCount: 0,
    openIncidentCount: 0,
    sla: { state: 'on_track' },
  },
};

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function waitForPreview(child) {
  const deadline = Date.now() + 20_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Vite terminó antes de iniciar (código ${child.exitCode}).`);
    }

    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return;
    } catch {
      // El servidor todavía está iniciando.
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error('Vite no quedó disponible para la prueba E2E de Órdenes.');
}

async function configurePage(page, profile) {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('admin_token', 'stage1.e2e.token');
    window.localStorage.setItem('auth', 'true');
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return route.continue();

    if (url.pathname === '/api/admin/auth/verify') {
      return json(route, {
        ok: true,
        user: {
          id: `stage1-${profile.adminRole}`,
          username: `stage1-${profile.adminRole}`,
          displayName: profile.displayName,
          role: 'admin',
          adminRole: profile.adminRole,
          permissions: profile.permissions,
          active: true,
        },
      });
    }

    if (url.pathname === '/api/site-settings') {
      return json(route, { theme: {}, admin: { theme: {} } });
    }

    if (url.pathname === '/api/orders/admin') {
      return json(route, {
        data: [ORDER],
        page: 1,
        total: 1,
        totalPages: 1,
        summaryIncluded: true,
        financialSummary: {
          totalOrders: 1,
          totalAmount: ORDER.total,
          paidAmount: ORDER.total,
          pendingAmount: 0,
          refundedAmount: 0,
          averageTicket: ORDER.total,
        },
        operationalSummary: {
          total: 1,
          queues: { prepare: 1 },
        },
      });
    }

    if (url.pathname === '/api/admin/branches') {
      return json(route, { data: [] });
    }

    if (url.pathname === `/api/orders/${ORDER_ID}`) {
      return json(route, ORDER);
    }

    if (url.pathname === `/api/orders/${ORDER_ID}/timeline`) {
      return json(route, { data: [] });
    }

    if (url.pathname === `/api/orders/${ORDER_ID}/notes`) {
      return json(route, { data: [] });
    }

    if (url.pathname === `/api/orders/${ORDER_ID}/refunds`) {
      return json(route, { refunds: [] });
    }

    if (url.pathname === `/api/orders/${ORDER_ID}/returns`) {
      return json(route, {
        policy: { windowDays: 30 },
        eligibility: [],
        returns: [],
      });
    }

    if (url.pathname === `/api/orders/${ORDER_ID}/fulfillment/logistics`) {
      return json(route, {
        shipments: [],
        summary: { status: 'not_initialized', shipmentCount: 0 },
        eligibility: {
          canInitialize: true,
          code: 'READY',
          message: 'La orden de prueba está lista para preparación.',
        },
        orderStatus: 'paid',
        fulfillmentStatus: 'pending',
      });
    }

    if (url.pathname === '/api/orders/admin/shipping/providers') {
      return json(route, {
        providers: {
          manual: { enabled: true },
          envia: { enabled: false, mode: 'sandbox' },
        },
      });
    }

    return json(route, { ok: true, data: {} });
  });

  return pageErrors;
}

async function assertNoDocumentOverflow(page, label) {
  const sizes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(
    sizes.documentWidth <= sizes.viewport + 1,
    `${label} desborda horizontalmente: ${sizes.documentWidth}px > ${sizes.viewport}px.`
  );
}

async function openOrder(page) {
  await page.goto(`${BASE_URL}/admin/ordenes`, { waitUntil: 'networkidle' });
  await page.getByText(`#${ORDER.orderNumber}`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Gestionar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('tab', { name: 'Resumen', exact: true }).waitFor();
  return dialog;
}

async function ownerDesktopScenario(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const pageErrors = await configurePage(page, {
    adminRole: 'owner',
    displayName: 'Propietario QA',
    permissions: ['*'],
  });

  await page.goto(`${BASE_URL}/admin/ordenes`, { waitUntil: 'networkidle' });
  await page.getByText(`#${ORDER.orderNumber}`, { exact: true }).waitFor();
  await page.getByRole('checkbox', { name: 'Seleccionar órdenes visibles' }).waitFor();
  await page.getByRole('button', { name: 'Mostrar panel de filtros' }).click();
  await page.getByRole('button', { name: 'Exportar CSV' }).waitFor();
  await page.getByRole('button', { name: 'Ocultar panel de filtros' }).click();
  await page.getByRole('button', { name: 'Gestionar', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  assert.equal(await dialog.getByRole('tab').count(), 6, 'El detalle debe conservar sus seis secciones.');
  await dialog.getByRole('button', { name: 'Gestionar', exact: true }).click();
  await dialog.getByRole('heading', { name: 'Gestionar orden' }).waitFor();
  assert.deepEqual(pageErrors, [], `Errores de navegador para owner: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function warehouseMobileScenario(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const pageErrors = await configurePage(page, {
    adminRole: 'warehouse',
    displayName: 'Bodega QA',
    permissions: ['orders:view', 'orders:fulfillment', 'orders:returns'],
  });

  const dialog = await openOrder(page);
  await assertNoDocumentOverflow(page, 'La vista móvil de bodega');
  assert.equal(
    await dialog.getByRole('button', { name: 'Factura', exact: true }).count(),
    0,
    'Bodega no debe tener acceso a documentos fiscales.'
  );
  assert.equal(
    await dialog.getByRole('button', { name: 'Gestionar', exact: true }).count(),
    0,
    'Bodega no debe recibir acciones administrativas generales.'
  );

  await dialog.getByRole('tab', { name: 'Operación', exact: true }).click();
  await dialog.getByRole('heading', { name: 'Centro logístico' }).waitFor();
  await dialog.getByRole('tab', { name: 'Posventa', exact: true }).click();
  await dialog.getByText('Posventa · RMA', { exact: true }).waitFor();
  assert.deepEqual(pageErrors, [], `Errores de navegador para bodega: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function readOnlyMobileScenario(browser) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
  const page = await context.newPage();
  const pageErrors = await configurePage(page, {
    adminRole: 'viewer',
    displayName: 'Consulta QA',
    permissions: ['orders:view'],
  });

  await page.goto(`${BASE_URL}/admin/ordenes`, { waitUntil: 'networkidle' });
  await page.getByText(`#${ORDER.orderNumber}`, { exact: true }).waitFor();
  assert.equal(await page.getByRole('checkbox', { name: 'Seleccionar órdenes visibles' }).count(), 0);
  await page.getByRole('button', { name: 'Mostrar panel de filtros' }).click();
  assert.equal(await page.getByRole('button', { name: 'Exportar CSV' }).count(), 0);
  await page.getByRole('button', { name: 'Ocultar panel de filtros' }).click();

  const dialog = await openOrder(page);
  await assertNoDocumentOverflow(page, 'La vista móvil de solo lectura');
  assert.equal(await dialog.getByRole('button', { name: 'Gestionar', exact: true }).count(), 0);
  assert.equal(await dialog.getByRole('button', { name: 'PDF', exact: true }).count(), 0);
  assert.equal(await dialog.getByRole('button', { name: 'Factura', exact: true }).count(), 0);
  assert.deepEqual(pageErrors, [], `Errores de navegador para solo lectura: ${pageErrors.join(' | ')}`);
  await context.close();
}

async function main() {
  const preview = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'],
    { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let previewOutput = '';
  preview.stdout.on('data', (chunk) => { previewOutput += chunk; });
  preview.stderr.on('data', (chunk) => { previewOutput += chunk; });

  let browser;
  try {
    await waitForPreview(preview);
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    });
    await ownerDesktopScenario(browser);
    await warehouseMobileScenario(browser);
    await readOnlyMobileScenario(browser);
    console.log('E2E de Órdenes aprobado: owner, bodega y solo lectura en escritorio/móvil.');
  } catch (error) {
    if (previewOutput.trim()) console.error(previewOutput.trim());
    throw error;
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('FALLO E2E de Órdenes etapa 1:', error);
  process.exitCode = 1;
});
