'use strict';

const {
  countryCode,
  enviaColombiaStateCode,
} = require('../shippingPayloadService');
const { createReturnError } = require('../orderReturns/normalization');

function clean(value, maxLength = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function required(value, label, missing) {
  const result = clean(value, 250);
  if (!result) missing.push(label);
  return result;
}

function normalizeReturnPackages(packages = [], returnNumber = '') {
  const source = Array.isArray(packages) ? packages.slice(0, 5) : [];
  const missing = [];
  const normalized = source.map((item, index) => {
    const weightGrams = positive(item?.weightGrams);
    const lengthCm = positive(item?.lengthCm);
    const widthCm = positive(item?.widthCm);
    const heightCm = positive(item?.heightCm);
    if (!weightGrams) missing.push(`peso del paquete ${index + 1}`);
    if (!lengthCm || !widthCm || !heightCm) {
      missing.push(`dimensiones del paquete ${index + 1}`);
    }
    return {
      code: clean(item?.code || `RET-${index + 1}`, 100).toUpperCase(),
      weightGrams,
      lengthCm,
      widthCm,
      heightCm,
    };
  });
  if (!normalized.length) missing.push('al menos un paquete');
  if (Array.isArray(packages) && packages.length > 5) {
    throw createReturnError(
      'Una devolución admite máximo cinco paquetes por guía.',
      'RETURN_SHIPPING_PACKAGES_LIMIT',
      422
    );
  }
  if (missing.length) {
    throw createReturnError(
      `Completa la logística inversa: ${[...new Set(missing)].join(', ')}.`,
      'RETURN_SHIPPING_DATA_INCOMPLETE',
      422,
      { missing: [...new Set(missing)] }
    );
  }
  return normalized.map((item, index) => ({
    ...item,
    code: item.code || `${clean(returnNumber, 80)}-${index + 1}`,
  }));
}

function buildReturnShipmentPayload({ order, returnCase, destination, packages, rate } = {}) {
  const missing = [];
  const customer = order?.customer || {};
  const address = destination?.address || {};
  const contact = destination?.contact || {};
  const normalizedPackages = normalizeReturnPackages(packages, returnCase?.returnNumber);
  const originCountry = countryCode(customer.countryCode || customer.country);
  const destinationCountry = countryCode(address.country);
  if (originCountry !== destinationCountry) {
    throw createReturnError(
      'La guía RMA automática está habilitada para devoluciones nacionales. Una devolución internacional requiere gestión aduanera manual.',
      'RETURN_SHIPPING_INTERNATIONAL_MANUAL_REQUIRED',
      422,
      { originCountry, destinationCountry }
    );
  }
  const declaredTotal = Math.max(
    1,
    (returnCase?.items || []).reduce(
      (sum, item) => sum + Number(item?.unitAmount || 0) * Number(item?.authorizedQuantity || 0),
      0
    )
  );
  const payload = {
    origin: {
      name: required(
        [customer.name, customer.lastname].filter(Boolean).join(' '),
        'nombre del cliente',
        missing
      ),
      company: '',
      email: clean(customer.email || (/\S+@\S+/.test(customer.emailOrPhone || '') ? customer.emailOrPhone : ''), 160),
      phone: required(customer.phone || customer.emailOrPhone, 'teléfono del cliente', missing),
      street: required(customer.address, 'dirección del cliente', missing),
      number: '',
      district: '',
      city: required(customer.city || customer.municipalityCode, 'ciudad del cliente', missing),
      state: originCountry === 'CO'
        ? required(
            enviaColombiaStateCode(customer.departmentCode, customer.department),
            'departamento del cliente',
            missing
          )
        : clean(customer.departmentCode || customer.department, 120),
      country: originCountry,
      postalCode: clean(customer.postalCode, 30),
      reference: clean(returnCase?.returnNumber, 100),
    },
    destination: {
      name: required(destination?.name, 'nombre de la sede receptora', missing),
      company: clean(destination?.name, 250),
      email: clean(contact.email, 160),
      phone: required(contact.phone || contact.whatsapp, 'teléfono de la sede receptora', missing),
      street: required(address.addressLine, 'dirección de la sede receptora', missing),
      number: '',
      district: clean(address.neighborhood, 120),
      city: required(address.city || address.cityCode, 'ciudad de la sede receptora', missing),
      state: destinationCountry === 'CO'
        ? required(
            enviaColombiaStateCode(address.departmentCode, address.department),
            'departamento de la sede receptora',
            missing
          )
        : clean(address.departmentCode || address.department, 120),
      country: destinationCountry,
      postalCode: clean(address.postalCode, 30),
      reference: clean(destination?.code, 80),
    },
    packages: normalizedPackages.map((item) => ({
      content: item.code,
      amount: 1,
      type: 'box',
      weight: item.weightGrams / 1000,
      insurance: 0,
      declaredValue: declaredTotal / normalizedPackages.length,
      weightUnit: 'KG',
      lengthUnit: 'CM',
      dimensions: {
        length: item.lengthCm,
        width: item.widthCm,
        height: item.heightCm,
      },
    })),
    shipment: {
      type: 1,
      ...(clean(rate?.carrier, 80) ? { carrier: clean(rate.carrier, 80) } : {}),
      ...(clean(rate?.service, 120) ? { service: clean(rate.service, 120) } : {}),
    },
    settings: {
      currency: clean(order?.pricingSnapshot?.currency || order?.payment?.currency || 'COP', 10).toUpperCase(),
      printFormat: 'PDF',
      printSize: 'STOCK_4X6',
      comments: `Devolución ${clean(returnCase?.returnNumber, 100)} → ${clean(destination?.code, 50)}`,
    },
  };
  if (missing.length) {
    throw createReturnError(
      `Completa la información necesaria para la devolución: ${[...new Set(missing)].join(', ')}.`,
      'RETURN_SHIPPING_DATA_INCOMPLETE',
      422,
      { missing: [...new Set(missing)] }
    );
  }
  return { payload, packages: normalizedPackages };
}

const RETURN_ADDRESS_ROLES = Object.freeze({
  origin: Object.freeze({
    place: 'la dirección de recogida del cliente',
    correction: 'Corrige la dirección del cliente en la orden.',
  }),
  destination: Object.freeze({
    place: 'la sede receptora de la devolución',
    correction: 'Corrige la ubicación en Configuración → Sedes.',
  }),
});

module.exports = {
  RETURN_ADDRESS_ROLES,
  buildReturnShipmentPayload,
  normalizeReturnPackages,
};
