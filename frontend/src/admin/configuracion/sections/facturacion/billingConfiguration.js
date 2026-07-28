export const BILLING_STEPS = [
  { id: 'fiscal', label: 'Datos fiscales' },
  { id: 'control', label: 'Tipo de emisión' },
  { id: 'provider', label: 'Proveedor' },
  { id: 'resolution', label: 'Resolución' },
  { id: 'taxes', label: 'Impuestos' },
  { id: 'legal', label: 'Textos legales' },
  { id: 'summary', label: 'Resumen' },
];

export const FACTUS_API_URLS = {
  habilitacion: 'https://api-sandbox.factus.com.co',
  production: 'https://api.factus.com.co',
};

export const EMPTY_BILLING = {
  fiscalInfo: {},
  dianResolution: {},
  dian: {
    enabled: false,
    mode: 'internal',
    environment: '2',
  },
  electronicProvider: {
    provider: 'mock',
  },
  legalTexts: {},
  taxes: {},
};

export function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();
  if (['habilitation', 'habilitacion', 'sandbox', 'test'].includes(mode)) {
    return 'habilitacion';
  }
  if (mode === 'production') return 'production';
  return 'internal';
}

export function getApiError(error, fallback) {
  const response = error?.response?.data || {};
  const details = Array.isArray(response.details) ? response.details : [];
  return {
    message: response.message || error?.message || fallback,
    details,
  };
}
