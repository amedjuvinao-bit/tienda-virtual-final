const PAYU_ACTION_URLS = Object.freeze({
  sandbox: 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/',
  production: 'https://checkout.payulatam.com/ppp-web-gateway-payu/',
});

function resolvePayUActionUrl(payload) {
  const mode = payload?.mode === 'production' ? 'production' : 'sandbox';
  const emittedUrl = String(payload?.actionUrl || '').trim();
  const actionUrl = emittedUrl || PAYU_ACTION_URLS[mode];
  const normalized = actionUrl.replace(/\/+$/, '');
  const expected = PAYU_ACTION_URLS[mode].replace(/\/+$/, '');

  if (normalized !== expected) {
    throw new Error('La dirección de pago PayU no es válida.');
  }

  return PAYU_ACTION_URLS[mode];
}

export function redirectToPayU(payload = {}) {
  const payu = payload?.payu || {};
  const customerData = payload?.customerData || {};
  const order = payload?.order || {};

  const merchantId = String(payu.merchantId || '').trim();
  const accountId = String(payu.accountId || '').trim();
  const referenceCode = String(payu.referenceCode || '').trim();
  const description = String(
    payu.description ||
      `Pago orden ${order.orderNumber || referenceCode || ''}`
  ).trim();
  const amount = String(payu.amount ?? '').trim();
  const currency = String(payu.currency || 'COP').trim().toUpperCase();
  const signature = String(payu.signature || '').trim();
  const algorithmSignature = String(payu.algorithmSignature || '').trim();
  const buyerEmail = String(
    customerData.buyerEmail || customerData.email || ''
  ).trim();
  const responseUrl = String(
    payu.responseUrl || payu.redirectUrl || ''
  ).trim();
  const confirmationUrl = String(payu.confirmationUrl || '').trim();
  const test = String(
    payu.test ?? (payload?.mode === 'production' ? 0 : 1)
  ).trim();
  const actionUrl = resolvePayUActionUrl(payload);

  if (
    !merchantId ||
    !accountId ||
    !referenceCode ||
    !amount ||
    !Number.isFinite(Number(amount)) ||
    Number(amount) <= 0 ||
    !currency ||
    !signature ||
    !algorithmSignature ||
    !buyerEmail ||
    !responseUrl ||
    !confirmationUrl ||
    !['0', '1'].includes(test)
  ) {
    throw new Error('Faltan datos obligatorios para redirigir a PayU.');
  }

  const form = document.createElement('form');
  form.method = 'POST';
  form.action = actionUrl;
  form.style.display = 'none';

  const fields = {
    merchantId,
    accountId,
    description,
    referenceCode,
    amount: String(amount),
    tax: '0',
    taxReturnBase: '0',
    currency,
    algorithmSignature,
    signature,
    buyerEmail,
    test,
    responseUrl,
    confirmationUrl,
  };

  Object.entries(fields).forEach(([name, value]) => {
    if (value === '') return;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value);
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
}
