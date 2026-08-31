import { normalizeTags } from './orderDetailUtils';

export const STATUS_OPTIONS = [
  { code: 'pending', label: 'Pendiente' },
  { code: 'processing', label: 'Procesando' },
  { code: 'paid', label: 'Pagado' },
  { code: 'failed', label: 'Fallido / Rechazado' },
  { code: 'shipped', label: 'Enviado' },
  { code: 'delivered', label: 'Entregado' },
  { code: 'cancelled', label: 'Cancelado' },
  {
    code: 'refunded',
    label: 'Reembolsado (solo devolución)',
    disabled: true,
  },
];

function normalizeTagValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseOrderTags(value) {
  return String(value || '')
    .split(',')
    .map((tag) => normalizeTagValue(tag))
    .filter(Boolean);
}

export function canSelectOrderStatus(order, status) {
  if (String(status || '').toLowerCase() !== 'paid') return true;
  return String(order?.payment?.status || '').toLowerCase() === 'paid';
}

async function runMutation(handler, args, onRefreshTimeline) {
  try {
    await handler(...args);
    if (onRefreshTimeline) await onRefreshTimeline();
  } catch {
    // El componente principal mantiene la alerta/error si ya existe.
  }
}

export function buildOrderActionToolbarModel({
  archived,
  onPrepareWhatsApp,
  onRefreshTimeline,
  onSaveStatus,
  onSaveTags,
  onSendEmail,
  onToggleArchived,
  onTogglePrinted,
  order,
  printed,
  statusLocal,
  tagsStr,
}) {
  const canUpdateStatus = typeof onSaveStatus === 'function';
  const canUpdateTags = typeof onSaveTags === 'function';
  const canTogglePrinted = typeof onTogglePrinted === 'function';
  const canToggleArchived = typeof onToggleArchived === 'function';
  const canSendEmail = typeof onSendEmail === 'function';
  const canPrepareWhatsApp = typeof onPrepareWhatsApp === 'function';
  const statusBlocked = !canSelectOrderStatus(order, statusLocal);
  const statusOptions = STATUS_OPTIONS.map((option) => ({
    ...option,
    disabled:
      option.disabled === true ||
      !canSelectOrderStatus(order, option.code),
  }));
  const hasQuickActions =
    canTogglePrinted ||
    canToggleArchived ||
    canSendEmail ||
    canPrepareWhatsApp;
  const orderId = order?._id;

  return {
    currentTags: normalizeTags(order?.tags),
    canUpdateStatus,
    canUpdateTags,
    canTogglePrinted,
    canToggleArchived,
    canSendEmail,
    canPrepareWhatsApp,
    hasQuickActions,
    hasAnyActions: canUpdateStatus || canUpdateTags || hasQuickActions,
    statusBlocked,
    statusOptions,
    saveStatus: async () => {
      if (!orderId || !onSaveStatus || statusBlocked) return;
      await runMutation(onSaveStatus, [orderId, statusLocal], onRefreshTimeline);
    },
    saveTags: async () => {
      if (!orderId || !onSaveTags) return;
      await runMutation(
        onSaveTags,
        [orderId, parseOrderTags(tagsStr)],
        onRefreshTimeline
      );
    },
    togglePrinted: async () => {
      if (!orderId || !onTogglePrinted) return;
      await runMutation(onTogglePrinted, [orderId, !printed], onRefreshTimeline);
    },
    toggleArchived: async () => {
      if (!orderId || !onToggleArchived) return;
      await runMutation(onToggleArchived, [orderId, !archived], onRefreshTimeline);
    },
  };
}
