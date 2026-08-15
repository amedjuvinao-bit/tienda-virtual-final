/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Customer = require('../models/Customer');

const {
  applyCustomerResolutionToOrderData,
  applyCustomerStatsForOrder,
  buildCustomerPayloadFromOrder,
  findCustomerMatch,
  hasCustomerIdentity,
  isConfirmedOrder,
  isDemoOrder,
} = require('../services/customerOrderLinkService');
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

  const orderModel = read('backend/models/Order.js');
  const ordersRoute = read('backend/routes/orders.js');
  const posService = read('backend/services/adminPosService.js');
  const adminUi = read('frontend/src/admin/OrdersAdmin.jsx');
  const customerUi = read('frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx');
  const reconciliationScript = read('backend/scripts/reconcileOrderCustomers.js');
  const liveLifecycleScript = read('backend/scripts/testRealOrderCustomerLifecycle.js');
  const backendPackage = read('backend/package.json');
  const ciWorkflow = read('.github/workflows/products-ci.yml');
  ok('el modelo persiste customerId como referencia a Customer', orderModel.includes("ref: 'Customer'") && orderModel.includes("'customer.customerId'"));
  ok('checkout crea o vincula el cliente dentro de la transacción', ordersRoute.includes('resolveCustomerForOrder(base') && ordersRoute.includes('applyCustomerResolutionToOrderData'));
  ok('POS reutiliza identidades existentes antes de crear cliente rápido', posService.includes('findCustomerMatch(quickCustomerPayload'));
  ok('la edición administrativa distingue orden y ficha maestra', ordersRoute.includes('syncCustomerMasterFromOrder') && ordersRoute.includes('syncCustomer'));
  ok('la interfaz respeta el permiso sensible de datos del cliente', adminUi.includes("can('orders:customer_data')"));
  ok('la interfaz ofrece los dos alcances sin exponer mensajes técnicos', customerUi.includes('Solo esta orden') && customerUi.includes('Esta orden y ficha del cliente') && !customerUi.includes('podrás corregir sus datos para probar WhatsApp'));
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
