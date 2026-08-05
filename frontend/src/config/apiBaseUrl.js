const LOCAL_DEVELOPMENT_API_BASE_URL = 'http://localhost:5000';

export class ApiBaseUrlConfigurationError extends Error {
  constructor(message, code = 'API_BASE_URL_INVALID') {
    super(message);
    this.name = 'ApiBaseUrlConfigurationError';
    this.code = code;
  }
}

function normalizeConfiguredUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new ApiBaseUrlConfigurationError(
      'VITE_API_BASE_URL debe ser una URL absoluta valida.'
    );
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new ApiBaseUrlConfigurationError(
      'VITE_API_BASE_URL debe utilizar http o https.'
    );
  }

  return raw.replace(/\/+$/, '');
}

export function resolveApiBaseUrl(env = {}) {
  const configured = normalizeConfiguredUrl(env.VITE_API_BASE_URL);
  if (configured) return configured;

  const localDevelopment = env.DEV === true && env.PROD !== true;
  if (localDevelopment) return LOCAL_DEVELOPMENT_API_BASE_URL;

  throw new ApiBaseUrlConfigurationError(
    'VITE_API_BASE_URL es obligatoria fuera del desarrollo local.',
    'API_BASE_URL_REQUIRED'
  );
}

export const API_BASE_URL = resolveApiBaseUrl(import.meta.env);
