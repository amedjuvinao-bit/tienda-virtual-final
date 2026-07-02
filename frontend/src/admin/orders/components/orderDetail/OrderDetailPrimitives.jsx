// frontend/src/admin/orders/components/orderDetail/OrderDetailPrimitives.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { IconBadge } from './OrderDetailIcons';

export function OrderDetailPanel({
  children,
  className = '',
  style = {},
}) {
  return (
    <section
      className={className}
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: 24,
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.10)',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function SectionTitle({
  icon,
  title,
  subtitle = '',
  action = null,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 14,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          minWidth: 0,
        }}
      >
        {icon ? <IconBadge icon={icon} size={40} iconSize={17} /> : null}

        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
            }}
          >
            {title}
          </h3>

          {subtitle ? (
            <p
              style={{
                margin: '4px 0 0',
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.35,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {action ? <div style={{ flexShrink: 0 }}>{action}</div> : null}
    </div>
  );
}

export function InfoLine({
  label,
  value,
  title = '',
  strong = false,
}) {
  return (
    <div
      style={{
        minWidth: 0,
        color: ORDER_DETAIL_THEME.cardText,
        fontSize: 13,
        lineHeight: 1.35,
      }}
    >
      <span
        style={{
          display: 'inline',
          color: ORDER_DETAIL_THEME.mutedText,
          fontWeight: 700,
          marginRight: 5,
        }}
      >
        {label}
      </span>

      <strong
        title={title || String(value || '')}
        style={{
          color: strong ? ORDER_DETAIL_THEME.primary : ORDER_DETAIL_THEME.cardText,
          fontWeight: strong ? 900 : 750,
          overflowWrap: 'anywhere',
        }}
      >
        {value || '—'}
      </strong>
    </div>
  );
}

export function MiniInfoCard({
  label,
  value,
  icon,
  code = false,
  accent = false,
}) {
  return (
    <div
      style={{
        minWidth: 0,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: 16,
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      {icon ? <IconBadge icon={icon} size={34} iconSize={15} variant="soft" /> : null}

      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.11em',
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          {label}
        </span>

        <strong
          title={String(value || '')}
          style={{
            display: 'block',
            color: accent ? ORDER_DETAIL_THEME.primary : ORDER_DETAIL_THEME.cardText,
            fontFamily: code
              ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
              : 'inherit',
            fontSize: 13,
            fontWeight: 900,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {value || '—'}
        </strong>
      </div>
    </div>
  );
}

export function SummaryMetric({
  label,
  value,
  helper = '',
  icon,
  accent = false,
}) {
  return (
    <div
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: accent
          ? `linear-gradient(135deg, ${ORDER_DETAIL_THEME.primarySoftBg}, ${ORDER_DETAIL_THEME.cardBg})`
          : ORDER_DETAIL_THEME.inputBg,
        borderRadius: 20,
        padding: 16,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span
          style={{
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>

        {icon ? <IconBadge icon={icon} size={34} iconSize={15} /> : null}
      </div>

      <strong
        title={String(value || '')}
        style={{
          display: 'block',
          color: accent ? ORDER_DETAIL_THEME.primary : ORDER_DETAIL_THEME.cardText,
          fontSize: accent ? 21 : 18,
          fontWeight: 950,
          lineHeight: 1.05,
          letterSpacing: '-0.04em',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value || '—'}
      </strong>

      {helper ? (
        <span
          style={{
            display: 'block',
            marginTop: 7,
            color: ORDER_DETAIL_THEME.mutedText,
            fontSize: 11,
            fontWeight: 650,
          }}
        >
          {helper}
        </span>
      ) : null}
    </div>
  );
}

export function SoftBadge({
  children,
  variant = 'primary',
  title = '',
}) {
  const variants = {
    primary: {
      background: ORDER_DETAIL_THEME.primarySoftBg,
      color: ORDER_DETAIL_THEME.primary,
      borderColor: ORDER_DETAIL_THEME.cardBorder,
    },
    neutral: {
      background: ORDER_DETAIL_THEME.inputBg,
      color: ORDER_DETAIL_THEME.mutedText,
      borderColor: ORDER_DETAIL_THEME.cardBorder,
    },
    success: {
      background: 'rgba(34, 197, 94, 0.12)',
      color: '#16a34a',
      borderColor: 'rgba(34, 197, 94, 0.25)',
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.12)',
      color: '#d97706',
      borderColor: 'rgba(245, 158, 11, 0.25)',
    },
    danger: {
      background: 'rgba(239, 68, 68, 0.12)',
      color: '#dc2626',
      borderColor: 'rgba(239, 68, 68, 0.25)',
    },
  };

  const current = variants[variant] || variants.primary;

  return (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `1px solid ${current.borderColor}`,
        background: current.background,
        color: current.color,
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function GhostButton({
  children,
  onClick,
  disabled = false,
  icon = null,
  type = 'button',
  title = '',
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 38,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: disabled ? ORDER_DETAIL_THEME.inputBg : ORDER_DETAIL_THEME.primarySoftBg,
        color: disabled ? ORDER_DETAIL_THEME.mutedText : ORDER_DETAIL_THEME.primary,
        borderRadius: 14,
        padding: '0 14px',
        fontSize: 12,
        fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'transform 0.16s ease, filter 0.16s ease',
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          event.currentTarget.style.transform = 'translateY(-1px)';
          event.currentTarget.style.filter = 'brightness(1.04)';
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  onClick,
  disabled = false,
  icon = null,
  type = 'button',
  title = '',
}) {
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 40,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        border: 'none',
        background: `linear-gradient(135deg, ${ORDER_DETAIL_THEME.primary}, ${ORDER_DETAIL_THEME.primaryHover})`,
        color: ORDER_DETAIL_THEME.primaryText,
        borderRadius: 15,
        padding: '0 16px',
        fontSize: 12,
        fontWeight: 950,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: '0 14px 30px rgba(236, 72, 153, 0.24)',
        transition: 'transform 0.16s ease, filter 0.16s ease',
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          event.currentTarget.style.transform = 'translateY(-1px)';
          event.currentTarget.style.filter = 'brightness(1.05)';
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {icon}
      {children}
    </button>
  );
}

export function EmptyState({
  children = 'Sin información disponible.',
}) {
  return (
    <div
      style={{
        border: `1px dashed ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        color: ORDER_DETAIL_THEME.mutedText,
        borderRadius: 18,
        padding: 18,
        fontSize: 12,
        fontWeight: 700,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
}