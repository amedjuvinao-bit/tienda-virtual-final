import { EMPTY_BILLING, normalizeMode } from './billingConfiguration';

const FISCAL_REQUIRED_FIELDS = [
  ['businessName', 'Razón social'],
  ['nit', 'NIT / identificación tributaria'],
  ['dv', 'Dígito de verificación'],
  ['billingEmail', 'Correo de facturación'],
  ['address', 'Dirección fiscal'],
  ['municipalityCode', 'Código DANE del municipio'],
];

const PROVIDER_REQUIRED_FIELDS = [
  ['clientId', 'Client ID', false],
  ['clientSecret', 'Client Secret', true],
  ['username', 'Usuario', false],
  ['password', 'Contraseña', true],
];

function cleanText(value) {
  return String(value ?? '').trim();
}

function onlyDigits(value) {
  return cleanText(value).replace(/\D/g, '');
}

function isCredentialConfigured(credentialStatus = {}, field) {
  return credentialStatus[`billing.electronicProvider.${field}`] === true;
}

function normalizePersistedLegalText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 2000);
}

function legalTextsWerePersisted(requested = {}, persisted = {}) {
  return (
    normalizePersistedLegalText(requested.invoiceLegalText) ===
      normalizePersistedLegalText(persisted.invoiceLegalText) &&
    normalizePersistedLegalText(requested.internalReceiptNote) ===
      normalizePersistedLegalText(persisted.internalReceiptNote)
  );
}

export function getBillingStepErrors(
  stepId,
  {
    billing = EMPTY_BILLING,
    mode = 'internal',
    credentialStatus = {},
    connectionChanged = false,
  } = {}
) {
  const errors = [];

  if (stepId === 'fiscal') {
    const fiscalInfo = billing.fiscalInfo || {};
    const missing = FISCAL_REQUIRED_FIELDS.filter(([field]) => {
      const value =
        field === 'municipalityCode'
          ? fiscalInfo.municipalityCode || fiscalInfo.cityCode
          : fiscalInfo[field];
      return !cleanText(value);
    }).map(([, label]) => label);

    if (missing.length) {
      errors.push(`Completa: ${missing.join(', ')}.`);
    }

    const nit = onlyDigits(fiscalInfo.nit);
    if (nit && (nit.length < 7 || nit.length > 15)) {
      errors.push('El NIT debe contener entre 7 y 15 dígitos.');
    }

    const dv = onlyDigits(fiscalInfo.dv);
    if (dv && !/^\d$/.test(dv)) {
      errors.push('El dígito de verificación debe contener un solo número.');
    }

    const billingEmail = cleanText(fiscalInfo.billingEmail);
    if (
      billingEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)
    ) {
      errors.push('El correo de facturación no tiene un formato válido.');
    }
  }

  if (stepId === 'control') {
    if (!['internal', 'habilitacion', 'production'].includes(mode)) {
      errors.push('Selecciona un tipo de emisión válido.');
    }
  }

  if (stepId === 'provider' && mode !== 'internal') {
    const provider = billing.electronicProvider || {};
    const missing = PROVIDER_REQUIRED_FIELDS.filter(
      ([field, _label, secret]) =>
        !cleanText(provider[field]) &&
        !(secret && isCredentialConfigured(credentialStatus, field))
    ).map(([, label]) => label);

    if (missing.length) {
      errors.push(`Completa las credenciales de Factus: ${missing.join(', ')}.`);
    }

    const connectionVerified =
      provider.lastConnectionStatus === 'success' && !connectionChanged;
    if (!connectionVerified) {
      errors.push(
        'Prueba la conexión real con Factus y confirma que fue aprobada.'
      );
    }
  }

  if (stepId === 'resolution' && mode !== 'internal') {
    const resolution = billing.dianResolution || {};
    const provider = billing.electronicProvider || {};
    const invoiceRangeId = Number(
      provider.numberingRangeId || resolution.numberingRangeId || 0
    );
    const creditNoteRangeId = Number(
      provider.creditNoteNumberingRangeId ||
        resolution.creditNoteNumberingRangeId ||
        0
    );

    if (!Number.isInteger(invoiceRangeId) || invoiceRangeId <= 0) {
      errors.push('Selecciona y guarda el rango oficial para facturas.');
    }
    if (!Number.isInteger(creditNoteRangeId) || creditNoteRangeId <= 0) {
      errors.push('Selecciona y guarda el rango oficial para notas crédito.');
    }
  }

  if (stepId === 'taxes') {
    const iva = billing.taxes?.iva || {};
    const enabled = iva.enabled !== false;
    const percent = Number(iva.percent ?? 19);

    if (
      enabled &&
      (!Number.isFinite(percent) || percent <= 0 || percent > 100)
    ) {
      errors.push(
        'El porcentaje de IVA debe ser mayor que 0 y no superar 100.'
      );
    }
  }

  if (stepId === 'legal') {
    const legalTexts = billing.legalTexts || {};
    if (String(legalTexts.invoiceLegalText ?? '').length > 2000) {
      errors.push('El texto legal para factura no puede superar 2000 caracteres.');
    }
    if (String(legalTexts.internalReceiptNote ?? '').length > 2000) {
      errors.push(
        'La nota para documentos internos no puede superar 2000 caracteres.'
      );
    }
  }

  return errors;
}

function normalizeComparableValue(value, field = '') {
  const text = cleanText(value);
  if (['nit', 'dv', 'municipalityCode', 'cityCode'].includes(field)) {
    return text.replace(/\D/g, '');
  }
  if (field === 'billingEmail') return text.toLowerCase();
  return text.replace(/\s+/g, ' ');
}

function fieldsWerePersisted(requested = {}, persisted = {}, fields = []) {
  return fields.every(
    (field) =>
      normalizeComparableValue(requested[field], field) ===
      normalizeComparableValue(persisted[field], field)
  );
}

export function billingStepWasPersisted(
  stepId,
  requestedBilling = {},
  persistedSettings = {}
) {
  const persistedBilling = persistedSettings?.billing || {};

  if (stepId === 'fiscal') {
    return fieldsWerePersisted(
      requestedBilling.fiscalInfo,
      persistedBilling.fiscalInfo,
      [
        'businessName',
        'nit',
        'dv',
        'taxRegime',
        'legalRepresentative',
        'billingEmail',
        'address',
        'municipalityCode',
      ]
    );
  }

  if (stepId === 'control') {
    return (
      normalizeMode(requestedBilling.dian?.mode) ===
      normalizeMode(persistedBilling.dian?.mode)
    );
  }

  if (stepId === 'provider') {
    if (normalizeMode(requestedBilling.dian?.mode) === 'internal') {
      return true;
    }

    const requestedProvider = requestedBilling.electronicProvider || {};
    const persistedProvider = persistedBilling.electronicProvider || {};
    const publicFieldsPersisted = fieldsWerePersisted(
      requestedProvider,
      persistedProvider,
      ['clientId', 'username']
    );
    const secretsPersisted = ['clientSecret', 'password'].every(
      (field) =>
        !cleanText(requestedProvider[field]) ||
        isCredentialConfigured(persistedSettings?._credentialStatus, field)
    );

    return publicFieldsPersisted && secretsPersisted;
  }

  if (stepId === 'resolution') {
    const requestedResolution = requestedBilling.dianResolution || {};
    const persistedResolution = persistedBilling.dianResolution || {};
    const requestedProvider = requestedBilling.electronicProvider || {};
    const persistedProvider = persistedBilling.electronicProvider || {};

    return (
      Number(
        requestedProvider.numberingRangeId ||
          requestedResolution.numberingRangeId ||
          0
      ) ===
        Number(
          persistedProvider.numberingRangeId ||
            persistedResolution.numberingRangeId ||
            0
        ) &&
      Number(
        requestedProvider.creditNoteNumberingRangeId ||
          requestedResolution.creditNoteNumberingRangeId ||
          0
      ) ===
        Number(
          persistedProvider.creditNoteNumberingRangeId ||
            persistedResolution.creditNoteNumberingRangeId ||
            0
        )
    );
  }

  if (stepId === 'taxes') {
    const requestedIva = requestedBilling.taxes?.iva || {};
    const persistedIva = persistedBilling.taxes?.iva || {};
    return (
      (requestedIva.enabled !== false) === (persistedIva.enabled !== false) &&
      Number(requestedIva.percent ?? 19) === Number(persistedIva.percent ?? 19)
    );
  }

  if (stepId === 'legal') {
    return legalTextsWerePersisted(
      requestedBilling.legalTexts,
      persistedBilling.legalTexts
    );
  }

  return ['fiscal', 'control', 'provider', 'resolution', 'taxes', 'legal'].every(
    (id) => billingStepWasPersisted(id, requestedBilling, persistedSettings)
  );
}
