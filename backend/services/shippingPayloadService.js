'use strict';

const CountriesISO = require('i18n-iso-countries');
const enLocale = require('i18n-iso-countries/langs/en.json');
const esLocale = require('i18n-iso-countries/langs/es.json');
const {
  validateProductCustoms,
} = require('../lib/products/productCustomsConfig');

CountriesISO.registerLocale(enLocale);
CountriesISO.registerLocale(esLocale);

function clean(value, maxLength = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function payloadError(message, code, statusCode = 422, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function required(value, label, missing) {
  const finalValue = clean(value, 250);
  if (!finalValue) missing.push(label);
  return finalValue;
}

function countryCode(value) {
  const raw = clean(value, 120);
  const normalized = raw.toUpperCase();
  if (!normalized) return 'CO';
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  if (/^[A-Z]{3}$/.test(normalized)) {
    return CountriesISO.alpha3ToAlpha2(normalized) || normalized;
  }
  return (
    CountriesISO.getAlpha2Code(raw, 'es') ||
    CountriesISO.getAlpha2Code(raw, 'en') ||
    normalized
  );
}

const COLOMBIA_STATE_CODES = Object.freeze({
  '05': 'AN', ANT: 'AN', ANTIOQUIA: 'AN',
  '08': 'AT', ATL: 'AT', ATLANTICO: 'AT',
  '11': 'DC', DC: 'DC', BOGOTA: 'DC',
  '13': 'BL', BOL: 'BL', BOLIVAR: 'BL',
  '15': 'BY', BOY: 'BY', BOYACA: 'BY',
  '17': 'CL', CAL: 'CL', CALDAS: 'CL',
  '18': 'CQ', CAQ: 'CQ', CAQUETA: 'CQ',
  '19': 'CA', CAU: 'CA', CAUCA: 'CA',
  '20': 'CE', CES: 'CE', CESAR: 'CE',
  '23': 'CO', COR: 'CO', CORDOBA: 'CO',
  '25': 'CU', CUN: 'CU', CUNDINAMARCA: 'CU',
  '27': 'CH', CHO: 'CH', CHOCO: 'CH',
  '41': 'HU', HUI: 'HU', HUILA: 'HU',
  '44': 'LG', LAG: 'LG', 'LA GUAJIRA': 'LG',
  '47': 'MA', MAG: 'MA', MAGDALENA: 'MA',
  '50': 'ME', MET: 'ME', META: 'ME',
  '52': 'NA', NAR: 'NA', NARINO: 'NA',
  '54': 'NS', NSA: 'NS', 'NORTE DE SANTANDER': 'NS',
  '63': 'QD', QUI: 'QD', QUINDIO: 'QD',
  '66': 'RI', RIS: 'RI', RISARALDA: 'RI',
  '68': 'ST', SAN: 'ST', SANTANDER: 'ST',
  '70': 'SU', SUC: 'SU', SUCRE: 'SU',
  '73': 'TO', TOL: 'TO', TOLIMA: 'TO',
  '76': 'VC', VAC: 'VC', 'VALLE DEL CAUCA': 'VC',
  '81': 'AR', ARA: 'AR', ARAUCA: 'AR',
  '85': 'CS', CAS: 'CS', CASANARE: 'CS',
  '86': 'PU', PUT: 'PU', PUTUMAYO: 'PU',
  '88': 'SA', SAP: 'SA', 'SAN ANDRES Y PROVIDENCIA': 'SA',
  '91': 'AM', AMA: 'AM', AMAZONAS: 'AM',
  '94': 'GN', GUA: 'GN', GUAINIA: 'GN',
  '95': 'GV', GUV: 'GV', GUAVIARE: 'GV',
  '97': 'VP', VAU: 'VP', VAUPES: 'VP',
  '99': 'VD', VID: 'VD', VICHADA: 'VD',
});

const COLOMBIA_DANE_DEPARTMENT_CODES = Object.freeze(
  Object.fromEntries(
    Object.entries(COLOMBIA_STATE_CODES)
      .filter(([key]) => /^\d{2}$/.test(key))
      .map(([departmentCode, enviaCode]) => [enviaCode, departmentCode])
  )
);

function normalizedLookup(value) {
  return clean(value, 100)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/^CO-/, '');
}

function enviaColombiaStateCode(code, name) {
  const codeKey = normalizedLookup(code);
  const nameKey = normalizedLookup(name);
  return COLOMBIA_STATE_CODES[codeKey] || COLOMBIA_STATE_CODES[nameKey] || codeKey || nameKey;
}

function daneColombiaDepartmentCode(value) {
  const normalized = normalizedLookup(value);
  if (/^\d{2}$/.test(normalized)) return normalized;
  return COLOMBIA_DANE_DEPARTMENT_CODES[normalized] || '';
}

function idValue(value) {
  return String(value?._id || value || '').trim();
}

function physicalOrderItems(order) {
  return (Array.isArray(order?.items) ? order.items : []).filter(
    (item) =>
      item?.requiresShipping !== false &&
      !['digital', 'service'].includes(clean(item?.productType, 30).toLowerCase())
  );
}

function internationalOrderItems(order, shipment) {
  const items = physicalOrderItems(order);
  const byId = new Map(items.map((item) => [idValue(item), item]));
  const allocationIds = new Set(
    (Array.isArray(shipment?.allocationIds) ? shipment.allocationIds : [])
      .map(idValue)
      .filter(Boolean)
  );
  const allAllocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const allocations = allAllocations.filter((allocation) =>
    allocationIds.has(idValue(allocation))
  );

  if (allocations.length) {
    const quantityByItem = new Map();
    for (const allocation of allocations) {
      const orderItemId = idValue(allocation?.orderItem);
      if (!orderItemId || !byId.has(orderItemId)) {
        throw payloadError(
          'No fue posible relacionar la asignación de inventario con el producto declarado para aduanas.',
          'SHIPPING_CUSTOMS_ITEM_ALLOCATION_INVALID',
          422,
          { shipment: clean(shipment?.code, 100), allocation: idValue(allocation) }
        );
      }
      if (allocation?.bundleParentProduct) {
        const missingBundleAllocation = allAllocations.some(
          (candidate) =>
            idValue(candidate?.orderItem) === orderItemId &&
            candidate?.bundleParentProduct &&
            Math.max(
              0,
              numeric(candidate?.soldQuantity) -
                numeric(candidate?.returnedQuantity)
            ) > 0 &&
            !allocationIds.has(idValue(candidate))
        );
        if (missingBundleAllocation) {
          throw payloadError(
            'Un combo internacional no puede dividir sus componentes entre varios envíos.',
            'SHIPPING_CUSTOMS_BUNDLE_SPLIT_UNSUPPORTED',
            422,
            {
              shipment: clean(shipment?.code, 100),
              item: clean(byId.get(orderItemId)?.title, 160),
            }
          );
        }
        quantityByItem.set(
          orderItemId,
          Math.max(
            1,
            numeric(
              byId.get(orderItemId)?.quantity ?? byId.get(orderItemId)?.qty,
              1
            )
          )
        );
        continue;
      }
      const quantity = Math.max(
        0,
        numeric(allocation?.soldQuantity) - numeric(allocation?.returnedQuantity)
      );
      if (quantity > 0) {
        quantityByItem.set(
          orderItemId,
          numeric(quantityByItem.get(orderItemId)) + quantity
        );
      }
    }
    return [...quantityByItem.entries()].map(([orderItemId, quantity]) => ({
      item: byId.get(orderItemId),
      quantity,
    }));
  }

  if (allocationIds.size) {
    throw payloadError(
      'Las asignaciones del envío no coinciden con el inventario vendido de la orden.',
      'SHIPPING_CUSTOMS_ALLOCATION_INVALID',
      422,
      { shipment: clean(shipment?.code, 100) }
    );
  }

  const shipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments.filter(
        (candidate) => clean(candidate?.status, 30).toLowerCase() !== 'cancelled'
      )
    : [];
  if (shipments.length > 1) {
    throw payloadError(
      'El envío internacional no identifica qué productos corresponden a esta sede.',
      'SHIPPING_CUSTOMS_ALLOCATION_REQUIRED',
      422,
      { shipment: clean(shipment?.code, 100) }
    );
  }
  return items.map((item) => ({
    item,
    quantity: Math.max(1, numeric(item?.quantity ?? item?.qty, 1)),
  }));
}

function buildInternationalCustoms(order, shipment, packages, customsPolicy = {}) {
  if (packages.length > 1) {
    throw payloadError(
      'Los envíos internacionales con varios paquetes requieren asignar los productos a cada paquete antes de cotizar.',
      'SHIPPING_INTERNATIONAL_PACKAGE_ALLOCATION_REQUIRED',
      422,
      { shipment: clean(shipment?.code, 100), packages: packages.length }
    );
  }

  const sourceItems = internationalOrderItems(order, shipment);
  if (!sourceItems.length) {
    throw payloadError(
      'El envío internacional no contiene productos físicos para declarar.',
      'SHIPPING_CUSTOMS_ITEMS_REQUIRED',
      422,
      { shipment: clean(shipment?.code, 100) }
    );
  }

  const missing = [];
  const items = sourceItems.map(({ item, quantity }, index) => {
    const validated = validateProductCustoms(item?.customsSnapshot, {
      required: true,
    });
    if (validated.errors.length) {
      for (const error of validated.errors) {
        missing.push({
          item: clean(item?.title, 160) || `Producto ${index + 1}`,
          field: error.field,
          message: error.message,
        });
      }
    }
    return {
      description: validated.customs.description,
      quantity: Math.max(1, Math.floor(numeric(quantity, 1))),
      price: Math.max(
        0.01,
        numeric(item?.unitPrice ?? item?.price ?? item?.priceNumber, 0.01)
      ),
      hsCode: validated.customs.hsCode,
      countryOfManufacture: validated.customs.countryOfManufacture,
    };
  });
  if (missing.length) {
    throw payloadError(
      `Completa la información aduanera de los productos: ${[
        ...new Set(missing.map((entry) => entry.item)),
      ].join(', ')}.`,
      'SHIPPING_CUSTOMS_DATA_INCOMPLETE',
      422,
      { missing }
    );
  }

  const dutiesPaymentEntity = ['recipient', 'sender', 'envia_guaranteed'].includes(
    clean(customsPolicy?.dutiesPaymentEntity, 40).toLowerCase()
  )
    ? clean(customsPolicy.dutiesPaymentEntity, 40).toLowerCase()
    : 'recipient';
  return {
    items,
    customsSettings: {
      dutiesPaymentEntity,
      exportReason: clean(customsPolicy?.exportReason, 40).toLowerCase() || 'sale',
    },
  };
}

function buildEnviaShipmentPayload({
  order,
  shipment,
  branch,
  rate = null,
  customsPolicy = {},
} = {}) {
  const missing = [];
  const customer = order?.customer || {};
  const originAddress = branch?.address || {};
  const originContact = branch?.contact || {};
  const packages = Array.isArray(shipment?.packages) ? shipment.packages : [];
  const originCountry = countryCode(originAddress.country);
  const destinationCountry = countryCode(customer.countryCode || customer.country);

  const normalizedPackages = packages.map((item, index) => {
    const weight = numeric(item?.weightGrams) / 1000;
    const length = numeric(item?.lengthCm);
    const width = numeric(item?.widthCm);
    const height = numeric(item?.heightCm);
    if (!(weight > 0)) missing.push(`peso del paquete ${index + 1}`);
    if (!(length > 0 && width > 0 && height > 0)) {
      missing.push(`dimensiones del paquete ${index + 1}`);
    }
    return {
      content: clean(item?.code || shipment?.code, 100),
      amount: 1,
      type: 'box',
      weight,
      insurance: 0,
      declaredValue: Math.max(1, numeric(order?.total, 1) / Math.max(1, packages.length)),
      weightUnit: 'KG',
      lengthUnit: 'CM',
      dimensions: { length, width, height },
    };
  });
  if (!normalizedPackages.length) missing.push('al menos un paquete');

  const payload = {
    origin: {
      name: required(branch?.name || shipment?.branchSnapshot?.name, 'nombre de la sede', missing),
      company: clean(branch?.name || shipment?.branchSnapshot?.name, 250),
      email: clean(originContact.email, 160),
      phone: required(originContact.phone || originContact.whatsapp, 'teléfono de la sede', missing),
      street: required(originAddress.addressLine, 'dirección de la sede', missing),
      number: '',
      district: clean(originAddress.neighborhood, 120),
      city: required(originAddress.city, 'ciudad de la sede', missing),
      state: originCountry === 'CO'
        ? required(
            enviaColombiaStateCode(
              originAddress.departmentCode,
              originAddress.department
            ),
            'departamento de la sede',
            missing
          )
        : clean(originAddress.departmentCode || originAddress.department, 120),
      country: originCountry,
      postalCode: clean(originAddress.postalCode, 30),
      reference: clean(shipment?.branchSnapshot?.code, 80),
    },
    destination: {
      name: required(`${clean(customer.name, 120)} ${clean(customer.lastname, 120)}`, 'nombre del cliente', missing),
      company: '',
      email: clean(customer.email, 160),
      phone: required(customer.phone || customer.emailOrPhone, 'teléfono del cliente', missing),
      street: required(customer.address, 'dirección del cliente', missing),
      number: '',
      district: '',
      city: required(customer.city, 'ciudad del cliente', missing),
      state: destinationCountry === 'CO'
        ? required(
            enviaColombiaStateCode(
              customer.departmentCode,
              customer.department
            ),
            'departamento del cliente',
            missing
          )
        : clean(customer.departmentCode || customer.department, 120),
      country: destinationCountry,
      postalCode: clean(customer.postalCode, 30),
      reference: clean(order?.orderNumber, 100),
    },
    packages: normalizedPackages,
    shipment: {
      type: 1,
      ...(clean(rate?.carrier, 80) ? { carrier: clean(rate.carrier, 80) } : {}),
      ...(clean(rate?.service, 120) ? { service: clean(rate.service, 120) } : {}),
    },
    settings: {
      currency: clean(
        order?.pricingSnapshot?.currency || order?.payment?.currency || 'COP',
        10
      ).toUpperCase(),
      printFormat: 'PDF',
      printSize: 'STOCK_4X6',
      comments: `Orden ${clean(order?.orderNumber, 100)} · ${clean(shipment?.code, 100)}`,
    },
  };

  const uniqueMissing = [...new Set(missing)];
  if (uniqueMissing.length) {
    throw payloadError(
      `Completa la información necesaria para cotizar: ${uniqueMissing.join(', ')}.`,
      'SHIPPING_DATA_INCOMPLETE',
      422,
      { missing: uniqueMissing }
    );
  }

  if (originCountry !== destinationCountry) {
    const customs = buildInternationalCustoms(
      order,
      shipment,
      normalizedPackages,
      customsPolicy
    );
    payload.packages[0].items = customs.items;
    payload.customsSettings = customs.customsSettings;
  }
  return payload;
}

function normalizeRate(item = {}, now = new Date()) {
  const carrierId = clean(
    item.carrierId ||
    item.carrier_id ||
    item.idCarrier ||
    item.id_carrier ||
    item.carrier?.id,
    80
  );
  const carrierActions = [...new Set(
    (Array.isArray(item.carrierActions) ? item.carrierActions : [])
      .map((action) => clean(action, 80).toLowerCase())
      .filter(Boolean)
  )];
  const normalized = {
    carrier: clean(item.carrier, 80),
    service: clean(item.service, 120),
    serviceDescription: clean(item.serviceDescription, 180),
    deliveryEstimate: clean(item.deliveryEstimate, 120),
    totalPrice: Math.max(0, numeric(item.totalPrice)),
    currency: clean(item.currency || 'COP', 10).toUpperCase(),
    quotedAt: now,
  };
  if (carrierId) normalized.carrierId = carrierId;
  if (Object.prototype.hasOwnProperty.call(item, 'carrierActions')) {
    normalized.carrierActions = carrierActions;
  }
  if (typeof item.carrierActionsResolved === 'boolean') {
    normalized.carrierActionsResolved = item.carrierActionsResolved;
  }
  return normalized;
}

function normalizeGeneratedLabel(item = {}) {
  const safeUrl = (value, label) => {
    const raw = clean(value, 1000);
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol');
      return parsed.toString();
    } catch {
      throw payloadError(
        `La transportadora devolvió ${label} con URL inválida.`,
        'INVALID_PROVIDER_LABEL_URL',
        502
      );
    }
  };
  const labelUrl = safeUrl(item.label, 'una etiqueta');
  return {
    providerShipmentId: clean(item.shipmentId, 180),
    trackingNumber: clean(item.trackingNumber, 180),
    trackingUrl: safeUrl(item.trackUrl, 'un seguimiento'),
    labelUrl,
    totalPrice: Math.max(0, numeric(item.totalPrice)),
    currency: clean(item.currency || 'COP', 10).toUpperCase(),
    carrier: clean(item.carrier, 80),
    service: clean(item.service, 120),
  };
}

module.exports = {
  buildEnviaShipmentPayload,
  buildInternationalCustoms,
  countryCode,
  daneColombiaDepartmentCode,
  enviaColombiaStateCode,
  normalizeGeneratedLabel,
  normalizeRate,
};
