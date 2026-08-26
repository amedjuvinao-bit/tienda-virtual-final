// frontend/src/admin/orders/components/orderDetail/OrderDetailPaymentPanel.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  cleanText,
  fmtDate,
  getOrderExchangeInfo,
  getPaymentInfo,
  toCOP,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  MiniInfoCard,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

function firstValidText(...values) {
  const found = values
    .map((value) => String(value || '').trim())
    .find((value) => value && value !== '—');

  return found || '—';
}

function firstValidValue(...values) {
  const found = values.find((value) => {
    if (value === undefined || value === null || value === '') return false;

    const numberValue = Number(value);

    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0;
    }

    if (Number.isFinite(numberValue)) {
      return numberValue > 0;
    }

    return String(value).trim() !== '';
  });

  return found || 0;
}

function getInvoiceData(order) {
  return (
    order?.electronicInvoice ||
    order?.invoice ||
    order?.factusInvoice ||
    {}
  );
}

function getPaymentDetails(order) {
  const payment = order?.payment || {};
  const paymentDetails = order?.paymentDetails || {};
  const wompi = order?.wompi || {};
  const payu = order?.payu || {};
  const transaction = order?.transaction || {};
  const invoice = getInvoiceData(order);
  const dianResponse = invoice?.dianResponse || {};
  const providerRaw = invoice?.provider?.raw || {};
  const providerPaymentDetails = Array.isArray(providerRaw?.payment_details)
    ? providerRaw.payment_details[0] || {}
    : {};

  const method = firstValidText(
    payment.methodLabel,
    payment.methodType,
    payment.method,
    payment.paymentMethod,
    paymentDetails.methodLabel,
    paymentDetails.methodType,
    paymentDetails.method,
    paymentDetails.paymentMethod,
    wompi.payment_method_type,
    wompi.paymentMethodType,
    wompi.payment_method?.type,
    payu.paymentMethod,
    transaction.payment_method_type,
    transaction.payment_method?.type,
    providerPaymentDetails?.payment_method?.name,
    providerPaymentDetails?.payment_method?.code
  );

  const reference = firstValidText(
    payment.reference,
    payment.referenceCode,
    paymentDetails.reference,
    paymentDetails.referenceCode,
    wompi.reference,
    payu.reference,
    transaction.reference,
    order?.paymentReference,
    dianResponse.paymentReference,
    invoice?.provider?.referenceCode,
    providerRaw?.reference_code,
    order?.orderNumber ? `ORDER-${order.orderNumber}` : ''
  );

  const transactionId = firstValidText(
    payment.transactionId,
    payment.transaction_id,
    paymentDetails.transactionId,
    paymentDetails.transaction_id,
    wompi.id,
    wompi.transactionId,
    payu.transactionId,
    transaction.id,
    transaction.transactionId,
    transaction.transaction_id,
    order?.transactionId,
    dianResponse.transactionId,
    dianResponse.paymentTransactionId
  );

  const authorization = firstValidText(
    payment.authorization,
    payment.authorizationCode,
    payment.authCode,
    payment.approvalCode,
    paymentDetails.authorization,
    paymentDetails.authorizationCode,
    paymentDetails.authCode,
    transaction.authorization_code,
    transaction.authorizationCode,
    transaction.approval_code,
    transaction.approvalCode,
    providerRaw?.number,
    invoice?.provider?.number,
    invoice?.invoiceNumber
  );

  const paidAt =
    payment.paidAt ||
    payment.paymentDate ||
    paymentDetails.paidAt ||
    paymentDetails.paymentDate ||
    transaction.finalized_at ||
    transaction.created_at ||
    dianResponse.generatedAt ||
    invoice?.generatedAt ||
    invoice?.createdAt ||
    order?.paidAt ||
    order?.updatedAt ||
    '';

  const amount = firstValidValue(
    payment.amount,
    payment.paidAmount,
    paymentDetails.amount,
    paymentDetails.paidAmount,
    transaction.amount_in_cents ? Number(transaction.amount_in_cents) / 100 : 0,
    providerRaw?.totals?.total,
    order?.total
  );

  return {
    method: cleanText(method),
    reference: cleanText(reference),
    transactionId: cleanText(transactionId),
    authorization: cleanText(authorization),
    paidAt,
    amount,
  };
}

function getPaymentBadgeVariant(status) {
  const normalized = String(status || '').toLowerCase();

  if (
    normalized.includes('approved') ||
    normalized.includes('aprob') ||
    normalized.includes('paid') ||
    normalized.includes('pag')
  ) {
    return 'success';
  }

  if (
    normalized.includes('failed') ||
    normalized.includes('rechaz') ||
    normalized.includes('cancel') ||
    normalized.includes('error')
  ) {
    return 'danger';
  }

  return 'warning';
}

export default function OrderDetailPaymentPanel({ order }) {
  const exchange = getOrderExchangeInfo(order);
  const payment = getPaymentInfo(order);
  const details = getPaymentDetails(order);
  const storeCredit = order?.storeCredit || {};
  const hasStoreCredit = storeCredit.applied === true && Number(storeCredit.amount) > 0;
  const splitPayments = Array.isArray(order?.payment?.splitPayments)
    ? order.payment.splitPayments
    : [];
  const externalPayment = splitPayments.find(
    (item) => String(item?.method || '').toLowerCase() !== 'store_credit'
  );
  const storeCreditStatus =
    {
      consumed: 'Aplicado',
      reserved: 'Reservado',
      released: 'Devuelto',
    }[String(storeCredit.status || '').toLowerCase()] || 'Registrado';
  const badgeVariant = getPaymentBadgeVariant(payment.status);
  const paymentStatusLabel = exchange.noCharge ? 'Sin cobro' : payment.status;

  return (
    <OrderDetailPanel
      style={{
        padding: 18,
      }}
    >
      <SectionTitle
        icon={OrderDetailIcons.CreditCard}
        title="Pago"
        subtitle="Información financiera y trazabilidad de la transacción"
        action={<SoftBadge variant={badgeVariant}>{paymentStatusLabel}</SoftBadge>}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <MiniInfoCard
          label="Método"
          value={details.method}
          icon={OrderDetailIcons.CreditCard}
          accent
        />

        <MiniInfoCard
          label="Proveedor"
          value={payment.provider}
          icon={OrderDetailIcons.ShieldCheck}
        />

        <MiniInfoCard
          label="Moneda"
          value={payment.currency}
          icon={OrderDetailIcons.CircleDollarSign}
          code
        />

        <MiniInfoCard
          label={hasStoreCredit ? 'Total de la compra' : 'Valor pagado'}
          value={toCOP(hasStoreCredit ? order?.total : details.amount)}
          icon={OrderDetailIcons.CheckCircle2}
          accent
        />
      </div>

      {hasStoreCredit && (
        <div
          style={{
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            background: ORDER_DETAIL_THEME.inputBg,
            borderRadius: 20,
            padding: 16,
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 850, marginBottom: 12 }}>
            Composición del pago
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: externalPayment
                ? 'repeat(2, minmax(0, 1fr))'
                : '1fr',
              gap: 12,
            }}
          >
            <MiniInfoCard
              label={`Saldo a favor · ${storeCreditStatus}`}
              value={toCOP(storeCredit.amount)}
              icon={OrderDetailIcons.CircleDollarSign}
              accent
            />
            {externalPayment && (
              <MiniInfoCard
                label={externalPayment.methodLabel || 'Pago por pasarela'}
                value={toCOP(externalPayment.amount)}
                icon={OrderDetailIcons.CreditCard}
              />
            )}
          </div>
          {Array.isArray(storeCredit.references) &&
            storeCredit.references.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <InfoLine
                  label="Saldo utilizado:"
                  value={storeCredit.references.join(', ')}
                />
              </div>
            )}
          {storeCredit.status === 'released' && storeCredit.releaseReason && (
            <div style={{ marginTop: 8 }}>
              <InfoLine
                label="Motivo de devolución:"
                value={storeCredit.releaseReason}
              />
            </div>
          )}
        </div>
      )}

      <div
        style={{
          border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
          background: ORDER_DETAIL_THEME.inputBg,
          borderRadius: 20,
          padding: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '12px 18px',
        }}
      >
        <InfoLine label="Referencia:" value={details.reference} strong />
        <InfoLine label="Transacción:" value={details.transactionId} />
        <InfoLine label="Autorización:" value={details.authorization} />
        <InfoLine label="Fecha de pago:" value={fmtDate(details.paidAt)} />
      </div>

      <style>
        {`
          @media (max-width: 1020px) {
            div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"] {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }

          @media (max-width: 620px) {
            div[style*="grid-template-columns: repeat(4, minmax(0, 1fr))"],
            div[style*="grid-template-columns: repeat(2, minmax(0, 1fr))"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </OrderDetailPanel>
  );
}
