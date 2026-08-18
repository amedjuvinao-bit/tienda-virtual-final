import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const HOST = '127.0.0.1';
const PORT = 4173;
const BASE_URL = `http://${HOST}:${PORT}`;
const ORDER_ID = '000000000000000000000001';
const FINGERPRINT = 'a'.repeat(64);

// Fixture completamente ficticia: no representa a ninguna persona real.
const order = {
  id: ORDER_ID,
  orderNumber: 'FM-PHASE1-E2E-001',
  customerName: 'Fixture Fiscal Automatizada',
  customerEmail: 'fixture.phase1@example.invalid',
  source: 'manual',
  itemsCount: 1,
  paymentStatus: 'paid',
  paymentProvider: 'manual',
  subtotal: 162900,
  shipping: 0,
  total: 162900,
  createdAt: '2026-08-17T12:00:00.000Z',
};

const preflight = {
  ready: true,
  blockers: [],
  warnings: [],
  fingerprint: FINGERPRINT,
  orderId: ORDER_ID,
  orderNumber: order.orderNumber,
  provider: 'factus',
  environment: 'habilitacion',
  customer: {
    personType: 'natural',
    documentType: 'CC',
    documentNumber: '0000000000',
    firstName: 'Fixture Fiscal',
    lastName: 'Automatizada',
    email: 'fixture.phase1@example.invalid',
    phone: '0000000001',
    address: 'DIRECCION FICTICIA SIN VALIDEZ',
    city: 'Bogotá, D.C.',
    department: 'Bogotá, D.C.',
    municipalityCode: '11001',
  },
  totals: {
    subtotal: 162900,
    totalDiscount: 0,
    taxAmount: 0,
    shipping: 0,
    total: 162900,
  },
  payload: {
    items: [
      {
        code_reference: 'QA50-022',
        name: 'Tableta Axis fase 1',
        quantity: 1,
        price: 162900,
      },
    ],
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

  throw new Error('Vite no quedó disponible para la prueba E2E.');
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const pageErrors = [];
    let generatedPayload = null;

    page.on('pageerror', (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      window.localStorage.setItem('admin_token', 'phase1.e2e.token');
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
            id: 'phase1-owner',
            username: 'phase1-owner',
            displayName: 'QA Fase 1',
            role: 'owner',
            adminRole: 'owner',
            permissions: ['*'],
            active: true,
          },
        });
      }

      if (url.pathname === '/api/site-settings') {
        return json(route, { theme: {}, admin: { theme: {} } });
      }

      if (url.pathname === '/api/admin/billing/pending-orders') {
        return json(route, { ok: true, data: { rows: [order], total: 1, page: 1, pages: 1 } });
      }

      if (url.pathname === `/api/admin/billing/orders/${ORDER_ID}/preflight`) {
        return json(route, { ok: true, data: preflight });
      }

      if (
        url.pathname === `/api/admin/billing/orders/${ORDER_ID}/generate` &&
        request.method() === 'POST'
      ) {
        generatedPayload = request.postDataJSON();
        return json(route, {
          ok: true,
          data: {
            created: true,
            invoice: { invoiceNumber: 'SETP990015999', status: 'accepted' },
          },
        }, 201);
      }

      return json(route, { ok: true, data: {} });
    });

    await page.goto(`${BASE_URL}/admin/facturacion/ordenes`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Revisar y emitir' }).click();

    const dialog = page.getByRole('dialog', { name: /revisa antes de emitir en factus/i });
    await dialog.waitFor();
    await dialog.getByText('0000000000', { exact: true }).waitFor();
    await dialog.getByText('Bogotá, D.C. · Bogotá, D.C.', { exact: true }).waitFor();
    await dialog.getByText('Tableta Axis fase 1', { exact: true }).waitFor();
    await dialog.getByText(/162\.900/).last().waitFor();

    const emitButton = dialog.getByRole('button', { name: 'Confirmar y emitir' });
    assert.equal(await emitButton.isDisabled(), true, 'Emitir debe iniciar bloqueado.');
    await dialog.getByRole('checkbox').check();
    assert.equal(await emitButton.isEnabled(), true, 'La confirmación debe habilitar la emisión.');
    await emitButton.click();

    await page.getByText('Factura SETP990015999 generada correctamente.', { exact: true }).waitFor();
    assert.deepEqual(generatedPayload, { preflightFingerprint: FINGERPRINT });
    assert.deepEqual(pageErrors, [], `Errores de navegador: ${pageErrors.join(' | ')}`);

    console.log('E2E Fase 1 aprobado: revisión fiscal, confirmación y emisión enlazada.');
  } catch (error) {
    if (previewOutput.trim()) console.error(previewOutput.trim());
    throw error;
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((error) => {
  console.error('FALLO E2E Fase 1:', error);
  process.exitCode = 1;
});
