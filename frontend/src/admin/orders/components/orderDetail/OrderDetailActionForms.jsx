import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { OrderDetailIcons } from './OrderDetailIcons';
import { GhostButton, PrimaryButton, SoftBadge } from './OrderDetailPrimitives';
import { STATUS_OPTIONS } from './orderActionToolbarModel';
import { ActionLabel } from './OrderDetailActionControls';

const CARD_STYLE = {
  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
  background: ORDER_DETAIL_THEME.inputBg,
  borderRadius: 18,
  padding: 14,
  minWidth: 0,
};

const FORM_ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  gap: 9,
  alignItems: 'center',
  marginTop: 8,
};

export function OrderStatusActionCard({
  disabled,
  onSave,
  setStatusLocal,
  statusBlocked = false,
  statusLocal,
  statusOptions = STATUS_OPTIONS,
}) {
  return (
    <div style={CARD_STYLE}>
      <ActionLabel>Estado de la orden</ActionLabel>

      <div style={FORM_ROW_STYLE}>
        <select
          value={statusLocal}
          onChange={(event) => setStatusLocal(event.target.value)}
          disabled={disabled}
          style={{
            width: '100%',
            minHeight: 42,
            border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
            background: ORDER_DETAIL_THEME.cardBg,
            color: ORDER_DETAIL_THEME.inputText,
            borderRadius: 14,
            padding: '0 12px',
            outline: 'none',
            fontSize: 13,
            fontWeight: 850,
          }}
        >
          {statusOptions.map((option) => (
            <option
              key={option.code}
              value={option.code}
              disabled={option.disabled === true}
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
          onClick={onSave}
          disabled={disabled || statusBlocked}
          icon={<OrderDetailIcons.CheckCircle2 size={15} strokeWidth={2.4} />}
        >
          {disabled ? 'Guardando…' : 'Guardar'}
        </PrimaryButton>
      </div>
      {statusBlocked ? (
        <p style={{ margin: '8px 0 0', color: ORDER_DETAIL_THEME.warning, fontSize: 11 }}>
          El estado Pagado solo se habilita después de confirmar el pago por su flujo seguro.
        </p>
      ) : null}
    </div>
  );
}

export function OrderTagsActionCard({
  currentTags,
  onSave,
  savingTags,
  setTagsStr,
  tagsStr,
}) {
  return (
    <div style={CARD_STYLE}>
      <ActionLabel>Etiquetas internas</ActionLabel>

      <div style={FORM_ROW_STYLE}>
        <input
          value={tagsStr}
          onChange={(event) => setTagsStr(event.target.value)}
          placeholder="vip, urgente, mayorista..."
          style={{
            width: '100%',
            minHeight: 42,
            border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
            background: ORDER_DETAIL_THEME.cardBg,
            color: ORDER_DETAIL_THEME.inputText,
            borderRadius: 14,
            padding: '0 12px',
            outline: 'none',
            fontSize: 13,
            fontWeight: 750,
          }}
        />

        <GhostButton
          onClick={onSave}
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
  );
}
