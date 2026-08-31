import { cleanText } from './orderDetailUtils';

function firstValidText(...values) {
  const found = values
    .map((value) => String(value || '').trim())
    .find((value) => value && value !== '—');
  return found || '—';
}

function firstValidValue(...values) {
  const found = values.find((value) => {
    if (value === undefined || value === null || value === '') return false;
    const numeric = Number(value);
    if (typeof value === 'number') return Number.isFinite(value) && value > 0;
    if (Number.isFinite(numeric)) return numeric > 0;
    return String(value).trim() !== '';
  });
  return found || 0;
}

function getInvoiceData(order) {
  return order?.electronicInvoice || order?.invoice || order?.factusInvoice || {};
}

export function getPaymentDetails(order) {
  const payment = order?.payment || {};
  const details = order?.paymentDetails || {};
  const wompi = order?.wompi || {};
  const payu = order?.payu || {};
  const transaction = order?.transaction || {};
  const invoice = getInvoiceData(order);
  const dian = invoice?.dianResponse || {};
  const raw = invoice?.provider?.raw || {};
  const providerDetails = Array.isArray(raw?.payment_details)
    ? raw.payment_details[0] || {}
    : {};

  return {
    method: cleanText(firstValidText(
      payment.methodLabel,
      payment.methodType,
      payment.method,
      payment.paymentMethod,
      details.methodLabel,
      details.methodType,
      details.method,
      details.paymentMethod,
      wompi.payment_method_type,
      wompi.paymentMethodType,
      wompi.payment_method?.type,
      payu.paymentMethod,
      transaction.payment_method_type,
      transaction.payment_method?.type,
      providerDetails?.payment_method?.name,
      providerDetails?.payment_method?.code
    )),
    reference: cleanText(firstValidText(
      payment.reference,
      payment.referenceCode,
      details.reference,
      details.referenceCode,
      wompi.reference,
      payu.reference,
      transaction.reference,
      order?.paymentReference,
      dian.paymentReference,
      invoice?.provider?.referenceCode,
      raw?.reference_code,
      order?.orderNumber ? `ORDER-${order.orderNumber}` : ''
    )),
    transactionId: cleanText(firstValidText(
      payment.transactionId,
      payment.transaction_id,
      details.transactionId,
      details.transaction_id,
      wompi.id,
      wompi.transactionId,
      payu.transactionId,
      transaction.id,
      transaction.transactionId,
      transaction.transaction_id,
      order?.transactionId,
      dian.transactionId,
      dian.paymentTransactionId
    )),
    authorization: cleanText(firstValidText(
      payment.authorization,
      payment.authorizationCode,
      payment.authCode,
      payment.approvalCode,
      details.authorization,
      details.authorizationCode,
      details.authCode,
      transaction.authorization_code,
      transaction.authorizationCode,
      transaction.approval_code,
      transaction.approvalCode,
      raw?.number,
      invoice?.provider?.number,
      invoice?.invoiceNumber
    )),
    paidAt:
      payment.paidAt ||
      payment.paymentDate ||
      details.paidAt ||
      details.paymentDate ||
      transaction.finalized_at ||
      transaction.created_at ||
      dian.generatedAt ||
      invoice?.generatedAt ||
      invoice?.createdAt ||
      order?.paidAt ||
      order?.updatedAt ||
      '',
    amount: firstValidValue(
      payment.amount,
      payment.paidAmount,
      details.amount,
      details.paidAmount,
      transaction.amount_in_cents ? Number(transaction.amount_in_cents) / 100 : 0,
      raw?.totals?.total,
      order?.total
    ),
  };
}

export function getPaymentBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();
  if (['approved', 'aprob', 'paid', 'pag'].some((word) => normalized.includes(word))) {
    return 'success';
  }
  if (['failed', 'rechaz', 'cancel', 'error'].some((word) => normalized.includes(word))) {
    return 'danger';
  }
  return 'warning';
}
