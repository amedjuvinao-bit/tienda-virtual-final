'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const {
  WOMPI_ENVIRONMENTS,
} = require('../../lib/payments/wompiPaymentUtils');
const {
  createWompiPublicGatewayService,
} = require('../../services/wompiPublicGatewayService');

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}

function buildCompactJwe(payload, publicKeyPem) {
  const protectedHeader = base64url(
    JSON.stringify({ alg: 'RSA-OAEP-256', enc: 'A256GCM' })
  );
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const cek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);

  try {
    const cipher = crypto.createCipheriv('aes-256-gcm', cek, iv);
    cipher.setAAD(Buffer.from(protectedHeader, 'ascii'));
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedKey = crypto.publicEncrypt(
      {
        key: publicKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      cek
    );
    return [
      protectedHeader,
      base64url(encryptedKey),
      base64url(iv),
      base64url(ciphertext),
      base64url(tag),
    ].join('.');
  } finally {
    plaintext.fill(0);
    cek.fill(0);
  }
}

async function fetchData(url, options, operation) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const reason = body?.error?.reason || body?.message || `HTTP ${response.status}`;
    throw Object.assign(new Error(`Wompi ${operation}: ${reason}`), {
      code: `WOMPI_${operation.toUpperCase()}_FAILED`,
    });
  }
  return body?.data || {};
}

async function tokenizeApprovedSandboxCard({ baseUrl, publicKey }) {
  assert.strictEqual(baseUrl, WOMPI_ENVIRONMENTS.sandbox);
  assert.match(publicKey || '', /^pub_test_/i);
  const keyData = await fetchData(
    `${baseUrl}/tokens/keys/tokenization`,
    { headers: { Authorization: `Bearer ${publicKey}` } },
    'tokenization_key'
  );
  assert(keyData.publicKey, 'Wompi no entregó la llave RSA de tokenización.');

  const expiryYear = String((new Date().getUTCFullYear() + 3) % 100).padStart(2, '0');
  const card = {
    number: ['4242', '4242', '4242', '4242'].join(''),
    cvc: ['1', '2', '3'].join(''),
    exp_month: '12',
    exp_year: expiryYear,
    card_holder: 'QA WOMPI SANDBOX',
  };
  try {
    const encrypted = buildCompactJwe(card, keyData.publicKey);
    const token = await fetchData(
      `${baseUrl}/tokens/cards`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ payload: encrypted }),
      },
      'card_tokenization'
    );
    assert(token.id, 'Wompi no devolvió el token de tarjeta.');
    return token.id;
  } finally {
    for (const key of Object.keys(card)) card[key] = '';
  }
}

async function createTransaction({ baseUrl, privateKey, checkoutData, cardToken, email }) {
  assert.strictEqual(baseUrl, WOMPI_ENVIRONMENTS.sandbox);
  assert.match(privateKey || '', /^prv_test_/i);
  assert(cardToken, 'Falta el token efímero de tarjeta.');
  assert(checkoutData?.acceptanceToken, 'Falta la aceptación de términos de Wompi.');
  assert(
    checkoutData?.personalDataAcceptanceToken,
    'Falta la autorización de datos personales de Wompi.'
  );
  const transaction = await fetchData(
    `${baseUrl}/transactions`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${privateKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount_in_cents: Number(checkoutData.amountInCents),
        currency: checkoutData.currency,
        customer_email: email,
        payment_method: { type: 'CARD', token: cardToken, installments: 1 },
        payment_method_type: 'CARD',
        reference: checkoutData.reference,
        signature: checkoutData.signature,
        acceptance_token: checkoutData.acceptanceToken,
        accept_personal_auth: checkoutData.personalDataAcceptanceToken,
        redirect_url: checkoutData.redirectUrl,
      }),
    },
    'transaction_creation'
  );
  assert(transaction.id, 'Wompi no devolvió el ID de transacción.');
  return transaction;
}

async function waitForApproved({ baseUrl, payments, transactionId }) {
  const gateway = createWompiPublicGatewayService({ fetchImpl: global.fetch });
  for (let attempt = 1; attempt <= 45; attempt += 1) {
    const transaction = await gateway.fetchTransactionById({
      baseUrl,
      transactionId,
      privateKey: payments.credentials.wompi.privateKey,
      publicKey: payments.credentials.wompi.publicKey,
    });
    const status = String(transaction?.status || '').trim().toUpperCase();
    if (status === 'APPROVED') return transaction;
    if (['DECLINED', 'ERROR', 'VOIDED'].includes(status)) {
      throw Object.assign(new Error(`Wompi terminó la transacción en ${status}.`), {
        code: `WOMPI_${status}`,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw Object.assign(new Error('Wompi no aprobó la transacción dentro del tiempo esperado.'), {
    code: 'WOMPI_APPROVAL_TIMEOUT',
  });
}

async function createApprovedSandboxTransaction({ baseUrl, payments, checkoutData, email }) {
  let cardToken = await tokenizeApprovedSandboxCard({
    baseUrl,
    publicKey: payments.credentials.wompi.publicKey,
  });
  try {
    const created = await createTransaction({
      baseUrl,
      privateKey: payments.credentials.wompi.privateKey,
      checkoutData,
      cardToken,
      email,
    });
    return waitForApproved({ baseUrl, payments, transactionId: created.id });
  } finally {
    cardToken = '';
  }
}

module.exports = {
  buildCompactJwe,
  createApprovedSandboxTransaction,
  createTransaction,
  tokenizeApprovedSandboxCard,
  waitForApproved,
};
