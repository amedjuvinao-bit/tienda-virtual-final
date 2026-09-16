'use strict';

const DEFAULT_SHIPPING_PRICE = 20000;

function cleanText(value, maxLength = 180) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function normalizeText(value) {
  return cleanText(value, 180)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeCode(value, maxLength = 20) {
  return cleanText(value, maxLength).toUpperCase();
}

function normalizeMoney(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : null;
}

function inferCountryCode(source = {}) {
  const explicit = normalizeCode(source.countryCode, 2);
  if (explicit) return explicit;
  const country = normalizeText(source.country);
  return country === 'colombia' || country === 'co' ? 'CO' : '';
}

function normalizeShippingZone(zone = {}, index = 0) {
  const source = zone && typeof zone === 'object' && !Array.isArray(zone) ? zone : {};
  const countryCode = inferCountryCode(source);
  const legacyDepartment = cleanText(source.department, 100);
  const legacyCity = cleanText(source.city, 100);
  return {
    id: cleanText(source.id, 80) || `zone-${index + 1}`,
    countryCode,
    country: cleanText(source.countryName || source.country, 100) || (countryCode === 'CO' ? 'Colombia' : ''),
    departmentCode: normalizeCode(
      source.departmentCode || (/^\d{2}$/.test(legacyDepartment) ? legacyDepartment : ''),
      20
    ),
    department: cleanText(source.departmentName || legacyDepartment, 100),
    cityCode: normalizeCode(source.cityCode || source.municipalityCode, 20),
    city: cleanText(source.cityName || legacyCity, 100),
    price: normalizeMoney(source.price),
    eta: cleanText(source.eta, 120),
  };
}

function normalizeShippingRates(raw = {}) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const freeShipping = source.freeShipping && typeof source.freeShipping === 'object'
    ? source.freeShipping
    : {};
  const fallback = source.fallback && typeof source.fallback === 'object'
    ? source.fallback
    : {};
  const mode = cleanText(source.mode, 20).toLowerCase();
  return {
    active: source.active !== false,
    mode: mode === 'zones' ? 'zones' : 'fixed',
    fixedPrice: normalizeMoney(source.fixedPrice),
    estimatedTime: cleanText(source.estimatedTime, 120),
    freeShipping: {
      enabled: freeShipping.enabled === true,
      minimum: normalizeMoney(freeShipping.minimum),
    },
    fallback: {
      price: normalizeMoney(fallback.price),
      eta: cleanText(fallback.eta, 120),
    },
    zones: (Array.isArray(source.zones) ? source.zones : [])
      .slice(0, 100)
      .map(normalizeShippingZone),
  };
}

function sameLocationPart(customerCode, customerName, zoneCode, zoneName) {
  const leftCode = normalizeCode(customerCode);
  const rightCode = normalizeCode(zoneCode);
  if (leftCode && rightCode) return leftCode === rightCode;
  const leftName = normalizeText(customerName || customerCode);
  const rightName = normalizeText(zoneName || zoneCode);
  return Boolean(leftName && rightName && leftName === rightName);
}

function findShippingZone(config, customer = {}) {
  const rates = normalizeShippingRates(config);
  return rates.zones.find((zone) => (
    sameLocationPart(
      customer.countryCode,
      customer.country,
      zone.countryCode,
      zone.country
    ) &&
    sameLocationPart(
      customer.departmentCode,
      customer.department,
      zone.departmentCode,
      zone.department
    ) &&
    sameLocationPart(
      customer.cityCode || customer.municipalityCode || customer.municipalityId,
      customer.city,
      zone.cityCode,
      zone.city
    )
  )) || null;
}

function resolveShippingRate({ config, customer = {}, subtotal = 0 } = {}) {
  if (!config || typeof config !== 'object') return DEFAULT_SHIPPING_PRICE;
  const rates = normalizeShippingRates(config);
  if (!rates.active) return 0;

  if (
    rates.freeShipping.enabled &&
    Number.isFinite(rates.freeShipping.minimum) &&
    rates.freeShipping.minimum > 0 &&
    Number(subtotal) >= rates.freeShipping.minimum
  ) {
    return 0;
  }

  if (rates.mode === 'fixed') {
    return Number.isFinite(rates.fixedPrice) && rates.fixedPrice >= 0
      ? rates.fixedPrice
      : DEFAULT_SHIPPING_PRICE;
  }

  const zone = findShippingZone(rates, customer);
  if (zone && Number.isFinite(zone.price) && zone.price >= 0) return zone.price;
  return Number.isFinite(rates.fallback.price) && rates.fallback.price >= 0
    ? rates.fallback.price
    : DEFAULT_SHIPPING_PRICE;
}

module.exports = {
  DEFAULT_SHIPPING_PRICE,
  cleanText,
  findShippingZone,
  normalizeCode,
  normalizeMoney,
  normalizeShippingRates,
  normalizeShippingZone,
  normalizeText,
  resolveShippingRate,
  sameLocationPart,
};
