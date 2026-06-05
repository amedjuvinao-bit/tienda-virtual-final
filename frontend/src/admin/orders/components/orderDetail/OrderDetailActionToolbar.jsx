// frontend/src/admin/orders/components/orderDetail/OrderDetailActionToolbar.jsx

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { normalizeTags } from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  GhostButton,
  PrimaryButton,
  SoftBadge,
} from './OrderDetailPrimitives';

const STATUS_OPTIONS = [
  { code: 'pending', label: 'Pendiente' },
  { code: 'processing', label: 'Procesando' },
  { code: 'paid', label: 'Pagado' },
  { code: 'failed', label: 'Fallido / Rechazado' },
  { code: 'shipped', label: 'Enviado' },
  { code: 'cancelled', label: 'Cancelado' },
  { code: 'refunded', label: 'Reembolsado' },
];

function normalizeTagValue(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export default function OrderDetailActionToolbar({
  order,

  statusLocal,
  setStatusLocal,
  onSaveStatus,
  disabled = false,

  tagsStr,
  setTagsStr,
  onSaveTags,
  savingTags = false,

  printed = false,
  archived = false,
  onTogglePrinted,
  onToggleArchived,

  emailMenuOpen = false,
  setEmailMenuOpen,
  emailBtnRef,
  onSendEmail,

  loadingAux = false,
  onRefreshTimeline,
}) {
  const currentTags = normalizeTags(order?.tags);

  const saveStatus = async () => {
    if (!order?._id || !onSaveStatus) return;

    try {
      await onSaveStatus(order._id, statusLocal);
      if (onRefreshTimeline) await onRefreshTimeline();
    } catch {
      // El componente principal mantiene la alerta/error si ya existe.
    }
  };

  const saveTags = async () => {
    if (!order?._id || !onSaveTags) return;

    const parts = String(tagsStr || '')
      .split(',')
      .map((tag) => normalizeTagValue(tag))
      .filter(Boolean);

    try {
      await onSaveTags(order._id, parts);
      if (onRefreshTimeline) await onRefreshTimeline();
    } catch {
      // El componente principal mantiene la alerta/error si ya existe.
    }
  };

  const togglePrinted = async () => {
    if (!order?._id || !onTogglePrinted) return;

    try {
      await onTogglePrinted(order._id, !printed);
      if (onRefreshTimeline) await onRefreshTimeline();
    } catch {
      // Silencioso para mantener comportamiento actual.
    }
  };

  const toggleArchived = async () => {
    if (!order?._id || !onToggleArchived) return;

    try {
      await onToggleArchived(order._id, !archived);
      if (onRefreshTimeline) await onRefreshTimeline();
    } catch {
      // Silencioso para mantener comportamiento actual.
    }
  };

  return (
    <section
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        color: ORDER_DETAIL_THEME.cardText,
        borderRadius: 24,
        padding: 16,
        boxShadow: '0 14px 42px rgba(15, 23, 42, 0.08)',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1.4fr 1fr',
          gap: 14,
          alignItems: 'stretch',
        }}
      >
        <div
          style={{
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            background: ORDER_DETAIL_THEME.inputBg,
            borderRadius: 18,
            padding: 14,
            minWidth: 0,
          }}
        >
          <Label>Estado de la orden</Label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 9,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <select
              value={statusLocal}
              onChange={(event) => setStatusLocal(event.target.value)}
              disabled={disabled}
              style={{
                width: '100%',
                minHeight: 40,
                border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
                background: ORDER_DETAIL_THEME.inputBg,
                color: ORDER_DETAIL_THEME.inputText,
                borderRadius: 14,
                padding: '0 12px',
                outline: 'none',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {STATUS_OPTIONS.map((option) => (
                <option
                  key={option.code}
                  value={option.code}
                  style={{
                    background: ORDER_DETAIL_THEME.inputBg,
                    color: ORDER_DETAIL_THEME.inputText,
                  }}
                >
                  {option.label}
                </option>
              ))}
            </select>

            <PrimaryButton
              onClick={saveStatus}
              disabled={disabled}
              icon={<OrderDetailIcons.CheckCircle2 size={15} strokeWidth={2.4} />}
            >
              {disabled ? 'Guardando…' : 'Guardar'}
            </PrimaryButton>
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            background: ORDER_DETAIL_THEME.inputBg,
            borderRadius: 18,
            padding: 14,
            minWidth: 0,
          }}
        >
          <Label>Etiquetas internas</Label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: 9,
              alignItems: 'center',
              marginTop: 8,
            }}
          >
            <input
              value={tagsStr}
              onChange={(event) => setTagsStr(event.target.value)}
              placeholder="vip, urgente, mayorista..."
              style={{
                width: '100%',
                minHeight: 40,
                border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
                background: ORDER_DETAIL_THEME.inputBg,
                color: ORDER_DETAIL_THEME.inputText,
                borderRadius: 14,
                padding: '0 12px',
                outline: 'none',
                fontSize: 13,
                fontWeight: 750,
              }}
            />

            <GhostButton
              onClick={saveTags}
              disabled={savingTags}
              icon={<OrderDetailIcons.Tag size={15} strokeWidth={2.4} />}
            >
              {savingTags ? 'Guardando…' : 'Guardar tags'}
            </GhostButton>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 7,
              marginTop: 10,
            }}
          >
            {currentTags.length > 0 ? (
              currentTags.map((tag) => (
                <SoftBadge key={tag} variant="primary">
                  #{tag}
                </SoftBadge>
              ))
            ) : (
              <SoftBadge variant="neutral">Sin etiquetas</SoftBadge>
            )}
          </div>
        </div>

        <div
          style={{
            border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
            background: ORDER_DETAIL_THEME.inputBg,
            borderRadius: 18,
            padding: 14,
            minWidth: 0,
          }}
        >
          <Label>Acciones rápidas</Label>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 8,
            }}
          >
            <GhostButton
              onClick={togglePrinted}
              disabled={disabled}
              icon={<OrderDetailIcons.FileText size={15} strokeWidth={2.4} />}
            >
              {printed ? 'Quitar impresa' : 'Marcar impresa'}
            </GhostButton>

            <GhostButton
              onClick={toggleArchived}
              disabled={disabled}
              icon={<OrderDetailIcons.PackageCheck size={15} strokeWidth={2.4} />}
            >
              {archived ? 'Desarchivar' : 'Archivar'}
            </GhostButton>

            <div
              ref={emailBtnRef}
              style={{
                position: 'relative',
                display: 'inline-flex',
              }}
            >
              <GhostButton
                onClick={() => setEmailMenuOpen((value) => !value)}
                disabled={loadingAux}
                icon={<OrderDetailIcons.Mail size={15} strokeWidth={2.4} />}
              >
                Enviar email
              </GhostButton>

              {emailMenuOpen ? (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    zIndex: 40,
                    width: 230,
                    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                    background: ORDER_DETAIL_THEME.cardBg,
                    color: ORDER_DETAIL_THEME.cardText,
                    borderRadius: 16,
                    boxShadow: '0 18px 45px rgba(15, 23, 42, 0.18)',
                    padding: 8,
                  }}
                >
                  <EmailButton onClick={() => onSendEmail('confirmation')}>
                    Confirmación de compra
                  </EmailButton>

                  <EmailButton onClick={() => onSendEmail('status')}>
                    Actualización de estado
                  </EmailButton>

                  <EmailButton onClick={() => onSendEmail('payment')}>
                    Información de pago
                  </EmailButton>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <style>
        {`
          @media (max-width: 1100px) {
            div[style*="grid-template-columns: 1.1fr 1.4fr 1fr"] {
              grid-template-columns: 1fr !important;
            }
          }

          @media (max-width: 640px) {
            div[style*="grid-template-columns: minmax(0, 1fr) auto"] {
              grid-template-columns: 1fr !important;
            }
          }
        `}
      </style>
    </section>
  );
}

function Label({ children }) {
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

function EmailButton({ children, onClick }) {
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