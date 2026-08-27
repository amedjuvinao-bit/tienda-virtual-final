'use strict';

const crypto = require('crypto');
const { trimSafe } = require('./payuConfigurationService');

function parseAmount(value) {
  const raw = String(value || '').trim().replace(/,/g, '.');
  const number = Number(raw);
  return Number.isFinite(number) ? number : 0;
}

function formatPayUAmountForSignature(value) {
  const number = parseAmount(value);
  const fixed = number.toFixed(2);
  const decimals = fixed.split('.')[1] || '00';

  return decimals[1] === '0' ? number.toFixed(1) : fixed;
}

function hashHex(algorithm, value) {
  return crypto.createHash(algorithm).update(value).digest('hex');
}

function hmacHex(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function buildPayUPaymentSignature({
  apiKey,
  merchantId,
  referenceCode,
  amount,
  currency,
}) {
  const base = `${apiKey}~${merchantId}~${referenceCode}~${amount}~${currency}`;

  return {
    base,
    algorithm: 'MD5',
    signature: hashHex('md5', base),
  };
}

function buildPayUConfirmationSignatureCandidates({
  apiKey,
  merchantId,
  referenceSale,
  value,
  currency,
  statePol,
  signatureSecret = '',
}) {
  const normalizedValue = formatPayUAmountForSignature(value);
  const base = `${apiKey}~${merchantId}~${referenceSale}~${normalizedValue}~${currency}~${statePol}`;
  const candidates = [
    { algorithm: 'MD5', signature: hashHex('md5', base) },
    { algorithm: 'SHA1', signature: hashHex('sha1', base) },
    { algorithm: 'SHA256', signature: hashHex('sha256', base) },
    { algorithm: 'HMAC-SHA256-APIKEY', signature: hmacHex(apiKey, base) },
  ];

  if (signatureSecret) {
    candidates.push({
      algorithm: 'HMAC-SHA256-SECRET',
      signature: hmacHex(signatureSecret, base),
    });
  }

  return {
    base,
    normalizedValue,
    candidates,
  };
}

function safeCompareHex(left, right) {
  const a = Buffer.from(String(left || '').trim().toLowerCase(), 'utf8');
  const b = Buffer.from(String(right || '').trim().toLowerCase(), 'utf8');

  if (!a.length || !b.length || a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function validatePayUSignature({ payload, payu }) {
  const providedSign = trimSafe(payload.sign || payload.signature, 300).toLowerCase();
  const merchantId = trimSafe(payload.merchant_id || payload.merchantId, 100);
  const referenceSale = trimSafe(
    payload.reference_sale || payload.referenceCode,
    255
  );
  const value = trimSafe(payload.value || payload.TX_VALUE, 80);
  const currency = trimSafe(payload.currency, 12).toUpperCase();
  const statePol = trimSafe(payload.state_pol || payload.transactionState, 40);

  if (!providedSign) return { ok: false, error: 'PAYU_SIGN_MISSING' };
  if (!payu.apiKey) return { ok: false, error: 'PAYU_API_KEY_MISSING' };

  if (!merchantId || !referenceSale || !value || !currency || !statePol) {
    return { ok: false, error: 'PAYU_SIGNATURE_FIELDS_MISSING' };
  }

  const built = buildPayUConfirmationSignatureCandidates({
    apiKey: payu.apiKey,
    merchantId,
    referenceSale,
    value,
    currency,
    statePol,
    signatureSecret: payu.signatureSecret,
  });

  const matched = built.candidates.find((candidate) =>
    safeCompareHex(candidate.signature, providedSign)
  );

  if (!matched) {
    return {
      ok: false,
      error: 'INVALID_PAYU_SIGNATURE',
      normalizedValue: built.normalizedValue,
    };
  }

  return {
    ok: true,
    algorithm: matched.algorithm,
    normalizedValue: built.normalizedValue,
  };
}

module.exports = {
  buildPayUConfirmationSignatureCandidates,
  buildPayUPaymentSignature,
  formatPayUAmountForSignature,
  hashHex,
  hmacHex,
  parseAmount,
  safeCompareHex,
  validatePayUSignature,
};
