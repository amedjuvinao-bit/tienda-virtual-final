import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { IconBadge, OrderDetailIcons } from './OrderDetailIcons';

export default function OrderDetailManagementDisclosure({ children }) {
  if (!children) return null;

  return (
    <details
      className="order-detail-management"
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: 20,
        boxShadow: '0 14px 38px rgba(15, 23, 42, 0.08)',
        overflow: 'hidden',
      }}
    >
      <summary
        style={{
          padding: 14,
          display: 'grid',
          gridTemplateColumns: '38px minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
          listStyle: 'none',
          userSelect: 'none',
        }}
      >
        <IconBadge icon={OrderDetailIcons.Zap} size={38} iconSize={16} />
        <span style={{ minWidth: 0 }}>
          <strong style={{ display: 'block', fontSize: 13, fontWeight: 950 }}>
            Gestionar orden
          </strong>
          <small
            style={{
              display: 'block',
              marginTop: 3,
              color: ORDER_DETAIL_THEME.mutedText,
              fontSize: 10,
              fontWeight: 650,
            }}
          >
            Estado, etiquetas y acciones internas
          </small>
        </span>
        <OrderDetailIcons.MoreHorizontal
          size={18}
          color={ORDER_DETAIL_THEME.primary}
          aria-hidden="true"
        />
      </summary>

      <div
        style={{
          borderTop: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
          padding: 12,
        }}
      >
        {children}
      </div>

      <style>
        {`
          .order-detail-management > summary::-webkit-details-marker {
            display: none;
          }

          .order-detail-management[open] {
            overflow: visible !important;
          }
        `}
      </style>
    </details>
  );
}
