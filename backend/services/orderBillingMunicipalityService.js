'use strict';

const municipalityCatalog = require('../scripts/data/factusMunicipalities.json');

const MUNICIPALITIES = (Array.isArray(municipalityCatalog?.municipalities)
  ? municipalityCatalog.municipalities
  : [])
  .map((municipality) => ({
    code: cleanDigits(municipality?.code, 5),
    name: cleanText(municipality?.name, 120),
    normalizedName: normalizeName(municipality?.name),
    departmentCode: cleanDigits(municipality?.department?.code, 2),
    department: cleanText(municipality?.department?.name, 120),
    normalizedDepartment: normalizeName(municipality?.department?.name),
  }))
  .filter((municipality) => municipality.code && municipality.normalizedName);

const MUNICIPALITY_BY_CODE = new Map(
  MUNICIPALITIES.map((municipality) => [municipality.code, municipality])
);

function cleanText(value, max = 180) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, max);
}

function cleanDigits(value, max = 20) {
  return cleanText(value, max).replace(/\D/g, '').slice(0, max);
}

function normalizeName(value) {
  return cleanText(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeMunicipalityName(value) {
  const normalized = normalizeName(value);

  if (normalized === 'bogota') return 'bogota d c';
  return normalized;
}

function createMunicipalityError(message, code, details = {}) {
  return Object.assign(new Error(message), {
    status: 422,
    statusCode: 422,
    code,
    details,
  });
}

function firstText(...values) {
  return values.map((value) => cleanText(value)).find(Boolean) || '';
}

function firstDigits(...values) {
  return values.map((value) => cleanDigits(value)).find(Boolean) || '';
}

function isColombianLocation(location = {}) {
  const countryCode = cleanText(location.countryCode, 10).toUpperCase();
  const countryName = normalizeName(location.country);

  if (countryCode) return countryCode === 'CO';
  return !countryName || countryName === 'co' || countryName === 'colombia';
}

function serializeMunicipality(municipality) {
  if (!municipality) return null;

  return {
    municipalityCode: municipality.code,
    cityCode: municipality.code,
    city: municipality.name,
    departmentCode: municipality.departmentCode,
    department: municipality.department,
    country: 'Colombia',
    countryCode: 'CO',
  };
}

function resolveOrderBillingMunicipality(order = {}, { required = false } = {}) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const location = {
    countryCode: firstText(billing.countryCode, customer.countryCode),
    country: firstText(billing.country, customer.country, 'Colombia'),
  };

  if (!isColombianLocation(location)) return null;

  const explicitCode = firstDigits(
    billing.municipalityCode,
    billing.cityCode,
    customer.municipalityCode,
    customer.municipalityId,
    customer.municipality_id
  );

  if (explicitCode) {
    const municipality = MUNICIPALITY_BY_CODE.get(explicitCode);
    if (municipality) return serializeMunicipality(municipality);

    if (required && isColombianLocation(location)) {
      throw createMunicipalityError(
        'El código DIVIPOLA guardado en la orden no corresponde a un municipio válido. Selecciona nuevamente departamento y municipio.',
        'BILLING_MUNICIPALITY_CODE_INVALID',
        { municipalityCode: explicitCode }
      );
    }

    return {
      municipalityCode: explicitCode,
      cityCode: explicitCode,
      city: firstText(billing.city, customer.city),
      departmentCode: firstDigits(billing.departmentCode, customer.departmentCode),
      department: firstText(billing.department, customer.department),
      country: location.country || 'Colombia',
      countryCode: location.countryCode || 'CO',
    };
  }

  const city = firstText(billing.city, customer.city);
  if (!city) {
    if (!required) return null;
    throw createMunicipalityError(
      'La orden no tiene municipio fiscal. Selecciona departamento y municipio antes de reintentar la factura.',
      'BILLING_MUNICIPALITY_REQUIRED'
    );
  }

  const normalizedCity = normalizeMunicipalityName(city);
  let candidates = MUNICIPALITIES.filter((municipality) => {
    const municipalityName = normalizeMunicipalityName(municipality.name);
    return municipalityName === normalizedCity;
  });

  const departmentCode = firstDigits(
    billing.departmentCode,
    customer.departmentCode
  );
  const department = firstText(billing.department, customer.department);
  const normalizedDepartment = normalizeName(department);

  if (departmentCode) {
    candidates = candidates.filter(
      (municipality) => municipality.departmentCode === departmentCode
    );
  } else if (normalizedDepartment) {
    candidates = candidates.filter(
      (municipality) => municipality.normalizedDepartment === normalizedDepartment
    );
  }

  if (candidates.length === 1) return serializeMunicipality(candidates[0]);

  if (!required) return null;

  if (candidates.length > 1) {
    throw createMunicipalityError(
      `El municipio "${city}" existe en más de un departamento. Selecciona departamento y municipio antes de reintentar la factura.`,
      'BILLING_MUNICIPALITY_AMBIGUOUS',
      {
        city,
        matches: candidates.map((candidate) => ({
          code: candidate.code,
          departmentCode: candidate.departmentCode,
          department: candidate.department,
        })),
      }
    );
  }

  throw createMunicipalityError(
    `No fue posible identificar de forma segura el municipio fiscal "${city}". Selecciónalo en la orden antes de reintentar la factura.`,
    'BILLING_MUNICIPALITY_NOT_FOUND',
    { city, department, departmentCode }
  );
}

module.exports = {
  normalizeName,
  resolveOrderBillingMunicipality,
};
