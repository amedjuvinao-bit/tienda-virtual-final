import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { cleanText } from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  EmptyState,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

const STATUS_LABELS = {
  reserved: 'Reservado',
  sold: 'Vendido',
  partially_shipped: 'Despacho parcial',
  shipped: 'Despachado',
  partially_delivered: 'Entrega parcial',
  delivered: 'Entregado',
  partially_returned: 'Devolución parcial',
  returned: 'Devuelto',
  released: 'Liberado',
};

function toQuantity(value) {
  const quantity = Number(value || 0);
  return Number.isFinite(quantity)
    ? Math.max(0, Math.floor(quantity))
    : 0;
}

function branchIdentity(allocation = {}) {
  const branch = allocation?.branch || {};
  const snapshot = allocation?.branchSnapshot || {};
  return String(
    branch?._id ||
      branch?.id ||
      branch ||
      snapshot.code ||
      snapshot.name ||
      'sin-sede'
  );
}

function getBranchInfo(allocation = {}) {
  const branch = allocation?.branch || {};
  const snapshot = allocation?.branchSnapshot || {};
  return {
    name: cleanText(
      snapshot.name || branch?.name || 'Sede sin nombre'
    ),
    code: cleanText(
      snapshot.code || branch?.code || ''
    ).toUpperCase(),
    type: cleanText(snapshot.type || branch?.type || ''),
  };
}

function groupAllocations(allocations = []) {
  const groups = new Map();

  allocations.forEach((allocation) => {
    const key = branchIdentity(allocation);
    const group = groups.get(key) || {
      key,
      branch: getBranchInfo(allocation),
      allocations: [],
      reserved: 0,
      sold: 0,
      shipped: 0,
      delivered: 0,
      returned: 0,
      released: 0,
    };

    group.allocations.push(allocation);
    group.reserved += toQuantity(
      allocation?.reservedQuantity || allocation?.quantity
    );
    group.sold += toQuantity(allocation?.soldQuantity);
    group.shipped += toQuantity(allocation?.shippedQuantity);
    group.delivered += toQuantity(
      allocation?.deliveredQuantity
    );
    group.returned += toQuantity(
      allocation?.returnedQuantity
    );
    group.released += toQuantity(
      allocation?.releasedQuantity
    );
    groups.set(key, group);
  });

  return Array.from(groups.values());
}

function getVariantLabel(allocation = {}) {
  const direct = cleanText(allocation?.variantLabel || '');
  if (direct) return direct;

  const attributes = Array.isArray(
    allocation?.variantAttributes
  )
    ? allocation.variantAttributes
        .map((attribute) => {
          const label = cleanText(
            attribute?.label || attribute?.key || ''
          );
          const value = cleanText(attribute?.value || '');
          return label && value ? `${label}: ${value}` : value;
        })
        .filter(Boolean)
    : [];

  return (
    attributes.join(' · ') ||
    [allocation?.size, allocation?.color]
      .map((value) => cleanText(value))
      .filter(Boolean)
      .join(' / ') ||
    'Presentación general'
  );
}

function QuantityMetric({ label, value, accent = false }) {
  return (
    <div
      style={{
        minWidth: 82,
        borderRadius: 13,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: accent
          ? ORDER_DETAIL_THEME.primarySoftBg
          : ORDER_DETAIL_THEME.inputBg,
        padding: '9px 10px',
      }}
    >
      <span
        style={{
          display: 'block',
          color: ORDER_DETAIL_THEME.mutedText,
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <strong
        style={{
          display: 'block',
          marginTop: 3,
          color: accent
            ? ORDER_DETAIL_THEME.primary
            : ORDER_DETAIL_THEME.cardText,
          fontSize: 16,
          fontWeight: 950,
        }}
      >
        {value}
      </strong>
    </div>
  );
}

export default function OrderDetailInventoryAllocations({
  order,
}) {
  const allocations = Array.isArray(order?.inventoryAllocations)
    ? order.inventoryAllocations
    : [];
  const groups = groupAllocations(allocations);

  if (!allocations.length) return null;

  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.Building2}
        title="Preparación por sedes"
        subtitle="Unidades reservadas, vendidas y despachadas desde cada ubicación"
        action={
          <SoftBadge
            variant={groups.length > 1 ? 'warning' : 'primary'}
          >
            {groups.length} sede(s)
          </SoftBadge>
        }
      />

      {groups.length === 0 ? (
        <EmptyState>
          La orden no tiene asignaciones de inventario.
        </EmptyState>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {groups.map((group) => (
            <article
              key={group.key}
              style={{
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 18,
                background: ORDER_DETAIL_THEME.cardBg,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  padding: 14,
                  background:
                    ORDER_DETAIL_THEME.primarySoftBg,
                  borderBottom: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                }}
              >
                <div>
                  <strong
                    style={{
                      color: ORDER_DETAIL_THEME.cardText,
                      fontSize: 13,
                      fontWeight: 950,
                    }}
                  >
                    {group.branch.name}
                  </strong>
                  <span
                    style={{
                      display: 'block',
                      marginTop: 3,
                      color: ORDER_DETAIL_THEME.mutedText,
                      fontSize: 10,
                      fontWeight: 750,
                    }}
                  >
                    {group.branch.code || 'Sin código'}
                    {group.branch.type
                      ? ` · ${group.branch.type}`
                      : ''}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: 7,
                    flexWrap: 'wrap',
                  }}
                >
                  <QuantityMetric
                    label="Reservadas"
                    value={group.reserved}
                  />
                  <QuantityMetric
                    label="Vendidas"
                    value={group.sold}
                  />
                  <QuantityMetric
                    label="Despachadas"
                    value={group.shipped}
                    accent
                  />
                  <QuantityMetric
                    label="Entregadas"
                    value={group.delivered}
                  />
                  {group.returned > 0 && (
                    <QuantityMetric
                      label="Devueltas"
                      value={group.returned}
                    />
                  )}
                  {group.released > 0 && (
                    <QuantityMetric
                      label="Liberadas"
                      value={group.released}
                    />
                  )}
                </div>
              </div>

              <div style={{ display: 'grid' }}>
                {group.allocations.map((allocation, index) => {
                  const productTitle = cleanText(
                    allocation?.productSnapshot?.title ||
                      'Producto'
                  );
                  const bundleTitle = cleanText(
                    allocation?.bundleParentTitle || ''
                  );
                  const quantity = toQuantity(
                    allocation?.quantity
                  );

                  return (
                    <div
                      key={
                        allocation?._id ||
                        allocation?.reservationItem ||
                        `${group.key}-${index}`
                      }
                      style={{
                        display: 'grid',
                        gridTemplateColumns:
                          'minmax(0, 1fr) auto',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        borderBottom:
                          index ===
                          group.allocations.length - 1
                            ? 'none'
                            : `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <strong
                          style={{
                            display: 'block',
                            color:
                              ORDER_DETAIL_THEME.cardText,
                            fontSize: 12,
                            fontWeight: 900,
                          }}
                        >
                          {bundleTitle
                            ? `${bundleTitle} → ${productTitle}`
                            : productTitle}
                        </strong>
                        <span
                          style={{
                            display: 'block',
                            marginTop: 3,
                            color:
                              ORDER_DETAIL_THEME.mutedText,
                            fontSize: 10,
                            fontWeight: 700,
                          }}
                        >
                          {getVariantLabel(allocation)} ·{' '}
                          {quantity} unidad(es)
                        </span>
                      </div>

                      <SoftBadge
                        variant={
                          allocation?.status === 'returned' ||
                          allocation?.status === 'released'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {STATUS_LABELS[allocation?.status] ||
                          allocation?.status ||
                          'Reservado'}
                      </SoftBadge>
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </OrderDetailPanel>
  );
}
