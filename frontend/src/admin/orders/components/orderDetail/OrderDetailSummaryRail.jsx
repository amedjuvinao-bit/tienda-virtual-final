// frontend/src/admin/orders/components/orderDetail/OrderDetailSummaryRail.jsx

import { ORDER_DETAIL_THEME, getOrderStatusMeta } from './orderDetailTheme';
import {
  fmtDate,
  getAdminSnapshot,
  getOrderExchangeInfo,
  getInvoiceInfo,
  getOrderBranchInfo,
  getOrderSourceLabel,
  getOrderSummary,
  getPaymentInfo,
  toCOP,
} from './orderDetailUtils';
import { OrderDetailIcons, IconBadge } from './OrderDetailIcons';
import {
  InfoLine,
  MiniInfoCard,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

const FLOW_STEPS = ['pending', 'processing', 'shipped', 'delivered'];
const FLOW_LABELS = {
  pending: 'Recibida',
  processing: 'Preparando',
  shipped: 'Enviada',
  delivered: 'Entregada',
};

function getProgressPercent(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (normalized === 'paid') return 40;
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'failed') return 0;
  if (normalized === 'refunded') return 100;

  const index = FLOW_STEPS.indexOf(normalized);

  if (index < 0) return 20;

  return Math.max(20, Math.round(((index + 1) / FLOW_STEPS.length) * 100));
}

function toNumber(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function firstValidNumber(...values) {
  const found = values.find((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0;
  });

  return found === undefined ? 0 : Number(found);
}

function firstConfiguredNumber(...values) {
  const found = values.find((value) => {
    if (value === undefined || value === null || value === '') return false;
    return Number.isFinite(Number(value));
  });

  return found === undefined ? 0 : Number(found);
}

function getProviderTotals(order) {
  const invoice =
    order?.electronicInvoice ||
    order?.invoice ||
    order?.factusInvoice ||
    {};

  const providerRaw = invoice?.provider?.raw || {};
  const totals = providerRaw?.totals || {};

  return {
    grossAmount: toNumber(totals.gross_amount),
    taxableAmount: toNumber(totals.taxable_amount),
    taxAmount: toNumber(totals.tax_amount),
    surchargeAmount: toNumber(totals.surcharge_amount),
    prepaymentAmount: toNumber(totals.prepayment_amount),
    total: toNumber(totals.total),
  };
}

function getOrderTaxes(order) {
  const ivaAmount = firstValidNumber(
    order?.taxes?.iva?.amount,
    order?.taxes?.ivaAmount,
    order?.taxes?.taxAmount,
    order?.taxAmount,
    order?.iva,
    order?.ivaAmount
  );

  const ivaRate = firstConfiguredNumber(
    order?.taxes?.iva?.percent,
    order?.taxes?.iva?.rate,
    order?.taxes?.ivaRate,
    order?.taxRate,
    19
  );

  return {
    ivaAmount,
    ivaRate,
  };
}

function getOrderDiscount(order) {
  return firstValidNumber(
    order?.pricing?.productDiscount,
    order?.discount?.amount,
    order?.coupon?.discountAmount,
    order?.discount,
    order?.discountAmount,
    order?.couponDiscount,
    order?.summary?.discount,
    order?.totals?.discount
  );
}

function getMoneyBreakdown(order, summary) {
  const providerTotals = getProviderTotals(order);
  const orderTaxes = getOrderTaxes(order);

  const subtotal = firstValidNumber(
    summary?.subtotal,
    order?.subtotal,
    order?.itemsSubtotal,
    order?.totals?.subtotal,
    providerTotals.grossAmount,
    providerTotals.taxableAmount
  );

  const shipping = toNumber(
    order?.shipping ??
      order?.shippingCost ??
      order?.shippingAmount ??
      order?.deliveryFee ??
      order?.totals?.shipping ??
      summary?.shipping ??
      0
  );

  const discount = getOrderDiscount(order);
  const shippingDiscount = firstValidNumber(
    order?.pricing?.shippingDiscount,
    order?.coupon?.shippingDiscountAmount
  );
  const originalShipping = firstConfiguredNumber(
    order?.pricing?.originalShipping,
    order?.coupon?.originalShippingAmount,
    shipping
  );

  const total = firstValidNumber(
    summary?.total,
    order?.total,
    order?.grandTotal,
    order?.totals?.total,
    providerTotals.total,
    subtotal + shipping + orderTaxes.ivaAmount - discount
  );

  const inferredTax = Math.max(0, total - subtotal - shipping + discount);

  const ivaAmount = firstValidNumber(
    orderTaxes.ivaAmount,
    providerTotals.taxAmount,
    inferredTax
  );

  const ivaRate = orderTaxes.ivaRate || 19;

  const surcharge = firstValidNumber(
    order?.surcharge,
    order?.surchargeAmount,
    providerTotals.surchargeAmount
  );

  const prepayment = firstValidNumber(
    order?.prepayment,
    order?.prepaymentAmount,
    providerTotals.prepaymentAmount
  );

  return {
    subtotal,
    discount,
    shippingDiscount,
    couponCode: order?.coupon?.code || '',
    ivaAmount,
    ivaRate,
    shipping,
    originalShipping,
    surcharge,
    prepayment,
    total,
  };
}

function RailMoneyLine({ label, value, strong = false, muted = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        color: strong ? '#fff' : muted ? 'rgba(255,255,255,0.68)' : 'rgba(15, 23, 42, 0.72)',
        fontSize: strong ? 14 : 12,
        fontWeight: strong ? 950 : 750,
        lineHeight: 1.25,
      }}
    >
      <span>{label}</span>
      <strong
        style={{
          color: strong ? '#fff' : muted ? 'rgba(255,255,255,0.78)' : 'rgba(15, 23, 42, 0.95)',
          fontSize: strong ? 22 : 13,
          fontWeight: strong ? 950 : 850,
          letterSpacing: strong ? '-0.04em' : 0,
          whiteSpace: 'nowrap',
          textShadow: strong ? '0 1px 12px rgba(15, 23, 42, 0.24)' : 'none',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function RailStatusCard({ icon, label, value, variant = 'soft' }) {
  return (
    <div
      style={{
        minWidth: 0,
        minHeight: 82,
        border: '1px solid rgba(255,255,255,0.30)',
        background: 'rgba(255,255,255,0.18)',
        borderRadius: 18,
        padding: '12px 9px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        color: '#fff',
        textAlign: 'center',
        backdropFilter: 'blur(10px)',
      }}
    >
      <IconBadge icon={icon} size={30} iconSize={14} variant={variant} />

      <div style={{ minWidth: 0, width: '100%' }}>
        <span
          style={{
            display: 'block',
            opacity: 0.78,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.09em',
            textTransform: 'uppercase',
            marginBottom: 4,
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <strong
          title={String(value || '')}
          style={{
            display: 'block',
            width: '100%',
            fontSize: 10.5,
            fontWeight: 950,
            lineHeight: 1.15,
            whiteSpace: 'normal',
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {value || '—'}
        </strong>
      </div>
    </div>
  );
}

export default function OrderDetailSummaryRail({ order }) {
  const exchange = getOrderExchangeInfo(order);
  const status = getOrderStatusMeta(
    exchange.noCharge ? 'processing' : order?.status
  );
  const statusLabel = exchange.noCharge ? 'Cambio sin cobro' : status.label;
  const summary = getOrderSummary(order);
  const payment = getPaymentInfo(order);
  const invoice = getInvoiceInfo(order);
  const branchInfo = getOrderBranchInfo(order);
  const admin = getAdminSnapshot(order);
  const sourceLabel = getOrderSourceLabel(order?.source);
  const progressPercent = getProgressPercent(order?.status);
  const breakdown = getMoneyBreakdown(order, summary);

  return (
    <aside
      className="order-detail-summary-rail"
      style={{
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        minWidth: 0,
      }}
    >
      <section
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 28,
          padding: 22,
          color: '#fff',
          background: `
            radial-gradient(circle at 85% 12%, rgba(255,255,255,0.45), transparent 18%),
            radial-gradient(circle at 16% 0%, rgba(255,255,255,0.26), transparent 28%),
            linear-gradient(135deg, ${ORDER_DETAIL_THEME.primaryHover}, ${ORDER_DETAIL_THEME.primary}, #f9a8d4)
          `,
          boxShadow: '0 22px 58px rgba(236, 72, 153, 0.26)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            right: -24,
            top: -24,
            width: 132,
            height: 132,
            borderRadius: 999,
            background: 'rgba(255,255,255,0.16)',
          }}
        />

        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
            marginBottom: 20,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                opacity: 0.86,
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: '0.06em',
              }}
            >
              Resumen del pedido
            </p>
            <span
              style={{
                display: 'block',
                marginTop: 5,
                opacity: 0.72,
                fontSize: 11,
                fontWeight: 750,
              }}
            >
              Moneda: COP
            </span>
          </div>

          <span
            className={status.className}
            style={{
              borderRadius: 999,
              border: '1px solid rgba(255,255,255,0.45)',
              background: 'rgba(255,255,255,0.18)',
              color: '#fff',
              padding: '7px 11px',
              fontSize: 10,
              fontWeight: 950,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {statusLabel}
          </span>
        </div>

        <strong
          style={{
            position: 'relative',
            display: 'block',
            marginBottom: 20,
            fontSize: 34,
            fontWeight: 950,
            letterSpacing: '-0.055em',
            lineHeight: 1,
          }}
        >
          {toCOP(breakdown.total)}
        </strong>

        <div
          style={{
            position: 'relative',
            border: '1px solid rgba(255,255,255,0.28)',
            background: 'rgba(255,255,255,0.16)',
            borderRadius: 20,
            padding: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            backdropFilter: 'blur(10px)',
          }}
        >
          <RailMoneyLine label="Subtotal productos" value={toCOP(breakdown.subtotal)} />

          {breakdown.discount > 0 ? (
            <RailMoneyLine
              label={breakdown.couponCode ? `Descuento · ${breakdown.couponCode}` : 'Descuento'}
              value={`-${toCOP(breakdown.discount)}`}
              muted
            />
          ) : null}

          <RailMoneyLine
            label={`IVA ${breakdown.ivaRate}%`}
            value={toCOP(breakdown.ivaAmount)}
          />

          <RailMoneyLine label="Envío" value={toCOP(breakdown.originalShipping)} />

          {breakdown.shippingDiscount > 0 ? (
            <RailMoneyLine
              label="Descuento de envío"
              value={`-${toCOP(breakdown.shippingDiscount)}`}
              muted
            />
          ) : null}

          {breakdown.surcharge > 0 ? (
            <RailMoneyLine label="Recargo" value={toCOP(breakdown.surcharge)} />
          ) : null}

          {breakdown.prepayment > 0 ? (
            <RailMoneyLine
              label="Anticipo"
              value={`-${toCOP(breakdown.prepayment)}`}
              muted
            />
          ) : null}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.32)' }} />
          <RailMoneyLine label="Total pagado" value={toCOP(breakdown.total)} strong />
        </div>

        <div
          style={{
            position: 'relative',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 8,
            marginTop: 12,
          }}
        >
          <RailStatusCard
            icon={OrderDetailIcons.CreditCard}
            label="Pago"
            value={payment.status}
            variant="success"
          />
          <RailStatusCard
            icon={OrderDetailIcons.ReceiptText}
            label="Factura"
            value={exchange.noCharge ? 'No aplica' : invoice.number}
          />
          <RailStatusCard
            icon={OrderDetailIcons.ShieldCheck}
            label={exchange.noCharge ? 'Fiscal' : 'CUFE'}
            value={exchange.noCharge ? 'Venta original' : invoice.cufe}
          />
        </div>
      </section>

      <OrderDetailPanel style={{ padding: 18 }}>
        <SectionTitle
          icon={OrderDetailIcons.Clock3}
          title="Progreso del pedido"
          subtitle="Estado operativo actual"
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <span
            style={{
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 12,
              fontWeight: 750,
            }}
          >
            {progressPercent}% completado
          </span>
          <SoftBadge>{statusLabel}</SoftBadge>
        </div>

        <div
          style={{
            height: 9,
            borderRadius: 999,
            background: ORDER_DETAIL_THEME.primarySoftBg,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              borderRadius: 999,
              background: `linear-gradient(90deg, ${ORDER_DETAIL_THEME.primary}, ${ORDER_DETAIL_THEME.primaryHover})`,
              transition: 'width 0.25s ease',
            }}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 8,
            marginTop: 14,
          }}
        >
          {FLOW_STEPS.map((step) => (
            <span
              key={step}
              style={{
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 10,
                fontWeight: 850,
                textAlign: 'center',
                lineHeight: 1.2,
              }}
            >
              {FLOW_LABELS[step]}
            </span>
          ))}
        </div>
      </OrderDetailPanel>

      <OrderDetailPanel style={{ padding: 18 }}>
        <SectionTitle
          icon={OrderDetailIcons.Store}
          title="Datos rápidos"
          subtitle="Información clave de la orden"
        />

        <div style={{ display: 'grid', gap: 10 }}>
          <MiniInfoCard
            icon={OrderDetailIcons.ShoppingBag}
            label="Orden"
            value={`#${order?.orderNumber || '—'}`}
            code
            accent
          />
          <MiniInfoCard
            icon={OrderDetailIcons.PackageCheck}
            label="Productos"
            value={`${summary.itemsCount} producto(s) · ${summary.totalItems} unidad(es)`}
          />
          <MiniInfoCard
            icon={OrderDetailIcons.Building2}
            label={branchInfo.isMultiBranch ? 'Despacho' : 'Sede'}
            value={branchInfo.name}
          />
        </div>
      </OrderDetailPanel>

      <OrderDetailPanel style={{ padding: 18 }}>
        <SectionTitle
          icon={OrderDetailIcons.ClipboardList}
          title="Trazabilidad"
          subtitle="Origen y creación"
        />

        <div style={{ display: 'grid', gap: 10 }}>
          <InfoLine label="Creada el:" value={fmtDate(order?.createdAt)} />
          <InfoLine label="Canal:" value={sourceLabel} />
          <InfoLine
            label={
              branchInfo.isMultiBranch
                ? 'Sedes involucradas:'
                : 'Código sede:'
            }
            value={branchInfo.code || 'Sin sede'}
          />
          <InfoLine label="Creada por:" value={admin.displayName} strong />
          <InfoLine label="Rol:" value={admin.role} />
        </div>
      </OrderDetailPanel>
    </aside>
  );
}
