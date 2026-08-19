'use strict';

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
  const normalized = clean(value, 10).toUpperCase();
  if (!normalized || ['COLOMBIA', 'COL'].includes(normalized)) return 'CO';
  return normalized;
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

function buildEnviaShipmentPayload({ order, shipment, branch, rate = null } = {}) {
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
      state: required(
        originCountry === 'CO'
          ? enviaColombiaStateCode(originAddress.departmentCode, originAddress.department)
          : originAddress.departmentCode || originAddress.department,
        'departamento de la sede',
        missing
      ),
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
      state: required(
        destinationCountry === 'CO'
          ? enviaColombiaStateCode(customer.departmentCode, customer.department)
          : customer.departmentCode || customer.department,
        'departamento del cliente',
        missing
      ),
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
      currency: 'COP',
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
  return payload;
}

function normalizeRate(item = {}, now = new Date()) {
  return {
    carrier: clean(item.carrier, 80),
    service: clean(item.service, 120),
    serviceDescription: clean(item.serviceDescription, 180),
    deliveryEstimate: clean(item.deliveryEstimate, 120),
    totalPrice: Math.max(0, numeric(item.totalPrice)),
    currency: clean(item.currency || 'COP', 10).toUpperCase(),
    quotedAt: now,
  };
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
  enviaColombiaStateCode,
  normalizeGeneratedLabel,
  normalizeRate,
};
