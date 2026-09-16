export const DEFAULT_SHIPPING_PRICE = 20000;

export function normalizeShippingText(value) {
  return String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeCode(value) {
  return String(value || '').trim().toUpperCase();
}

function sameLocationPart(customerCode, customerName, zoneCode, zoneName) {
  const leftCode = normalizeCode(customerCode);
  const rightCode = normalizeCode(zoneCode);
  if (leftCode && rightCode) return leftCode === rightCode;
  const leftName = normalizeShippingText(customerName || customerCode);
  const rightName = normalizeShippingText(zoneName || zoneCode);
  return Boolean(leftName && rightName && leftName === rightName);
}

export function findShippingZone(config, customer = {}) {
  const zones = Array.isArray(config?.zones) ? config.zones : [];
  return zones.find((zone) => (
    sameLocationPart(customer.countryCode, customer.country, zone.countryCode, zone.country) &&
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

export function resolveShippingRate({
  config,
  customer = {},
  subtotal = 0,
  requiresShipping = true,
  deliveryType = 'envio',
} = {}) {
  if (!requiresShipping || String(deliveryType).toLowerCase() === 'retiro') return 0;
  if (!config || typeof config !== 'object') return DEFAULT_SHIPPING_PRICE;
  if (config.active === false) return 0;

  const minimum = Number(config?.freeShipping?.minimum);
  if (
    config?.freeShipping?.enabled === true &&
    Number.isFinite(minimum) &&
    minimum > 0 &&
    Number(subtotal) >= minimum
  ) return 0;

  if (String(config.mode).toLowerCase() === 'fixed') {
    const value = Number(config.fixedPrice);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SHIPPING_PRICE;
  }
  if (String(config.mode).toLowerCase() === 'zones') {
    const zone = findShippingZone(config, customer);
    const value = Number(zone?.price ?? config?.fallback?.price);
    return Number.isFinite(value) && value >= 0 ? value : DEFAULT_SHIPPING_PRICE;
  }
  return DEFAULT_SHIPPING_PRICE;
}
