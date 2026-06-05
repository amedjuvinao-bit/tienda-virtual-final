// frontend/src/admin/orders/components/orderDetail/OrderDetailSummaryRail.jsx

import { ORDER_DETAIL_THEME, getOrderStatusMeta } from './orderDetailTheme';
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

function RailMoneyLine({ label, value, strong = false }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        color: strong ? ORDER_DETAIL_THEME.cardText : ORDER_DETAIL_THEME.mutedText,
        fontSize: strong ? 14 : 12,
        fontWeight: strong ? 950 : 750,
        lineHeight: 1.25,
      }}
    >
      <span>{label}</span>
      <strong
        style={{
          color: strong ? ORDER_DETAIL_THEME.primary : ORDER_DETAIL_THEME.cardText,
          fontSize: strong ? 22 : 13,
          fontWeight: strong ? 950 : 850,
          letterSpacing: strong ? '-0.04em' : 0,
          whiteSpace: 'nowrap',
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
  const status = getOrderStatusMeta(order?.status);
  const summary = getOrderSummary(order);
  const payment = getPaymentInfo(order);
  const invoice = getInvoiceInfo(order);
  const branchInfo = getOrderBranchInfo(order);
  const admin = getAdminSnapshot(order);
  const sourceLabel = getOrderSourceLabel(order?.source);
  const progressPercent = getProgressPercent(order?.status);

  return (
    <aside
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
            {status.label}
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
          {toCOP(summary.total)}
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
          <RailMoneyLine label="Subtotal" value={toCOP(summary.subtotal)} />
          <RailMoneyLine label="Envío" value={toCOP(summary.shipping)} />
          <div style={{ height: 1, background: 'rgba(255,255,255,0.32)' }} />
          <RailMoneyLine label="Total" value={toCOP(summary.total)} strong />
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
            value={invoice.number}
          />
          <RailStatusCard
            icon={OrderDetailIcons.ShieldCheck}
            label="CUFE"
            value={invoice.cufe}
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
          <SoftBadge>{status.label}</SoftBadge>
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
            label="Sede"
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
          <InfoLine label="Código sede:" value={branchInfo.code || 'Sin sede'} />
          <InfoLine label="Creada por:" value={admin.displayName} strong />
          <InfoLine label="Rol:" value={admin.role} />
        </div>
      </OrderDetailPanel>
    </aside>
  );
}
