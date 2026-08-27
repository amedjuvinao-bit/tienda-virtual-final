/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');
const Order = require('../models/Order');
const { hasExactIndex } = require('./lib/orderSchemaContract');

const customerOrderLinkModule = require('../services/customerOrderLinkService');
const {
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  buildCustomerPayloadFromOrder,
  findCustomerMatch,
  hasCustomerIdentity,
  isConfirmedOrder,
  isDemoOrder,
  resolveCustomerForOrder,
  syncCustomerMasterFromOrder,
} = customerOrderLinkModule;
const customerOrderNormalization = require('../services/customerOrderLink/normalization');
const customerOrderMatching = require('../services/customerOrderLink/matching');
const customerOrderResolution = require('../services/customerOrderLink/resolution');
const customerOrderStats = require('../services/customerOrderLink/stats');
const customerOrderSync = require('../services/customerOrderLink/sync');
const {
  buildCandidateFilter,
  parseOptions,
} = require('./reconcileOrderCustomers');
const {
  REQUIRED_CONFIRMATION,
  assertRealTransactionConfirmation,
  buildIdentity,
  parseOptions: parseLiveLifecycleOptions,
} = require('./testRealOrderCustomerLifecycle');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

async function main() {
  const expectedCustomerOrderLinkExports = [
    'applyCustomerResolutionToOrderData',
    'applyCustomerStatsForOrder',
    'buildCustomerPayloadFromOrder',
    'findCustomerMatch',
    'hasCustomerIdentity',
    'isConfirmedOrder',
    'isDemoOrder',
    'resolveCustomerForOrder',
    'syncCustomerMasterFromOrder',
  ];
  ok(
    'la fachada conserva exactamente sus nueve exports públicos',
    JSON.stringify(Object.keys(customerOrderLinkModule)) ===
      JSON.stringify(expectedCustomerOrderLinkExports)
  );
  ok(
    'la fachada delega sin wrappers a normalización, matching, resolución, stats y sync',
    customerOrderLinkModule.buildCustomerPayloadFromOrder ===
      customerOrderNormalization.buildCustomerPayloadFromOrder &&
      customerOrderLinkModule.findCustomerMatch ===
        customerOrderMatching.findCustomerMatch &&
      customerOrderLinkModule.resolveCustomerForOrder ===
        customerOrderResolution.resolveCustomerForOrder &&
      customerOrderLinkModule.applyCustomerStatsForOrder ===
        customerOrderStats.applyCustomerStatsForOrder &&
      customerOrderLinkModule.syncCustomerMasterFromOrder ===
        customerOrderSync.syncCustomerMasterFromOrder
  );
  const customerOrderLinkFacade = read(
    'backend/services/customerOrderLinkService.js'
  );
  ok(
    'customerOrderLinkService permanece como fachada menor a 100 líneas',
    customerOrderLinkFacade.split(/\r?\n/).length <= 100 &&
      !customerOrderLinkFacade.includes("require('mongoose')")
  );

  const demoOrder = {
    source: 'system',
    tags: ['demo', 'orders-trace'],
    customer: {
      name: 'Prueba logística',
      email: 'orders-trace@example.com',
      phone: '3000000000',
    },
  };
  ok('las órdenes DEMO quedan fuera del CRM', isDemoOrder(demoOrder));

  const webOrder = {
    source: 'online',
    status: 'pending',
    total: 129900,
    customer: {
      name: 'María',
      lastname: 'Pérez',
      email: 'Maria.Perez@Correo.com ',
      phone: '300 123 4567',
      id: '1.234.567.890',
      documentType: 'cc',
      address: 'Calle 1 # 2-3',
      city: 'Bogotá',
    },
  };
  const payload = buildCustomerPayloadFromOrder(webOrder);
  ok('una orden web produce una identidad normalizada', payload.email === 'maria.perez@correo.com');
  ok('el teléfono se normaliza sin perder su número', payload.phone === '3001234567');
  ok('el documento se normaliza para detectar duplicados', payload.normalizedDocument === '1234567890');
  ok('la fuente comercial de una orden online es web', payload.source === 'web');
  ok('correo, celular o documento habilitan el vínculo', hasCustomerIdentity(payload));
  ok('una orden pendiente no incrementa compras confirmadas', !isConfirmedOrder(webOrder));
  ok('un pago confirmado sí incrementa estadísticas', isConfirmedOrder({ ...webOrder, payment: { status: 'paid' } }));

  const queries = [];
  const matchedCustomer = { _id: '64c000000000000000000001' };
  const CustomerMatchModel = {
    findOne(filter) {
      queries.push(filter);
      return Promise.resolve(
        filter.normalizedEmail === payload.normalizedEmail
          ? matchedCustomer
          : null
      );
    },
  };
  const match = await findCustomerMatch(payload, {
    CustomerModel: CustomerMatchModel,
  });
  ok('la búsqueda prioriza documento, correo y celular de forma determinista', queries.length === 2 && match.matchedBy === 'email');

  const linkedCustomerId = '64c000000000000000000009';
  const customerSession = { id: 'customer-link-session' };
  const sessionTrace = { querySessions: [], saves: [] };
  const linkedCustomer = {
    _id: linkedCustomerId,
    fullName: 'María Pérez',
    displayName: 'María Pérez',
    firstName: 'María',
    lastName: 'Pérez',
    phone: payload.phone,
    email: payload.email,
    documentType: payload.documentType,
    documentNumber: payload.documentNumber,
    address: payload.address,
    city: payload.city,
    country: payload.country,
    async save(options) {
      sessionTrace.saves.push(options?.session);
    },
    toOrderSnapshot() {
      return {
        customerId: this._id,
        customerCode: 'CLI-SESSION-001',
        name: this.fullName,
        email: this.email,
        phone: this.phone,
      };
    },
  };
  const SessionCustomerModel = {
    findOne(filter) {
      const value = filter?._id === linkedCustomerId ? linkedCustomer : null;
      return {
        session(session) {
          sessionTrace.querySessions.push(session);
          return Promise.resolve(value);
        },
        then(resolve, reject) {
          return Promise.resolve(value).then(resolve, reject);
        },
      };
    },
    async create() {
      throw new Error('No debe crear una ficha cuando customerId sigue vigente');
    },
  };
  const linkedOrder = {
    ...webOrder,
    customer: {
      ...webOrder.customer,
      customerId: linkedCustomerId,
    },
  };
  const linkedResolution = await resolveCustomerForOrder(linkedOrder, {
    session: customerSession,
    CustomerModel: SessionCustomerModel,
  });
  ok(
    'la resolución conserva la sesión y el snapshot de la ficha vinculada',
    linkedResolution.matchedBy === 'customer_id' &&
      linkedResolution.snapshot.customerCode === 'CLI-SESSION-001' &&
      sessionTrace.querySessions.length >= 2 &&
      sessionTrace.querySessions.every((value) => value === customerSession) &&
      sessionTrace.saves.every((value) => value === customerSession)
  );

  sessionTrace.querySessions.length = 0;
  sessionTrace.saves.length = 0;
  const masterSync = await syncCustomerMasterFromOrder(linkedOrder, {
    session: customerSession,
    CustomerModel: SessionCustomerModel,
  });
  ok(
    'la sincronización maestra conserva sesión, match y snapshot de orden',
    masterSync.matchedBy === 'customer_id' &&
      linkedOrder.customer.customerCode === 'CLI-SESSION-001' &&
      sessionTrace.querySessions.length >= 2 &&
      sessionTrace.querySessions.every((value) => value === customerSession) &&
      sessionTrace.saves.length === 1 &&
      sessionTrace.saves[0] === customerSession
  );
  await assert.rejects(
    () =>
      syncCustomerMasterFromOrder(demoOrder, {
        session: customerSession,
        CustomerModel: SessionCustomerModel,
      }),
    (error) =>
      error?.code === 'DEMO_CUSTOMER_SYNC_NOT_ALLOWED' &&
      error?.statusCode === 422 &&
      error?.details &&
      typeof error.details === 'object'
  );
  ok('la sincronización DEMO conserva su error público exacto');

  const resolvedData = applyCustomerResolutionToOrderData(webOrder, {
    customer: matchedCustomer,
    snapshot: {
      customerId: matchedCustomer._id,
      customerCode: 'CLI-WEB-001',
      name: 'María Pérez',
      email: payload.email,
      phone: payload.phone,
    },
    matchedBy: 'email',
  });
  ok('la orden conserva customerId y código del cliente', resolvedData.customer.customerId === matchedCustomer._id && resolvedData.customer.customerCode === 'CLI-WEB-001');
  ok('el vínculo registra cómo se resolvió sin marcar estadísticas anticipadamente', resolvedData.customerRelationship.matchedBy === 'email' && resolvedData.customerRelationship.statsAppliedAt === null);

  let statsUpdates = 0;
  let orderSaves = 0;
  const confirmedOrder = {
    _id: '64d000000000000000000001',
    orderNumber: 'ORD-CLIENTE-001',
    source: 'online',
    status: 'paid',
    total: 129900,
    customer: { customerId: matchedCustomer._id },
    customerRelationship: { linkedAt: new Date(), statsAppliedAt: null },
    async save() {
      orderSaves += 1;
    },
  };
  const CustomerStatsModel = {
    findOne() {
      return Promise.resolve({
        _id: matchedCustomer._id,
        stats: { firstPurchaseAt: null },
      });
    },
    async updateOne(_filter, update) {
      statsUpdates += 1;
      assert.strictEqual(update.$inc['stats.webOrdersCount'], 1);
    },
  };
  const firstStats = await applyCustomerStatsForOrder(confirmedOrder, {
    CustomerModel: CustomerStatsModel,
  });
  const repeatedStats = await applyCustomerStatsForOrder(confirmedOrder, {
    CustomerModel: CustomerStatsModel,
  });
  ok('las estadísticas se aplican a una compra real confirmada', firstStats.applied && orderSaves === 1);
  ok('la marca idempotente evita contar dos veces la misma compra', !repeatedStats.applied && statsUpdates === 1);

  const dryRun = parseOptions([]);
  const applyRun = parseOptions(['--apply', '--limit=25']);
  ok('la conciliación histórica es vista previa por defecto', dryRun.apply === false);
  ok('la escritura histórica exige --apply y respeta un límite', applyRun.apply === true && applyRun.limit === 25);
  const candidate = buildCandidateFilter(dryRun);
  ok('la conciliación excluye POS para no duplicar estadísticas antiguas', !candidate.filter.source.$in.includes('pos'));

  const changingCustomer = new Customer({
    fullName: 'Cliente Normalización',
    phone: '300 111 2233',
    normalizedPhone: '3000000000',
    email: 'NUEVO@EXAMPLE.COM',
    normalizedEmail: 'anterior@example.com',
    documentType: 'CC',
    documentNumber: '1.234.567',
    normalizedDocument: '9999999',
  });
  await changingCustomer.validate();
  ok(
    'editar una identidad recalcula teléfono, correo y documento normalizados',
    changingCustomer.normalizedPhone === '3001112233' &&
      changingCustomer.normalizedEmail === 'nuevo@example.com' &&
      changingCustomer.normalizedDocument === '1234567'
  );

  const liveOptions = parseLiveLifecycleOptions([
    REQUIRED_CONFIRMATION,
    '--label=contrato',
  ]);
  ok(
    'la prueba persistente exige confirmación explícita',
    liveOptions.confirmRealTransaction === true &&
      assert.throws(
        () => assertRealTransactionConfirmation({}),
        (error) =>
          error?.code === 'REAL_ORDER_CUSTOMER_CONFIRMATION_REQUIRED'
      )
  );
  const liveIdentity = buildIdentity(
    new Date('2026-08-14T12:00:00.000Z'),
    (size) => Buffer.alloc(size, 1)
  );
  ok(
    'la prueba persistente crea una identidad única y un celular corregido distinto',
    liveIdentity.email.includes('+') &&
      liveIdentity.initialPhone !== liveIdentity.correctedPhone
  );

  const ordersRoute = read('backend/routes/orders.js');
  const orderCreationTransactionService = read(
    'backend/services/orderCreationTransactionService.js'
  );
  const orderCustomerDataController = read(
    'backend/controllers/orderCustomerDataController.js'
  );
  const posService = read('backend/services/adminPosService.js');
  const adminUi = read('frontend/src/admin/OrdersAdmin.jsx');
  const adminCapabilities = read(
    'frontend/src/admin/orders/hooks/useOrdersAdminCapabilities.js'
  );
  const customerUiFacade = read(
    'frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx'
  );
  const customerUiEditForm = read(
    'frontend/src/admin/orders/components/orderDetail/OrderCustomerBillingEditForm.jsx'
  );
  const customerUi = `${customerUiFacade}\n${customerUiEditForm}`;
  const reconciliationScript = read('backend/scripts/reconcileOrderCustomers.js');
  const liveLifecycleScript = read('backend/scripts/testRealOrderCustomerLifecycle.js');
  const backendPackage = read('backend/package.json');
  const ciWorkflow = read('.github/workflows/products-ci.yml');
  const customerIdPath = Order.schema.path('customer.customerId');
  ok(
    'el modelo persiste customerId como referencia a Customer',
    customerIdPath?.instance === 'ObjectId' &&
      customerIdPath?.options?.ref === 'Customer' &&
      hasExactIndex(Order.schema, {
        'customer.customerId': 1,
        createdAt: -1,
      })
  );
  ok(
    'checkout crea o vincula el cliente dentro de la transacción',
    ordersRoute.includes('createOrder') &&
      orderCreationTransactionService.includes('resolveCustomerForOrder(base') &&
      orderCreationTransactionService.includes(
        'applyCustomerResolutionToOrderData'
      )
  );
  ok('POS reutiliza identidades existentes antes de crear cliente rápido', posService.includes('findCustomerMatch(quickCustomerPayload'));
  ok(
    'la edición administrativa distingue orden y ficha maestra',
    ordersRoute.includes('updateOrderCustomerData') &&
      orderCustomerDataController.includes('syncCustomerMasterFromOrder') &&
      orderCustomerDataController.includes('syncCustomer')
  );
  ok(
    'la interfaz respeta el permiso sensible de datos del cliente',
    `${adminUi}\n${adminCapabilities}`.includes("can('orders:customer_data')") &&
      adminUi.includes('canEditCustomerData={capabilities.canEditCustomerData}')
  );
  ok(
    'la interfaz ofrece los dos alcances sin exponer mensajes técnicos',
    customerUiFacade.includes("from './OrderCustomerBillingEditForm'") &&
      customerUi.includes('Solo esta orden') &&
      customerUi.includes('Esta orden y ficha del cliente') &&
      !customerUi.includes('podrás corregir sus datos para probar WhatsApp')
  );
  ok('la conciliación histórica no contiene operaciones de borrado', !/deleteOne|deleteMany|findOneAndDelete|dropDatabase/.test(reconciliationScript));
  ok('la prueba real reutiliza las autoridades de cliente, inventario, estado y logística', liveLifecycleScript.includes('resolveCustomerForOrder') && liveLifecycleScript.includes('createInventoryReservation') && liveLifecycleScript.includes('transitionOrderStatus') && liveLifecycleScript.includes('updateOrderShipment'));
  ok('la prueba real conserva evidencia y no contiene operaciones de borrado', liveLifecycleScript.includes('RESULTADO CONSERVADO PARA REVISIÓN VISUAL') && !/deleteOne|deleteMany|findOneAndDelete|dropDatabase/.test(liveLifecycleScript));
  ok('package.json publica el comando persistente con confirmación separada', backendPackage.includes('test:orders-customer-lifecycle-live') && !backendPackage.includes(`testRealOrderCustomerLifecycle.js ${REQUIRED_CONFIRMATION}`));
  ok('CI ejecuta los contratos de conexión en backend y frontend', (ciWorkflow.match(/test:orders-customer-connection/g) || []).length === 2);

  console.log(`\nConexión Órdenes–Clientes: ${controls}/${controls} controles superados.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
