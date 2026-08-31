export const MANUAL_PAYMENT_METHODS = Object.freeze([
  Object.freeze({ value: 'cash', label: 'Efectivo' }),
  Object.freeze({ value: 'transfer', label: 'Transferencia' }),
  Object.freeze({ value: 'card', label: 'Tarjeta registrada manualmente' }),
  Object.freeze({ value: 'other', label: 'Otro medio manual' }),
]);

const METHOD_VALUES = new Set(MANUAL_PAYMENT_METHODS.map(({ value }) => value));
const METHOD_LABELS = Object.fromEntries(
  MANUAL_PAYMENT_METHODS.map(({ value, label }) => [value, label])
);

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cents(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : NaN;
}

export function canConfirmManualPaymentForOrder(order, hasPermission) {
  const provider = clean(order?.payment?.provider).toLowerCase();
  const paymentStatus = clean(order?.payment?.status).toLowerCase();
  const orderStatus = clean(order?.status).toLowerCase();

  return Boolean(
    hasPermission &&
    provider === 'manual' &&
    paymentStatus === 'pending_manual' &&
    ['pending', 'processing'].includes(orderStatus)
  );
}

export function createManualPaymentForm(order) {
  return {
    method: 'transfer',
    reference: '',
    amount: Number(order?.payment?.amount || 0),
    currency: clean(order?.payment?.currency).toUpperCase(),
    reason: '',
    verified: false,
  };
}

export function validateManualPaymentForm(form, order) {
  const errors = {};
  const expectedAmount = Number(order?.payment?.amount || 0);
  const expectedCurrency = clean(order?.payment?.currency).toUpperCase();
  const method = clean(form?.method).toLowerCase();
  const reference = clean(form?.reference);
  const reason = clean(form?.reason);
  const currency = clean(form?.currency).toUpperCase();
  const amount = Number(form?.amount);

  if (!METHOD_VALUES.has(method)) errors.method = 'Selecciona un método permitido.';
  if (reference.length < 4) {
    errors.reference = 'Registra una referencia comprobable de al menos 4 caracteres.';
  }
  if (reason.length < 8) {
    errors.reason = 'Explica el motivo en al menos 8 caracteres.';
  }
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    errors.amount = 'La orden no tiene un monto pendiente válido.';
  } else if (cents(amount) !== cents(expectedAmount)) {
    errors.amount = 'El monto debe coincidir exactamente con el pago pendiente.';
  }
  if (!/^[A-Z]{3}$/.test(expectedCurrency)) {
    errors.currency = 'La orden no tiene una moneda válida.';
  } else if (currency !== expectedCurrency) {
    errors.currency = 'La moneda debe coincidir con la orden.';
  }
  if (form?.verified !== true) {
    errors.verified = 'Confirma que verificaste el comprobante y el monto.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    request: {
      method,
      reference,
      amount: expectedAmount,
      currency: expectedCurrency,
      reason,
    },
  };
}

export function getManualPaymentEvidence(order) {
  const evidence = order?.payment?.manualConfirmation;
  if (!evidence || typeof evidence !== 'object') return null;

  const method = clean(evidence.method).toLowerCase();
  const amount = Number(evidence.amount || 0);
  return {
    id: clean(evidence.evidence?._id || evidence.evidence),
    method,
    methodLabel: METHOD_LABELS[method] || method || 'Medio manual',
    reference: clean(evidence.reference),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: clean(evidence.currency).toUpperCase(),
    reason: clean(evidence.reason),
    actorLabel: clean(evidence.actorLabel),
    actorRole: clean(evidence.actorRole),
    confirmedAt: evidence.confirmedAt || null,
  };
}

export function getManualPaymentErrorMessage(error) {
  return clean(error?.response?.data?.message) ||
    'No fue posible confirmar el pago manual. Intenta nuevamente.';
}
