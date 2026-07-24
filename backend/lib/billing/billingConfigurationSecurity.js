'use strict';

const crypto = require('crypto');

const INTERNAL_MODE = 'internal';
const HABILITATION_MODE = 'habilitacion';
const PRODUCTION_MODE = 'production';
const SUPPORTED_EXTERNAL_PROVIDER = 'factus';
const ENCRYPTED_PREFIX = 'billing:v1';
const FACTUS_API_URLS = Object.freeze({
  habilitacion: 'https://api-sandbox.factus.com.co',
  production: 'https://api.factus.com.co',
});

class BillingConfigurationError extends Error {
  constructor(message, code = 'BILLING_CONFIGURATION_INVALID', status = 422, details = []) {
    super(message);
    this.name = 'BillingConfigurationError';
    this.code = code;
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
  }
}

function clean(value, max = 300) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function clone(value) {
  return value === undefined || value === null
    ? value
    : JSON.parse(JSON.stringify(value));
}

function normalizeMode(value) {
  const mode = clean(value, 40).toLowerCase();
  if (!mode || mode === INTERNAL_MODE) return INTERNAL_MODE;
  if (['habilitation', 'habilitacion', 'sandbox', 'test', 'testing'].includes(mode)) {
    return HABILITATION_MODE;
  }
  if (mode === PRODUCTION_MODE) return PRODUCTION_MODE;

  throw new BillingConfigurationError(
    'El ambiente de facturación indicado no es válido.',
    'BILLING_MODE_INVALID'
  );
}

function resolveFactusApiUrl(mode) {
  const normalized = normalizeMode(mode);
  if (normalized === PRODUCTION_MODE) return FACTUS_API_URLS.production;
  if (normalized === HABILITATION_MODE) return FACTUS_API_URLS.habilitacion;
  return '';
}

function assertOfficialFactusUrl(value, mode) {
  const expected = resolveFactusApiUrl(mode);
  const received = clean(value, 300).replace(/\/+$/, '');

  if (received && expected && received !== expected) {
    throw new BillingConfigurationError(
      'La URL de Factus no puede editarse manualmente. El sistema utiliza la URL oficial del ambiente seleccionado.',
      'FACTUS_API_URL_NOT_ALLOWED'
    );
  }

  return expected;
}

function getEncryptionKey() {
  const secret = String(process.env.BILLING_ENCRYPTION_KEY || '').trim();

  if (!secret) {
    throw new BillingConfigurationError(
      'Falta configurar BILLING_ENCRYPTION_KEY para proteger las credenciales de facturación.',
      'BILLING_ENCRYPTION_KEY_REQUIRED',
      503
    );
  }

  if (secret.length < 32) {
    throw new BillingConfigurationError(
      'BILLING_ENCRYPTION_KEY debe tener al menos 32 caracteres.',
      'BILLING_ENCRYPTION_KEY_WEAK',
      503
    );
  }

  return crypto.createHash('sha256').update(secret).digest();
}

function isEncryptedBillingSecret(value) {
  return String(value || '').trim().startsWith(`${ENCRYPTED_PREFIX}:`);
}

function encryptBillingSecret(value) {
  const plain = String(value ?? '');
  if (!plain) return '';
  if (isEncryptedBillingSecret(plain)) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptBillingSecret(value) {
  const stored = String(value ?? '').trim();
  if (!stored) return '';
  if (!isEncryptedBillingSecret(stored)) return stored;

  const parts = stored.split(':');
  if (
    parts.length !== 5 ||
    parts[0] !== 'billing' ||
    parts[1] !== 'v1' ||
    !parts[2] ||
    !parts[3] ||
    !parts[4]
  ) {
    throw new BillingConfigurationError(
      'Una credencial cifrada de facturación tiene un formato inválido.',
      'BILLING_ENCRYPTED_VALUE_INVALID',
      500
    );
  }

  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      Buffer.from(parts[2], 'base64')
    );
    decipher.setAuthTag(Buffer.from(parts[3], 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(parts[4], 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
    throw new BillingConfigurationError(
      'No fue posible descifrar las credenciales de facturación. Verifica BILLING_ENCRYPTION_KEY.',
      'BILLING_DECRYPTION_FAILED',
      503
    );
  }
}

function mergeSecret(incoming, previous) {
  const selected = String(incoming ?? '').trim()
    ? String(incoming)
    : String(previous ?? '');
  return selected ? encryptBillingSecret(selected) : '';
}

function calculateColombianNitDv(value) {
  const digits = clean(value, 20).replace(/\D/g, '');
  if (!digits) return '';

  const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
  const padded = digits.padStart(weights.length, '0').slice(-weights.length);
  const sum = padded
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;
  return String(remainder <= 1 ? remainder : 11 - remainder);
}

function integer(value, fallback, min = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.trunc(parsed)) : fallback;
}

function number(value, fallback, min = 0, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function isoDate(value, label) {
  const date = clean(value, 10);
  if (!date) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new BillingConfigurationError(
      `${label} debe tener formato AAAA-MM-DD.`,
      'BILLING_DATE_INVALID'
    );
  }
  return date;
}

function sanitizeFiscalInfo(incoming = {}, previous = {}, external = false) {
  const input = incoming && typeof incoming === 'object' ? incoming : {};
  const old = previous && typeof previous === 'object' ? previous : {};
  const fiscal = {
    businessName: clean(input.businessName ?? old.businessName, 180),
    nit: clean(input.nit ?? old.nit, 20).replace(/\D/g, ''),
    dv: clean(input.dv ?? old.dv, 1).replace(/\D/g, ''),
    taxRegime: clean(input.taxRegime ?? old.taxRegime, 100),
    taxResponsibility: clean(input.taxResponsibility ?? old.taxResponsibility, 120),
    taxLevelCode: clean(input.taxLevelCode ?? old.taxLevelCode, 30),
    responsibilityCode: clean(input.responsibilityCode ?? old.responsibilityCode, 30),
    legalRepresentative: clean(input.legalRepresentative ?? old.legalRepresentative, 180),
    billingEmail: clean(input.billingEmail ?? old.billingEmail, 180).toLowerCase(),
    address: clean(input.address ?? old.address, 220),
    city: clean(input.city ?? old.city, 120),
    cityCode: clean(input.cityCode ?? old.cityCode, 20).replace(/\D/g, ''),
    municipalityCode: clean(input.municipalityCode ?? old.municipalityCode, 20).replace(/\D/g, ''),
    department: clean(input.department ?? old.department, 120),
    departmentCode: clean(input.departmentCode ?? old.departmentCode, 20).replace(/\D/g, ''),
    country: clean(input.country ?? old.country ?? 'CO', 3).toUpperCase() || 'CO',
  };

  if (fiscal.billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fiscal.billingEmail)) {
    throw new BillingConfigurationError(
      'El correo de facturación no tiene un formato válido.',
      'BILLING_EMAIL_INVALID'
    );
  }
  if (fiscal.nit && (fiscal.nit.length < 7 || fiscal.nit.length > 15)) {
    throw new BillingConfigurationError(
      'El NIT debe contener entre 7 y 15 dígitos, sin puntos ni guiones.',
      'BILLING_NIT_INVALID'
    );
  }
  if (fiscal.nit && fiscal.dv && calculateColombianNitDv(fiscal.nit) !== fiscal.dv) {
    throw new BillingConfigurationError(
      `El dígito de verificación del NIT no es correcto. Debe ser ${calculateColombianNitDv(fiscal.nit)}.`,
      'BILLING_NIT_DV_INVALID'
    );
  }
  if (fiscal.country !== 'CO') {
    throw new BillingConfigurationError(
      'La integración fiscal actual solo admite empresas registradas en Colombia.',
      'BILLING_COUNTRY_UNSUPPORTED'
    );
  }

  if (external) {
    const required = [
      ['businessName', 'razón social'],
      ['nit', 'NIT'],
      ['dv', 'dígito de verificación'],
      ['billingEmail', 'correo de facturación'],
      ['address', 'dirección fiscal'],
      ['municipalityCode', 'código del municipio'],
    ];
    const missing = required.filter(([key]) => !fiscal[key]).map(([, label]) => label);
    if (missing.length) {
      throw new BillingConfigurationError(
        `Faltan datos fiscales obligatorios: ${missing.join(', ')}.`,
        'BILLING_FISCAL_INFO_INCOMPLETE',
        422,
        missing
      );
    }
  }

  return fiscal;
}

function sanitizeResolution(incoming = {}, previous = {}, mode = INTERNAL_MODE) {
  const input = incoming && typeof incoming === 'object' ? incoming : {};
  const old = previous && typeof previous === 'object' ? previous : {};
  const rangeFrom = integer(input.rangeFrom ?? old.rangeFrom, 1, 1);
  const rangeTo = integer(input.rangeTo ?? old.rangeTo, rangeFrom, 1);
  const currentNumber = integer(input.currentNumber ?? old.currentNumber, rangeFrom, 1);
  const resolutionDate = isoDate(input.resolutionDate ?? old.resolutionDate, 'La fecha de la resolución');
  const expirationDate = isoDate(input.expirationDate ?? old.expirationDate, 'La fecha de vencimiento');

  if (rangeTo < rangeFrom) {
    throw new BillingConfigurationError(
      'El número final de la resolución no puede ser menor que el número inicial.',
      'BILLING_RANGE_INVALID'
    );
  }
  if (currentNumber < rangeFrom || currentNumber > rangeTo) {
    throw new BillingConfigurationError(
      'El consecutivo actual debe estar dentro del rango autorizado.',
      'BILLING_CURRENT_NUMBER_OUT_OF_RANGE'
    );
  }
  if (resolutionDate && expirationDate && expirationDate < resolutionDate) {
    throw new BillingConfigurationError(
      'La fecha de vencimiento no puede ser anterior a la fecha de la resolución.',
      'BILLING_RESOLUTION_DATES_INVALID'
    );
  }

  return {
    resolutionNumber: clean(input.resolutionNumber ?? old.resolutionNumber, 100),
    prefix: clean(input.prefix ?? old.prefix, 20).replace(/\s+/g, '').toUpperCase(),
    rangeFrom,
    rangeTo,
    currentNumber,
    resolutionDate,
    expirationDate,
    documentType: clean(input.documentType ?? old.documentType ?? '01', 40) || '01',
    technicalKey: mergeSecret(input.technicalKey, old.technicalKey),
    environment: mode === PRODUCTION_MODE ? '1' : '2',
    numberingRangeId: integer(input.numberingRangeId ?? old.numberingRangeId, 0, 0),
    creditNoteNumberingRangeId: integer(
      input.creditNoteNumberingRangeId ?? old.creditNoteNumberingRangeId,
      0,
      0
    ),
  };
}

function sanitizeProvider(incoming = {}, previous = {}, mode = INTERNAL_MODE) {
  const input = incoming && typeof incoming === 'object' ? incoming : {};
  const old = previous && typeof previous === 'object' ? previous : {};
  const clearCredentials =
    input.clearCredentials === true ||
    clean(input.credentialAction, 30).toLowerCase() === 'clear';
  const requested = clean(
    input.provider ?? old.provider ?? (mode === INTERNAL_MODE ? 'mock' : 'factus'),
    40
  ).toLowerCase();

  if (!['', 'mock', SUPPORTED_EXTERNAL_PROVIDER].includes(requested)) {
    throw new BillingConfigurationError(
      `El proveedor ${requested} no está implementado y no puede activarse.`,
      'BILLING_PROVIDER_NOT_IMPLEMENTED'
    );
  }
  if (mode !== INTERNAL_MODE && requested && requested !== SUPPORTED_EXTERNAL_PROVIDER) {
    throw new BillingConfigurationError(
      'Factus es el único proveedor electrónico habilitado actualmente.',
      'BILLING_PROVIDER_NOT_IMPLEMENTED'
    );
  }

  const provider = mode === INTERNAL_MODE ? 'mock' : SUPPORTED_EXTERNAL_PROVIDER;
  const apiUrl = mode === INTERNAL_MODE
    ? ''
    : assertOfficialFactusUrl(input.apiUrl ?? old.apiUrl, mode);
  const result = {
    provider,
    apiUrl,
    clientId: clearCredentials ? '' : clean(input.clientId ?? old.clientId, 300),
    clientSecret: clearCredentials
      ? ''
      : mergeSecret(input.clientSecret, old.clientSecret),
    username: clearCredentials ? '' : clean(input.username ?? old.username, 300),
    password: clearCredentials
      ? ''
      : mergeSecret(input.password, old.password),
    softwareId: clearCredentials ? '' : clean(input.softwareId ?? old.softwareId, 300),
    softwarePin: clearCredentials
      ? ''
      : mergeSecret(input.softwarePin, old.softwarePin),
    technicalKey: clearCredentials
      ? ''
      : mergeSecret(input.technicalKey, old.technicalKey),
    numberingRangeId: clearCredentials
      ? 0
      : integer(input.numberingRangeId ?? old.numberingRangeId, 0, 0),
    creditNoteNumberingRangeId: integer(
      clearCredentials
        ? 0
        : input.creditNoteNumberingRangeId ?? old.creditNoteNumberingRangeId,
      0,
      0
    ),
    lastConnectionStatus: clearCredentials
      ? 'none'
      : clean(old.lastConnectionStatus, 40),
    lastConnectionMessage: clearCredentials
      ? ''
      : clean(old.lastConnectionMessage, 500),
    lastConnectionAt: clearCredentials ? null : old.lastConnectionAt || null,
    lastConnectionEnvironment: clearCredentials
      ? ''
      : clean(old.lastConnectionEnvironment, 40),
    lastConnectionFingerprint: clearCredentials
      ? ''
      : clean(old.lastConnectionFingerprint, 128),
    lastConnectionCompany: clearCredentials
      ? null
      : clone(old.lastConnectionCompany || null),
    numberingRangesEnvironment: clearCredentials
      ? ''
      : clean(old.numberingRangesEnvironment, 40),
    numberingRangesFingerprint: clearCredentials
      ? ''
      : clean(old.numberingRangesFingerprint, 128),
    numberingRangesSyncedAt: clearCredentials
      ? null
      : old.numberingRangesSyncedAt || null,
  };

  if (mode !== INTERNAL_MODE) {
    const missing = ['clientId', 'clientSecret', 'username', 'password'].filter(
      (field) => !result[field]
    );
    if (missing.length) {
      throw new BillingConfigurationError(
        `Faltan credenciales obligatorias de Factus: ${missing.join(', ')}.`,
        'FACTUS_CREDENTIALS_INCOMPLETE',
        422,
        missing
      );
    }
  }

  return result;
}

function sanitizeTaxes(incoming = {}, previous = {}) {
  const input = incoming?.iva && typeof incoming.iva === 'object' ? incoming.iva : {};
  const old = previous?.iva && typeof previous.iva === 'object' ? previous.iva : {};
  const enabled = input.enabled === undefined ? old.enabled !== false : input.enabled === true;
  const percent = number(input.percent ?? old.percent, enabled ? 19 : 0, 0, 100);

  if (enabled && percent <= 0) {
    throw new BillingConfigurationError(
      'El porcentaje de IVA debe ser mayor que cero cuando el impuesto está activo.',
      'BILLING_IVA_PERCENT_INVALID'
    );
  }

  return {
    iva: {
      enabled,
      percent: enabled ? percent : 0,
      code: '01',
      name: 'IVA',
    },
  };
}

function sanitizeLegalTexts(incoming = {}, previous = {}) {
  const input = incoming && typeof incoming === 'object' ? incoming : {};
  const old = previous && typeof previous === 'object' ? previous : {};
  return {
    invoiceLegalText: clean(input.invoiceLegalText ?? old.invoiceLegalText, 2000),
    internalReceiptNote: clean(input.internalReceiptNote ?? old.internalReceiptNote, 2000),
  };
}

function buildRuntimeFactusConfig(billing = {}) {
  const mode = normalizeMode(billing?.dian?.mode);
  if (mode === INTERNAL_MODE) {
    throw new BillingConfigurationError(
      'La facturación electrónica externa no está activa.',
      'BILLING_EXTERNAL_PROVIDER_INACTIVE'
    );
  }

  const provider = billing?.electronicProvider || {};
  if (clean(provider.provider, 40).toLowerCase() !== SUPPORTED_EXTERNAL_PROVIDER) {
    throw new BillingConfigurationError(
      'Factus es el único proveedor electrónico habilitado actualmente.',
      'BILLING_PROVIDER_NOT_IMPLEMENTED'
    );
  }

  const runtime = {
    provider: SUPPORTED_EXTERNAL_PROVIDER,
    apiUrl: assertOfficialFactusUrl(provider.apiUrl, mode),
    clientId: clean(provider.clientId, 300),
    clientSecret: decryptBillingSecret(provider.clientSecret),
    username: clean(provider.username, 300),
    password: decryptBillingSecret(provider.password),
    softwareId: clean(provider.softwareId, 300),
    softwarePin: decryptBillingSecret(provider.softwarePin),
    technicalKey: decryptBillingSecret(provider.technicalKey),
    numberingRangeId: integer(provider.numberingRangeId, 0, 0),
    creditNoteNumberingRangeId: integer(provider.creditNoteNumberingRangeId, 0, 0),
    environment: mode === PRODUCTION_MODE ? 'production' : 'habilitacion',
  };
  const missing = ['clientId', 'clientSecret', 'username', 'password'].filter(
    (field) => !runtime[field]
  );
  if (missing.length) {
    throw new BillingConfigurationError(
      `Faltan credenciales obligatorias de Factus: ${missing.join(', ')}.`,
      'FACTUS_CREDENTIALS_INCOMPLETE',
      422,
      missing
    );
  }
  return runtime;
}

function buildFactusCredentialFingerprint(config = {}) {
  return crypto.createHash('sha256').update([
    config.apiUrl,
    config.clientId,
    config.username,
    config.clientSecret,
    config.password,
  ].join('|')).digest('hex');
}

function prepareBillingConfigurationForStorage(incoming = {}, current = {}, options = {}) {
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    throw new BillingConfigurationError(
      'La configuración de facturación debe ser un objeto.',
      'BILLING_CONFIGURATION_TYPE_INVALID',
      400
    );
  }

  const old = current && typeof current === 'object' ? clone(current) : {};
  const incomingDian = incoming.dian && typeof incoming.dian === 'object'
    ? incoming.dian
    : {};
  const mode = normalizeMode(incomingDian.mode ?? old?.dian?.mode);
  const external = mode !== INTERNAL_MODE;
  const clearCredentials =
    incoming?.electronicProvider?.clearCredentials === true ||
    clean(incoming?.electronicProvider?.credentialAction, 30).toLowerCase() ===
      'clear';
  const provider = sanitizeProvider(incoming.electronicProvider, old.electronicProvider, mode);

  const result = {
    fiscalInfo: sanitizeFiscalInfo(incoming.fiscalInfo, old.fiscalInfo, external),
    dianResolution: sanitizeResolution(incoming.dianResolution, old.dianResolution, mode),
    dian: {
      enabled: external,
      mode,
      environment: mode === PRODUCTION_MODE ? '1' : '2',
      providerType: external ? 'provider' : '',
      softwareId: clean(incomingDian.softwareId ?? old?.dian?.softwareId, 300),
      softwarePin: mergeSecret(incomingDian.softwarePin, old?.dian?.softwarePin),
      softwareSecurityCode: mergeSecret(
        incomingDian.softwareSecurityCode,
        old?.dian?.softwareSecurityCode
      ),
      testSetId: clean(incomingDian.testSetId ?? old?.dian?.testSetId, 300),
      providerNit: clean(incomingDian.providerNit ?? old?.dian?.providerNit, 20).replace(/\D/g, ''),
      providerDv: clean(incomingDian.providerDv ?? old?.dian?.providerDv, 1).replace(/\D/g, ''),
      certificateFileName: clean(old?.dian?.certificateFileName, 240),
      certificatePath: mergeSecret(incomingDian.certificatePath, old?.dian?.certificatePath),
      certificatePassword: mergeSecret(
        incomingDian.certificatePassword,
        old?.dian?.certificatePassword
      ),
      certificateUploadedAt: old?.dian?.certificateUploadedAt || null,
      wsdlUrl: '',
      productionWsdlUrl: '',
      habilitationWsdlUrl: '',
      lastTestStatus: clean(old?.dian?.lastTestStatus, 40),
      lastTestMessage: clean(old?.dian?.lastTestMessage, 500),
      lastTestAt: old?.dian?.lastTestAt || null,
      lastSyncStatus: clean(old?.dian?.lastSyncStatus, 40),
      lastSyncMessage: clean(old?.dian?.lastSyncMessage, 500),
      lastSyncAt: old?.dian?.lastSyncAt || null,
    },
    electronicProvider: provider,
    legalTexts: sanitizeLegalTexts(incoming.legalTexts, old.legalTexts),
    taxes: sanitizeTaxes(incoming.taxes, old.taxes),
  };

  if (clearCredentials) {
    Object.assign(result.dian, {
      softwarePin: '',
      softwareSecurityCode: '',
      certificateFileName: '',
      certificatePath: '',
      certificatePassword: '',
      certificateUploadedAt: null,
      lastTestStatus: '',
      lastTestMessage: '',
      lastTestAt: null,
      lastSyncStatus: '',
      lastSyncMessage: '',
      lastSyncAt: null,
    });
    Object.assign(result.dianResolution, {
      technicalKey: '',
      numberingRangeId: 0,
      creditNoteNumberingRangeId: 0,
    });
  }

  if (external) {
    const runtime = buildRuntimeFactusConfig(result);
    const fingerprint = buildFactusCredentialFingerprint(runtime);

    if (provider.lastConnectionFingerprint !== fingerprint) {
      Object.assign(result.electronicProvider, {
        lastConnectionStatus: 'none',
        lastConnectionMessage: '',
        lastConnectionAt: null,
        lastConnectionEnvironment: '',
        lastConnectionFingerprint: '',
      });
    }

    if (mode === PRODUCTION_MODE && options.skipProductionReadiness !== true) {
      const missing = [];
      if (provider.numberingRangeId <= 0) missing.push('rango activo para facturas');
      if (provider.creditNoteNumberingRangeId <= 0) missing.push('rango activo para notas crédito');
      if (result.electronicProvider.lastConnectionStatus !== 'success') {
        missing.push('conexión Factus verificada');
      }
      if (result.electronicProvider.lastConnectionEnvironment !== 'production') {
        missing.push('verificación realizada contra Producción');
      }
      if (result.electronicProvider.lastConnectionFingerprint !== fingerprint) {
        missing.push('credenciales verificadas sin cambios posteriores');
      }

      if (missing.length) {
        throw new BillingConfigurationError(
          `No se puede activar Producción. Falta: ${missing.join(', ')}.`,
          'BILLING_PRODUCTION_NOT_READY',
          409,
          missing
        );
      }
    }
  }

  return result;
}

function hasLegacyPlaintextBillingSecrets(billing = {}) {
  const provider = billing?.electronicProvider || {};
  const dian = billing?.dian || {};
  const resolution = billing?.dianResolution || {};
  const values = [
    provider.clientSecret,
    provider.password,
    provider.softwarePin,
    provider.technicalKey,
    dian.softwarePin,
    dian.softwareSecurityCode,
    dian.certificatePath,
    dian.certificatePassword,
    resolution.technicalKey,
  ];
  return values.some(
    (value) => String(value || '').trim() && !isEncryptedBillingSecret(value)
  );
}

module.exports = {
  BillingConfigurationError,
  FACTUS_API_URLS,
  HABILITATION_MODE,
  INTERNAL_MODE,
  PRODUCTION_MODE,
  SUPPORTED_EXTERNAL_PROVIDER,
  assertOfficialFactusUrl,
  buildFactusCredentialFingerprint,
  buildRuntimeFactusConfig,
  calculateColombianNitDv,
  decryptBillingSecret,
  encryptBillingSecret,
  hasLegacyPlaintextBillingSecrets,
  isEncryptedBillingSecret,
  normalizeMode,
  prepareBillingConfigurationForStorage,
  resolveFactusApiUrl,
};
