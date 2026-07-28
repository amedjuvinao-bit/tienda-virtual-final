function dateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function defaultReportFilters() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return {
    from: dateInputValue(from),
    to: dateInputValue(to),
    type: 'all',
    status: 'all',
  };
}

export function formatNumber(value) {
  return Number(value || 0).toLocaleString('es-CO');
}

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

export function formatReportDate(value) {
  if (!value) return '—';
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function normalizeProviderLabel(value) {
  const text = String(value || '').trim();
  if (!text) return 'Interno';
  if (text === 'mock') return 'Interno';
  if (text === 'factus') return 'Factus';
  if (text === 'dian') return 'DIAN directa';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function normalizeModeLabel(value) {
  const text = String(value || '').toLowerCase();
  if (text === 'production') return 'Producción';
  if (text === 'test' || text === 'sandbox') return 'Pruebas';
  if (text === 'internal') return 'Interno';
  return value || 'Interno';
}

export function normalizeChannelLabel(value) {
  const text = String(value || '').toLowerCase();
  if (text === 'pos') return 'POS';
  if (text === 'web' || text === 'online') return 'Tienda web';
  return value || 'Sin canal';
}

export function normalizePaymentStatus(value) {
  const text = String(value || '').toLowerCase();
  const labels = {
    paid: 'Pagado',
    approved: 'Aprobado',
    captured: 'Capturado',
    success: 'Pagado',
    pending: 'Pendiente',
    failed: 'Fallido',
    rejected: 'Rechazado',
  };

  return labels[text] || value || 'Sin estado';
}

export function getStatusLabel(status) {
  const value = String(status || '').toLowerCase();
  const labels = {
    pending: 'Pendiente',
    processing: 'Procesando',
    generated: 'Generada',
    created: 'Creada',
    sent: 'Enviada',
    accepted: 'Aceptada',
    validated: 'Validada',
    rejected: 'Rechazada',
    failed: 'Fallida',
    error: 'Error',
  };

  return labels[value] || status || 'Pendiente';
}

export function getEmailStatusLabel(status) {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'sent') return 'Enviado';
  if (value === 'sending') return 'Enviando';
  if (value === 'error') return 'Error';
  return 'Pendiente';
}

export function getStatusStyle(status) {
  const value = String(status || '').toLowerCase();

  if (['accepted', 'validated'].includes(value)) {
    return {
      borderColor: 'rgba(16, 185, 129, 0.36)',
      background: 'rgba(16, 185, 129, 0.12)',
      color: '#047857',
    };
  }

  if (['rejected', 'failed', 'error'].includes(value)) {
    return {
      borderColor: 'rgba(244, 63, 94, 0.36)',
      background: 'rgba(244, 63, 94, 0.12)',
      color: '#be123c',
    };
  }

  if (['sent', 'generated', 'created'].includes(value)) {
    return {
      borderColor: 'rgba(245, 158, 11, 0.36)',
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#92400e',
    };
  }

  if (value === 'processing') {
    return {
      borderColor: 'rgba(59, 130, 246, 0.36)',
      background: 'rgba(59, 130, 246, 0.12)',
      color: '#1d4ed8',
    };
  }

  return {
    borderColor: 'var(--admin-card-border)',
    background: 'var(--admin-soft-bg)',
    color: 'var(--admin-card-text)',
  };
}

export function getEmailStatusStyle(status) {
  const value = String(status || 'pending').toLowerCase();
  if (value === 'sent') return getStatusStyle('accepted');
  if (value === 'error') return getStatusStyle('error');
  if (value === 'sending') return getStatusStyle('processing');
  return getStatusStyle('pending');
}

export function isValidatedDocument(document = {}) {
  const status = String(document?.status || '').toLowerCase();
  return (
    ['accepted', 'validated'].includes(status) ||
    document?.provider?.isValidated === true
  );
}

export function getCreditNoteTypeLabel(type) {
  return String(type || '').toLowerCase() === 'partial' ? 'Parcial' : 'Total';
}

export function uniqueById(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row?.id || row?._id || `${row?.invoiceNumber || ''}-${row?.orderNumber || ''}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
