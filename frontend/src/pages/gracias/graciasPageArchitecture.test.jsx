import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { selectPaymentResponse } from './paymentResponseModel';
import { buildSafeThanksPageConfig } from './thanksPageConfig';
import { buildThanksPageViewModel } from './thanksPageViewModel';

const directory = path.dirname(fileURLToPath(import.meta.url));
const pagePath = path.resolve(directory, '../GraciasPage.jsx');

function lineCount(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).length;
}

function buildModel(overrides = {}) {
  return buildThanksPageViewModel({
    paymentResponse: selectPaymentResponse(''),
    thanksOrderData: null,
    wompiTxData: null,
    thanksConfig: buildSafeThanksPageConfig({}),
    thanksAccessError: '',
    verificationLoading: false,
    ...overrides,
  });
}

describe('arquitectura y autoridad de GraciasPage', () => {
  it('mantiene una fachada mínima y módulos cohesivos', () => {
    expect(lineCount(pagePath)).toBeLessThanOrEqual(100);
    const modules = fs.readdirSync(directory)
      .filter((name) => /\.(?:js|jsx)$/.test(name) && !name.includes('.test.'));
    expect(modules.length).toBeGreaterThanOrEqual(10);
    for (const name of modules) {
      expect(lineCount(path.join(directory, name)), name).toBeLessThanOrEqual(350);
    }
  });

  it('no acepta estado, comprador ni importes manipulados desde la URL', () => {
    const paymentResponse = selectPaymentResponse(
      '?orderId=aaaaaaaaaaaaaaaaaaaaaaaa&referenceCode=FAKE-1' +
      '&transactionState=4&lapTransactionState=APROBADA' +
      '&TX_VALUE=999999999&buyerEmail=attacker%40example.com'
    );
    const model = buildModel({
      paymentResponse,
      thanksAccessError: 'No fue posible verificar.',
    });
    expect(model.verified).toBe(false);
    expect(model.hasUnverifiedResult).toBe(true);
    expect(model.paymentMeta.badge).toBe('Pago no verificado');
    expect(model.paymentMeta.showSuccessCheck).toBe(false);
    expect(model.orderNumber).toBe('');
    expect(model.customerName).toBe('');
    expect(model.total).toBe(0);
  });

  it('usa exclusivamente el resumen protegido como autoridad', () => {
    const paymentResponse = selectPaymentResponse(
      '?referenceCode=FAKE&transactionState=6&TX_VALUE=1'
    );
    const model = buildModel({
      paymentResponse,
      thanksOrderData: {
        ok: true,
        orderId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
        orderNumber: 'ORDER-REAL',
        customerName: 'Cliente Real',
        itemCount: 2,
        subtotal: 100000,
        shipping: 10000,
        total: 110000,
        paymentProvider: 'wompi',
        paymentStatus: 'paid',
        paymentStatusLabel: 'Aprobado',
      },
    });
    expect(model.verified).toBe(true);
    expect(model.orderNumber).toBe('ORDER-REAL');
    expect(model.customerName).toBe('Cliente Real');
    expect(model.total).toBe(110000);
    expect(model.paymentMeta.badge).toBe('Pago aprobado');
  });

  it('muestra verificación en curso sin declarar fallo provisional', () => {
    const model = buildModel({
      paymentResponse: selectPaymentResponse('?id=TX-12345678&status=APPROVED&orderId=aaaaaaaaaaaaaaaaaaaaaaaa'),
      verificationLoading: true,
    });
    expect(model.verificationLoading).toBe(true);
    expect(model.hasUnverifiedResult).toBe(false);
    expect(model.paymentMeta.badge).toBe('Verificando pago');
  });

  it('distingue señales PayU de una respuesta Wompi', () => {
    expect(selectPaymentResponse('?id=TX-12345678&status=APPROVED&orderId=aaaaaaaaaaaaaaaaaaaaaaaa').provider).toBe('wompi');
    expect(selectPaymentResponse('?referenceCode=PAYU-1&transactionState=4&orderId=aaaaaaaaaaaaaaaaaaaaaaaa').provider).toBe('payu');
  });

  it('carga el CMS y la verdad protegida en efectos independientes', () => {
    const controller = fs.readFileSync(path.join(directory, 'useGraciasPageController.js'), 'utf8');
    expect(controller).toContain('/api/pages/gracias');
    expect(controller).toContain('/api/orders/${backendOrderId}/thanks');
    expect(controller).toContain('/api/payments/wompi/transaction/${transactionId}');
    expect((controller.match(/useEffect\(\(\) =>/g) || []).length).toBeGreaterThanOrEqual(5);
  });
});
