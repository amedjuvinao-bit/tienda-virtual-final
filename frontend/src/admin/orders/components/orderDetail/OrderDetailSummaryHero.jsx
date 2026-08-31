import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { toCOP } from './orderDetailUtils';
import { IconBadge, OrderDetailIcons } from './OrderDetailIcons';

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

export default function OrderDetailSummaryHero({
  breakdown,
  exchange,
  invoice,
  payment,
  status,
  statusLabel,
}) {
  return (
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
          value={exchange.noCharge ? 'Sin cobro' : payment.status}
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
  );
}
