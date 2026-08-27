// frontend/src/admin/orders/components/orderDetail/OrderDetailPaymentPanel.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  fmtDate,
  getOrderExchangeInfo,
  getPaymentInfo,
  toCOP,
} from './orderDetailUtils';
import OrderManualPaymentConfirmationCard from './OrderManualPaymentConfirmationCard';
import OrderManualPaymentEvidence from './OrderManualPaymentEvidence';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  MiniInfoCard,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';
import {
  getPaymentBadgeVariant,
  getPaymentDetails,
} from './orderPaymentPanelModel';

export default function OrderDetailPaymentPanel({
  order,
  canConfirmManualPayment = false,
  manualPaymentConfirmation,
}) {
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

      <OrderManualPaymentEvidence order={order} />
      <OrderManualPaymentConfirmationCard
        canConfirmManualPayment={canConfirmManualPayment}
        controller={manualPaymentConfirmation}
        order={order}
      />

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
