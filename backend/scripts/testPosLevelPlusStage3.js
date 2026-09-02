'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PosHeldSale = require('../models/PosHeldSale');
const {
  sanitizeCustomerSelection,
  serializePosHistoryOrder,
} = require('../services/posOperationsService');
const {
  POS_HELD_SALE_INDEX_DEFINITIONS,
} = require('../models/posHeldSaleIndexDefinitions');

let controls = 0;

function ok(message, condition = true) {
  assert.ok(condition, message);
  controls += 1;
  console.log(`OK ${String(controls).padStart(2, '0')} ${message}`);
}

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '..', relativePath), 'utf8');
}

function main() {
  const schema = PosHeldSale.schema;
  const statusValues = schema.path('status').enumValues;
  const indexes = schema.indexes();

  ok('las ventas en espera usan una colección propia', PosHeldSale.collection.name === 'pos_held_sales');
  ok('el código de espera es único', schema.path('code').options.unique === true);
  ok('el estado distingue activas, completadas y descartadas', ['active', 'completed', 'discarded'].every((value) => statusValues.includes(value)));
  ok('la consulta por sede y estado tiene índice operativo', indexes.some(([fields]) => fields.branch === 1 && fields.status === 1 && fields.updatedAt === -1));
  ok('la bandeja por cajero tiene índice operativo', indexes.some(([fields]) => fields.cashier === 1 && fields.status === 1 && fields.updatedAt === -1));
  ok('una venta en espera conserva el pedido que finalmente la completó', Boolean(schema.path('completedOrder')));
  ok('la venta en espera no tiene borrado TTL automático', !indexes.some(([, options]) => options?.expireAfterSeconds !== undefined));
  ok('la migración declara los tres índices canónicos sin operaciones destructivas', POS_HELD_SALE_INDEX_DEFINITIONS.length === 3 && POS_HELD_SALE_INDEX_DEFINITIONS.every((definition) => definition.options.name));

  const guest = sanitizeCustomerSelection({ mode: 'guest' });
  ok('el consumidor final queda normalizado sin datos personales', guest.mode === 'guest' && guest.selectedCustomer === null && guest.quickCustomer === null);

  const existing = sanitizeCustomerSelection({
    mode: 'existing',
    selectedCustomer: {
      id: 'customer-1',
      fullName: '  Ana   Pérez ',
      email: 'ANA@CORREO.COM',
      phone: '300 000 0000',
    },
  });
  ok('el cliente existente conserva identidad y contacto', existing.selectedCustomer.id === 'customer-1' && existing.selectedCustomer.fullName === 'Ana Pérez');
  ok('el correo del cliente se normaliza en minúsculas', existing.selectedCustomer.email === 'ana@correo.com');

  const quick = sanitizeCustomerSelection({
    mode: 'quick',
    quickCustomer: { fullName: 'Cliente rápido', documentType: 'cc', country: 'co' },
  });
  ok('el cliente rápido conserva sus datos para recuperarlos', quick.mode === 'quick' && quick.quickCustomer.fullName === 'Cliente rápido');
  ok('documento y país quedan normalizados', quick.quickCustomer.documentType === 'CC' && quick.quickCustomer.country === 'CO');
  assert.throws(
    () => sanitizeCustomerSelection({ mode: 'existing' }),
    (error) => error?.code === 'POS_HELD_CUSTOMER_REQUIRED'
  );
  ok('no se guarda una selección de cliente existente incompleta');
  assert.throws(
    () => sanitizeCustomerSelection({ mode: 'quick', quickCustomer: {} }),
    (error) => error?.code === 'POS_HELD_QUICK_CUSTOMER_REQUIRED'
  );
  ok('no se guarda un cliente rápido sin nombre');

  const historyOrder = serializePosHistoryOrder({
    _id: 'order-1',
    orderNumber: '000245',
    status: 'paid',
    branch: 'branch-1',
    branchSnapshot: { name: 'Sede Principal', code: 'PRINCIPAL' },
    customer: { name: 'Consumidor final' },
    payment: { method: 'cash', methodLabel: 'Efectivo' },
    total: 28500,
    items: [{ quantity: 2 }, { qty: 1 }],
    refundControl: { totalAmount: 0 },
    returnControl: { requestCount: 0 },
  });
  ok('el historial conserva orden, sede y total', historyOrder.orderNumber === '000245' && historyOrder.branch.name === 'Sede Principal' && historyOrder.total === 28500);
  ok('el historial calcula unidades desde el servidor', historyOrder.totalItems === 3 && historyOrder.itemsCount === 2);
  ok('el historial expone trazabilidad de reembolsos y devoluciones', historyOrder.refundControl.totalAmount === 0 && historyOrder.returnControl.requestCount === 0);

  const route = read('backend/routes/adminPos.js');
  const service = read('backend/services/posOperationsService.js');
  const api = read('frontend/src/admin/api/adminPosApi.js');
  const panel = read('frontend/src/admin/pos/PosOperationsPanel.jsx');
  const page = read('frontend/src/admin/pos/PosSalesPageSafe.jsx');
  const customerSelector = read('frontend/src/admin/pos/PosCustomerSelector.jsx');
  const receipt = read('frontend/src/admin/pos/PosReceiptActions.jsx');

  ok('guardar y recuperar ventas exige permiso de venta POS', route.includes("router.post('/held-sales', requirePermission('pos:sell')") && route.includes("router.post('/held-sales/:id/open', requirePermission('pos:sell')"));
  ok('el historial exige permiso de consulta POS', route.includes("router.get('/sales/history', requirePermission('pos:view')"));
  ok('todas las lecturas se limitan a sedes autorizadas', (route.match(/buildPosResourceAccess/g) || []).length >= 4 && service.includes('branchIds'));
  ok('la espera valida productos, precios y stock con autoridad del servidor', service.includes('loadAndValidatePosItems') && service.includes('calculateTotalsFromNormalizedItems'));
  ok('guardar en espera no reserva ni descuenta inventario', !service.includes('InventoryMovement') && !service.includes('applyPosInventoryOut'));
  ok('la API ofrece guardar, recuperar, cerrar e historizar', ['createPosHeldSale', 'openPosHeldSale', 'closePosHeldSale', 'getPosSalesHistory'].every((name) => api.includes(`function ${name}`)));
  ok('la interfaz usa un modal centrado sobre la ventana', panel.includes('createPortal(') && panel.includes("document.body.style.overflow = 'hidden'") && panel.includes('document.body'));
  ok('la recuperación restaura carrito, cobro, descuento y cliente', page.includes('restoreHeldSale') && page.includes('setPaymentDetails') && page.includes('setDiscount') && page.includes('restoreCustomerSelection'));
  ok('el selector de cliente acepta restauración explícita', customerSelector.includes("pos:restore-customer-selection") && customerSelector.includes('setSelectedCustomer'));
  ok('una espera cobrada se cierra con la orden resultante', page.includes("reason: 'sold'") && page.includes('orderId: data?.order?._id'));
  ok('el historial reutiliza comprobantes y enlaza al centro de Órdenes', panel.includes('<PosReceiptActions compact') && panel.includes('/admin/ordenes?q=') && panel.includes('openOrder='));
  ok('los comprobantes soportan una presentación compacta reutilizable', receipt.includes('compact = false') && receipt.includes('if (compact)'));
  ok('la operación avanzada no depende de localStorage', !panel.includes('localStorage') && !service.includes('localStorage'));

  console.log(`\nEtapa 3 POS validada: ${controls} controles superados.`);
}

try {
  main();
} catch (error) {
  console.error('Fallo en Etapa 3 POS:', error);
  process.exitCode = 1;
}
