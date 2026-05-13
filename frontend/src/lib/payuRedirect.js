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
  const amount = Number(payu.amount || 0);
  const currency = String(payu.currency || 'COP').trim().toUpperCase();
  const buyerEmail = String(customerData.email || '').trim();
  const responseUrl = String(payu.redirectUrl || '').trim();
  const confirmationUrl = String(payu.confirmationUrl || '').trim();
  const test = String(
    payu.test === true || payload?.mode === 'sandbox' ? '1' : '0'
  );

  if (!merchantId || !accountId || !referenceCode || !amount || !currency) {
    throw new Error('Faltan datos obligatorios para redirigir a PayU.');
  }

  const actionUrl =
    payload?.mode === 'production'
      ? 'https://gateway.payulatam.com/ppp-web-gateway/'
      : 'https://sandbox.checkout.payulatam.com/ppp-web-gateway-payu/';

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