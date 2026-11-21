'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Customer = require('../models/Customer');
const CustomerAuditEvent = require('../models/CustomerAuditEvent');
const {
  buildAuditChanges,
  calculateEventHash,
  maskDocument,
  maskEmail,
  maskPhone,
  protectCustomerData,
  serializeAuditEvent,
  verifyCustomerAuditChain,
} = require('../services/customerPrivacyService');
const { buildIndexPlan } = require('../services/customerIntegrityMigrationService');
const {
  findAdminRoutePermission,
  getUnknownPermissionRoutes,
} = require('../security/adminRoutePermissionMap');
const adminAccessGate = require('../middleware/adminAccessGate');
const { buildCustomerOrdersFilter } = require('../services/customerOrderIdentityFilter');
const { preserveLegacyCustomerOrderLinks } = require('../services/customerOrderLinkService');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

async function testLegacyCustomerOrderLinks() {
  const customer = {
    _id: '64c000000000000000000001',
    email: 'cliente@example.com',
    documentType: 'CC',
    documentNumber: '123456789',
  };
  const session = {};
  const orderFields = { email: 'cliente@example.com' };
  const orders = [
    { _id: 'correo', customer: { ...orderFields, name: 'Nombre de compra' } },
    { _id: 'facturacion', customer: null, billing: orderFields },
    { _id: 'documento-en-conflicto', customer: { ...orderFields, id: '987654321' } },
    { _id: 'otra-ficha', customer: orderFields, billing: { phone: '3001234567' } },
    { _id: 'sin-identidad', customer: { name: 'Nombre de compra' } },
    { _id: 'demo', customer: orderFields, tags: ['demo'] },
  ];
  const writes = [];
  let closed = 0;
  let allowUpdate = true;
  const OrderModel = {
    find(filter) {
      assert.deepEqual(filter, {
        $and: [buildCustomerOrdersFilter(customer), { 'customer.customerId': null }],
      });
      return {
        select() { return this; },
        session(activeSession) {
          assert.equal(activeSession, session);
          return this;
        },
        lean() { return this; },
        cursor() {
          return {
            async *[Symbol.asyncIterator]() { yield* orders; },
            async close() { closed += 1; },
          };
        },
      };
    },
    async updateOne(filter, update, options) {
      assert.deepEqual(filter.$and[1], { 'customer.customerId': null });
      assert.deepEqual(options, { session, timestamps: false });
      if (!allowUpdate) return { matchedCount: 0 };
      writes.push([filter._id, update]);
      const order = orders.find(({ _id }) => _id === filter._id);
      order.customer = { ...order.customer, customerId: customer._id };
      return { matchedCount: 1 };
    },
  };
  const CustomerModel = {
    findOne(filter) {
      return {
        async session(activeSession) {
          assert.equal(activeSession, session);
          assert.equal(String(filter._id.$ne), customer._id);
          return filter.normalizedPhone === '+573001234567'
            ? { _id: '64c000000000000000000002' }
            : null;
        },
      };
    },
  };
  const req = { adminRole: 'owner', query: { branchId: '64c000000000000000000003' } };
  const options = { session, OrderModel, CustomerModel };
  await preserveLegacyCustomerOrderLinks(req, customer, options);
  assert.deepEqual(writes, [
    ['correo', { $set: { 'customer.customerId': customer._id } }],
    ['facturacion', { $set: { customer: { customerId: customer._id } } }],
  ]);
  assert.equal(orders[0].customer.name, 'Nombre de compra');
  const anonymizedFilter = buildCustomerOrdersFilter({ _id: customer._id });
  assert.deepEqual(anonymizedFilter.$or, [{ 'customer.customerId': customer._id }]);
  assert.equal(orders[0].customer.customerId, anonymizedFilter.$or[0]['customer.customerId']);
  ok('conserva pedidos antiguos verificados por ID sin tocar sus datos comerciales');

  delete orders[0].customer.customerId;
  allowUpdate = false;
  await assert.rejects(
    preserveLegacyCustomerOrderLinks(req, customer, options),
    { code: 'CUSTOMER_LEGACY_ORDER_LINK_CHANGED' }
  );
  assert.equal(closed, 2);
  ok('aborta la vinculación cuando una orden cambió y cierra el cursor');
}

function testAuditNamePrivacy() {
  const originalName = 'Cliente de prueba';
  const anonymousName = 'Cliente anonimizado 000001';
  const nameFields = ['fullName', 'displayName', 'firstName', 'lastName', 'name'];
  const before = Object.fromEntries(nameFields.map((field) => [field, originalName]));
  const after = Object.fromEntries(nameFields.map((field) => [field, anonymousName]));
  const changes = buildAuditChanges(before, after, nameFields);
  ok(
    'la auditoría protege las vistas de nombres y conserva las huellas de cambio',
    changes.length === nameFields.length &&
      changes.every((change) =>
        change.beforePreview === '[DATO PROTEGIDO]' &&
        change.afterPreview === '[DATO PROTEGIDO]' &&
        change.beforeHash.length === 64 &&
        change.afterHash.length === 64 &&
        change.beforeHash !== change.afterHash
      )
  );

  const legacy = {
    customer: '64c000000000000000000001',
    customerCode: 'CLI-AUDIT',
    eventType: 'created',
    action: 'Cliente creado',
    actorUsername: 'owner',
    changes: [
      { ...changes[0], beforePreview: '', afterPreview: originalName },
      {
        path: 'crmStage',
        beforePreview: '',
        afterPreview: 'active',
      },
    ],
    previousHash: '',
    createdAt: new Date('2026-08-31T10:00:00.000Z'),
  };
  legacy.eventHash = calculateEventHash(legacy);
  const following = {
    ...legacy,
    eventType: 'anonymized',
    action: 'Cliente anonimizado',
    changes: [changes[0]],
    previousHash: legacy.eventHash,
    createdAt: new Date('2026-08-31T11:00:00.000Z'),
  };
  following.eventHash = calculateEventHash(following);
  const serialized = serializeAuditEvent(legacy);
  assert.equal(legacy.changes[0].afterPreview, originalName);
  assert.equal(serialized.changes[0].beforePreview, '');
  assert.equal(serialized.changes[0].afterPreview, '[DATO PROTEGIDO]');
  assert.equal(serialized.changes[0].afterHash, legacy.changes[0].afterHash);
  assert.deepEqual(serialized.changes[1], legacy.changes[1]);
  assert.equal(serialized.eventHash, legacy.eventHash);
  ok(
    'la consulta protege nombres históricos y permite verificar la cadena original',
    !JSON.stringify(serialized).includes(originalName) &&
      verifyCustomerAuditChain([legacy, following])
  );
}

async function main() {
  testAuditNamePrivacy();
  const customer = new Customer({
    fullName: 'Cliente Privacidad',
    acceptsMarketing: true,
  });
  await customer.validate();
  ok(
    'la ficha incluye estado de privacidad, conservación y anonimización',
    Customer.schema.path('privacyStatus') &&
      Customer.schema.path('retentionHoldUntil') &&
      Customer.schema.path('anonymizedAt') &&
      customer.privacyStatus === 'active'
  );
  ok(
    'el consentimiento comercial conserva estado, origen, evidencia e historial',
    Customer.schema.path('marketingConsent') &&
      customer.marketingConsent.status === 'granted' &&
      customer.acceptsMarketing === true
  );

  ok(
    'correo, celular y documento se enmascaran sin revelar el valor completo',
    maskEmail('cliente@example.com') === 'cl***@example.com' &&
      maskPhone('+57 300 123 4567').endsWith('4567') &&
      !maskPhone('+57 300 123 4567').includes('300123') &&
      maskDocument('AB-123456').endsWith('3456')
  );
  const protectedCustomer = protectCustomerData({
    email: 'cliente@example.com',
    phone: '3001234567',
    documentNumber: '123456789',
    address: 'Calle privada 1',
    notes: 'Dato interno',
    marketingConsent: { proofReference: 'archivo-secreto', history: [] },
  });
  ok(
    'la serialización protegida cubre contacto, dirección, notas y evidencia',
    protectedCustomer.email !== 'cliente@example.com' &&
      protectedCustomer.address === '[DIRECCIÓN PROTEGIDA]' &&
      protectedCustomer.notes === '[NOTA INTERNA PROTEGIDA]' &&
      protectedCustomer.marketingConsent.proofReference === '[EVIDENCIA PROTEGIDA]'
  );

  const changes = buildAuditChanges(
    { email: 'antes@example.com', crmStage: 'new' },
    { email: 'despues@example.com', crmStage: 'active' },
    ['email', 'crmStage']
  );
  ok(
    'la auditoría guarda huellas y vistas enmascaradas, no PII cruda',
    changes.length === 2 &&
      changes.every((change) => change.beforeHash.length === 64 && change.afterHash.length === 64) &&
      !JSON.stringify(changes).includes('antes@example.com') &&
      !JSON.stringify(changes).includes('despues@example.com')
  );

  const first = {
    customer: '64c000000000000000000001',
    customerCode: 'CLI-AUDIT',
    eventType: 'created',
    action: 'Cliente creado',
    actorAdmin: '',
    actorUsername: 'owner',
    actorRole: 'owner',
    branch: '',
    requestId: 'req-1',
    ipHash: '',
    changes: [],
    metadata: {},
    previousHash: '',
    createdAt: new Date('2026-08-31T10:00:00.000Z'),
  };
  first.eventHash = calculateEventHash(first);
  const second = {
    ...first,
    eventType: 'updated',
    action: 'Cliente actualizado',
    requestId: 'req-2',
    previousHash: first.eventHash,
    createdAt: new Date('2026-08-31T11:00:00.000Z'),
  };
  second.eventHash = calculateEventHash(second);
  ok(
    'la cadena criptográfica valida eventos ordenados y enlazados',
    verifyCustomerAuditChain([first, second]) === true
  );
  ok(
    'la cadena detecta alteraciones posteriores',
    verifyCustomerAuditChain([{ ...first, action: 'Alterado' }, second]) === false
  );
  ok(
    'el modelo de auditoría declara prohibidas actualizaciones y eliminaciones',
    read('backend/models/CustomerAuditEvent.js').includes('CUSTOMER_AUDIT_IMMUTABLE') &&
      read('backend/models/CustomerAuditEvent.js').includes("'findOneAndUpdate'") &&
      read('backend/models/CustomerAuditEvent.js').includes("'deleteMany'")
  );
  ok(
    'la auditoría tiene índices por cliente, actor, evento y cadena única',
    CustomerAuditEvent.schema.indexes().some(([, options]) => options.name === 'customer_audit_customer_recent') &&
      CustomerAuditEvent.schema.indexes().some(([, options]) => options.name === 'customer_audit_chain_unique' && options.unique)
  );
  ok(
    'la migración de Clientes incluye los índices físicos de auditoría',
    buildIndexPlan().filter((item) => item.collection === 'customerauditevents').length >= 5
  );

  const permissionCatalog = read('backend/security/adminPermissionCatalog.js');
  ok(
    'los datos sensibles, consentimiento, auditoría y anonimización tienen permisos separados',
    ['customers:sensitive', 'customers:consent', 'customers:audit', 'customers:anonymize']
      .every((permission) => permissionCatalog.includes(`'${permission}'`))
  );
  ok(
    'todas las nuevas reglas usan permisos conocidos por el control global',
    getUnknownPermissionRoutes().length === 0
  );
  const exportRule = findAdminRoutePermission(
    'GET',
    '/api/admin/customers/64c000000000000000000001/export'
  );
  ok(
    'exportar exige simultáneamente exportación y acceso sensible',
    exportRule?.requiredPermissions?.includes('customers:export') &&
      exportRule.requiredPermissions.includes('customers:sensitive')
  );
  const anonymizeRule = findAdminRoutePermission(
    'POST',
    '/api/admin/customers/64c000000000000000001/anonymize'
  );
  ok(
    'anonimizar queda marcado como operación auditada y peligrosa',
    anonymizeRule?.permission === 'customers:anonymize' &&
      anonymizeRule?.requiredPermissions?.includes('customers:sensitive') &&
      anonymizeRule.audit === true &&
      anonymizeRule.danger === true
  );
  const sanitizedSnapshot = adminAccessGate.sanitizeValue({
    email: 'cliente@example.com',
    phone: '3001234567',
    documentNumber: '123456789',
    address: 'Calle privada 1',
    note: 'Contenido del seguimiento',
    proofReference: 'checkout-123',
    q: 'cliente@example.com',
    crmStage: 'active',
  });
  ok(
    'el log administrativo global redacta PII y conserva contexto no sensible',
    sanitizedSnapshot.email === '[REDACTED]' &&
      sanitizedSnapshot.phone === '[REDACTED]' &&
      sanitizedSnapshot.documentNumber === '[REDACTED]' &&
      sanitizedSnapshot.address === '[REDACTED]' &&
      sanitizedSnapshot.note === '[REDACTED]' &&
      sanitizedSnapshot.proofReference === '[REDACTED]' &&
      sanitizedSnapshot.q === '[REDACTED]' &&
      sanitizedSnapshot.crmStage === 'active'
  );

  const routes = read('backend/routes/adminCustomers.js');
  ok(
    'listado y detalle aplican enmascaramiento según permiso efectivo',
    routes.includes('canViewSensitiveCustomerData') &&
      routes.includes('serializeProtectedCustomer') &&
      routes.includes('protectedCustomerUpdateBody')
  );
  ok(
    'usuarios sin permiso sensible no pueden buscar por documento, correo o celular',
    routes.includes('options.canViewSensitive && normalizedPhone') &&
      routes.includes('options.canViewSensitive && normalizedEmail') &&
      routes.includes('options.canViewSensitive && normalizedDocument')
  );
  ok(
    'las vistas y modificaciones quedan registradas en el historial del cliente',
    routes.includes("eventType: 'viewed'") &&
      routes.includes("eventType: 'created'") &&
      routes.includes("eventType: 'updated'")
  );
  ok(
    'el consentimiento exige evidencia al ser otorgado',
    routes.includes('CUSTOMER_CONSENT_PROOF_REQUIRED') &&
      routes.includes("eventType: 'consent_changed'")
  );
  ok(
    'la exportación produce expediente acotado y deja evento de auditoría',
    routes.includes("eventType: 'exported'") &&
      routes.includes('mayBeTruncated') &&
      routes.includes('Content-Disposition')
  );
  ok(
    'la anonimización exige frase exacta y elegibilidad por conservación',
    routes.includes('CUSTOMER_ANONYMIZATION_CONFIRMATION_REQUIRED') &&
      routes.includes('CUSTOMER_ANONYMIZATION_RETENTION_HOLD') &&
      routes.includes('eligibleForAnonymization')
  );
  ok(
    'la anonimización conserva órdenes relacionadas y retira seguimientos con PII',
    routes.includes('relatedOrdersRetained: true') &&
      routes.includes("note: '[ANONIMIZADO]'")
  );

  await testLegacyCustomerOrderLinks();

  const followUps = read('backend/routes/adminCustomerFollowUps.js');
  ok(
    'crear, actualizar y eliminar seguimientos genera eventos del cliente',
    [
      'follow_up_created',
      'follow_up_updated',
      'follow_up_result_recorded',
      'follow_up_deleted',
    ]
      .every((eventType) => followUps.includes(`eventType: '${eventType}'`))
  );
  ok(
    'la bandeja CRM también enmascara contacto y restringe búsquedas sensibles',
    followUps.includes('protectCustomerData') &&
      followUps.includes('canViewSensitive') &&
      followUps.includes('resolveQueueCustomerIds')
  );
  ok(
    'listado, bandeja e historial de seguimiento dejan rastro de consulta',
    findAdminRoutePermission('GET', '/api/admin/customers')?.audit === true &&
      findAdminRoutePermission('GET', '/api/admin/customer-follow-ups/queue')?.audit === true &&
      findAdminRoutePermission(
        'POST',
        '/api/admin/customer-follow-ups/64c000000000000000000001/64c000000000000000000002/result'
      )?.audit === true &&
      findAdminRoutePermission(
        'GET',
        '/api/admin/customer-follow-ups/64c000000000000000000001'
      )?.audit === true &&
      followUps.includes('Historial de seguimiento consultado')
  );

  const privacyPanel = read('frontend/src/admin/customers/CustomerPrivacyPanel.jsx');
  ok(
    'el panel integra consentimiento, exportación, conservación y auditoría',
    privacyPanel.includes('updateAdminCustomerConsent') &&
      privacyPanel.includes('exportAdminCustomerData') &&
      privacyPanel.includes('Historial inmutable') &&
      privacyPanel.includes('Anonimización controlada')
  );

  console.log(`\nEtapa 4 Clientes privacidad: ${controls}/${controls} controles superados.`);
}

main().catch((error) => {
  console.error('\nFALLO Etapa 4 Clientes privacidad');
  console.error(error);
  process.exitCode = 1;
});
