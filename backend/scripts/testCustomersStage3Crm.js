'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const AdminUser = require('../models/AdminUser');
const { deriveMetrics } = require('../services/customerCommercialMetricsService');
const {
  normalizeCustomerFollowUpResult,
} = require('../lib/customers/customerFollowUpResultPolicy');

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
  const customer = new Customer({
    fullName: 'Cliente CRM',
    crmStage: 'LOYAL',
    crmPriority: 'VIP',
  });
  await customer.validate();
  ok(
    'la ficha normaliza etapa y prioridad CRM con valores controlados',
    customer.crmStage === 'loyal' && customer.crmPriority === 'vip'
  );
  ok(
    'Clientes guarda responsable, próxima revisión y último contacto',
    Customer.schema.path('crmOwnerAdmin') &&
      Customer.schema.path('crmNextReviewAt') &&
      Customer.schema.path('crmLastContactAt') &&
      Customer.schema.path('crmLastContactType')
  );

  const urgent = new CustomerFollowUp({
    customer: customer._id,
    note: 'Resolver reclamo prioritario',
    priority: 'urgent',
  });
  await urgent.validate();
  ok(
    'cada seguimiento persiste prioridad y rango estable para ordenar la bandeja',
    urgent.priority === 'urgent' && urgent.priorityRank === 40
  );
  ok(
    'cada seguimiento puede conservar resultado, evidencia, autor e historial',
    CustomerFollowUp.schema.path('outcome') &&
      CustomerFollowUp.schema.path('outcomeNote') &&
      CustomerFollowUp.schema.path('outcomeAt') &&
      CustomerFollowUp.schema.path('outcomeByAdmin') &&
      CustomerFollowUp.schema.path('outcomeHistory')
  );

  const closedResult = normalizeCustomerFollowUpResult({
    outcome: 'payment_confirmed',
    outcomeNote: 'Cliente confirmó el pago por WhatsApp.',
  }, { now: new Date('2026-09-01T12:00:00.000Z') });
  ok(
    'un resultado definitivo cierra solo la gestión CRM',
    closedResult.statusAfter === 'done' &&
      closedResult.continuesPending === false
  );

  const pendingResult = normalizeCustomerFollowUpResult({
    outcome: 'no_answer',
    outcomeNote: 'Se llamó dos veces sin respuesta.',
    nextAction: 'Volver a llamar',
    dueAt: '2026-09-02T15:00:00.000Z',
  }, { now: new Date('2026-09-01T12:00:00.000Z') });
  ok(
    'sin respuesta exige reprogramación y conserva la gestión pendiente',
    pendingResult.statusAfter === 'pending' &&
      pendingResult.nextAction === 'Volver a llamar' &&
      pendingResult.dueAt.toISOString() === '2026-09-02T15:00:00.000Z'
  );
  assert.throws(
    () => normalizeCustomerFollowUpResult({ outcome: 'resolved', outcomeNote: '' }),
    (error) => error.code === 'FOLLOW_UP_RESULT_NOTE_REQUIRED'
  );
  ok('el backend rechaza cierres sin evidencia escrita');
  ok(
    'Clientes tiene índices por etapa, prioridad, responsable y revisión',
    hasIndex(Customer.schema, 'customer_crm_stage_priority_recent') &&
      hasIndex(Customer.schema, 'customer_crm_owner_stage_review')
  );
  ok(
    'Seguimientos tiene índices de cola por sede y responsable',
    hasIndex(CustomerFollowUp.schema, 'customer_follow_up_branch_priority_due') &&
      hasIndex(CustomerFollowUp.schema, 'customer_follow_up_assignee_priority_due')
  );

  const metrics = deriveMetrics({
    ordersCount: 3,
    posOrdersCount: 1,
    webOrdersCount: 2,
    grossSales: 600000,
    refundedAmount: 150000,
    returnOrdersCount: 1,
    firstPurchaseAt: new Date('2026-01-01T00:00:00.000Z'),
    lastPurchaseAt: new Date('2026-03-02T00:00:00.000Z'),
  });
  ok(
    'las métricas separan venta bruta, reembolso y venta neta',
    metrics.grossSales === 600000 &&
      metrics.refundedAmount === 150000 &&
      metrics.netSpent === 450000 &&
      metrics.totalSpent === 450000
  );
  ok(
    'ticket promedio y valor de vida se calculan sobre venta neta',
    metrics.averageTicket === 150000 && metrics.lifetimeValue === 450000
  );
  ok(
    'frecuencia y recurrencia anual se derivan del historial confirmado',
    metrics.purchaseFrequencyDays === 30 && metrics.purchasesPerYear === 12.2
  );
  ok(
    'la tasa de devolución usa órdenes afectadas y no suma importes',
    metrics.returnOrdersCount === 1 && metrics.returnRate === 33.3
  );

  const followUpRoutes = read('backend/routes/adminCustomerFollowUps.js');
  ok(
    'la bandeja CRM se declara antes del detalle genérico del cliente',
    followUpRoutes.indexOf("router.get('/queue'") <
      followUpRoutes.indexOf("router.get('/:customerId'")
  );
  ok(
    'la bandeja filtra seguimientos por el alcance real de sede',
    followUpRoutes.includes('buildScopedFollowUpFilter') &&
      followUpRoutes.includes('requestedBranchId: req.query.branchId')
  );
  ok(
    'la cola permite responsable, prioridad, vencidos, hoy y próximos',
    followUpRoutes.includes("assigned === 'me'") &&
      followUpRoutes.includes("dueScope === 'overdue'") &&
      followUpRoutes.includes('priorityRank: -1')
  );
  ok(
    'completar una gestión actualiza el último contacto de la ficha',
    followUpRoutes.includes('recordCompletedCustomerContact') &&
      followUpRoutes.includes('crmLastContactAt: contactAt')
  );
  ok(
    'cerrar una gestión usa un endpoint de resultado y bloquea el atajo de estado',
    followUpRoutes.includes("'/:customerId/:followUpId/result'") &&
      followUpRoutes.includes('FOLLOW_UP_RESULT_REQUIRED') &&
      followUpRoutes.includes('FOLLOW_UP_MUST_START_PENDING')
  );
  ok(
    'el resultado CRM declara que no modifica pagos, órdenes ni facturas',
    followUpRoutes.includes('paymentChanged: false') &&
      followUpRoutes.includes('orderChanged: false') &&
      followUpRoutes.includes('invoiceChanged: false')
  );

  const customerRoutes = read('backend/routes/adminCustomers.js');
  ok(
    'los segmentos avanzados incluyen VIP, recurrencia, riesgo, inactividad y devolución',
    ['vip', 'recurrent', 'at-risk', 'inactive-customers', 'high-return', 'high-value']
      .every((segment) => customerRoutes.includes(`'${segment}'`))
  );
  ok(
    'carrito abandonado solo se consolida con alcance global',
    customerRoutes.includes('CUSTOMER_ABANDONED_CART_GLOBAL_SCOPE_REQUIRED') &&
      customerRoutes.includes('ABANDONED_WINDOW_MS') &&
      customerRoutes.includes("Cart.distinct('userEmail'")
  );
  ok(
    'los segmentos guardados son personales, persistentes y limitados a veinte',
    AdminUser.schema.path('customerSavedSegments') &&
      read('backend/models/AdminUser.js').includes('CUSTOMER_SAVED_SEGMENT_LIMIT = 20')
  );
  ok(
    'la API implementa listar, crear, editar y eliminar segmentos guardados',
    customerRoutes.includes("router.get('/segments/saved'") &&
      customerRoutes.includes("router.post('/segments/saved'") &&
      customerRoutes.includes("router.put('/segments/saved/:segmentId'") &&
      customerRoutes.includes("router.delete('/segments/saved/:segmentId'")
  );

  const crmWorkspace = read('frontend/src/admin/customers/CustomerCrmWorkspace.jsx');
  ok(
    'el frontend ofrece bandeja general, resumen temporal y actualización operativa',
    crmWorkspace.includes('Bandeja de seguimientos') &&
      crmWorkspace.includes('getAdminCustomerCrmQueue') &&
      crmWorkspace.includes('updateAdminCustomerFollowUp')
  );
  ok(
    'la bandeja reemplaza el cierre ambiguo por un resultado documentado',
    crmWorkspace.includes('Registrar resultado') &&
      crmWorkspace.includes('recordAdminCustomerFollowUpResult') &&
      !crmWorkspace.includes("status: 'done'")
  );
  ok(
    'la bandeja descarta respuestas antiguas cuando cambian los filtros',
    crmWorkspace.includes('requestSequence') &&
      crmWorkspace.includes('requestId !== requestSequence.current')
  );

  const savedSegments = read('frontend/src/admin/customers/CustomerSavedSegments.jsx');
  ok(
    'el panel permite guardar, aplicar y eliminar combinaciones de filtros',
    savedSegments.includes('createAdminCustomerSavedSegment') &&
      savedSegments.includes('onApply?.(segment.filters') &&
      savedSegments.includes('deleteAdminCustomerSavedSegment')
  );

  const customerPage = read('frontend/src/admin/customers/AdminCustomersPageTabbed.jsx');
  ok(
    'la pantalla expone métricas netas, filtros CRM y carritos abandonados',
    customerPage.includes('label="Venta neta"') &&
      customerPage.includes('LTV:') &&
      customerPage.includes('crmStageFilter') &&
      customerPage.includes("key: 'abandoned-cart'")
  );

  console.log(`\nEtapa 3 Clientes CRM: ${controls}/${controls} controles superados.`);
}

main().catch((error) => {
  console.error('\nFALLO Etapa 3 Clientes CRM');
  console.error(error);
  process.exitCode = 1;
});
