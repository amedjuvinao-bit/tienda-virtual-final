import { ORDER_DETAIL_THEME } from './orderDetailTheme';

export function ActionButton({
  children,
  onClick,
  disabled = false,
  icon = null,
  title = '',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: '100%',
        minHeight: 42,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: disabled ? ORDER_DETAIL_THEME.inputBg : ORDER_DETAIL_THEME.cardBg,
        color: disabled ? ORDER_DETAIL_THEME.mutedText : ORDER_DETAIL_THEME.primary,
        borderRadius: 14,
        padding: '0 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 10,
        fontSize: 12,
        fontWeight: 950,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        transition: 'transform 0.16s ease, filter 0.16s ease, border-color 0.16s ease',
      }}
      onMouseEnter={(event) => {
        if (!disabled) {
          event.currentTarget.style.transform = 'translateY(-1px)';
          event.currentTarget.style.filter = 'brightness(1.03)';
          event.currentTarget.style.borderColor = ORDER_DETAIL_THEME.primary;
        }
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = 'translateY(0)';
        event.currentTarget.style.filter = 'brightness(1)';
        event.currentTarget.style.borderColor = ORDER_DETAIL_THEME.cardBorder;
      }}
    >
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function ActionLabel({ children }) {
  return (
    <span
      style={{
        display: 'block',
        color: ORDER_DETAIL_THEME.mutedText,
        fontSize: 10,
        fontWeight: 950,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  );
}

export function EmailButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        border: 'none',
        background: 'transparent',
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: 12,
        padding: '10px 11px',
        textAlign: 'left',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
      }}
      onMouseEnter={(event) => {
        event.currentTarget.style.background = ORDER_DETAIL_THEME.primarySoftBg;
        event.currentTarget.style.color = ORDER_DETAIL_THEME.primary;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.background = 'transparent';
        event.currentTarget.style.color = ORDER_DETAIL_THEME.cardText;
      }}
    >
      {children}
    </button>
  );
}
