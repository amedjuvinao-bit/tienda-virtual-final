import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { fmtDate } from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  MiniInfoCard,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';
import { FLOW_LABELS, FLOW_STEPS } from './orderSummaryRailModel';

export function OrderDetailProgressPanel({ progress, statusLabel }) {
  const terminal = progress?.kind === 'terminal';

  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.Clock3}
        title="Progreso del pedido"
        subtitle={terminal ? 'Cierre comercial de la orden' : 'Estado operativo actual'}
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
          {progress?.summary}
        </span>
        <SoftBadge>{statusLabel}</SoftBadge>
      </div>

      {terminal ? (
        <div
          style={{
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            borderRadius: 18,
            background: ORDER_DETAIL_THEME.primarySoftBg,
            padding: '14px 15px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 11,
          }}
        >
          <OrderDetailIcons.RotateCcw
            aria-hidden="true"
            size={18}
            style={{ color: ORDER_DETAIL_THEME.primary, flexShrink: 0, marginTop: 1 }}
          />
          <div>
            <strong
              style={{
                display: 'block',
                color: ORDER_DETAIL_THEME.cardText,
                fontSize: 13,
                fontWeight: 900,
                marginBottom: 4,
              }}
            >
              {progress.title}
            </strong>
            <p
              style={{
                margin: 0,
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 11,
                fontWeight: 650,
                lineHeight: 1.4,
              }}
            >
              {progress.description}
            </p>
          </div>
        </div>
      ) : (
        <>
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
                width: `${progress?.percent}%`,
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
        </>
      )}
    </OrderDetailPanel>
  );
}

export function OrderDetailQuickInfoPanel({ branchInfo, order, summary }) {
  return (
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
  );
}

export function OrderDetailTraceabilityPanel({
  admin,
  branchInfo,
  order,
  sourceLabel,
}) {
  return (
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
  );
}
