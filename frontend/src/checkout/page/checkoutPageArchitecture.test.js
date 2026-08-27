import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pageDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendSource = path.resolve(pageDirectory, '../..');
const checkoutPagePath = path.join(frontendSource, 'pages/CheckoutPage.jsx');
const extractedModules = [
  'CheckoutContactSection.jsx',
  'CheckoutDeliverySection.jsx',
  'CheckoutFormActions.jsx',
  'CheckoutOrderSummary.jsx',
  'CheckoutPageView.jsx',
  'CheckoutPaymentSection.jsx',
  'checkoutPageModel.js',
  'checkoutPageStyles.js',
  'checkoutSubmissionModel.js',
  'checkoutWompi.js',
  'useCheckoutConfiguration.js',
  'useCheckoutDerived.js',
  'useCheckoutGeography.js',
  'useCheckoutQuote.js',
  'useCheckoutState.js',
  'useCheckoutSubmission.js',
  'useWompiCheckout.js',
];

function source(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function lineCount(filePath) {
  return source(filePath).split(/\r?\n/).length;
}

describe('arquitectura escalable de Checkout', () => {
  it('mantiene el orquestador y cada responsabilidad bajo el ratchet acordado', () => {
    expect(lineCount(checkoutPagePath)).toBeLessThanOrEqual(100);
    for (const moduleName of extractedModules) {
      expect(
        lineCount(path.join(pageDirectory, moduleName)),
        `${moduleName} excedió 450 líneas`
      ).toBeLessThanOrEqual(450);
    }
  });

  it('compone estado, configuración, derivados, geografía, quote y envío sin lógica de red en la página', () => {
    const page = source(checkoutPagePath);
    expect(page).toContain('useCheckoutState()');
    expect(page).toContain('useCheckoutConfiguration(state)');
    expect(page).toContain('useCheckoutDerived({ state, cart })');
    expect(page).toContain('useCheckoutGeography({ state, selectedCountry: derived.selectedCountry })');
    expect(page).toContain('useCheckoutQuote({');
    expect(page).toContain('useCheckoutSubmission({');
    expect(page).toContain('<CheckoutPageView');
    expect(page).not.toContain('api.post(');
    expect(page).not.toContain('fetch(');
  });

  it('mantiene cada contrato crítico en el módulo que lo gobierna', () => {
    const quote = source(path.join(pageDirectory, 'useCheckoutQuote.js'));
    const submission = source(path.join(pageDirectory, 'useCheckoutSubmission.js'));
    const wompi = source(path.join(pageDirectory, 'useWompiCheckout.js'));
    const view = source(path.join(pageDirectory, 'CheckoutPageView.jsx'));

    expect(quote).toContain("api.post(\n          '/api/orders/quote'");
    expect(quote).toContain('/store-credit/preview');
    expect(submission).toContain("validateCart('strict')");
    expect(submission).toContain('await renewCartAccess()');
    expect(submission).toContain("'/api/payments/payu/checkout-data'");
    expect(submission).toContain("'Idempotency-Key': idempotencyKey");
    expect(wompi).toContain('/api/payments/wompi/checkout-data');
    expect(view).toContain('<CheckoutContactSection');
    expect(view).toContain('<CheckoutDeliverySection');
    expect(view).toContain('<CheckoutPaymentSection');
    expect(view).toContain('<CheckoutOrderSummary');
  });
});
