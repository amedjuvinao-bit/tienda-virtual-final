'use strict';

const crypto = require('crypto');

const FACTUS_API_URLS = Object.freeze({
  habilitacion: 'https://api-sandbox.factus.com.co',
  production: 'https://api.factus.com.co',
});

const INTERNAL_MODE = 'internal';
const HABILITATION_MODE = 'habilitacion';
const PRODUCTION_MODE = 'production';
const SUPPORTED_EXTERNAL_PROVIDER = 'factus';
const ENCRYPTED_PREFIX = 'billing:v1';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const SECRET_FIELDS = Object.freeze([
  'clientSecret',
  'password',
  'softwarePin',
  'technicalKey',
]);

class BillingConfigurationError extends Error {
  constructor(message, code = 'BILLING_CONFIGURATION_INVALID', status = 422, details = []) {
    super(message);
    this.name = 'BillingConfigurationError';
    this.code = code;
    this.status = status;
    this.details = Array.isArray(details) ? details : [];
  }
}

function cleanText(value, max = 300) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function clone(value) {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value));
}

function normalizeMode(value) {
  const mode = cleanText(value, 40).toLowerCase();

  if (['habilitation', 'habilitacion', 'sandbox', 'test', 'testing'].includes(mode)) {
    return HABILITATION_MODE;
  }

  if (mode === PRODUCTION_MODE) return PRODUCTION_MODE;
  if (mode === INTERNAL_MODE || !mode) return INTERNAL_MODE;

  throw new BillingConfigurationError(
    'El ambiente de facturación indicado no es válido.',
    'BILLING_MODE_INVALID'
  );
}

function resolveFactusApiUrl(mode) {
  const normalizedMode = normalizeMode(mode);

  if (normalizedMode === PRODUCTION_MODE) return FACTUS_API_URLS.production;
  if (normalizedMode === HABILITATION_MODE) return FACTUS_API_URLS.habilitacion;
  return '';
}

function assertOfficialFactusUrl(value, mode) {
  const apiUrl = cleanText(value, 300).replace(/\/+$/, '');
  const expected = resolveFactusApiUrl(mode);

  if (!apiUrl || !expected) return expected;

  if (apiUrl !== expected) {
    throw new BillingConfigurationError(
      'La URL de Factus no puede editarse manualmente. El sistema utiliza la URL oficial del ambiente seleccionado.',
      'FACTUS_API_URL_NOT_ALLOWED'
    );
  }

  return expected;
}

function getEncryptionKey() {
  const secret = cleanText(process.env.BILLING_ENCRYPTION_KEY, 1000);

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
  return cleanText(value, 5000).startsWith(`${ENCRYPTED_PREFIX}:`);
}

function encryptBillingSecret(value) {
  const plainText = String(value ?? '');
  if (!plainText) return '';
  if (isEncryptedBillingSecret(plainText)) return plainText;

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENCRYPTED_PREFIX,
    iv.toString('base64'),
    authTag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
}

function decryptBillingSecret(value) {
  const encryptedValue = String(value ?? '').trim();
  if (!encryptedValue) return '';

  // Compatibilidad controlada para migrar configuraciones antiguas.
  // El siguiente guardado seguro reemplaza estos valores por AES-256-GCM.
  if (!isEncryptedBillingSecret(encryptedValue)) return encryptedValue;

  const parts = encryptedValue.split(':');
  if (parts.length !== 6 || `${parts[0]}:${parts[1]}` !== ENCRYPTED_PREFIX) {
    throw new BillingConfigurationError(
      'Una credencial cifrada de facturación tiene un formato inválido.',
      'BILLING_ENCRYPTED_VALUE_INVALID',
      500
    );
  }

  const [, , version, ivBase64, authTagBase64, encryptedBase64] = parts;
  if (version !== 'v1') {
    throw new BillingConfigurationError(
      'La versión de cifrado de una credencial de facturación no es compatible.',
      'BILLING_ENCRYPTION_VERSION_UNSUPPORTED',
      500
    );
  }

  try {
    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivBase64, 'base64'),
      { authTagLength: AUTH_TAG_LENGTH }
    );
    decipher.setAuthTag(Buffer.from(authTagBase64, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedBase64, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    if (error instanceof BillingConfigurationError) throw error;
    throw new BillingConfigurationError(
      'No fue posible descifrar las credenciales de facturación. Verifica BILLING_ENCRYPTION_KEY.',
      'BILLING_DECRYPTION_FAILED',
      503
    );
  }
}

function calculateColombianNitDv(nitValue) {
  const digits = cleanText(nitValue, 20).replace(/\D/g, '');
  if (!digits) return '';

  const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29, 23, 19, 17, 13, 7, 3];
  const padded = digits.padStart(weights.length, '0').slice(-weights.length);
  const sum = padded
    .split('')
    .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
  const remainder = sum % 11;

  return String(remainder <= 1 ? remainder : 11 - remainder);
}

function normalizeInteger(value, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function normalizeNumber(value, fallback, { min = 0, max = 100 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function normalizeIsoDate(value, fieldLabel) {
  const date = cleanText(value, 10);
  if (!date) return '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new BillingConfigurationError(
      `${fieldLabel} debe tener formato AAAA-MM-DD.`,
      'BILLING_DATE_INVALID'
    );
  }

  return date;
}

function sanitizeFiscalInfo(value = {}, current = {}, externalEnabled = false) {
  const input = value && typeof value === 'object' ? value : {};
  const previous = current && typeof current === 'object' ? current : {};
  const fiscalInfo = {
    businessName: cleanText(input.businessName ?? previous.businessName, 180),
    nit: cleanText(input.nit ?? previous.nit, 20).replace(/\D/g, ''),
    dv: cleanText(input.dv ?? previous.dv, 1).replace(/\D/g, ''),
    taxRegime: cleanText(input.taxRegime ?? previous.taxRegime, 100),
    taxResponsibility: cleanText(
      input.taxResponsibility ?? previous.taxResponsibility,
      120
    ),
    taxLevelCode: cleanText(input.taxLevelCode ?? previous.taxLevelCode, 30),
    responsibilityCode: cleanText(
      input.responsibilityCode ?? previous.responsibilityCode,
      30
    ),
    legalRepresentative: cleanText(
      input.legalRepresentative ?? previous.legalRepresentative,
      180
    ),
    billingEmail: cleanText(input.billingEmail ?? previous.billingEmail, 180).toLowerCase(),
    address: cleanText(input.address ?? previous.address, 220),
    city: cleanText(input.city ?? previous.city, 120),
    cityCode: cleanText(input.cityCode ?? previous.cityCode, 20).replace(/\D/g, ''),
    municipalityCode: cleanText(
      input.municipalityCode ?? previous.municipalityCode,
      20
    ).replace(/\D/g, ''),
    department: cleanText(input.department ?? previous.department, 120),
    departmentCode: cleanText(
      input.departmentCode ?? previous.departmentCode,
      20
    ).replace(/\D/g, ''),
    country: cleanText(input.country ?? previous.country ?? 'CO', 3).toUpperCase() || 'CO',
  };

  if (fiscalInfo.billingEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fiscalInfo.billingEmail)) {
    throw new BillingConfigurationError(
      'El correo de facturación no tiene un formato válido.',
      'BILLING_EMAIL_INVALID'
    );
  }

  if (fiscalInfo.nit && (fiscalInfo.nit.length < 7 || fiscalInfo.nit.length > 15)) {
    throw new BillingConfigurationError(
      'El NIT debe contener entre 7 y 15 dígitos, sin puntos ni guiones.',
      'BILLING_NIT_INVALID'
    );
  }

  if (fiscalInfo.nit && fiscalInfo.dv) {
    const expectedDv = calculateColombianNitDv(fiscalInfo.nit);
    if (expectedDv !== fiscalInfo.dv) {
      throw new BillingConfigurationError(
        `El dígito de verificación del NIT no es correcto. Debe ser ${expectedDv}.`,
        'BILLING_NIT_DV_INVALID'
      );
    }
  }

  if (fiscalInfo.country !== 'CO') {
    throw new BillingConfigurationError(
      'La integración fiscal actual solo admite empresas registradas en Colombia.',
      'BILLING_COUNTRY_UNSUPPORTED'
    );
  }

  if (externalEnabled) {
    const required = [
      ['businessName', 'razón social'],
      ['nit', 'NIT'],
      ['dv', 'dígito de verificación'],
      ['billingEmail', 'correo de facturación'],
      ['address', 'dirección fiscal'],
      ['municipalityCode', 'código del municipio'],
    ];
    const missing = required
      .filter(([key]) => !fiscalInfo[key])
      .map(([, label]) => label);

    if (missing.length) {
      throw new BillingConfigurationError(
        `Faltan datos fiscales obligatorios: ${missing.join(', ')}.`,
        'BILLING_FISCAL_INFO_INCOMPLETE',
        422,
        missing
      );
    }
  }

  return fiscalInfo;
}

function sanitizeResolution(value = {}, current = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const previous = current && typeof current === 'object' ? current : {};
  const rangeFrom = normalizeInteger(input.rangeFrom ?? previous.rangeFrom, 1, { min: 1 });
  const rangeTo = normalizeInteger(input.rangeTo ?? previous.rangeTo, rangeFrom, { min: 1 });
  const currentNumber = normalizeInteger(
    input.currentNumber ?? previous.currentNumber,
    rangeFrom,
    { min: 1 }
  );
  const resolutionDate = normalizeIsoDate(
    input.resolutionDate ?? previous.resolutionDate,
    'La fecha de la resolución'
  );
  const expirationDate = normalizeIsoDate(
    input.expirationDate ?? previous.expirationDate,
    'La fecha de vencimiento'
  );

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
    resolutionNumber: cleanText(
      input.resolutionNumber ?? previous.resolutionNumber,
      100
    ),
    prefix: cleanText(input.prefix ?? previous.prefix, 20)
      .replace(/\s+/g, '')
      .toUpperCase(),
    rangeFrom,
    rangeTo,
    currentNumber,
    resolutionDate,
    expirationDate,
    documentType: cleanText(input.documentType ?? previous.documentType ?? '01', 10) || '01',
    technicalKey: mergeEncryptedSecret(
      input.technicalKey,
      previous.technicalKey
    ),
    environment: '2',
    numberingRangeId: normalizeInteger(
      input.numberingRangeId ?? previous.numberingRangeId,
      0,
      { min: 0 }
    ),
    creditNoteNumberingRangeId: normalizeInteger(
      input.creditNoteNumberingRangeId ?? previous.creditNoteNumberingRangeId,
      0,
      { min: 0 }
    ),
  };
}

function mergeEncryptedSecret(incomingValue, previousValue) {
  const incoming = String(incomingValue ?? '');
  const previous = String(previousValue ?? '');
  const selected = incoming.trim() ? incoming : previous;

  if (!selected) return '';
  return encryptBillingSecret(selected);
}

function sanitizeProvider(value = {}, current = {}, mode = INTERNAL_MODE) {
  const input = value && typeof value === 'object' ? value : {};
  const previous = current && typeof current === 'object' ? current : {};
  const requestedProvider = cleanText(
    input.provider ?? previous.provider ?? (mode === INTERNAL_MODE ? 'mock' : 'factus'),
    40
  ).toLowerCase();

  if (![SUPPORTED_EXTERNAL_PROVIDER, 'mock', ''].includes(requestedProvider)) {
    throw new BillingConfigurationError(
      `El proveedor ${requestedProvider} no está implementado y no puede activarse.`,
      'BILLING_PROVIDER_NOT_IMPLEMENTED'
    );
  }

  const provider = mode === INTERNAL_MODE ? 'mock' : SUPPORTED_EXTERNAL_PROVIDER;
  if (mode !== INTERNAL_MODE && requestedProvider && requestedProvider !== SUPPORTED_EXTERNAL_PROVIDER) {
    throw new BillingConfigurationError(
      'Factus es el único proveedor electrónico habilitado actualmente.',
      'BILLING_PROVIDER_NOT_IMPLEMENTED'
    );
  }

  const apiUrl = mode === INTERNAL_MODE
    ? ''
    : assertOfficialFactusUrl(input.apiUrl ?? previous.apiUrl, mode);

  const providerConfig = {
    provider,
    apiUrl,
    clientId: cleanText(input.clientId ?? previous.clientId, 300),
    clientSecret: mergeEncryptedSecret(input.clientSecret, previous.clientSecret),
    username: cleanText(input.username ?? previous.username, 300),
    password: mergeEncryptedSecret(input.password, previous.password),
    softwareId: cleanText(input.softwareId ?? previous.softwareId, 300),
    softwarePin: mergeEncryptedSecret(input.softwarePin, previous.softwarePin),
    technicalKey: mergeEncryptedSecret(input.technicalKey, previous.technicalKey),
    numberingRangeId: normalizeInteger(
      input.numberingRangeId ?? previous.numberingRangeId,
      0,
      { min: 0 }
    ),
    creditNoteNumberingRangeId: normalizeInteger(
      input.creditNoteNumberingRangeId ?? previous.creditNoteNumberingRangeId,
      0,
      { min: 0 }
    ),
    lastConnectionStatus: cleanText(previous.lastConnectionStatus, 40),
    lastConnectionMessage: cleanText(previous.lastConnectionMessage, 500),
    lastConnectionAt: previous.lastConnectionAt || null,
    lastConnectionEnvironment: cleanText(previous.lastConnectionEnvironment, 40),
    lastConnectionFingerprint: cleanText(previous.lastConnectionFingerprint, 128),
  };

  if (mode !== INTERNAL_MODE) {
    const missing = ['clientId', 'clientSecret', 'username', 'password'].filter(
      (field) => !providerConfig[field]
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

  return providerConfig;
}

function sanitizeTaxes(value = {}, current = {}) {
  const inputIva = value?.iva && typeof value.iva === 'object' ? value.iva : {};
  const previousIva = current?.iva && typeof current.iva === 'object' ? current.iva : {};
  const enabled = inputIva.enabled === undefined
    ? previousIva.enabled !== false
    : inputIva.enabled === true;
  const percent = normalizeNumber(
    inputIva.percent ?? previousIva.percent,
    enabled ? 19 : 0,
    { min: 0, max: 100 }
  );

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

function sanitizeLegalTexts(value = {}, current = {}) {
  const input = value && typeof value === 'object' ? value : {};
  const previous = current && typeof current === 'object' ? current : {};

  return {
    invoiceLegalText: cleanText(
      input.invoiceLegalText ?? previous.invoiceLegalText,
      2000
    ),
    internalReceiptNote: cleanText(
      input.internalReceiptNote ?? previous.internalReceiptNote,
      2000
    ),
  };
}

function buildRuntimeFactusConfig(billing = {}) {
  const mode = normalizeMode(billing?.dian?.mode || INTERNAL_MODE);
  if (mode === INTERNAL_MODE) {
    throw new BillingConfigurationError(
      'La facturación electrónica externa no está activa.',
      'BILLING_EXTERNAL_PROVIDER_INACTIVE'
    );
  }

  const provider = billing?.electronicProvider || {};
  if (cleanText(provider.provider, 40).toLowerCase() !== SUPPORTED_EXTERNAL_PROVIDER) {
    throw new BillingConfigurationError(
      'Factus es el único proveedor electrónico habilitado actualmente.',
      'BILLING_PROVIDER_NOT_IMPLEMENTED'
    );
  }

  const runtime = {
    provider: SUPPORTED_EXTERNAL_PROVIDER,
    apiUrl: assertOfficialFactusUrl(provider.apiUrl, mode),
    clientId: cleanText(provider.clientId, 300),
    clientSecret: decryptBillingSecret(provider.clientSecret),
    username: cleanText(provider.username, 300),
    password: decryptBillingSecret(provider.password),
    softwareId: cleanText(provider.softwareId, 300),
    softwarePin: decryptBillingSecret(provider.softwarePin),
    technicalKey: decryptBillingSecret(provider.technicalKey),
    numberingRangeId: normalizeInteger(provider.numberingRangeId, 0, { min: 0 }),
    creditNoteNumberingRangeId: normalizeInteger(
      provider.creditNoteNumberingRangeId,
      0,
      { min: 0 }
    ),
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

function buildFactusCredentialFingerprint(runtimeConfig = {}) {
  return crypto
    .createHash('sha256')
    .update(
      [
        runtimeConfig.apiUrl,
        runtimeConfig.clientId,
        runtimeConfig.username,
        runtimeConfig.clientSecret,
        runtimeConfig.password,
      ].join('|')
    )
    .digest('hex');
}

function prepareBillingConfigurationForStorage(
  incomingBilling = {},
  currentBilling = {},
  options = {}
) {
  if (!incomingBilling || typeof incomingBilling !== 'object' || Array.isArray(incomingBilling)) {
    throw new BillingConfigurationError(
      'La configuración de facturación debe ser un objeto.',
      'BILLING_CONFIGURATION_TYPE_INVALID',
      400
    );
  }

  const previous = currentBilling && typeof currentBilling === 'object'
    ? clone(currentBilling)
    : {};
  const incomingDian = incomingBilling.dian && typeof incomingBilling.dian === 'object'
    ? incomingBilling.dian
    : {};
  const mode = normalizeMode(incomingDian.mode ?? previous?.dian?.mode);
  const externalEnabled = mode !== INTERNAL_MODE;
  const provider = sanitizeProvider(
    incomingBilling.electronicProvider,
    previous.electronicProvider,
    mode
  );
  const resolution = sanitizeResolution(
    incomingBilling.dianResolution,
    previous.dianResolution
  );
  resolution.environment = mode === PRODUCTION_MODE ? '1' : '2';

  const billing = {
    fiscalInfo: sanitizeFiscalInfo(
      incomingBilling.fiscalInfo,
      previous.fiscalInfo,
      externalEnabled
    ),
    dianResolution: resolution,
    dian: {
      enabled: externalEnabled,
      mode,
      environment: mode === PRODUCTION_MODE ? '1' : '2',
      providerType: externalEnabled ? 'provider' : '',
      softwareId: cleanText(previous?.dian?.softwareId, 300),
      softwarePin: mergeEncryptedSecret(
        incomingDian.softwarePin,
        previous?.dian?.softwarePin
      ),
      softwareSecurityCode: mergeEncryptedSecret(
        incomingDian.softwareSecurityCode,
        previous?.dian?.softwareSecurityCode
      ),
      testSetId: cleanText(incomingDian.testSetId ?? previous?.dian?.testSetId, 300),
      providerNit: cleanText(
        incomingDian.providerNit ?? previous?.dian?.providerNit,
        20
      ).replace(/\D/g, ''),
      providerDv: cleanText(
        incomingDian.providerDv ?? previous?.dian?.providerDv,
        1
      ).replace(/\D/g, ''),
      certificateFileName: cleanText(previous?.dian?.certificateFileName, 240),
      certificatePath: mergeEncryptedSecret(
        incomingDian.certificatePath,
        previous?.dian?.certificatePath
      ),
      certificatePassword: mergeEncryptedSecret(
        incomingDian.certificatePassword,
        previous?.dian?.certificatePassword
      ),
      certificateUploadedAt: previous?.dian?.certificateUploadedAt || null,
      wsdlUrl: '',
      productionWsdlUrl: '',
      habilitationWsdlUrl: '',
      lastTestStatus: cleanText(previous?.dian?.lastTestStatus, 40),
      lastTestMessage: cleanText(previous?.dian?.lastTestMessage, 500),
      lastTestAt: previous?.dian?.lastTestAt || null,
      lastSyncStatus: cleanText(previous?.dian?.lastSyncStatus, 40),
      lastSyncMessage: cleanText(previous?.dian?.lastSyncMessage, 500),
      lastSyncAt: previous?.dian?.lastSyncAt || null,
    },
    electronicProvider: provider,
    legalTexts: sanitizeLegalTexts(
      incomingBilling.legalTexts,
      previous.legalTexts
    ),
    taxes: sanitizeTaxes(incomingBilling.taxes, previous.taxes),
  };

  if (externalEnabled) {
    const runtime = buildRuntimeFactusConfig(billing);
    const fingerprint = buildFactusCredentialFingerprint(runtime);

    if (provider.lastConnectionFingerprint !== fingerprint) {
      billing.electronicProvider.lastConnectionStatus = 'none';
      billing.electronicProvider.lastConnectionMessage = '';
      billing.electronicProvider.lastConnectionAt = null;
      billing.electronicProvider.lastConnectionEnvironment = '';
      billing.electronicProvider.lastConnectionFingerprint = '';
    }

    if (mode === PRODUCTION_MODE && options.skipProductionReadiness !== true) {
      const missing = [];
      if (provider.numberingRangeId <= 0) missing.push('rango activo para facturas');
      if (provider.creditNoteNumberingRangeId <= 0) {
        missing.push('rango activo para notas crédito');
      }
      if (billing.electronicProvider.lastConnectionStatus !== 'success') {
        missing.push('conexión Factus verificada');
      }
      if (billing.electronicProvider.lastConnectionEnvironment !== 'production') {
        missing.push('verificación realizada contra Producción');
      }
      if (billing.electronicProvider.lastConnectionFingerprint !== fingerprint) {
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

  return billing;
}

function hasLegacyPlaintextBillingSecrets(billing = {}) {
  const provider = billing?.electronicProvider || {};
  const dian = billing?.dian || {};
  const resolution = billing?.dianResolution || {};
  const values = [
    ...SECRET_FIELDS.map((field) => provider[field]),
    dian.softwarePin,
    dian.softwareSecurityCode,
    dian.certificatePath,
    dian.certificatePassword,
    resolution.technicalKey,
  ];

  return values.some(
    (value) => String(value ?? '').trim() && !isEncryptedBillingSecret(value)
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