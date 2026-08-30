/* eslint-disable no-console */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  readCheckoutComposition,
} = require('./lib/readCheckoutComposition');
const Order = require('../models/Order');

const validateOrderPayload = require('../validators/orderPayload');
const {
  buildFactusCustomer,
  buildFactusInvoicePayload,
} = require('../lib/dian/providers/factusProvider');
const {
  buildCustomerSnapshot,
} = require('../services/electronicInvoiceIssuanceService');

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const results = { ok: 0, warn: 0, fail: 0 };

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function fail(message, error) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), 'utf8');
}

function baseOrderPayload() {
  return {
    sessionId: 'checkout-fiscal-test',
    cart: [
      {
        _id: '507f1f77bcf86cd799439011',
        title: 'Producto de prueba',
        quantity: 1,
        price: 100000,
      },
    ],
    subtotal: 100000,
    shipping: 10000,
    total: 110000,
    customer: {
      name: 'Ana',
      lastname: 'Pérez',
      id: '1234567890',
      emailOrPhone: 'ana@example.com',
      email: 'ana@example.com',
      phone: '3001234567',
      address: 'Calle 10 # 20-30',
      city: 'Santa Marta',
      municipalityId: '47001',
      country: 'Colombia',
      countryCode: 'CO',
      department: '47',
      departmentCode: '47',
      deliveryType: 'envio',
    },
    billing: {
      useSameAddress: true,
      personType: 'natural',
      documentType: 'CC',
      documentNumber: '1234567890',
      firstName: 'Ana',
      lastName: 'Pérez',
      email: 'ana@example.com',
      phone: '3001234567',
      department: 'Magdalena',
      departmentCode: '47',
      country: 'Colombia',
      countryCode: 'CO',
      municipalityCode: '47001',
      tributeCode: 'ZZ',
    },
    payment: {
      active: true,
      provider: 'wompi',
      mode: 'sandbox',
      currency: 'COP',
      status: 'pending_gateway',
    },
  };
}

function validateNaturalPersonAndSameAddress() {
  const payload = baseOrderPayload();
  payload.customer.isFinalConsumer = false;
  payload.billing.isFinalConsumer = false;
  const result = validateOrderPayload(payload);

  assert(result.ok, `La persona natural válida fue rechazada: ${result.errors.join(' | ')}`);
  assert(result.cleaned.customer.isFinalConsumer === false, 'La orden perdió la condición identificada del cliente.');
  assert(result.cleaned.billing.isFinalConsumer === false, 'La orden perdió la condición fiscal de comprador identificado.');
  assert(result.cleaned.billing.documentType === 'CC', 'No se conservó el tipo de documento fiscal.');
  assert(result.cleaned.billing.documentNumber === '1234567890', 'No se conservó el documento fiscal.');
  assert(result.cleaned.billing.address === 'Calle 10 # 20-30', 'No se resolvió la dirección de envío como dirección fiscal.');
  assert(result.cleaned.billing.municipalityCode === '47001', 'No se conservó el código DIVIPOLA.');

  ok('Persona natural usa documento, correo y dirección fiscal resueltos');
}

function validateIdentifiedBuyerCannotBecomeFinalConsumer() {
  const payload = baseOrderPayload();
  payload.customer.isFinalConsumer = false;
  payload.billing.isFinalConsumer = false;
  const validated = validateOrderPayload(payload);
  assert(validated.ok, validated.errors.join(' | '));

  const customer = buildFactusCustomer({
    source: 'web',
    customer: validated.cleaned.customer,
    billing: validated.cleaned.billing,
  });

  assert(customer.identification === '1234567890', 'Factus sustituyó el documento identificado.');
  assert(customer.names === 'Ana Pérez', 'Factus sustituyó el nombre del comprador.');
  assert(customer.email === 'ana@example.com', 'Factus eliminó el correo del comprador.');
  assert(customer.address === 'Calle 10 # 20-30', 'Factus eliminó la dirección del comprador.');
  assert(customer.municipality_code === '47001', 'Factus eliminó el municipio del comprador.');
  assert(customer.identification !== '222222222222', 'El comprador identificado terminó como consumidor final.');

  ok('Comprador identificado no puede degradarse a consumidor final');
}

function validateCompanyAndDifferentAddress() {
  const payload = baseOrderPayload();
  payload.billing = {
    useSameAddress: false,
    personType: 'juridica',
    documentType: 'NIT',
    documentNumber: '900.123.456-7',
    dv: '7',
    businessName: 'Comercializadora Ejemplo S.A.S.',
    email: 'facturacion@ejemplo.com',
    phone: '6054000000',
    address: 'Carrera 5 # 10-20',
    city: 'Barranquilla',
    cityCode: '08001',
    municipalityCode: '08001',
    department: 'Atlántico',
    departmentCode: '08',
    country: 'Colombia',
    countryCode: 'CO',
    tributeCode: '01',
  };

  const result = validateOrderPayload(payload);

  assert(result.ok, `La empresa válida fue rechazada: ${result.errors.join(' | ')}`);
  assert(result.cleaned.billing.documentNumber === '900123456', 'El NIT debe guardarse sin puntos, guion ni DV duplicado.');
  assert(result.cleaned.billing.dv === '7', 'No se conservó el DV.');
  assert(result.cleaned.billing.businessName === 'Comercializadora Ejemplo S.A.S.', 'No se conservó la razón social.');
  assert(result.cleaned.billing.address === 'Carrera 5 # 10-20', 'Se reemplazó indebidamente la dirección fiscal diferente.');

  ok('Persona jurídica conserva NIT, DV, razón social y dirección diferente');
}

function validateBackendRejectsIncompleteFiscalData() {
  const payload = baseOrderPayload();
  payload.billing = {
    ...payload.billing,
    personType: 'juridica',
    documentType: 'CC',
    businessName: '',
    email: 'correo-invalido',
  };

  const result = validateOrderPayload(payload);
  const messages = result.errors.join(' | ');

  assert(!result.ok, 'El backend aceptó datos fiscales incompletos.');
  assert(messages.includes('persona jurídica debe identificarse con NIT'), 'No se detectó empresa sin NIT.');
  assert(messages.includes('razón social'), 'No se detectó la razón social faltante.');
  assert(messages.includes('correo electrónico'), 'No se detectó el correo fiscal inválido.');

  ok('Backend bloquea empresa sin NIT, razón social o correo válido');
}

function validateFactusNaturalCustomer() {
  const validated = validateOrderPayload(baseOrderPayload());
  const order = {
    orderNumber: 'ORD-000001',
    customer: validated.cleaned.customer,
    billing: validated.cleaned.billing,
    items: validated.cleaned.cart,
    subtotal: validated.cleaned.subtotal,
    shipping: validated.cleaned.shipping,
    total: validated.cleaned.total,
    taxes: { iva: { percent: 0, amount: 0 } },
  };
  const customer = buildFactusCustomer(order);

  assert(customer.identification_document_code === '13', 'Factus no recibió código 13 para CC.');
  assert(customer.legal_organization_code === '2', 'Factus no recibió persona natural.');
  assert(customer.names === 'Ana Pérez', 'Factus no recibió el nombre fiscal real.');
  assert(customer.identification === '1234567890', 'Factus no recibió el documento fiscal real.');
  assert(customer.municipality_code === '47001', 'Factus no recibió el municipio fiscal.');
  assert(!Object.prototype.hasOwnProperty.call(customer, 'company'), 'Una persona natural no debe recibir razón social del emisor.');

  ok('Factus recibe el adquiriente natural real sin datos fiscales de la tienda');
}

function validateFactusCompanyCustomer() {
  const payload = baseOrderPayload();
  payload.billing = {
    ...payload.billing,
    useSameAddress: false,
    personType: 'juridica',
    documentType: 'NIT',
    documentNumber: '900123456',
    dv: '7',
    businessName: 'Comercializadora Ejemplo S.A.S.',
    email: 'facturacion@ejemplo.com',
    address: 'Carrera 5 # 10-20',
    city: 'Barranquilla',
    cityCode: '08001',
    municipalityCode: '08001',
    department: 'Atlántico',
    departmentCode: '08',
    country: 'Colombia',
    countryCode: 'CO',
  };
  const validated = validateOrderPayload(payload);
  assert(validated.ok, validated.errors.join(' | '));

  const order = {
    orderNumber: 'ORD-000002',
    customer: validated.cleaned.customer,
    billing: validated.cleaned.billing,
    items: validated.cleaned.cart,
    subtotal: validated.cleaned.subtotal,
    shipping: validated.cleaned.shipping,
    total: validated.cleaned.total,
    taxes: { iva: { percent: 0, amount: 0 } },
  };
  const invoicePayload = buildFactusInvoicePayload({ order });

  assert(invoicePayload.customer.identification_document_code === '31', 'Factus no recibió código 31 para NIT.');
  assert(invoicePayload.customer.legal_organization_code === '1', 'Factus no recibió persona jurídica.');
  assert(invoicePayload.customer.dv === '7', 'Factus no recibió el DV.');
  assert(invoicePayload.customer.company === 'Comercializadora Ejemplo S.A.S.', 'Factus no recibió la razón social.');
  assert(!Object.prototype.hasOwnProperty.call(invoicePayload.customer, 'merchant_registration'), 'Se mezcló el NIT del emisor con el adquiriente.');

  ok('Payload Factus V2 usa NIT, DV y razón social del comprador');
}

function validateFactusOfficialDocumentCatalog() {
  const expectedCodes = {
    RC: '11',
    TI: '12',
    CC: '13',
    TE: '21',
    CE: '22',
    NIT: '31',
    PP: '41',
    DIE: '42',
    PEP: '47',
    PPT: '48',
    NIT_EXTRANJERO: '50',
    NUIP: '91',
  };

  Object.entries(expectedCodes).forEach(([documentType, expectedCode]) => {
    const customer = buildFactusCustomer({
      customer: { name: 'Cliente', lastname: 'Prueba' },
      billing: {
        personType: 'natural',
        documentType,
        documentNumber: '123456789',
        municipalityCode: '47001',
        countryCode: 'CO',
      },
    });

    assert(
      customer.identification_document_code === expectedCode,
      `${documentType} no se tradujo al código Factus ${expectedCode}.`
    );
  });

  ok('Catálogo oficial de identificación se traduce sin valores libres ni fallback incorrecto');
}

function validateInvoiceSnapshotUsesBillingFirst() {
  const snapshot = buildCustomerSnapshot({
    customer: {
      name: 'Nombre de envío',
      lastname: 'Comprador',
      id: '11111111',
      address: 'Dirección de envío',
    },
    billing: {
      personType: 'juridica',
      documentType: 'NIT',
      documentNumber: '900123456',
      dv: '7',
      businessName: 'Empresa Fiscal S.A.S.',
      email: 'factura@empresa.com',
      address: 'Dirección fiscal',
      municipalityCode: '08001',
      countryCode: 'CO',
    },
  });

  assert(snapshot.documentNumber === '900123456', 'ElectronicInvoice tomó el documento de envío.');
  assert(snapshot.businessName === 'Empresa Fiscal S.A.S.', 'ElectronicInvoice perdió la razón social.');
  assert(snapshot.address === 'Dirección fiscal', 'ElectronicInvoice tomó la dirección de envío.');

  ok('ElectronicInvoice conserva una copia fiscal independiente del envío');
}

function validateCheckoutIntegration() {
  const checkout = readCheckoutComposition();
  const fields = read('frontend/src/checkout/dian/CheckoutDianCustomerFields.jsx');

  [
    'CheckoutDianCustomerFields',
    'validateDianCustomer(resolvedDianCustomer)',
    'const resolved = derived.resolvedDianCustomer',
    'personType: resolved.personType',
    'municipalityCode: resolved.municipalityCode',
  ].forEach((needle) => assert(checkout.includes(needle), `Checkout incompleto: falta ${needle}`));

  [
    'Tipo de persona',
    'Dígito de verificación (DV)',
    'Razón social',
    'Usar la misma dirección de envío',
    'Selecciona ciudad',
  ].forEach((needle) => assert(fields.includes(needle), `Formulario fiscal incompleto: falta ${needle}`));

  [
    'personType',
    'documentNumber',
    'businessName',
    'municipalityCode',
    'countryCode',
  ].forEach((field) => {
    const schemaPath = `billing.${field}`;
    assert(
      Order.schema.path(schemaPath)?.instance === 'String',
      `Order no persiste ${schemaPath} como String`
    );
  });

  ok('Checkout muestra y persiste todos los datos fiscales profesionales');
}

function validateScriptRegistration() {
  const packageJson = JSON.parse(read('backend/package.json'));
  assert(
    packageJson.scripts?.['test:billing-fiscal-checkout'] === 'node scripts/testBillingFiscalCheckoutModule.js',
    'Falta registrar test:billing-fiscal-checkout.'
  );

  ok('Prueba fiscal registrada para ejecución desde terminal');
}

console.log('\nValidando datos fiscales reales y checkout de Facturación...');

[
  validateNaturalPersonAndSameAddress,
  validateIdentifiedBuyerCannotBecomeFinalConsumer,
  validateCompanyAndDifferentAddress,
  validateBackendRejectsIncompleteFiscalData,
  validateFactusNaturalCustomer,
  validateFactusCompanyCustomer,
  validateFactusOfficialDocumentCatalog,
  validateInvoiceSnapshotUsesBillingFirst,
  validateCheckoutIntegration,
  validateScriptRegistration,
].forEach((test) => {
  try {
    test();
  } catch (error) {
    fail('El bloque fiscal no quedó completamente validado.', error);
  }
});

console.log(`\nResumen checkout fiscal -> OK: ${results.ok} WARN: ${results.warn} FAIL: ${results.fail}`);

if (results.fail > 0) process.exit(1);
