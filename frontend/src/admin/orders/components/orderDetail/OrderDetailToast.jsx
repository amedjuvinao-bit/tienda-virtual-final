import { ORDER_DETAIL_THEME } from './orderDetailTheme';

export default function OrderDetailToast({ toast, onClose }) {
  const type = toast?.type || 'info';
  const meta = {
    success: {
      label: 'OK',
      color: '#059669',
      bg: 'rgba(236, 253, 245, 0.98)',
      border: 'rgba(16, 185, 129, 0.36)',
    },
    error: {
      label: 'Error',
      color: '#dc2626',
      bg: 'rgba(255, 241, 242, 0.98)',
      border: 'rgba(244, 63, 94, 0.36)',
    },
    warning: {
      label: 'Aviso',
      color: '#d97706',
      bg: 'rgba(255, 251, 235, 0.98)',
      border: 'rgba(245, 158, 11, 0.38)',
    },
    info: {
      label: 'Info',
      color: ORDER_DETAIL_THEME.primary,
      bg: ORDER_DETAIL_THEME.cardBg,
      border: ORDER_DETAIL_THEME.cardBorder,
    },
  }[type] || {
    label: 'Info',
    color: ORDER_DETAIL_THEME.primary,
    bg: ORDER_DETAIL_THEME.cardBg,
    border: ORDER_DETAIL_THEME.cardBorder,
  };

  return (
    <div
      style={{
        position: 'fixed',
        right: 24,
        top: 24,
        zIndex: 100002,
        width: 'min(420px, calc(100vw - 32px))',
        border: `1px solid ${meta.border}`,
        borderRadius: 22,
        background: meta.bg,
        color: ORDER_DETAIL_THEME.cardText,
        boxShadow: '0 24px 70px rgba(15, 23, 42, 0.25)',
        overflow: 'hidden',
        backdropFilter: 'blur(14px)',
      }}
      role="status"
      aria-live="polite"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 13,
          padding: 16,
        }}
      >
        <div
          style={{
            minWidth: 40,
            height: 40,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.72)',
            color: meta.color,
            border: `1px solid ${meta.border}`,
            fontSize: 12,
            fontWeight: 950,
            textTransform: 'uppercase',
          }}
        >
          {meta.label}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              margin: 0,
              color: ORDER_DETAIL_THEME.cardText,
              fontSize: 14,
              fontWeight: 950,
              lineHeight: 1.2,
            }}
          >
            {toast?.title || 'Notificación'}
          </div>

          {toast?.message ? (
            <div
              style={{
                marginTop: 5,
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 12,
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              {toast.message}
            </div>
          ) : null}

          {toast?.actionLabel && typeof toast?.onAction === 'function' ? (
            <button
              type="button"
              onClick={toast.onAction}
              style={{
                marginTop: 12,
                border: 'none',
                borderRadius: 999,
                background: meta.color,
                color: '#fff',
                padding: '9px 13px',
                fontSize: 11,
                fontWeight: 950,
                cursor: 'pointer',
                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.16)',
              }}
            >
              {toast.actionLabel}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          style={{
            width: 32,
            height: 32,
            borderRadius: 12,
            border: `1px solid ${meta.border}`,
            background: 'rgba(255,255,255,0.72)',
            color: ORDER_DETAIL_THEME.cardText,
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
    </div>
  );
}
