import { useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  fmtDate,
  getAdminSnapshot,
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
} from './OrderDetailPrimitives';

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
  const invoice = order?.electronicInvoice || order?.invoice || order?.factusInvoice || {};
  const totals = invoice?.provider?.raw?.totals || {};

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
  return {
    ivaAmount: firstValidNumber(
      order?.taxes?.iva?.amount,
      order?.taxes?.ivaAmount,
      order?.taxes?.taxAmount,
      order?.taxAmount,
      order?.iva,
      order?.ivaAmount
    ),
    ivaRate: firstConfiguredNumber(
      order?.taxes?.iva?.percent,
      order?.taxes?.iva?.rate,
      order?.taxes?.ivaRate,
      order?.taxRate,
      19
    ),
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

  return {
    subtotal,
    discount,
    shippingDiscount,
    couponCode: order?.coupon?.code || '',
    ivaAmount: firstValidNumber(orderTaxes.ivaAmount, providerTotals.taxAmount, inferredTax),
    ivaRate: orderTaxes.ivaRate || 19,
    shipping,
    originalShipping,
    surcharge: firstValidNumber(
      order?.surcharge,
      order?.surchargeAmount,
      providerTotals.surchargeAmount
    ),
    prepayment: firstValidNumber(
      order?.prepayment,
      order?.prepaymentAmount,
      providerTotals.prepaymentAmount
    ),
    total,
  };
}

function truncateMiddle(value, start = 12, end = 8) {
  const text = String(value || '').trim();
  if (!text || text === '—') return '—';
  if (text.length <= start + end + 3) return text;
  return `${text.slice(0, start)}…${text.slice(-end)}`;
}

function statusVariant(value, fallback = 'soft') {
  const normalized = String(value || '').trim().toLowerCase();
  if (['paid', 'approved', 'aprob', 'valid', 'accept', 'success', 'emit'].some((part) => normalized.includes(part))) {
    return 'success';
  }
  if (['failed', 'error', 'rechaz', 'cancel', 'declin'].some((part) => normalized.includes(part))) {
    return 'danger';
  }
  if (['pending', 'pend', 'process', 'gateway'].some((part) => normalized.includes(part))) {
    return 'warning';
  }
  return fallback;
}

function RailMoneyLine({ label, value, strong = false, muted = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        color: strong ? '#fff' : muted ? 'rgba(255,255,255,0.70)' : 'rgba(255,255,255,0.88)',
        fontSize: strong ? 13 : 11,
        fontWeight: strong ? 950 : 750,
        lineHeight: 1.25,
      }}
    >
      <span>{label}</span>
      <strong
        style={{
          color: '#fff',
          fontSize: strong ? 19 : 12,
          fontWeight: strong ? 950 : 850,
          letterSpacing: strong ? '-0.03em' : 0,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function StatusLine({
  icon,
  label,
  value,
  helper = '',
  action = null,
  variant = 'soft',
  title = '',
}) {
  return (
    <div
      style={{
        minWidth: 0,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 15,
        padding: '10px 11px',
        display: 'grid',
        gridTemplateColumns: '34px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <IconBadge icon={icon} size={34} iconSize={14} variant={variant} />
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 9,
            fontWeight: 950,
            letterSpacing: '0.10em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          {label}
        </span>
        <strong
          title={title || String(value || '')}
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.cardText,
            fontSize: 11.5,
            fontWeight: 900,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value || '—'}
        </strong>
        {helper ? (
          <span
            style={{
              display: 'block',
              marginTop: 3,
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 9.5,
              fontWeight: 650,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {helper}
          </span>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export default function OrderDetailSummaryRail({ order }) {
  const [copiedCufe, setCopiedCufe] = useState(false);
  const summary = getOrderSummary(order);
  const payment = getPaymentInfo(order);
  const invoice = getInvoiceInfo(order);
  const branchInfo = getOrderBranchInfo(order);
  const admin = getAdminSnapshot(order);
  const sourceLabel = getOrderSourceLabel(order?.source);
  const breakdown = getMoneyBreakdown(order, summary);

  const copyCufe = async () => {
    if (!invoice.cufe || invoice.cufe === '—') return;

    try {
      if (globalThis.navigator?.clipboard?.writeText) {
        await globalThis.navigator.clipboard.writeText(invoice.cufe);
      } else if (globalThis.document) {
        const field = document.createElement('textarea');
        field.value = invoice.cufe;
        field.style.position = 'fixed';
        field.style.opacity = '0';
        document.body.appendChild(field);
        field.select();
        document.execCommand('copy');
        field.remove();
      }
      setCopiedCufe(true);
      globalThis.setTimeout?.(() => setCopiedCufe(false), 1800);
    } catch {
      setCopiedCufe(false);
    }
  };

  return (
    <aside
      className="order-detail-summary-rail"
      aria-label="Resumen de la orden"
      style={{
        position: 'sticky',
        top: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        minWidth: 0,
      }}
    >
      <section
        style={{
          borderRadius: 22,
          padding: 18,
          color: '#fff',
          background: `linear-gradient(140deg, ${ORDER_DETAIL_THEME.primaryHover}, ${ORDER_DETAIL_THEME.primary} 58%, #f472b6)`,
          boxShadow: '0 18px 44px rgba(236, 72, 153, 0.22)',
          border: '1px solid rgba(255,255,255,0.28)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <span
              style={{
                display: 'block',
                opacity: 0.82,
                fontSize: 9,
                fontWeight: 950,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
              }}
            >
              Total de la orden
            </span>
            <strong
              style={{
                display: 'block',
                marginTop: 7,
                fontSize: 29,
                fontWeight: 950,
                letterSpacing: '-0.05em',
                lineHeight: 1,
              }}
            >
              {toCOP(breakdown.total)}
            </strong>
          </div>
          <span style={{ opacity: 0.78, fontSize: 10, fontWeight: 850 }}>COP</span>
        </div>

        <details className="order-detail-breakdown">
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 10.5,
              fontWeight: 900,
              padding: '8px 10px',
              border: '1px solid rgba(255,255,255,0.30)',
              borderRadius: 12,
              background: 'rgba(255,255,255,0.12)',
              listStylePosition: 'inside',
            }}
          >
            Ver desglose del total
          </summary>
          <div
            style={{
              marginTop: 9,
              border: '1px solid rgba(255,255,255,0.24)',
              background: 'rgba(255,255,255,0.10)',
              borderRadius: 14,
              padding: 12,
              display: 'grid',
              gap: 9,
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
            <RailMoneyLine label={`IVA ${breakdown.ivaRate}%`} value={toCOP(breakdown.ivaAmount)} />
            <RailMoneyLine label="Envío" value={toCOP(breakdown.originalShipping)} />
            {breakdown.shippingDiscount > 0 ? (
              <RailMoneyLine label="Descuento de envío" value={`-${toCOP(breakdown.shippingDiscount)}`} muted />
            ) : null}
            {breakdown.surcharge > 0 ? (
              <RailMoneyLine label="Recargo" value={toCOP(breakdown.surcharge)} />
            ) : null}
            {breakdown.prepayment > 0 ? (
              <RailMoneyLine label="Anticipo" value={`-${toCOP(breakdown.prepayment)}`} muted />
            ) : null}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.28)' }} />
            <RailMoneyLine label="Total" value={toCOP(breakdown.total)} strong />
          </div>
        </details>
      </section>

      <OrderDetailPanel style={{ padding: 15 }}>
        <SectionTitle
          icon={OrderDetailIcons.ReceiptText}
          title="Pago y facturación"
          subtitle="Soportes financieros de la orden"
        />
        <div style={{ display: 'grid', gap: 8 }}>
          <StatusLine
            icon={OrderDetailIcons.CreditCard}
            label="Pago"
            value={payment.status}
            helper={payment.provider}
            variant={statusVariant(payment.status, 'warning')}
          />
          <StatusLine
            icon={OrderDetailIcons.ReceiptText}
            label="Factura"
            value={invoice.number}
            helper={invoice.status}
            variant={statusVariant(invoice.status)}
          />
          <StatusLine
            icon={OrderDetailIcons.ShieldCheck}
            label="CUFE"
            value={truncateMiddle(invoice.cufe)}
            title={invoice.cufe}
            helper={invoice.cufe === '—' ? 'No disponible' : 'Identificador fiscal'}
            variant={invoice.cufe === '—' ? 'soft' : 'success'}
            action={
              invoice.cufe !== '—' ? (
                <button
                  type="button"
                  onClick={copyCufe}
                  aria-label="Copiar CUFE"
                  title={invoice.cufe}
                  style={{
                    width: 34,
                    height: 34,
                    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 11,
                    background: ORDER_DETAIL_THEME.cardBg,
                    color: copiedCufe ? '#16a34a' : ORDER_DETAIL_THEME.primary,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  {copiedCufe ? (
                    <OrderDetailIcons.CheckCircle2 size={15} aria-hidden="true" />
                  ) : (
                    <OrderDetailIcons.Copy size={15} aria-hidden="true" />
                  )}
                </button>
              ) : null
            }
          />
        </div>
      </OrderDetailPanel>

      <OrderDetailPanel style={{ padding: 15 }}>
        <SectionTitle
          icon={OrderDetailIcons.Store}
          title="Datos clave"
          subtitle="Contexto comercial y trazabilidad"
        />
        <div style={{ display: 'grid', gap: 9 }}>
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
          <div
            style={{
              border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
              background: ORDER_DETAIL_THEME.inputBg,
              borderRadius: 15,
              padding: 12,
              display: 'grid',
              gap: 7,
            }}
          >
            <InfoLine label="Creada el:" value={fmtDate(order?.createdAt)} />
            <InfoLine label="Canal:" value={sourceLabel} />
            <InfoLine
              label={branchInfo.isMultiBranch ? 'Sedes:' : 'Código sede:'}
              value={branchInfo.code || 'Sin sede'}
            />
            <InfoLine label="Creada por:" value={admin.displayName} strong />
            <InfoLine label="Rol:" value={admin.role} />
          </div>
        </div>
      </OrderDetailPanel>
    </aside>
  );
}
