// frontend/src/admin/orders/components/orderDetail/orderDetailTheme.js

export const ORDER_DETAIL_THEME = {
  cardBg: 'var(--admin-card-bg)',
  cardText: 'var(--admin-card-text)',
  mutedText: 'var(--admin-card-muted-text)',

  primary: 'var(--admin-primary)',
  primaryHover: 'var(--admin-primary-hover)',
  primaryText: 'var(--admin-primary-text)',

  primarySoftBg: 'var(--admin-primary-soft-bg)',
  primarySoftText: 'var(--admin-primary-soft-text)',

  inputBg: 'var(--admin-input-bg)',
  inputText: 'var(--admin-input-text)',
  inputBorder: 'var(--admin-input-border)',

  cardBorder: 'var(--admin-card-border)',

  danger: 'var(--admin-danger, #ef4444)',
  success: 'var(--admin-success, #22c55e)',
  warning: 'var(--admin-warning, #f59e0b)',

  overlayBg: 'rgba(15, 23, 42, 0.56)',
};

export const ORDER_DETAIL_STATUS_META = {
  pending: {
    label: 'Pendiente',
    className:
      'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  },
  processing: {
    label: 'Procesando',
    className:
      'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200',
  },
  paid: {
    label: 'Pagada',
    className:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200',
  },
  shipped: {
    label: 'Enviada',
    className:
      'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
  },
  cancelled: {
    label: 'Cancelada',
    className:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200',
  },
  canceled: {
    label: 'Cancelada',
    className:
      'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200',
  },
  refunded: {
    label: 'Reembolsada',
    className:
      'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200',
  },
  failed: {
    label: 'Fallida',
    className:
      'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200',
  },
};

export function getOrderStatusMeta(status) {
  const key = String(status || '').trim().toLowerCase();

  return (
    ORDER_DETAIL_STATUS_META[key] || {
      label: status || 'Sin estado',
      className:
        'border-pink-200 bg-pink-50 text-pink-700 dark:border-pink-500/30 dark:bg-pink-500/10 dark:text-pink-200',
    }
  );
}