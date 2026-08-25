import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = 4178;
const BASE_URL = `http://${HOST}:${PORT}`;
const ORDER_ID = '000000000000000000004001';
const LINE_ID = '000000000000000000004101';
const RETURN_ID = '000000000000000000004201';
const RETURN_TOKEN = 'stage4.e2e.return.token';

let returns = [];

function customerPayload() {
  return {
    ok: true,
    order: { id: ORDER_ID, orderNumber: 'ORD-STAGE4-E2E' },
    policy: {
      enabled: true,
      customerPortalEnabled: true,
      windowDays: 30,
      allowedResolutions: ['exchange', 'store_credit'],
      requireReasonText: true,
      returnShippingPaidBy: 'store',
      instructions: 'Conserva el comprobante de entrega.',
      policyText: 'Puedes solicitar el cambio dentro de los 30 días siguientes a la entrega.',
    },
    eligibility: [{
      orderItemId: LINE_ID,
      title: 'Tenis Plus E2E',
      variantKey: 'm__negro',
      size: 'M',
      color: 'Negro',
      purchasedQuantity: 1,
      deliveredQuantity: 1,
      availableQuantity: returns.length ? 0 : 1,
      deliveredAt: '2026-08-20T12:00:00.000Z',
      eligibleUntil: '2026-09-19T12:00:00.000Z',
      eligible: returns.length === 0,
      expired: false,
      blocker: returns.length ? 'ITEM_ALREADY_RETURNED' : '',
    }],
    returns,
  };
}

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
  throw new Error('Vite no quedó disponible para el E2E de Órdenes · Etapa 4.');
}

async function runScenario(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const pageErrors = [];
  const customerRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.addInitScript(({ orderId, token }) => {
    window.localStorage.setItem(
      'order_return_access_v1',
      JSON.stringify({
        orderId,
        token,
        expiresAt: '2030-08-24T12:00:00.000Z',
      })
    );
  }, { orderId: ORDER_ID, token: RETURN_TOKEN });

  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!url.pathname.startsWith('/api/')) return route.continue();

    if (url.pathname === '/api/site-settings') {
      return json(route, {
        theme: {
          colors: { primary: '#8b2be2', accent: '#e83e8c', background: '#fff8fc' },
        },
      });
    }
    if (url.pathname === `/api/orders/${ORDER_ID}/returns/self-service`) {
      customerRequests.push({
        method: request.method(),
        token: request.headers()['x-order-return-token'] || '',
        body: request.postDataJSON?.() || null,
      });
      if (request.method() === 'POST') {
        returns = [{
          _id: RETURN_ID,
          returnNumber: 'RMA-STAGE4-E2E',
          status: 'authorized',
          revision: 0,
          requestedResolution: 'exchange',
          requestedAt: '2026-08-24T16:00:00.000Z',
          shipping: {
            labelType: 'internal_rma',
            instructions: 'Conserva el comprobante de entrega.',
          },
          items: [{
            orderItemId: LINE_ID,
            title: 'Tenis Plus E2E',
            requestedQuantity: 1,
            reasonCode: 'wrong_size',
          }],
        }];
        return json(route, { ok: true, returnCase: returns[0] }, 201);
      }
      return json(route, customerPayload());
    }

    return json(route, { ok: true, data: {} });
  });

  await page.goto(`${BASE_URL}/devoluciones/${ORDER_ID}`, { waitUntil: 'networkidle' });
  await page.getByText('Tenis Plus E2E', { exact: true }).waitFor();
  await page.getByLabel('Cantidad Tenis Plus E2E').fill('1');
  await page.getByLabel('Motivo Tenis Plus E2E').selectOption('wrong_size');
  await page.getByLabel('Detalle Tenis Plus E2E').fill('Necesito cambiar la talla del producto.');
  await page.getByRole('button', { name: 'Enviar solicitud' }).click();

  await page.getByText('RMA-STAGE4-E2E', { exact: true }).waitFor();
  await page.getByText('Devolución autorizada', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Descargar etiqueta RMA' }).waitFor();

  const post = customerRequests.find((entry) => entry.method === 'POST');
  assert(post, 'El portal no envió la solicitud de devolución.');
  assert.equal(post.token, RETURN_TOKEN, 'La solicitud no usó X-Order-Return-Token.');
  assert.equal(post.body.requestedResolution, 'exchange');
  assert.deepEqual(post.body.items, [{
    orderItemId: LINE_ID,
    quantity: 1,
    reasonCode: 'wrong_size',
    reasonText: 'Necesito cambiar la talla del producto.',
  }]);
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
    console.log('E2E de Órdenes · Etapa 4 aprobado: autoservicio, solicitud y trazabilidad RMA.');
  } catch (error) {
    if (previewOutput.trim()) console.error(previewOutput.trim());
    throw error;
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('FALLO E2E de Órdenes · Etapa 4:', error);
  process.exitCode = 1;
});
