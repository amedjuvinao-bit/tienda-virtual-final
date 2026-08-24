import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = 4177;
const BASE_URL = `http://${HOST}:${PORT}`;

function buildOrder(orderNumber, index = 0) {
  const id = String(index + 1).padStart(24, '0');
  return {
    _id: id,
    orderNumber,
    createdAt: new Date(Date.UTC(2026, 7, 24, 15, 0, index)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 7, 24, 15, 0, index)).toISOString(),
    source: 'online',
    status: 'paid',
    subtotal: 100000 + index,
    shipping: 0,
    total: 100000 + index,
    itemsCount: 1,
    totalItems: 1,
    customer: {
      name: 'Cliente',
      lastname: `Escala ${index}`,
      email: `orders-stage3-${index}@example.invalid`,
    },
    items: [
      {
        _id: `item-${id}`,
        title: `Producto escala ${index}`,
        quantity: 1,
        price: 100000 + index,
      },
    ],
    branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
    payment: { status: 'paid', provider: 'manual' },
    operational: {
      queue: 'prepare',
      urgency: 'normal',
      nextAction: 'Preparar logística',
      progress: 20,
      shipmentCount: 0,
      openIncidentCount: 0,
      sla: { state: 'on_track' },
    },
  };
}

const PAGE_ONE = Array.from({ length: 20 }, (_, index) =>
  buildOrder(`ORD-PAGE-1-${String(index + 1).padStart(2, '0')}`, index)
);
const PAGE_TWO = Array.from({ length: 20 }, (_, index) =>
  buildOrder(`ORD-PAGE-2-${String(index + 1).padStart(2, '0')}`, index + 20)
);

function summary(total) {
  return {
    totalOrders: total,
    totalSales: total * 100000,
    pendingAmount: 0,
    paidOrders: total,
    pendingOrders: 0,
    cancelledOrders: 0,
    averageTicket: 100000,
    withoutInvoiceOrders: total,
    validatedInvoiceOrders: 0,
  };
}

function operationalSummary(total) {
  return {
    total,
    attention: 0,
    awaitingPayment: 0,
    prepare: total,
    dispatch: 0,
    transit: 0,
    incidents: 0,
    slaRisk: 0,
    completed: 0,
  };
}

function json(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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
    await delay(200);
  }
  throw new Error('Vite no quedó disponible para el E2E de Órdenes · Etapa 3.');
}

async function waitForCondition(condition, message) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (condition()) return;
    await delay(25);
  }
  throw new Error(message);
}

async function configurePage(page) {
  const pageErrors = [];
  const orderRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(() => {
    window.localStorage.setItem('admin_token', 'stage3.e2e.token');
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
          id: 'stage3-owner',
          username: 'stage3-owner',
          displayName: 'Propietario Etapa 3',
          role: 'admin',
          adminRole: 'owner',
          permissions: ['*'],
          active: true,
        },
      });
    }
    if (url.pathname === '/api/site-settings') {
      return json(route, { theme: {}, admin: { theme: {} } });
    }
    if (url.pathname === '/api/admin/branches') {
      return json(route, { data: [] });
    }
    if (url.pathname === '/api/orders/admin') {
      const params = Object.fromEntries(url.searchParams.entries());
      orderRequests.push(params);
      const query = String(params.q || '');
      const pageNumber = Number(params.page || 1);
      const includeSummary = String(params.includeSummary || '1') !== '0';

      if (query === 'anterior') {
        await delay(1200);
        try {
          return await json(route, {
            data: [buildOrder('ORD-ANTERIOR', 80)],
            page: 1,
            total: 99,
            totalPages: 5,
            summaryIncluded: true,
            financialSummary: summary(99),
            operationalSummary: operationalSummary(99),
          });
        } catch {
          // La consulta fue cancelada por React al quedar obsoleta.
          return undefined;
        }
      }

      if (query === 'actual') {
        await delay(50);
        return json(route, {
          data: [buildOrder('ORD-ACTUAL', 81)],
          page: 1,
          total: 1,
          totalPages: 1,
          summaryIncluded: true,
          financialSummary: summary(1),
          operationalSummary: operationalSummary(1),
        });
      }

      const rows = pageNumber === 2 ? PAGE_TWO : PAGE_ONE;
      return json(route, {
        data: rows,
        page: pageNumber,
        summaryIncluded: includeSummary,
        ...(includeSummary
          ? {
              total: 41,
              totalPages: 3,
              financialSummary: summary(41),
              operationalSummary: operationalSummary(41),
            }
          : {}),
      });
    }

    return json(route, { ok: true, data: {} });
  });

  return { orderRequests, pageErrors };
}

async function runScenario(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const { orderRequests, pageErrors } = await configurePage(page);

  await page.goto(`${BASE_URL}/admin/ordenes`, { waitUntil: 'networkidle' });
  await page.getByText('#ORD-PAGE-1-01', { exact: true }).waitFor();
  await page
    .getByRole('button', { name: 'Siguiente página', exact: true })
    .click();
  await page.getByText('#ORD-PAGE-2-01', { exact: true }).waitFor();
  await page.getByText('Página 2 de 3', { exact: false }).waitFor();

  const secondPageRequest = orderRequests.find(
    (params) => params.page === '2' && !params.q
  );
  assert(secondPageRequest, 'No se solicitó la segunda página.');
  assert.equal(
    secondPageRequest.includeSummary,
    '0',
    'Paginar no debe recalcular los indicadores.'
  );
  await page
    .locator('.orders-admin-metrics .orf-card-metric')
    .filter({ hasText: 'Total órdenes' })
    .getByText('41', { exact: true })
    .waitFor();

  await page.getByRole('button', { name: 'Mostrar panel de filtros' }).click();
  const search = page.getByPlaceholder('Buscar orden, cliente o email...');
  await search.fill('anterior');
  await waitForCondition(
    () => orderRequests.some((params) => params.q === 'anterior'),
    'No comenzó la consulta anterior.'
  );
  await search.fill('actual');
  await page.getByText('#ORD-ACTUAL', { exact: true }).waitFor();
  await delay(1300);

  assert.equal(
    await page.getByText('#ORD-ANTERIOR', { exact: true }).count(),
    0,
    'Una respuesta obsoleta reemplazó el filtro actual.'
  );
  const currentRequest = orderRequests.find((params) => params.q === 'actual');
  assert(currentRequest, 'No se ejecutó la consulta del filtro actual.');
  assert.equal(currentRequest.includeSummary, '1');
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
      'E2E de Órdenes · Etapa 3 aprobado: paginación liviana y filtros sin respuestas obsoletas.'
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
  console.error('FALLO E2E de Órdenes · Etapa 3:', error);
  process.exitCode = 1;
});
