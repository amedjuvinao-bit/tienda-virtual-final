'use strict';

const crypto = require('crypto');
const {
  FACTUS_API_URLS,
  decryptBillingSecret,
} = require('../../../billing/billingConfigurationSecurity');
const {
  fetchFactus,
  trimSafe,
} = require('./factusProviderShared');

let factusTokenCache = {
  key: '',
  accessToken: '',
  tokenType: 'Bearer',
  expiresAt: 0,
};

function resolveFactusBaseUrl(providerConfig = {}) {
  const fromPanel = trimSafe(providerConfig.apiUrl, 300);
  const fromEnv = trimSafe(process.env.FACTUS_API_URL, 300);
  const requested = (fromPanel || fromEnv).replace(/\/+$/, '');
  const environment = trimSafe(
    providerConfig.environment || providerConfig.mode,
    40
  ).toLowerCase();

  if (requested === FACTUS_API_URLS.production) return FACTUS_API_URLS.production;
  if (requested === FACTUS_API_URLS.habilitacion) {
    return FACTUS_API_URLS.habilitacion;
  }

  return environment === 'production' || environment === '1'
    ? FACTUS_API_URLS.production
    : FACTUS_API_URLS.habilitacion;
}

function getFactusCredentials(invoiceData = {}) {
  const providerConfig = invoiceData?.providerConfig || {};

  return {
    apiUrl: resolveFactusBaseUrl(providerConfig),
    clientId: trimSafe(providerConfig.clientId || process.env.FACTUS_CLIENT_ID, 300),
    clientSecret: trimSafe(
      decryptBillingSecret(
        providerConfig.clientSecret || process.env.FACTUS_CLIENT_SECRET
      ),
      500
    ),
    username: trimSafe(providerConfig.username || process.env.FACTUS_USERNAME, 300),
    password: trimSafe(
      decryptBillingSecret(
        providerConfig.password || process.env.FACTUS_PASSWORD
      ),
      500
    ),
  };
}

function validateCredentials(credentials) {
  const missing = [];

  if (!credentials.apiUrl) missing.push('apiUrl');
  if (!credentials.clientId) missing.push('clientId');
  if (!credentials.clientSecret) missing.push('clientSecret');
  if (!credentials.username) missing.push('username');
  if (!credentials.password) missing.push('password');

  return missing;
}

function buildTokenCacheKey(credentials) {
  return crypto
    .createHash('sha256')
    .update(
      [
        credentials.apiUrl,
        credentials.clientId,
        credentials.clientSecret,
        credentials.username,
        credentials.password,
      ].join('|')
    )
    .digest('hex');
}

function clearFactusTokenCache() {
  factusTokenCache = {
    key: '',
    accessToken: '',
    tokenType: 'Bearer',
    expiresAt: 0,
  };
}

function getCachedFactusToken(credentials) {
  const now = Date.now();
  const cacheKey = buildTokenCacheKey(credentials);

  if (
    factusTokenCache.key === cacheKey &&
    factusTokenCache.accessToken &&
    factusTokenCache.expiresAt > now + 60000
  ) {
    return {
      success: true,
      status: 200,
      tokenType: factusTokenCache.tokenType || 'Bearer',
      accessToken: factusTokenCache.accessToken,
      fromCache: true,
    };
  }

  return null;
}

function saveFactusTokenInCache(credentials, tokenResult) {
  const expiresInSeconds = Number(tokenResult.expiresIn || 0);
  const safeExpiresInMs =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? expiresInSeconds * 1000
      : 50 * 60 * 1000;

  factusTokenCache = {
    key: buildTokenCacheKey(credentials),
    accessToken: tokenResult.accessToken,
    tokenType: tokenResult.tokenType || 'Bearer',
    expiresAt: Date.now() + safeExpiresInMs,
  };
}

async function getFactusAccessToken(credentials) {
  const cachedToken = getCachedFactusToken(credentials);

  if (cachedToken) {
    return cachedToken;
  }

  const body = new URLSearchParams();

  body.append('grant_type', 'password');
  body.append('client_id', credentials.clientId);
  body.append('client_secret', credentials.clientSecret);
  body.append('username', credentials.username);
  body.append('password', credentials.password);

  const response = await fetchFactus(`${credentials.apiUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.access_token) {
    return {
      success: false,
      status: response.status,
      error:
        data?.message ||
        data?.error ||
        data ||
        `No se pudo obtener token Factus. HTTP ${response.status}`,
      raw: data,
    };
  }

  const tokenResult = {
    success: true,
    status: response.status,
    tokenType: data.token_type || 'Bearer',
    accessToken: data.access_token,
    refreshToken: data.refresh_token || '',
    expiresIn: data.expires_in || null,
    fromCache: false,
  };

  saveFactusTokenInCache(credentials, tokenResult);

  return tokenResult;
}

module.exports = {
  clearFactusTokenCache,
  getFactusAccessToken,
  getFactusCredentials,
  validateCredentials,
};
