'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const {
  buildCustomerIdentity,
  normalizeDocumentNumber,
  normalizePhone,
} = require('../lib/customers/customerIdentity');
const {
  buildCustomerBranchAccess,
  buildScopedCustomerFilter,
  buildScopedFollowUpFilter,
  resolveCustomerWriteBranch,
} = require('../services/customerAdminScopeService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function hasIndex(schema, name, predicate = () => true) {
  return schema.indexes().some(
    ([key, options]) => options.name === name && predicate(key, options)
  );
}

async function main() {
  const branchA = new mongoose.Types.ObjectId();
  const branchB = new mongoose.Types.ObjectId();
  const branchC = new mongoose.Types.ObjectId();

  ok(
    'las tres variantes del celular colombiano producen una identidad E.164 única',
    new Set([
      normalizePhone('3001234567'),
      normalizePhone('+57 300 123 4567'),
      normalizePhone('57 300 123 4567'),
    ]).size === 1 && normalizePhone('3001234567') === '+573001234567'
  );
  ok(
    'los pasaportes conservan letras y no colisionan solo por compartir números',
    normalizeDocumentNumber('AB-123', 'PP') === 'AB123' &&
      normalizeDocumentNumber('XY-123', 'PP') === 'XY123'
  );
  ok(
    'los documentos numéricos eliminan formato sin alterar la identidad',
    normalizeDocumentNumber('1.234.567-8', 'NIT') === '12345678'
  );
  ok(
    'PPT queda reconocido como documento fiscal válido',
    buildCustomerIdentity({ documentType: 'PPT', documentNumber: 'PPT-99A' })
      .documentType === 'PPT'
  );

  const customer = new Customer({
    fullName: 'Cliente Integridad',
    phone: '300 123 4567',
    email: 'CLIENTE@EJEMPLO.COM ',
    documentType: 'PP',
    documentNumber: 'AB-123',
    defaultBranch: branchA,
    branchIds: [branchA, branchA],
    fiscalProfile: {
      personType: 'juridica',
      businessName: 'Empresa Prueba SAS',
      verificationDigit: '7',
      municipalityCode: '47001',
      departmentCode: '47',
      tributeCode: 'ZZ',
      taxRegime: 'Ordinario',
      taxResponsibilities: ['R-99-PN'],
    },
  });
  await customer.validate();
  ok(
    'el modelo recalcula las tres identidades canónicas al validar',
    customer.normalizedPhone === '+573001234567' &&
      customer.normalizedEmail === 'cliente@ejemplo.com' &&
      customer.normalizedDocument === 'AB123'
  );
  ok(
    'el modelo conserva una sola afiliación por sede e incluye la predeterminada',
    customer.branchIds.length === 1 && String(customer.branchIds[0]) === String(branchA)
  );
  const billing = customer.toBillingSnapshot();
  ok(
    'la ficha maestra entrega un snapshot fiscal reutilizable por Factus',
    billing.personType === 'juridica' &&
      billing.businessName === 'Empresa Prueba SAS' &&
      billing.dv === '7' &&
      billing.municipalityCode === '47001' &&
      billing.taxRegime === 'Ordinario' &&
      billing.taxResponsibilities.includes('R-99-PN')
  );

  ok(
    'correo, celular y documento tienen índices únicos parciales',
    hasIndex(Customer.schema, 'customer_email_identity_unique', (key, options) => options.unique === true && key.deletedAt === 1) &&
      hasIndex(Customer.schema, 'customer_phone_identity_unique', (key, options) => options.unique === true && key.deletedAt === 1) &&
      hasIndex(Customer.schema, 'customer_document_identity_unique', (key, options) => options.unique === true && key.deletedAt === 1)
  );
  ok(
    'Clientes tiene un índice operativo compuesto por sede',
    hasIndex(Customer.schema, 'customer_branch_status_recent', (key) => key.branchIds === 1)
  );
  ok(
    'Seguimientos tiene índices por sede, responsable y vencimiento',
    hasIndex(CustomerFollowUp.schema, 'customer_follow_up_branch_due') &&
      hasIndex(CustomerFollowUp.schema, 'customer_follow_up_assignee_due')
  );

  const ownerRequest = { adminRole: 'owner', adminBranches: [], query: {} };
  ok(
    'owner conserva acceso global sin un filtro artificial por sede',
    buildCustomerBranchAccess(ownerRequest).mode === 'all'
  );

  const sellerRequest = {
    adminRole: 'seller',
    adminDefaultBranch: branchA,
    adminBranches: [
      { branch: branchA },
      { branch: branchB },
    ],
    query: {},
  };
  const sellerAccess = buildScopedCustomerFilter(sellerRequest, {
    deletedAt: null,
  });
  const branchClause = sellerAccess.filter.$and?.[0]?.$or || [];
  ok(
    'un vendedor queda limitado en backend a sus sedes asignadas',
    sellerAccess.mode === 'assigned' &&
      sellerAccess.branchIds.length === 2 &&
      branchClause.some((item) => item.branchIds?.$in?.length === 2)
  );
  ok(
    'una sede ajena produce rechazo explícito y no un listado global',
    buildCustomerBranchAccess(
      { ...sellerRequest, query: { branchId: String(branchC) } }
    ).error === 'BRANCH_FORBIDDEN'
  );
  ok(
    'las escrituras sin sede explícita usan la sede predeterminada autorizada',
    resolveCustomerWriteBranch(sellerRequest).branchId === String(branchA)
  );
  const followScope = buildScopedFollowUpFilter(sellerRequest, {
    deletedAt: null,
  });
  ok(
    'los seguimientos también se filtran por sede en la consulta Mongo',
    followScope.filter.branch?.$in?.length === 2
  );

  const customersRoute = read('backend/routes/adminCustomers.js');
  const followUpsRoute = read('backend/routes/adminCustomerFollowUps.js');
  const posService = read('backend/services/adminPosService.js');
  ok(
    'listado, detalle, edición y resumen reutilizan el alcance por sede',
    (customersRoute.match(/buildScopedCustomerFilter/g) || []).length >= 3 &&
      customersRoute.includes(
        'buildCustomersSummary(req, summaryAccess.filter, summaryAccess)'
      )
  );
  ok(
    'el historial de compras reutiliza el filtro de seguridad de Órdenes',
    customersRoute.includes('buildScopedOrderFilter') &&
      customersRoute.includes('loadScopedCustomerStats') &&
      customersRoute.includes('applyScopedPurchaseSegment')
  );
  ok(
    'crear un seguimiento ya no sobrescribe customer.notes',
    !followUpsRoute.includes('customer.notes = payload.note')
  );
  ok(
    'la API devuelve creador, actualizador y responsable de cada seguimiento',
    followUpsRoute.includes('createdByAdmin: serializeAdmin') &&
      followUpsRoute.includes('assignedToAdmin: serializeAdmin') &&
      followUpsRoute.includes("populate('assignedToAdmin'")
  );
  ok(
    'el POS impide seleccionar por ID un cliente fuera de la sede de la venta',
    posService.includes('{ branchIds: branchObjectId }') &&
      posService.includes('{ defaultBranch: branchObjectId }')
  );

  const customerUi = read(
    'frontend/src/admin/customers/AdminCustomersPageTabbed.jsx'
  );
  const customerApi = read('frontend/src/admin/api/adminCustomersApi.js');
  ok(
    'el frontend navega todas las páginas y dejó de fijar los primeros 50 clientes',
    customerUi.includes('Página {page} de {pages}') &&
      customerUi.includes('page: requestedPage') &&
      !customerUi.includes("page: 1, limit: 50")
  );
  ok(
    'la ficha permite editar datos fiscales y muestra el responsable CRM',
    customerUi.includes('Datos fiscales reutilizables') &&
      customerUi.includes('Responsable:') &&
      customerApi.includes('fiscalProfile:')
  );

  const obsoleteFiles = [
    'AdminCustomersPageCRM.jsx',
    'AdminCustomersPageEnhanced.jsx',
    'AdminCustomersPagePro.jsx',
    'CustomerDetailEditableModal.jsx',
  ];
  ok(
    'se eliminan las versiones antiguas y queda una sola pantalla activa',
    obsoleteFiles.every(
      (file) =>
        !fs.existsSync(
          path.join(__dirname, '..', '..', 'frontend', 'src', 'admin', 'customers', file)
        )
    )
  );
  const concurrencyTest = read(
    'backend/scripts/testCustomerIdentityConcurrencyIntegration.js'
  );
  const customersCi = read('.github/workflows/customers-ci.yml');
  ok(
    'CI ejecutará una carrera real de 20 escrituras contra MongoDB 7',
    concurrencyTest.includes('Array.from({ length: 20 }') &&
      concurrencyTest.includes('created.length, 1') &&
      customersCi.includes('test:customer-identity-concurrency') &&
      customersCi.includes('image: mongo:7')
  );

  console.log(`\nEtapa 1 Clientes: ${controls}/${controls} controles superados.`);
}

main().catch((error) => {
  console.error('FAIL Etapa 1 Clientes');
  console.error(error);
  process.exitCode = 1;
});
