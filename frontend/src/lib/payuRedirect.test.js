import { afterEach, describe, expect, it, vi } from 'vitest';

import { redirectToPayU } from './payuRedirect';

function paymentFormFields(form) {
  return Object.fromEntries(
    [...form.querySelectorAll('input')].map((input) => [input.name, input.value])
  );
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('redirectToPayU', () => {
  it('envía exactamente el importe externo, firma y comprador emitidos por backend', () => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {});

    redirectToPayU({
      mode: 'production',
      actionUrl: 'https://checkout.payulatam.com/ppp-web-gateway-payu/',
      order: {
        orderNumber: '000901',
        total: 125000,
        paymentAmount: 100000.5,
      },
      payu: {
        merchantId: '508029',
        accountId: '512321',
        referenceCode: 'ORDER-000901__TRY__123',
        description: 'Pago orden 000901',
        amount: '100000.50',
        currency: 'COP',
        algorithmSignature: 'MD5',
        signature: 'firma-servidor-inmutable',
        responseUrl: 'https://tienda.example/gracias?orderNumber=000901',
        confirmationUrl: 'https://api.tienda.example/api/payments/payu/webhook',
        test: 0,
      },
      customerData: {
        buyerEmail: 'cliente@example.com',
        email: 'campo-heredado-no-autoritativo@example.com',
      },
    });

    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form.method).toBe('post');
    expect(form.action).toBe(
      'https://checkout.payulatam.com/ppp-web-gateway-payu/'
    );
    expect(paymentFormFields(form)).toEqual({
      merchantId: '508029',
      accountId: '512321',
      description: 'Pago orden 000901',
      referenceCode: 'ORDER-000901__TRY__123',
      amount: '100000.50',
      tax: '0',
      taxReturnBase: '0',
      currency: 'COP',
      algorithmSignature: 'MD5',
      signature: 'firma-servidor-inmutable',
      buyerEmail: 'cliente@example.com',
      test: '0',
      responseUrl: 'https://tienda.example/gracias?orderNumber=000901',
      confirmationUrl: 'https://api.tienda.example/api/payments/payu/webhook',
    });
    expect(form.querySelector('[name="apiKey"]')).toBeNull();
    expect(form.querySelector('[name="apiLogin"]')).toBeNull();
    expect(submit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['firma', { signature: '' }],
    ['algoritmo', { algorithmSignature: '' }],
    ['correo', {}, { buyerEmail: '', email: '' }],
  ])('falla de forma cerrada si falta %s', (_label, override, customerOverride) => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {});
    const payu = {
      merchantId: '508029',
      accountId: '512321',
      referenceCode: 'ORDER-000901__TRY__123',
      amount: '100000',
      currency: 'COP',
      algorithmSignature: 'MD5',
      signature: 'firma-servidor-inmutable',
      responseUrl: 'https://tienda.example/gracias',
      confirmationUrl: 'https://api.tienda.example/api/payments/payu/webhook',
      test: 1,
      ...override,
    };

    expect(() =>
      redirectToPayU({
        mode: 'sandbox',
        actionUrl:
          'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/',
        payu,
        customerData: {
          buyerEmail: 'cliente@example.com',
          ...customerOverride,
        },
      })
    ).toThrow('Faltan datos obligatorios para redirigir a PayU.');
    expect(document.querySelector('form')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });

  it('rechaza una URL externa aunque el resto del payload sea válido', () => {
    const submit = vi
      .spyOn(HTMLFormElement.prototype, 'submit')
      .mockImplementation(() => {});

    expect(() =>
      redirectToPayU({
        mode: 'production',
        actionUrl: 'https://attacker.example/collect',
        payu: {
          merchantId: '508029',
          accountId: '512321',
          referenceCode: 'ORDER-000901__TRY__123',
          amount: '100000',
          currency: 'COP',
          algorithmSignature: 'MD5',
          signature: 'firma-servidor-inmutable',
          responseUrl: 'https://tienda.example/gracias',
          confirmationUrl:
            'https://api.tienda.example/api/payments/payu/webhook',
          test: 0,
        },
        customerData: { buyerEmail: 'cliente@example.com' },
      })
    ).toThrow('La dirección de pago PayU no es válida.');
    expect(document.querySelector('form')).toBeNull();
    expect(submit).not.toHaveBeenCalled();
  });
});
