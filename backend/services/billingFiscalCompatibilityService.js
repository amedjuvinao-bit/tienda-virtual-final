'use strict';

const SiteSettings = require('../models/SiteSettings');
const {
  calculateColombianNitDv,
} = require('../lib/billing/billingConfigurationSecurity');

function cleanText(value, max = 500) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function onlyDigits(value, max = 30) {
  return cleanText(value, max).replace(/\D/g, '');
}

function firstText(values = [], max = 500) {
  for (const value of values) {
    const normalized = cleanText(value, max);
    if (normalized) return normalized;
  }
  return '';
}

function firstDigits(values = [], max = 30) {
  for (const value of values) {
    const normalized = onlyDigits(value, max);
    if (normalized) return normalized;
  }
  return '';
}

function normalizeColombianNit(rawNit, rawDv) {
  const text = cleanText(rawNit, 40).replace(/\./g, '');
  const suppliedDv = onlyDigits(rawDv, 2).slice(0, 1);
  const separated = text.match(/^(\d+)\s*-\s*(\d)$/);
  let nit = '';
  let legacyDv = suppliedDv;

  if (separated) {
    nit = separated[1];
    legacyDv = legacyDv || separated[2];
  } else {
    const digits = onlyDigits(text, 20);
    const possibleNit = digits.slice(0, -1);
    const possibleDv = digits.slice(-1);
    const hasEmbeddedDv =
      digits.length >= 8 &&
      ((suppliedDv && possibleDv === suppliedDv) || !suppliedDv) &&
      calculateColombianNitDv(possibleNit) === possibleDv;

    nit = hasEmbeddedDv ? possibleNit : digits;
    if (hasEmbeddedDv) legacyDv = legacyDv || possibleDv;
  }

  const calculatedDv = nit ? calculateColombianNitDv(nit) : '';

  return {
    nit,
    dv: calculatedDv || legacyDv,
    suppliedDv: legacyDv,
  };
}

function buildCanonicalFiscalInfo({
  fiscalInfo = {},
  store = {},
  incomingFiscalInfo = {},
} = {}) {
  const stored = fiscalInfo && typeof fiscalInfo === 'object' ? fiscalInfo : {};
  const incoming =
    incomingFiscalInfo && typeof incomingFiscalInfo === 'object'
      ? incomingFiscalInfo
      : {};
  const storeData = store && typeof store === 'object' ? store : {};
  const merged = {
    ...stored,
    ...incoming,
  };

  const normalizedNit = normalizeColombianNit(
    firstText(
      [merged.nit, merged.taxId, merged.identification, merged.documentNumber],
      40
    ),
    firstDigits(
      [merged.dv, merged.verificationDigit, merged.digitoVerificacion],
      2
    )
  );
  const municipalityCode = firstDigits(
    [
      merged.municipalityCode,
      merged.cityCode,
      merged.municipalityId,
      merged.municipality_id,
      storeData.municipalityCode,
      storeData.cityCode,
    ],
    20
  );

  return {
    ...merged,
    businessName: firstText(
      [
        merged.businessName,
        merged.company,
        merged.legalName,
        merged.razonSocial,
        storeData.businessName,
        storeData.name,
      ],
      180
    ),
    nit: normalizedNit.nit,
    dv: normalizedNit.dv,
    billingEmail: firstText(
      [merged.billingEmail, merged.email, storeData.email],
      180
    ).toLowerCase(),
    address: firstText(
      [merged.address, merged.fiscalAddress, storeData.address],
      220
    ),
    city: firstText([merged.city, merged.municipality, storeData.city], 120),
    cityCode: firstDigits([merged.cityCode, municipalityCode], 20),
    municipalityCode,
    department: firstText([merged.department, storeData.department], 120),
    departmentCode: firstDigits(
      [merged.departmentCode, storeData.departmentCode],
      20
    ),
    country: firstText([merged.country, storeData.country, 'CO'], 3).toUpperCase(),
    legalRepresentative: firstText(
      [merged.legalRepresentative, merged.representativeName],
      180
    ),
  };
}

function buildCompatibilitySet(settings = {}) {
  const current = settings?.billing?.fiscalInfo || {};
  const canonical = buildCanonicalFiscalInfo({
    fiscalInfo: current,
    store: settings?.store || {},
  });
  const $set = {};
  const canonicalFields = [
    'businessName',
    'nit',
    'dv',
    'billingEmail',
    'address',
    'city',
    'cityCode',
    'municipalityCode',
    'department',
    'departmentCode',
    'country',
    'legalRepresentative',
  ];

  canonicalFields.forEach((field) => {
    const existing = cleanText(current?.[field], 500);
    const resolved = cleanText(canonical?.[field], 500);
    const deterministicFiscalField = field === 'nit' || field === 'dv';

    if (
      resolved &&
      (!existing || (deterministicFiscalField && existing !== resolved))
    ) {
      $set[`billing.fiscalInfo.${field}`] = resolved;
    }
  });

  return { $set, canonical };
}

async function ensureStoredFiscalInfoCompatibility() {
  const settings = await SiteSettings.findOne().lean();
  if (!settings?._id) return settings;

  const { $set } = buildCompatibilitySet(settings);
  if (!Object.keys($set).length) return settings;

  return SiteSettings.findByIdAndUpdate(
    settings._id,
    { $set },
    { new: true, runValidators: true, strict: false }
  ).lean();
}

async function hydrateBillingPayload(payload = {}) {
  const settings = await ensureStoredFiscalInfoCompatibility();
  const body = payload && typeof payload === 'object' ? payload : {};
  const billing = body.billing && typeof body.billing === 'object' ? body.billing : {};
  const canonicalFiscalInfo = buildCanonicalFiscalInfo({
    fiscalInfo: settings?.billing?.fiscalInfo || {},
    store: settings?.store || {},
    incomingFiscalInfo: billing?.fiscalInfo || {},
  });

  return {
    ...body,
    billing: {
      ...billing,
      fiscalInfo: canonicalFiscalInfo,
    },
  };
}

async function hydrateBillingConfiguration(incomingBilling = {}) {
  const hydrated = await hydrateBillingPayload({ billing: incomingBilling });
  return hydrated.billing;
}

module.exports = {
  buildCanonicalFiscalInfo,
  buildCompatibilitySet,
  ensureStoredFiscalInfoCompatibility,
  hydrateBillingConfiguration,
  hydrateBillingPayload,
  normalizeColombianNit,
};
