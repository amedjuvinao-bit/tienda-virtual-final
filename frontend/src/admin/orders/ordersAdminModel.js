export const ADMIN_BORDER = 'var(--admin-table-border)';

export const STATUS_OPTIONS = [
  { code: 'pending', label: 'Pendiente' },
  { code: 'processing', label: 'Procesando' },
  { code: 'paid', label: 'Pagado (requiere confirmar el pago)', disabled: true },
  { code: 'failed', label: 'Fallido / Rechazado' },
  { code: 'shipped', label: 'Enviado' },
  { code: 'delivered', label: 'Entregado' },
  { code: 'cancelled', label: 'Cancelado' },
];

export const STATUS_FILTERS = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'processing', label: 'Procesando' },
  { key: 'paid', label: 'Pagadas' },
  { key: 'failed', label: 'Fallidas' },
  { key: 'shipped', label: 'Enviadas' },
  { key: 'delivered', label: 'Entregadas' },
  { key: 'cancelled', label: 'Canceladas' },
  { key: 'refunded', label: 'Reembolsadas' },
];

export const toCOP = (value) =>
  Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
  });

export function fmtDate(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('es-CO', {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export function statusBadgeClasses(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') return 'bg-green-100 text-green-700';
  if (normalized === 'processing') return 'bg-amber-100 text-amber-700';
  if (normalized === 'shipped') return 'bg-blue-100 text-blue-700';
  if (normalized === 'delivered') return 'bg-green-100 text-green-700';
  if (normalized === 'failed') return 'bg-red-100 text-red-700';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'bg-red-100 text-red-700';
  if (normalized === 'refunded') return 'bg-purple-100 text-purple-700';
  if (normalized === 'pending' || normalized === 'pendiente') return 'bg-gray-100 text-gray-700';
  return 'bg-gray-200 text-gray-700';
}

export function parseTagsInput(value) {
  return String(value || '')
    .split(',')
    .map((tag) => String(tag || '').toLowerCase().trim().replace(/\s+/g, ' '))
    .filter(Boolean);
}

export function parseDashboardStatusParam(rawStatus) {
  const allowedStatuses = new Set(STATUS_FILTERS.map((item) => item.key));

  return Array.from(
    new Set(
      String(rawStatus || '')
        .split(',')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => allowedStatuses.has(item))
    )
  );
}

export function parseOrdersSort(value) {
  const [field, raw] = String(value || '').split(':');
  const dir = Number(raw) === 1 ? 1 : -1;
  return { field, dir };
}
