import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = 4176;
const BASE_URL = `http://${HOST}:${PORT}`;
const ORDER_ID = '000000000000000000002001';
const REFUND_ID = '000000000000000000002101';

const ORDER = {
  _id: ORDER_ID,
  orderNumber: 'ORD-STAGE2-E2E-001',
  createdAt: '2026-08-24T14:00:00.000Z',
  updatedAt: '2026-08-24T15:00:00.000Z',
  source: 'pos',
  status: 'delivered',
  subtotal: 180000,
  shipping: 0,
  total: 180000,
  tags: ['devolucion'],
  customer: {
    name: 'Cliente',
    lastname: 'Etapa Dos',
    email: 'stage2.orders@example.invalid',
    phone: '3000000000',
  },
  billing: {
    name: 'Cliente Etapa Dos',
    documentType: 'CC',
    documentNumber: '0000000000',
    email: 'stage2.orders@example.invalid',
    address: 'Dirección ficticia',
    city: 'Bogotá, D.C.',
    municipalityCode: '11001',
  },
  items: [
    {
      _id: '000000000000000000002201',
      productId: '000000000000000000002301',
      title: 'Producto físico de conciliación',
      quantity: 1,
      qty: 1,
      price: 180000,
      lineTotal: 180000,
      productType: 'physical',
      requiresShipping: true,
    },
  ],
  payment: {
    status: 'paid',
    provider: 'manual',
    method: 'cash',
    amount: 180000,
    paidAt: '2026-08-24T14:05:00.000Z',
  },
  branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
  fulfillment: {
    status: 'delivered',
    shipments: [],
    services: [],
    digitalDeliveries: [],
    logisticsSummary: { status: 'delivered', shipmentCount: 1 },
  },
  operational: {
    queue: 'completed',
    nextAction: 'Cerrar conciliación de devolución',
    progress: 100,
    shipmentCount: 1,
    openIncidentCount: 0,
    sla: { state: 'on_track' },
  },
};

let refund = {
  _id: REFUND_ID,
  refundNumber: 'RF-STAGE2-E2E-001',
  amount: 180000,
  status: 'processed',
  processedAt: '2026-08-24T15:00:00.000Z',
  reconciliation: {
    state: 'action_required',
    inventory: { state: 'completed', reference: 'RF-STAGE2-E2E-001' },
    payment: { state: 'action_required' },
    cash: { state: 'completed', reference: 'CAJA-STAGE2' },
    billing: {
      state: 'action_required',
      reference: 'FV-STAGE2-001',
      errorMessage: 'La factura validada requiere una nota crédito oficial.',
    },
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
  throw new Error('Vite no quedó disponible para el E2E de Órdenes · Etapa 2.');
}

async function configurePage(page) {
  const pageErrors = [];
  const confirmations = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('admin_token', 'stage2.e2e.token');
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
          id: 'stage2-billing',
          username: 'stage2-billing',
          displayName: 'Facturación QA',
          role: 'admin',
          adminRole: 'billing',
          permissions: ['orders:view', 'orders:refund', 'billing:credit_note'],
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
          refundedAmount: ORDER.total,
          averageTicket: ORDER.total,
        },
        operationalSummary: { total: 1, queues: { completed: 1 } },
      });
    }
    if (url.pathname === '/api/admin/branches') return json(route, { data: [] });
    if (url.pathname === `/api/orders/${ORDER_ID}`) return json(route, ORDER);
    if (url.pathname === `/api/orders/${ORDER_ID}/timeline`) {
      return json(route, { data: [] });
    }
    if (url.pathname === `/api/orders/${ORDER_ID}/notes`) {
      return json(route, { data: [] });
    }
    if (url.pathname === `/api/orders/${ORDER_ID}/refunds`) {
      return json(route, { ok: true, refunds: [refund] });
    }
    if (url.pathname === `/api/orders/${ORDER_ID}/returns`) {
      return json(route, { policy: { windowDays: 30 }, eligibility: [], returns: [] });
    }
    if (url.pathname === `/api/orders/${ORDER_ID}/fulfillment/logistics`) {
      return json(route, {
        shipments: [],
        summary: { status: 'delivered', shipmentCount: 1 },
        eligibility: { canInitialize: false, code: 'ALREADY_INITIALIZED' },
        orderStatus: 'delivered',
        fulfillmentStatus: 'delivered',
      });
    }
    if (url.pathname === '/api/orders/admin/shipping/providers') {
      return json(route, { providers: { manual: { enabled: true } } });
    }
    if (
      request.method() === 'POST' &&
      url.pathname ===
        `/api/orders/${ORDER_ID}/refunds/${REFUND_ID}/confirm-payment`
    ) {
      const payload = request.postDataJSON();
      confirmations.push(payload);
      refund = {
        ...refund,
        reconciliation: {
          ...refund.reconciliation,
          payment: {
            state: 'completed',
            reference: payload.reference,
            completedByLabel: 'Facturación QA',
          },
        },
      };
      return json(route, { ok: true, refund });
    }

    return json(route, { ok: true, data: {} });
  });

  return { pageErrors, confirmations };
}

async function runScenario(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const { pageErrors, confirmations } = await configurePage(page);

  await page.goto(`${BASE_URL}/admin/ordenes`, { waitUntil: 'networkidle' });
  await page.getByText(`#${ORDER.orderNumber}`, { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Gestionar', exact: true }).click();

  const dialog = page.getByRole('dialog');
  await dialog.waitFor();
  await dialog.getByRole('tab', { name: 'Pago y factura', exact: true }).click();
  await dialog.getByText('Devoluciones y conciliación', { exact: true }).waitFor();
  await dialog.getByText('Confirma el dinero devuelto', { exact: true }).waitFor();

  const confirmation = dialog.getByRole('button', {
    name: 'Confirmar dinero devuelto',
  });
  assert.equal(await confirmation.isDisabled(), true);
  await dialog
    .getByRole('textbox', { name: 'Referencia devolución RF-STAGE2-E2E-001' })
    .fill('REVERSO-E2E-STAGE2-001');
  await confirmation.click();

  await dialog.getByText('Emite o recupera la nota crédito', { exact: true }).waitFor();
  assert.equal(confirmations.length, 1, 'Debe existir una sola confirmación monetaria.');
  assert.equal(confirmations[0].reference, 'REVERSO-E2E-STAGE2-001');
  assert.equal(
    await dialog.getByRole('button', { name: 'Confirmar dinero devuelto' }).count(),
    0,
    'La acción monetaria debe desaparecer cuando ya quedó confirmada.'
  );
  assert.deepEqual(pageErrors, [], `Errores de navegador: ${pageErrors.join(' | ')}`);

  await context.close();
}

async function main() {
  const preview = spawn(
    process.execPath,
    [
      'node_modules/vite/bin/vite.js',
      'preview',
      '--host',
      HOST,
      '--port',
      String(PORT),
      '--strictPort',
    ],
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
    await runScenario(browser);
    console.log(
      'E2E de Órdenes · Etapa 2 aprobado: dinero confirmado y obligación fiscal preservada.'
    );
  } catch (error) {
    if (previewOutput.trim()) console.error(previewOutput.trim());
    throw error;
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('FALLO E2E de Órdenes · Etapa 2:', error);
  process.exitCode = 1;
});
