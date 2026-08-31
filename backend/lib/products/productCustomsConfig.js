'use strict';

const CountriesISO = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');
const esLocale = require('i18n-iso-countries/langs/es.json');

CountriesISO.registerLocale(enLocale);
CountriesISO.registerLocale(esLocale);

function clean(value, maxLength = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeCountryCode(value) {
  const raw = clean(value, 120);
  const upper = raw.toUpperCase();
  if (!raw) return '';
  if (/^[A-Z]{2}$/.test(upper)) return upper;
  if (/^[A-Z]{3}$/.test(upper)) {
    return CountriesISO.alpha3ToAlpha2(upper) || '';
  }
  return (
    CountriesISO.getAlpha2Code(raw, 'es') ||
    CountriesISO.getAlpha2Code(raw, 'en') ||
    ''
  );
}

function normalizeHsCode(value) {
  const raw = clean(value, 20).replace(/\s+/g, '');
  if (!raw) return '';
  const digits = raw.replace(/\./g, '');
  if (!/^\d{6,10}$/.test(digits)) return raw;
  return `${digits.slice(0, 4)}.${digits.slice(4, 6)}${
    digits.length > 6 ? `.${digits.slice(6)}` : ''
  }`;
}

function normalizeProductCustoms(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    description: clean(source.description, 250),
    hsCode: normalizeHsCode(source.hsCode),
    countryOfManufacture: normalizeCountryCode(source.countryOfManufacture),
  };
}

function validateProductCustoms(value = {}, { required = false } = {}) {
  const customs = normalizeProductCustoms(value);
  const errors = [];
  const hsDigits = customs.hsCode.replace(/\./g, '');
  if ((required || customs.hsCode) && !/^\d{6,10}$/.test(hsDigits)) {
    errors.push({
      field: 'customs.hsCode',
      code: 'INVALID_HS_CODE',
      message: 'El código HS debe contener entre 6 y 10 dígitos.',
    });
  }
  if ((required || clean(value?.countryOfManufacture)) && !customs.countryOfManufacture) {
    errors.push({
      field: 'customs.countryOfManufacture',
      code: 'INVALID_MANUFACTURE_COUNTRY',
      message: 'El país de fabricación debe ser un país válido (código ISO de dos letras).',
    });
  }
  if (required && !customs.description) {
    errors.push({
      field: 'customs.description',
      code: 'CUSTOMS_DESCRIPTION_REQUIRED',
      message: 'La descripción aduanera es obligatoria para envíos internacionales.',
    });
  }
  return { customs, errors };
}

module.exports = {
  normalizeCountryCode,
  normalizeHsCode,
  normalizeProductCustoms,
  validateProductCustoms,
};
