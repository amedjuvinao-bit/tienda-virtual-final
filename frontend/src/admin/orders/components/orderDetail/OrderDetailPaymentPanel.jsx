// frontend/src/admin/orders/components/orderDetail/OrderDetailPaymentPanel.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  cleanText,
  fmtDate,
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

function getPaymentDetails(order) {
  const payment = order?.payment || {};
  const paymentDetails = order?.paymentDetails || {};
  const wompi = order?.wompi || {};
  const transaction = order?.transaction || {};

  const method =
    payment.method ||
    payment.paymentMethod ||
    paymentDetails.method ||
    paymentDetails.paymentMethod ||
    wompi.payment_method_type ||
    transaction.payment_method_type ||
    '—';

  const reference =
    payment.reference ||
    payment.referenceCode ||
    paymentDetails.reference ||
    paymentDetails.referenceCode ||
    wompi.reference ||
    transaction.reference ||
    order?.paymentReference ||
    '—';

  const transactionId =
    payment.transactionId ||
    payment.transaction_id ||
    paymentDetails.transactionId ||
    paymentDetails.transaction_id ||
    wompi.id ||
    transaction.id ||
    order?.transactionId ||
    '—';

  const authorization =
    payment.authorization ||
    payment.authorizationCode ||
    paymentDetails.authorization ||
    paymentDetails.authorizationCode ||
    transaction.authorization_code ||
    '—';

  const paidAt =
    payment.paidAt ||
    paymentDetails.paidAt ||
    transaction.created_at ||
    order?.paidAt ||
    '';

  const amount =
    payment.amount ||
    paymentDetails.amount ||
    transaction.amount_in_cents / 100 ||
    order?.total ||
    0;

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
  const payment = getPaymentInfo(order);
  const details = getPaymentDetails(order);
  const badgeVariant = getPaymentBadgeVariant(payment.status);

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
        action={<SoftBadge variant={badgeVariant}>{payment.status}</SoftBadge>}
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
          label="Valor pagado"
          value={toCOP(details.amount)}
          icon={OrderDetailIcons.CheckCircle2}
          accent
        />
      </div>

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