import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { OrderDetailIcons } from './OrderDetailIcons';

function StoryBlock({ eyebrow, value, tone = 'primary' }) {
  const colors = {
    success: {
      border: 'rgba(16, 185, 129, 0.32)',
      background: 'rgba(236, 253, 245, 0.72)',
      color: '#047857',
    },
    primary: {
      border: ORDER_DETAIL_THEME.cardBorder,
      background: ORDER_DETAIL_THEME.inputBg,
      color: ORDER_DETAIL_THEME.primary,
    },
    warning: {
      border: 'rgba(245, 158, 11, 0.34)',
      background: 'rgba(255, 251, 235, 0.78)',
      color: '#b45309',
    },
  }[tone];

  return (
    <div
      style={{
        minWidth: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        background: colors.background,
        padding: 13,
      }}
    >
      <div
        style={{
          color: colors.color,
          fontSize: 9,
          fontWeight: 950,
          letterSpacing: '.12em',
          textTransform: 'uppercase',
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 6,
          color: ORDER_DETAIL_THEME.cardText,
          fontSize: 12,
          fontWeight: 760,
          lineHeight: 1.48,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function OrderWhatsAppPreview({
  open,
  preview,
  loading = false,
  error = '',
  onClose,
  onRetry,
  onOpenWhatsApp,
}) {
  if (!open) return null;

  const report = preview?.report || {};
  const recipient = preview?.recipient || {};
  const details = Array.isArray(report.details) ? report.details : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-whatsapp-preview-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100004,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(15, 23, 42, 0.56)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        style={{
          width: 'min(640px, calc(100vw - 28px))',
          maxHeight: 'min(820px, calc(100vh - 28px))',
          overflowY: 'auto',
          border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
          borderRadius: 26,
          background: ORDER_DETAIL_THEME.cardBg,
          color: ORDER_DETAIL_THEME.cardText,
          boxShadow: '0 34px 100px rgba(15, 23, 42, 0.34)',
          padding: 18,
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <span
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 15,
                background: 'rgba(37, 211, 102, 0.14)',
                color: '#128c45',
                border: '1px solid rgba(37, 211, 102, 0.3)',
              }}
            >
              <OrderDetailIcons.MessageCircle size={21} strokeWidth={2.3} />
            </span>

            <div style={{ minWidth: 0 }}>
              <h2
                id="order-whatsapp-preview-title"
                style={{ margin: 0, fontSize: 18, fontWeight: 950 }}
              >
                Informe para WhatsApp
              </h2>
              <p
                style={{
                  margin: '4px 0 0',
                  color: ORDER_DETAIL_THEME.mutedText,
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Revisa el estado antes de abrir el chat del cliente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar vista previa de WhatsApp"
            style={{
              width: 36,
              height: 36,
              minWidth: 36,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 12,
              border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
              background: ORDER_DETAIL_THEME.inputBg,
              color: ORDER_DETAIL_THEME.cardText,
              cursor: 'pointer',
            }}
          >
            <OrderDetailIcons.X size={17} strokeWidth={2.4} />
          </button>
        </header>

        {loading ? (
          <div
            role="status"
            style={{
              marginTop: 18,
              borderRadius: 18,
              background: ORDER_DETAIL_THEME.inputBg,
              padding: 24,
              color: ORDER_DETAIL_THEME.mutedText,
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 850,
            }}
          >
            Preparando el informe con la trazabilidad más reciente…
          </div>
        ) : null}

        {!loading && error ? (
          <div
            role="alert"
            style={{
              marginTop: 18,
              border: '1px solid rgba(244, 63, 94, 0.34)',
              borderRadius: 18,
              background: 'rgba(255, 241, 242, 0.9)',
              padding: 16,
              color: '#be123c',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: 1.5,
            }}
          >
            {error}
            {typeof onRetry === 'function' ? (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: 'block',
                  marginTop: 12,
                  border: '1px solid rgba(244, 63, 94, 0.34)',
                  borderRadius: 12,
                  background: '#fff',
                  color: '#be123c',
                  padding: '8px 12px',
                  fontSize: 11,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Intentar nuevamente
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !error && preview ? (
          <>
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 16,
                background: ORDER_DETAIL_THEME.inputBg,
                padding: '11px 13px',
              }}
            >
              <div>
                <div
                  style={{
                    color: ORDER_DETAIL_THEME.mutedText,
                    fontSize: 9,
                    fontWeight: 950,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  Cliente
                </div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 900 }}>
                  {recipient.name || 'Cliente'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    color: ORDER_DETAIL_THEME.mutedText,
                    fontSize: 9,
                    fontWeight: 950,
                    letterSpacing: '.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  WhatsApp
                </div>
                <div style={{ marginTop: 3, fontSize: 13, fontWeight: 900 }}>
                  {recipient.maskedPhone || 'Sin número'}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 9,
              }}
              className="order-whatsapp-story-grid"
            >
              <StoryBlock eyebrow="Qué pasó" value={report.happened} tone="success" />
              <StoryBlock eyebrow="Estado actual" value={report.current} />
              <StoryBlock eyebrow="Qué sigue" value={report.next} tone="warning" />
            </div>

            {details.length ? (
              <div
                style={{
                  marginTop: 12,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 8,
                }}
                className="order-whatsapp-detail-grid"
              >
                {details.map((detail) => (
                  <div
                    key={`${detail.label}-${detail.value}`}
                    style={{
                      minWidth: 0,
                      border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                      borderRadius: 14,
                      padding: 11,
                    }}
                  >
                    <div
                      style={{
                        color: ORDER_DETAIL_THEME.mutedText,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase',
                      }}
                    >
                      {detail.label}
                    </div>
                    <div
                      style={{
                        marginTop: 4,
                        color: ORDER_DETAIL_THEME.cardText,
                        fontSize: 11,
                        fontWeight: 820,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {detail.value}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 12,
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 18,
                background: ORDER_DETAIL_THEME.inputBg,
                padding: 14,
              }}
            >
              <div
                style={{
                  color: ORDER_DETAIL_THEME.mutedText,
                  fontSize: 9,
                  fontWeight: 950,
                  letterSpacing: '.12em',
                  textTransform: 'uppercase',
                }}
              >
                Mensaje que verá el cliente
              </div>
              <pre
                style={{
                  margin: '10px 0 0',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  color: ORDER_DETAIL_THEME.cardText,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 680,
                  lineHeight: 1.55,
                }}
              >
                {preview.message}
              </pre>
            </div>

            <p
              style={{
                margin: '12px 2px 0',
                color: ORDER_DETAIL_THEME.mutedText,
                fontSize: 10,
                fontWeight: 720,
                lineHeight: 1.45,
              }}
            >
              Se abrirá WhatsApp con el mensaje preparado. La tienda no marcará
              el mensaje como enviado ni leído porque esta modalidad requiere
              que el administrador confirme el envío dentro de WhatsApp.
            </p>

            <footer
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 9,
                flexWrap: 'wrap',
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  minHeight: 42,
                  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                  borderRadius: 14,
                  background: ORDER_DETAIL_THEME.cardBg,
                  color: ORDER_DETAIL_THEME.cardText,
                  padding: '0 16px',
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <a
                href={preview.whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onOpenWhatsApp}
                style={{
                  minHeight: 42,
                  border: '1px solid rgba(18, 140, 69, 0.26)',
                  borderRadius: 14,
                  background: '#128c45',
                  color: '#fff',
                  padding: '0 17px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 950,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  boxShadow: '0 12px 26px rgba(18, 140, 69, 0.2)',
                }}
              >
                <OrderDetailIcons.MessageCircle size={16} strokeWidth={2.4} />
                Abrir WhatsApp
              </a>
            </footer>
          </>
        ) : null}

        <style>{`
          @media (max-width: 680px) {
            .order-whatsapp-story-grid,
            .order-whatsapp-detail-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>
      </section>
    </div>
  );
}
