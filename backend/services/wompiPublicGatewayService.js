'use strict';

function extractWompiErrorReason(data, status) {
  return (
    data?.error?.reason ||
    data?.error?.messages ||
    data?.message ||
    `HTTP ${status}`
  );
}

function createWompiPublicGatewayService({ fetchImpl } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('WOMPI_FETCH_IMPLEMENTATION_REQUIRED');
  }

  async function fetchJson(url, options, operation) {
    const response = await fetchImpl(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason = extractWompiErrorReason(data, response.status);
      throw new Error(`Wompi ${operation} error: ${reason}`);
    }

    return data?.data || {};
  }

  async function fetchMerchantData({ baseUrl, publicKey }) {
    return fetchJson(
      `${baseUrl}/merchants/${encodeURIComponent(publicKey)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      'merchant'
    );
  }

  async function fetchTransactionById({
    baseUrl,
    transactionId,
    privateKey,
    publicKey,
  }) {
    const privateAuthKey = String(privateKey || '').trim().slice(0, 300);
    const authKey =
      privateAuthKey || String(publicKey || '').trim().slice(0, 300);
    const headers = {
      'Content-Type': 'application/json',
    };

    if (authKey) {
      headers.Authorization = `Bearer ${authKey}`;
    }

    return fetchJson(
      `${baseUrl}/transactions/${encodeURIComponent(transactionId)}`,
      {
        method: 'GET',
        headers,
      },
      'transaction'
    );
  }

  return Object.freeze({
    fetchMerchantData,
    fetchTransactionById,
  });
}

function extractAcceptanceInfo(merchantData) {
  const acceptance = merchantData?.presigned_acceptance || null;
  const personalDataAuth = merchantData?.presigned_personal_data_auth || null;

  return {
    acceptanceToken: acceptance?.acceptance_token || '',
    acceptancePermalink: acceptance?.permalink || '',
    personalDataAcceptanceToken: personalDataAuth?.acceptance_token || '',
    personalDataPermalink: personalDataAuth?.permalink || '',
  };
}

module.exports = {
  createWompiPublicGatewayService,
  extractAcceptanceInfo,
  extractWompiErrorReason,
};
