export const REQUIRED_STATUS_FILTERS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'processing', label: 'Procesando' },
  { key: 'paid', label: 'Pagadas' },
  { key: 'failed', label: 'Fallidas' },
  { key: 'shipped', label: 'Enviadas' },
  { key: 'delivered', label: 'Entregadas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'refunded', label: 'Reembolsadas' },
];

export function mergeStatusFilters(filters) {
  const map = new Map();

  for (const item of Array.isArray(filters) ? filters : []) {
    const key = String(item?.key || '').trim();
    const label = String(item?.label || '').trim();
    if (key) map.set(key, { key, label: label || key });
  }

  for (const item of REQUIRED_STATUS_FILTERS) {
    if (!map.has(item.key)) map.set(item.key, item);
  }

  const preferredOrder = REQUIRED_STATUS_FILTERS.map((item) => item.key);
  return Array.from(map.values()).sort((first, second) => {
    const firstIndex = preferredOrder.indexOf(first.key);
    const secondIndex = preferredOrder.indexOf(second.key);
    if (firstIndex === -1 && secondIndex === -1) return 0;
    if (firstIndex === -1) return 1;
    if (secondIndex === -1) return -1;
    return firstIndex - secondIndex;
  });
}

function formatNumber(value) {
  return new Intl.NumberFormat('es-CO').format(Number(value || 0));
}

function formatMoney(value) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export function buildOrdersFilterMetrics(financialSummary, total) {
  const summary = financialSummary || {};
  const withoutInvoice = summary.withoutInvoice ||
    summary.withoutInvoiceOrders ||
    summary.ordersWithoutInvoice ||
    summary.noInvoiceOrders ||
    0;
  const validatedInvoices = summary.validatedInvoices ||
    summary.validatedInvoiceOrders ||
    summary.dianValidatedOrders ||
    summary.validatedDianOrders ||
    0;

  return [
    {
      key: 'total',
      label: 'Total órdenes',
      value: formatNumber(summary.totalOrders || total || 0),
      helper: 'Órdenes registradas',
      accent: false,
    },
    {
      key: 'sales',
      label: 'Ventas totales',
      value: formatMoney(summary.totalSales),
      helper: 'Ingresos confirmados',
      accent: true,
    },
    {
      key: 'ticket',
      label: 'Ticket promedio',
      value: formatMoney(summary.averageTicket),
      helper: 'Promedio por orden',
      accent: false,
    },
    {
      key: 'pending',
      label: 'Pendientes',
      value: formatNumber(summary.pendingOrders),
      helper: 'Órdenes por procesar',
      accent: false,
    },
    {
      key: 'noinv',
      label: 'Sin factura',
      value: formatNumber(withoutInvoice),
      helper: 'Por facturar',
      accent: false,
    },
    {
      key: 'dian',
      label: 'Validadas DIAN',
      value: formatNumber(validatedInvoices),
      helper: 'Documentos validados',
      accent: false,
    },
  ];
}

export function getBranchValue(branch) {
  return String(branch?._id || branch?.id || '');
}

export function getBranchLabel(branch) {
  const name = String(branch?.name || '').trim() || 'Sede sin nombre';
  const code = String(branch?.code || '').trim().toUpperCase();
  return code ? `${name} (${code})` : name;
}
