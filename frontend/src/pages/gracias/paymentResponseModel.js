function parseMoneyNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const safe = String(value).replace(/[^0-9,.-]/g, '').replace(',', '.');
  const number = Number(safe);
  return Number.isFinite(number) ? number : fallback;
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch {
    return String(value || '');
  }
}

export function parsePayUResponse(search) {
  const params = new URLSearchParams(search || '');
  const orderId = decodeSafe(params.get('orderId') || '').trim();
  const transactionState = String(params.get('transactionState') || '').trim();
  const lapTransactionState = decodeSafe(
    params.get('lapTransactionState') || ''
  ).trim();
  const referenceCode = decodeSafe(params.get('referenceCode') || '').trim();
  const description = decodeSafe(params.get('description') || '').trim();
  const txValue = parseMoneyNumber(params.get('TX_VALUE'), 0);
  const currency = decodeSafe(params.get('currency') || 'COP')
    .trim()
    .toUpperCase();
  const message = decodeSafe(params.get('message') || '').trim();
  const polResponseCode = String(params.get('polResponseCode') || '').trim();
  const buyerEmail = decodeSafe(params.get('buyerEmail') || '').trim();
  const processingDate = decodeSafe(params.get('processingDate') || '').trim();

  let status = 'unknown';
  if (lapTransactionState) {
    const safe = lapTransactionState.toLowerCase();
    if (safe.includes('aprob')) status = 'approved';
    else if (safe.includes('rechaz')) status = 'rejected';
    else if (safe.includes('pend')) status = 'pending';
    else if (safe.includes('expir')) status = 'expired';
    else if (safe.includes('error')) status = 'error';
  }
  if (status === 'unknown') {
    if (transactionState === '4') status = 'approved';
    else if (transactionState === '6') status = 'rejected';
    else if (transactionState === '7') status = 'pending';
    else if (transactionState === '5') status = 'expired';
    else if (transactionState === '104') status = 'error';
  }

  // orderId también lo usa Wompi. No basta para clasificar la respuesta como
  // PayU ni para presentar información financiera no verificada.
  const exists = Boolean(
    referenceCode ||
      transactionState ||
      lapTransactionState ||
      txValue ||
      message ||
      polResponseCode ||
      buyerEmail ||
      processingDate
  );

  return {
    provider: 'payu',
    exists,
    orderId,
    referenceCode,
    description,
    txValue,
    currency,
    transactionState,
    lapTransactionState,
    polResponseCode,
    buyerEmail,
    processingDate,
    message,
    status,
  };
}

export function parseWompiResponse(search) {
  const params = new URLSearchParams(search || '');
  const orderId = decodeSafe(params.get('orderId') || '').trim();
  const orderNumber = decodeSafe(params.get('orderNumber') || '').trim();
  const customerName = decodeSafe(params.get('name') || '').trim();
  const subtotal = parseMoneyNumber(params.get('subtotal'), 0);
  const items = Number.parseInt(params.get('items') || '0', 10);
  const transactionId = decodeSafe(
    params.get('tx') || params.get('id') || ''
  ).trim();
  const rawStatus = decodeSafe(params.get('status') || '')
    .trim()
    .toUpperCase();

  let status = 'unknown';
  if (rawStatus === 'APPROVED') status = 'approved';
  else if (rawStatus === 'DECLINED') status = 'rejected';
  else if (rawStatus === 'PENDING') status = 'pending';
  else if (rawStatus === 'VOIDED') status = 'expired';
  else if (rawStatus === 'ERROR') status = 'error';

  return {
    provider: 'wompi',
    exists: Boolean(
      orderId ||
        orderNumber ||
        customerName ||
        subtotal > 0 ||
        (Number.isFinite(items) && items > 0) ||
        transactionId ||
        rawStatus
    ),
    orderId,
    referenceCode: orderNumber,
    customerName,
    txValue: subtotal,
    itemCount: Number.isFinite(items) ? items : 0,
    transactionId,
    currency: 'COP',
    buyerEmail: '',
    processingDate: '',
    message: '',
    rawStatus,
    status,
    transactionState: rawStatus,
    lapTransactionState: rawStatus,
  };
}

const EMPTY_PAYMENT_RESPONSE = Object.freeze({
  provider: '', exists: false, orderId: '', referenceCode: '', description: '',
  txValue: 0, currency: 'COP', transactionState: '', lapTransactionState: '',
  polResponseCode: '', buyerEmail: '', processingDate: '', message: '',
  status: 'unknown', customerName: '', itemCount: 0, transactionId: '', rawStatus: '',
});

export function selectPaymentResponse(search) {
  const payu = parsePayUResponse(search);
  if (payu.exists) return payu;
  const wompi = parseWompiResponse(search);
  return wompi.exists ? wompi : { ...EMPTY_PAYMENT_RESPONSE };
}

export function mapGatewayStatusToUiStatus(status) {
  const safe = String(status || '').trim().toLowerCase();
  if (safe === 'approved' || safe === 'paid') return 'approved';
  if (['declined', 'rejected', 'failed'].includes(safe)) return 'rejected';
  if (safe === 'pending' || safe === 'pending_gateway') return 'pending';
  if (['voided', 'expired', 'cancelled'].includes(safe)) return 'expired';
  if (safe === 'error') return 'error';
  return 'unknown';
}

export function getPaymentStatusMeta(status, provider, fallback) {
  const providerLabel = provider === 'wompi' ? 'Wompi' : provider === 'payu'
    ? 'PayU' : provider === 'store_credit' ? 'el saldo a favor' : 'la pasarela de pago';
  const values = {
    approved: ['Pago aprobado', '#dcfce7', '#15803d', '¡Pago confirmado con éxito!', 'Tu pago fue aprobado correctamente. Ya recibimos tu orden y continuaremos con el proceso de preparación.', true],
    rejected: ['Pago rechazado', '#fee2e2', '#b91c1c', 'Tu pago fue rechazado', `${providerLabel} informó que este intento de pago fue rechazado. Puedes intentarlo nuevamente con otro medio de pago o volver a la tienda.`, false],
    pending: ['Pago pendiente', '#fef3c7', '#b45309', 'Tu pago está pendiente', `Recibimos tu intento de pago, pero ${providerLabel} aún no confirma el resultado final. Te avisaremos cuando el estado cambie.`, false],
    expired: ['Pago expirado', '#fef2f2', '#b91c1c', 'Tu intento de pago expiró', 'El intento de pago expiró antes de completarse. Puedes regresar a la tienda y generar un nuevo intento.', false],
    error: ['Error en el pago', '#fee2e2', '#b91c1c', 'Hubo un problema con tu pago', `${providerLabel} devolvió un error en el procesamiento. Te recomendamos intentar nuevamente.`, false],
  };
  const selected = values[status] || ['Orden recibida', '#fdf2f8', '#db2777', '¡Gracias por tu compra!', fallback || 'Hemos recibido tu pedido correctamente. Te enviaremos un mensaje cuando esté en camino.', true];
  return { badge: selected[0], badgeBg: selected[1], badgeText: selected[2], title: selected[3], message: selected[4], showSuccessCheck: selected[5] };
}
