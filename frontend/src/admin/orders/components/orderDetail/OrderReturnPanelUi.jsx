import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { returnInputStyle } from './orderReturnPanelModel';

export function ReturnMetric({ label, value, tone = '' }) {
  return (
    <div
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        borderRadius: 13,
        padding: '9px 10px',
      }}
    >
      <div style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>
        {label}
      </div>
      <strong style={{ display: 'block', marginTop: 4, color: tone || ORDER_DETAIL_THEME.cardText, fontSize: 13 }}>
        {value}
      </strong>
    </div>
  );
}

export function ReturnInspectionField({
  label,
  helper,
  ariaLabel,
  value,
  max,
  onChange,
}) {
  return (
    <label
      style={{
        display: 'flex',
        minWidth: 0,
        flexDirection: 'column',
        gap: 4,
        padding: 9,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 13,
      }}
    >
      <strong style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>
        {label}
      </strong>
      <span style={{ minHeight: 26, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, lineHeight: 1.35 }}>
        {helper}
      </span>
      <input
        aria-label={ariaLabel}
        type="number"
        min="0"
        max={max}
        value={value}
        onChange={onChange}
        style={returnInputStyle({ marginTop: 2 })}
      />
    </label>
  );
}

export function ReturnWorkflowGuide() {
  const steps = [
    ['1', 'Autorizar', 'Valida política y cantidades'],
    ['2', 'Recibir', 'Confirma unidades físicas'],
    ['3', 'Inspeccionar', 'Clasifica cada unidad'],
    ['4', 'Resolver', 'Reembolsa o enlaza cambio'],
  ];

  return (
    <div className="order-return-workflow" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
      {steps.map(([number, title, helper]) => (
        <div key={number} style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 15, padding: 11 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 23, height: 23, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: ORDER_DETAIL_THEME.primarySoftBg, color: ORDER_DETAIL_THEME.primary, fontSize: 11, fontWeight: 950 }}>
              {number}
            </span>
            <strong style={{ fontSize: 12 }}>{title}</strong>
          </div>
          <div style={{ marginTop: 7, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, lineHeight: 1.35 }}>{helper}</div>
        </div>
      ))}
    </div>
  );
}

export function OrderReturnResponsiveStyles() {
  return (
    <style>{`
      @media (max-width: 840px) {
        .order-return-workflow,
        .order-return-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .order-return-inspection-fields { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .order-return-policy-grid,
        .order-return-request-line { grid-template-columns: 1fr 1fr !important; }
      }
      @media (max-width: 560px) {
        .order-return-workflow,
        .order-return-metrics,
        .order-return-policy-grid,
        .order-return-form-grid,
        .order-return-request-line,
        .order-return-inspection-fields { grid-template-columns: 1fr !important; }
      }
    `}</style>
  );
}
