import api from '../../lib/api';
import { canAccessAdminPath, hasAdminPermission } from '../security/adminPermissions';

export const ADMIN_ALERTS_CHANGED = 'rb:admin-alerts-changed';
const casePath = '/admin/ordenes/reclamos';
const orderPath = '/admin/ordenes';
const inventoryPath = '/admin/inventario?alertas=1';
const securityPath = '/admin/configuracion/seguridad?alertas=1';

const request = (path, params, signal) =>
  api.get(path, { params, signal, skipAdminRouteLoader: true }).then(({ data }) => data);

const badge = (id, title, count, href) =>
  Number(count) > 0 ? [{ id, title, count: Number(count), href }] : [];

const records = (rows, label, reference, getHref) =>
  (Array.isArray(rows) ? rows : []).filter((row) => row.id || row._id).map((row) => ({
    id: `${label}-${row.id || row._id}`,
    title: label,
    reference: row[reference] || row.orderNumber || '',
    href: getHref(row),
  }));

const orderLink = (orderId, tab, recordId) =>
  `${orderPath}?${new URLSearchParams({ openOrder: orderId, pestana: tab, registro: recordId })}`;

const sources = [
  {
    id: 'pqr',
    allowed: (user) => canAccessAdminPath(user, casePath),
    load: (signal) => request('/api/consumer/admin/cases/notifications', {}, signal),
    alerts: (data) => {
      const cases = records(data.cases, 'PQR nueva', 'reference', (row) =>
        `${casePath}?radicado=${encodeURIComponent(row.id)}`);
      const remaining = Number(data.count) - cases.length;
      return [...cases, ...badge('pqr-more', 'Más PQR recibidas', remaining, casePath)];
    },
  },
  {
    id: 'orders',
    permission: 'orders:view',
    load: (signal) => request('/api/orders/admin/operational-alerts', {}, signal),
    alerts: ({ operational = {} }) => [
      ...badge('orders-payment', 'Pedidos por confirmar pago', operational.awaitingPayment, `${orderPath}?vista=awaiting_payment`),
      ...badge('orders-prepare', 'Pedidos por preparar', operational.prepare, `${orderPath}?vista=prepare`),
      ...badge('orders-dispatch', 'Pedidos listos para despacho', operational.dispatch, `${orderPath}?vista=dispatch`),
      ...badge('orders-attention', 'Pedidos con fallos, incidencias o riesgo de entrega', operational.attention, `${orderPath}?vista=attention`),
    ],
  },
  {
    id: 'post-sale',
    permission: 'orders:view',
    load: (signal) => request('/api/orders/admin/post-sale-alerts', {}, signal),
    alerts: (data) => [
      ...records(data.returns, 'Devolución por atender', 'returnNumber', (row) => orderLink(row.order, 'returns', row._id)),
      ...records(data.refunds, 'Reembolso por revisar', 'refundNumber', (row) => orderLink(row.order, 'payment', row._id)),
    ],
  },
  {
    id: 'catalog',
    permission: 'products:view',
    load: (signal) => request('/api/products/admin/catalog-alerts', {}, signal),
    alerts: (data) => [
      ...badge('catalog-category', 'Productos sin categoría', data.category, '/admin/productos?faltante=category'),
      ...badge('catalog-image', 'Productos sin imagen', data.image, '/admin/productos?faltante=image'),
    ],
  },
  {
    id: 'inventory',
    permission: 'inventory:view',
    load: (signal) => request('/api/admin/inventory/alerts', { summary: 1 }, signal),
    alerts: ({ data }) => {
      const summary = data?.summary || {};
      return [
        ...badge('stock-low', 'Variantes con inventario bajo', summary.lowStock, inventoryPath),
        ...badge('stock-out', 'Variantes sin existencias', summary.outOfStock, inventoryPath),
        ...badge('stock-reservations', 'Reservas vencidas', summary.expiredReservations, inventoryPath),
        ...badge('stock-transfers', 'Traslados de inventario pendientes', summary.pendingTransfers, `${inventoryPath}&vista=traceability`),
      ];
    },
  },
  {
    id: 'billing',
    permission: 'billing:view',
    load: (signal) => request('/api/admin/billing/summary', {}, signal),
    alerts: ({ data }) => [
      ...badge('billing-errors', 'Documentos de facturación con errores', data?.errors, '/admin/facturacion/resumen'),
      ...badge('billing-pending', 'Pedidos pendientes de facturar', data?.pending, '/admin/facturacion/ordenes'),
    ],
  },
  {
    id: 'cash',
    permission: 'pos:view',
    load: (signal) => request('/api/admin/cash-sessions/notifications', {}, signal),
    alerts: (data) => records(data.sessions, 'Caja por revisar', 'sessionCode', (row) =>
      `/admin/caja?${new URLSearchParams({ sede: row.branch, caja: row.cashRegisterCode })}`),
  },
  {
    id: 'finance',
    permission: 'finance:expenses:approve',
    allowed: (user) => hasAdminPermission(user, 'finance:view'),
    load: (signal) => request('/api/admin/finance/expenses', { status: 'pending', range: 'this_month', limit: 1 }, signal),
    alerts: ({ data }) => badge('finance-expenses', 'Gastos de este mes pendientes de aprobación', data?.total, '/admin/finanzas?gastos=pendientes'),
  },
  {
    id: 'customers',
    permission: 'customers:view',
    load: (signal) => request('/api/admin/customer-follow-ups/queue', { summary: 1 }, signal),
    alerts: ({ summary = {} }) => [
      ...badge('customers-overdue', 'Seguimientos a clientes vencidos', summary.overdue, '/admin/clientes?seguimiento=overdue'),
      ...badge('customers-today', 'Seguimientos a clientes para hoy', summary.today, '/admin/clientes?seguimiento=today'),
    ],
  },
  {
    id: 'security',
    load: (signal) => request('/api/admin/auth/security-center', { summary: 1 }, signal),
    alerts: ({ security }) => badge('security-open', 'Alertas de seguridad por revisar', security?.summary?.pendingAlerts, securityPath),
  },
];

export function getAdminAlertSources(user) {
  if (!user) return [];
  return sources.filter((source) =>
    (!source.permission || hasAdminPermission(user, source.permission)) &&
    (!source.allowed || source.allowed(user)));
}
