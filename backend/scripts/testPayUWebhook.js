// backend/scripts/testPayUWebhook.js

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const crypto = require('crypto');
const mongoose = require('mongoose');

const SiteSettings = require('../models/SiteSettings');
const Order = require('../models/Order');

function trimSafe(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function parseArgs(argv = []) {
  const args = {};

  for (const item of argv) {
    const raw = String(item || '').trim();
    if (!raw.startsWith('--')) continue;

    const withoutPrefix = raw.slice(2);
    const [key, ...rest] = withoutPrefix.split('=');
    args[key] = rest.join('=') || true;
  }

  return args;
}

function getNestedPaymentSettings(settings = {}) {
  return settings?.theme?.global?.payments || {};
}

function getPayUCredentials(settings = {}) {
  const payments = getNestedPaymentSettings(settings);
  const credentials = payments?.credentials || {};
  const payu = credentials?.payu || {};

  return {
    active: payments.active !== false,
    provider: trimSafe(payments.provider, 40).toLowerCase(),
    mode: trimSafe(payments.mode || 'sandbox', 20).toLowerCase() === 'production'
      ? 'production'
      : 'sandbox',
    currency: trimSafe(payments.currency || 'COP', 12).toUpperCase() || 'COP',
    merchantId: trimSafe(payu.merchantId, 100),
    accountId: trimSafe(payu.accountId, 100),
    apiKey: trimSafe(payu.apiKey, 150),
  };
}

function formatPayUAmountForSignature(value) {
  const number = Number(String(value || '').trim().replace(/,/g, '.'));

  if (!Number.isFinite(number)) return '0.0';

  const fixed = number.toFixed(2);
  const decimals = fixed.split('.')[1] || '00';

  return decimals[1] === '0' ? number.toFixed(1) : fixed;
}

function buildPayUSignature({ apiKey, merchantId, referenceSale, value, currency, statePol }) {
  const normalizedValue = formatPayUAmountForSignature(value);
  const raw = `${apiKey}~${merchantId}~${referenceSale}~${normalizedValue}~${currency}~${statePol}`;
  const sign = crypto.createHash('md5').update(raw).digest('hex');

  return {
    raw,
    sign,
    normalizedValue,
  };
}

async function postForm(url, payload) {
  const body = new URLSearchParams(payload);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await response.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  return {
    status: response.status,
    ok: response.ok,
    text,
    json,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = trimSafe(args.baseUrl || process.env.TEST_API_URL || 'http://localhost:5000', 300).replace(/\/+$/, '');
  const orderNumberArg = trimSafe(args.orderNumber, 80);
  const statePol = trimSafe(args.statePol || '4', 20);
  const badSign = args.badSign === true || String(args.badSign || '').toLowerCase() === 'true';

  if (!process.env.MONGODB_URI) {
    throw new Error('Falta MONGODB_URI en backend/.env');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const settings = await SiteSettings.findOne().lean();
  const payu = getPayUCredentials(settings);

  if (!payu.active || payu.provider !== 'payu') {
    throw new Error(`PayU no está activo. Provider actual: ${payu.provider || 'vacío'}`);
  }

  if (!payu.merchantId || !payu.accountId || !payu.apiKey) {
    throw new Error('Faltan credenciales PayU: merchantId, accountId o apiKey.');
  }

  const order = orderNumberArg
    ? await Order.findOne({ orderNumber: orderNumberArg }).lean()
    : await Order.findOne({ status: { $in: ['pending', 'processing'] } })
        .sort({ createdAt: -1 })
        .lean();

  if (!order) {
    throw new Error(
      orderNumberArg
        ? `No se encontró la orden ${orderNumberArg}.`
        : 'No se encontró una orden pending/processing para probar.'
    );
  }

  const referenceSale = `ORDER-${order.orderNumber}__TRY__TEST${Date.now()}`;
  const value = Number(order.total || 0).toFixed(2);
  const currency = payu.currency || 'COP';
  const signature = buildPayUSignature({
    apiKey: payu.apiKey,
    merchantId: payu.merchantId,
    referenceSale,
    value,
    currency,
    statePol,
  });

  const payload = {
    merchant_id: payu.merchantId,
    state_pol: statePol,
    risk: '0',
    response_code_pol: statePol === '4' ? '1' : '5',
    reference_sale: referenceSale,
    reference_pol: `TEST-${Date.now()}`,
    sign: badSign ? `bad-${signature.sign}` : signature.sign,
    extra1: '',
    extra2: '',
    payment_method: 'VISA',
    payment_method_type: '2',
    payment_method_name: 'VISA',
    installments_number: '1',
    value,
    tax: '0.00',
    additional_value: '0.00',
    transaction_date: new Date().toISOString(),
    currency,
    email_buyer: order.customer?.email || order.customer?.emailOrPhone || 'cliente@example.com',
    cus: '',
    pse_bank: '',
    test: payu.mode === 'sandbox' ? '1' : '0',
    description: `Prueba PayU orden ${order.orderNumber}`,
    billing_address: order.customer?.address || '',
    shipping_address: order.customer?.address || '',
    phone: order.customer?.phone || '',
    office_phone: '',
    account_number_ach: '',
    account_type_ach: '',
    administrative_fee: '0.00',
    administrative_fee_base: '0.00',
    administrative_fee_tax: '0.00',
    airline_code: '',
    attempts: '1',
    authorization_code: 'TESTAUTH',
    bank_id: '',
    billing_city: order.customer?.city || '',
    billing_country: 'CO',
    commision_pol: '0.00',
    commision_pol_currency: currency,
    customer_number: '',
    date: new Date().toISOString(),
    error_code_bank: '',
    error_message_bank: '',
    exchange_rate: '1',
    ip: '127.0.0.1',
    nickname_buyer: '',
    nickname_seller: '',
    payment_method_id: '2',
    payment_request_state: statePol === '4' ? 'A' : 'R',
    response_message_pol: statePol === '4' ? 'APPROVED' : 'DECLINED',
    shipping_city: order.customer?.city || '',
    shipping_country: 'CO',
    transaction_bank_id: '',
    transaction_id: `PAYU-TEST-${Date.now()}`,
    transactionState: statePol,
  };

  const result = await postForm(`${baseUrl}/api/payments/payu/webhook`, payload);

  console.log('\n=== PAYU WEBHOOK TEST ===');
  console.log('URL:', `${baseUrl}/api/payments/payu/webhook`);
  console.log('Orden:', order.orderNumber);
  console.log('Estado PayU state_pol:', statePol);
  console.log('Valor:', value, currency);
  console.log('Firma usada:', badSign ? 'MALA A PROPÓSITO' : 'VÁLIDA');
  console.log('Valor normalizado firma:', signature.normalizedValue);
  console.log('HTTP:', result.status);
  console.log('Respuesta:', result.json || result.text);

  await mongoose.disconnect();

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('\n❌ Error ejecutando prueba PayU:', error.message);

  try {
    await mongoose.disconnect();
  } catch {}

  process.exitCode = 1;
});
