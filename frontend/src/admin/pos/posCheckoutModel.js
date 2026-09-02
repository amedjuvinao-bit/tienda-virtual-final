const PAYMENT_LABELS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta / Datáfono',
  mixed: 'Pago mixto',
  other: 'Otro',
};

export const POS_DISCOUNT_APPROVAL_THRESHOLD = 20;

function moneyValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function paymentLabel(method) {
  return PAYMENT_LABELS[method] || cleanText(method) || 'Pago';
}

export function createInitialPaymentDetails(total = 0) {
  const initialTotal = moneyValue(total);
  return {
    receivedAmount: initialTotal > 0 ? initialTotal : '',
    reference: '',
    terminalId: '',
    splitPayments: [
      { id: 'split-cash', method: 'cash', amount: '', receivedAmount: '', reference: '' },
      { id: 'split-card', method: 'card', amount: '', receivedAmount: '', reference: '' },
    ],
  };
}

export function createInitialDiscount() {
  return { type: 'none', value: '', reason: '' };
}

export function calculateDiscountAmount(subtotal, discount = {}) {
  const safeSubtotal = moneyValue(subtotal);
  const value = moneyValue(discount.value);

  if (discount.type === 'percent') {
    return Math.min(safeSubtotal, Math.round((safeSubtotal * Math.min(100, value)) / 100));
  }

  if (discount.type === 'amount') {
    return Math.min(safeSubtotal, value);
  }

  return 0;
}

export function calculateCheckoutSummary(subtotal, discount = {}) {
  const safeSubtotal = moneyValue(subtotal);
  const discountAmount = calculateDiscountAmount(safeSubtotal, discount);

  return {
    subtotal: safeSubtotal,
    discount: discountAmount,
    total: Math.max(0, safeSubtotal - discountAmount),
  };
}

function splitPaymentPayload(split = {}) {
  const method = cleanText(split.method).toLowerCase();
  const amount = moneyValue(split.amount);
  const hasReceivedAmount = split.receivedAmount !== '' && split.receivedAmount !== null && split.receivedAmount !== undefined;
  const receivedAmount = method === 'cash'
    ? moneyValue(hasReceivedAmount ? split.receivedAmount : amount)
    : amount;

  return {
    method,
    methodLabel: paymentLabel(method),
    amount,
    reference: cleanText(split.reference),
    receivedAmount,
    changeAmount: method === 'cash' ? Math.max(0, receivedAmount - amount) : 0,
  };
}

export function buildPaymentPayload({ method = 'cash', total = 0, details = {} } = {}) {
  const safeTotal = moneyValue(total);
  const safeMethod = cleanText(method).toLowerCase() || 'cash';

  if (safeMethod === 'mixed') {
    const splitPayments = (Array.isArray(details.splitPayments) ? details.splitPayments : [])
      .map(splitPaymentPayload)
      .filter((split) => split.amount > 0);

    return {
      method: safeMethod,
      methodLabel: paymentLabel(safeMethod),
      amount: splitPayments.reduce((sum, split) => sum + split.amount, 0),
      receivedAmount: splitPayments.reduce((sum, split) => sum + split.receivedAmount, 0),
      reference: '',
      splitPayments,
    };
  }

  const receivedAmount = safeMethod === 'cash'
    ? moneyValue(details.receivedAmount)
    : safeTotal;

  return {
    method: safeMethod,
    methodLabel: paymentLabel(safeMethod),
    amount: safeTotal,
    receivedAmount,
    changeAmount: safeMethod === 'cash' ? Math.max(0, receivedAmount - safeTotal) : 0,
    reference: cleanText(details.reference),
    splitPayments: [],
  };
}

export function buildDiscountPayload(discount = {}) {
  const type = ['percent', 'amount'].includes(discount.type) ? discount.type : 'none';

  return {
    type,
    value: type === 'none' ? 0 : moneyValue(discount.value),
    reason: type === 'none' ? '' : cleanText(discount.reason),
  };
}

export function validatePosCheckout({
  subtotal = 0,
  discount = {},
  paymentMethod = 'cash',
  paymentDetails = {},
  permissions = {},
} = {}) {
  const errors = {};
  const summary = calculateCheckoutSummary(subtotal, discount);
  const discountPayload = buildDiscountPayload(discount);
  const payment = buildPaymentPayload({ method: paymentMethod, total: summary.total, details: paymentDetails });

  if (summary.subtotal <= 0) errors.cart = 'Agrega productos antes de preparar el cobro.';

  if (discountPayload.type !== 'none') {
    if (permissions.canDiscount !== true) {
      errors.discount = 'Tu perfil no tiene permiso para aplicar descuentos POS.';
    } else if (discountPayload.value <= 0) {
      errors.discount = 'Ingresa un descuento mayor que cero.';
    } else if (discountPayload.type === 'percent' && discountPayload.value > 100) {
      errors.discount = 'El porcentaje no puede superar el 100%.';
    } else if (discountPayload.type === 'amount' && discountPayload.value > summary.subtotal) {
      errors.discount = 'El descuento fijo no puede superar el subtotal.';
    } else if (discountPayload.reason.length < 3) {
      errors.discount = 'Escribe el motivo comercial del descuento.';
    } else {
      const effectivePercent = summary.subtotal > 0
        ? (summary.discount / summary.subtotal) * 100
        : 0;
      if (
        effectivePercent > POS_DISCOUNT_APPROVAL_THRESHOLD &&
        permissions.canApproveDiscount !== true
      ) {
        errors.discount = `El descuento supera el ${POS_DISCOUNT_APPROVAL_THRESHOLD}% y requiere autorización.`;
      }
    }
  }

  if (summary.total <= 0) {
    errors.payment = 'El total de la venta debe ser mayor que cero.';
  } else if (paymentMethod === 'cash') {
    if (payment.receivedAmount < summary.total) {
      errors.payment = 'El efectivo recibido no cubre el total de la venta.';
    }
  } else if (paymentMethod === 'mixed') {
    if (payment.splitPayments.length < 2) {
      errors.payment = 'El pago mixto necesita al menos dos medios con valor.';
    } else if (payment.splitPayments.some((split) => split.method === 'mixed')) {
      errors.payment = 'Un pago mixto no puede contener otro pago mixto.';
    } else if (payment.amount !== summary.total) {
      errors.payment = payment.amount < summary.total
        ? `Faltan ${summary.total - payment.amount} por distribuir entre los medios de pago.`
        : `La distribución supera el total por ${payment.amount - summary.total}.`;
    } else {
      const cashUnderpaid = payment.splitPayments.find(
        (split) => split.method === 'cash' && split.receivedAmount < split.amount
      );
      const missingReference = payment.splitPayments.find(
        (split) => ['transfer', 'card', 'other'].includes(split.method) && split.reference.length < 3
      );
      if (cashUnderpaid) errors.payment = 'El efectivo recibido en el pago mixto no cubre su parte.';
      if (missingReference) errors.payment = `Registra la referencia de ${paymentLabel(missingReference.method).toLowerCase()}.`;
    }
  } else if (['transfer', 'card', 'other'].includes(paymentMethod) && payment.reference.length < 3) {
    errors.payment = paymentMethod === 'card'
      ? 'Registra la autorización o referencia del datáfono.'
      : paymentMethod === 'transfer'
        ? 'Registra la referencia de la transferencia.'
        : 'Describe la referencia del medio de pago.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    summary,
    discount: discountPayload,
    payment,
  };
}

export function buildPosCommercialPayload({
  branchId,
  cartItems = [],
  paymentMethod = 'cash',
  paymentDetails = {},
  discount = {},
  total = 0,
  registerCode = 'CAJA POS',
} = {}) {
  return {
    branchId,
    customerMode: 'guest',
    registerCode,
    cashRegisterCode: registerCode,
    terminalId: cleanText(paymentDetails.terminalId),
    items: cartItems.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      size: item.size || '',
      color: item.color || '',
      variantKey: item.variantKey || item.variantId || '',
      variantLabel: item.variantLabel || '',
      variantAttributes: Array.isArray(item.variantAttributes) ? item.variantAttributes : [],
    })),
    payment: buildPaymentPayload({ method: paymentMethod, total, details: paymentDetails }),
    discount: buildDiscountPayload(discount),
  };
}
