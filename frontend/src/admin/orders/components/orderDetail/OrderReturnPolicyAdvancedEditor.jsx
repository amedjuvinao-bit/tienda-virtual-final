import { useEffect, useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { OrderDetailIcons } from './OrderDetailIcons';

const SCOPE_OPTIONS = [
  ['category', 'Categoría', 'Ej.: calzado, tecnología'],
  ['product', 'Producto o SKU', 'Ej.: ID del producto o SKU'],
  ['market', 'Canal de venta', 'Ej.: web, pos, manual'],
  ['commercial_condition', 'Condición comercial', 'Ej.: liquidación, mayorista'],
];

const RESOLUTION_OPTIONS = [
  ['refund', 'Reembolso'],
  ['exchange', 'Cambio'],
  ['store_credit', 'Saldo a favor'],
];

const fieldStyle = (extra = {}) => ({
  width: '100%',
  minWidth: 0,
  border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
  background: ORDER_DETAIL_THEME.inputBg,
  color: ORDER_DETAIL_THEME.inputText,
  borderRadius: 12,
  padding: '10px 12px',
  fontSize: 12,
  outline: 'none',
  ...extra,
});

const labelStyle = {
  display: 'flex',
  minWidth: 0,
  flexDirection: 'column',
  gap: 5,
  color: ORDER_DETAIL_THEME.cardText,
  fontSize: 10,
  fontWeight: 850,
};

const checkboxStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: ORDER_DETAIL_THEME.cardText,
  fontSize: 11,
  fontWeight: 800,
};

function positiveInteger(value, fallback = 0) {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
}

function listFromText(value) {
  return Array.from(
    new Set(
      String(value || '')
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean)
    )
  ).slice(0, 30);
}

function ruleDecision(rule = {}) {
  if (rule.returnable === false) return 'block';
  if (rule.requireManualReview === true) return 'manual_review';
  return 'allow';
}

function ruleKey(rules = []) {
  const used = new Set(rules.map((rule) => String(rule.key || '')));
  let position = rules.length + 1;
  while (used.has(`special-${position}`)) position += 1;
  return `special-${position}`;
}

function AdvancedSection({ icon: Icon, title, helper, children }) {
  return (
    <section
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.cardBg,
        borderRadius: 17,
        padding: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 34,
            height: 34,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: '0 0 auto',
            borderRadius: 12,
            background: ORDER_DETAIL_THEME.primarySoftBg,
            color: ORDER_DETAIL_THEME.primary,
          }}
        >
          <Icon size={17} strokeWidth={2.3} />
        </span>
        <div>
          <strong style={{ display: 'block', color: ORDER_DETAIL_THEME.cardText, fontSize: 13 }}>
            {title}
          </strong>
          <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, lineHeight: 1.4 }}>
            {helper}
          </span>
        </div>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function PolicyRuleCard({ rule, index, disabled, onChange, onRemove }) {
  const scope = rule.scope || { type: 'category', values: [] };
  const scopeMeta = SCOPE_OPTIONS.find(([value]) => value === scope.type) || SCOPE_OPTIONS[0];
  const [scopeText, setScopeText] = useState((scope.values || []).join(', '));

  useEffect(() => {
    setScopeText((scope.values || []).join(', '));
  }, [rule.key, (scope.values || []).join('|')]);
  const toggleResolution = (value) => {
    const next = new Set(rule.allowedResolutions || []);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange({ allowedResolutions: Array.from(next) });
  };

  return (
    <article
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 15,
        padding: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ display: 'block', color: ORDER_DETAIL_THEME.cardText, fontSize: 12 }}>
            Regla {index + 1} · {rule.name || 'Sin nombre'}
          </strong>
          <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9 }}>
            La regla de mayor prioridad que coincida será la aplicada.
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={checkboxStyle}>
            <input
              aria-label={`Regla ${index + 1} activa`}
              type="checkbox"
              checked={rule.enabled !== false}
              disabled={disabled}
              onChange={(event) => onChange({ enabled: event.target.checked })}
            />
            Activa
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            style={{
              border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
              background: ORDER_DETAIL_THEME.cardBg,
              color: ORDER_DETAIL_THEME.danger,
              borderRadius: 11,
              padding: '7px 10px',
              fontSize: 10,
              fontWeight: 900,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Eliminar
          </button>
        </div>
      </div>

      <div className="order-return-rule-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1.3fr) 95px minmax(160px, 1fr)', gap: 8, marginTop: 11 }}>
        <label style={labelStyle}>
          Nombre que verá el administrador
          <input
            aria-label={`Nombre regla ${index + 1}`}
            value={rule.name || ''}
            disabled={disabled}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Ej.: Tecnología de alto valor"
            style={fieldStyle()}
          />
        </label>
        <label style={labelStyle}>
          Prioridad
          <input
            aria-label={`Prioridad regla ${index + 1}`}
            type="number"
            min="0"
            max="999"
            value={rule.priority ?? index + 1}
            disabled={disabled}
            onChange={(event) => onChange({ priority: positiveInteger(event.target.value) })}
            style={fieldStyle()}
          />
        </label>
        <label style={labelStyle}>
          Resultado
          <select
            aria-label={`Resultado regla ${index + 1}`}
            value={ruleDecision(rule)}
            disabled={disabled}
            onChange={(event) => onChange({
              returnable: event.target.value !== 'block',
              requireManualReview: event.target.value === 'manual_review',
            })}
            style={fieldStyle()}
          >
            <option value="allow">Permitir normalmente</option>
            <option value="manual_review">Exigir revisión manual</option>
            <option value="block">No admite devolución</option>
          </select>
        </label>
      </div>

      <div className="order-return-rule-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, .8fr) minmax(220px, 1.6fr)', gap: 8, marginTop: 9 }}>
        <label style={labelStyle}>
          Se aplica por
          <select
            aria-label={`Alcance regla ${index + 1}`}
            value={scope.type || 'category'}
            disabled={disabled}
            onChange={(event) => onChange({ scope: { ...scope, type: event.target.value } })}
            style={fieldStyle()}
          >
            {SCOPE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label style={labelStyle}>
          Valores separados por coma
          <input
            aria-label={`Valores regla ${index + 1}`}
            value={scopeText}
            disabled={disabled}
            onChange={(event) => setScopeText(event.target.value)}
            onBlur={() => onChange({ scope: { ...scope, values: listFromText(scopeText) } })}
            placeholder={scopeMeta[2]}
            style={fieldStyle()}
          />
        </label>
      </div>

      <div className="order-return-rule-grid" style={{ display: 'grid', gridTemplateColumns: '110px minmax(170px, 1fr) minmax(170px, 1fr)', gap: 8, marginTop: 9 }}>
        <label style={labelStyle}>
          Ventana (días)
          <input
            aria-label={`Ventana regla ${index + 1}`}
            type="number"
            min="1"
            max="365"
            value={rule.windowDays || 30}
            disabled={disabled}
            onChange={(event) => onChange({ windowDays: positiveInteger(event.target.value, 30) })}
            style={fieldStyle()}
          />
        </label>
        <label style={labelStyle}>
          Quién paga el retorno
          <select
            aria-label={`Costo retorno regla ${index + 1}`}
            value={rule.returnShippingPaidBy || 'case_by_case'}
            disabled={disabled}
            onChange={(event) => onChange({ returnShippingPaidBy: event.target.value })}
            style={fieldStyle()}
          >
            <option value="case_by_case">Según el caso</option>
            <option value="store">La tienda</option>
            <option value="customer">El cliente</option>
          </select>
        </label>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 9 }}>
          <label style={checkboxStyle}>
            <input
              aria-label={`Exigir detalle regla ${index + 1}`}
              type="checkbox"
              checked={rule.requireReasonText === true}
              disabled={disabled}
              onChange={(event) => onChange({ requireReasonText: event.target.checked })}
            />
            Exigir explicación del cliente
          </label>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <span style={{ display: 'block', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 850, marginBottom: 6 }}>
          Soluciones permitidas
        </span>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {RESOLUTION_OPTIONS.map(([value, label]) => (
            <label key={value} style={checkboxStyle}>
              <input
                aria-label={`${label} regla ${index + 1}`}
                type="checkbox"
                checked={(rule.allowedResolutions || []).includes(value)}
                disabled={disabled}
                onChange={() => toggleResolution(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </article>
  );
}

export default function OrderReturnPolicyAdvancedEditor({ value = {}, onChange, disabled = false }) {
  const controls = value.riskControls || {};
  const rules = Array.isArray(value.rules) ? value.rules : [];
  const patchControls = (patch) => onChange?.({
    ...value,
    riskControls: { ...controls, ...patch },
  });
  const patchRule = (index, patch) => onChange?.({
    ...value,
    rules: rules.map((rule, position) => (
      position === index ? { ...rule, ...patch } : rule
    )),
  });
  const addRule = () => onChange?.({
    ...value,
    rules: [
      ...rules,
      {
        key: ruleKey(rules),
        name: 'Nueva política especial',
        enabled: true,
        priority: rules.length + 1,
        scope: { type: 'category', values: [] },
        returnable: true,
        windowDays: Number(value.windowDays || 30),
        allowedResolutions: ['refund', 'exchange'],
        requireReasonText: false,
        requireManualReview: false,
        returnShippingPaidBy: value.returnShippingPaidBy || 'case_by_case',
      },
    ],
  });

  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <AdvancedSection
        icon={OrderDetailIcons.ShieldCheck}
        title="Protección antifraude"
        helper="Evalúa el historial antes de autorizar. Una alerta nunca aprueba ni rechaza dinero por sí sola."
      >
        <label style={checkboxStyle}>
          <input
            aria-label="Activar controles antifraude"
            type="checkbox"
            checked={controls.enabled !== false}
            disabled={disabled}
            onChange={(event) => patchControls({ enabled: event.target.checked })}
          />
          Activar revisión de riesgo en devoluciones
        </label>

        <div className="order-return-risk-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(130px, 1fr))', gap: 8, marginTop: 10 }}>
          <label style={labelStyle}>Historial a revisar (días)<input aria-label="Días de historial antifraude" type="number" min="7" max="730" value={controls.lookbackDays ?? 90} disabled={disabled} onChange={(event) => patchControls({ lookbackDays: positiveInteger(event.target.value, 90) })} style={fieldStyle()} /></label>
          <label style={labelStyle}>Revisar desde solicitudes<input aria-label="Solicitudes para revisión" type="number" min="1" max="50" value={controls.reviewRequestCount ?? 3} disabled={disabled} onChange={(event) => patchControls({ reviewRequestCount: positiveInteger(event.target.value, 3) })} style={fieldStyle()} /></label>
          <label style={labelStyle}>Bloquear al llegar a<input aria-label="Solicitudes para bloqueo" type="number" min="2" max="100" value={controls.blockRequestCount ?? 8} disabled={disabled} onChange={(event) => patchControls({ blockRequestCount: positiveInteger(event.target.value, 8) })} style={fieldStyle()} /></label>
          <label style={labelStyle}>Unidades acumuladas<input aria-label="Unidades para revisión" type="number" min="1" max="500" value={controls.reviewUnitCount ?? 5} disabled={disabled} onChange={(event) => patchControls({ reviewUnitCount: positiveInteger(event.target.value, 5) })} style={fieldStyle()} /></label>
          <label style={labelStyle}>Valor acumulado COP<input aria-label="Valor para revisión" type="number" min="0" value={controls.reviewAmount ?? 500000} disabled={disabled} onChange={(event) => patchControls({ reviewAmount: nonNegativeNumber(event.target.value, 500000) })} style={fieldStyle()} /></label>
          <label style={labelStyle}>Rechazos acumulados<input aria-label="Rechazos para revisión" type="number" min="1" max="50" value={controls.reviewRejectedCount ?? 2} disabled={disabled} onChange={(event) => patchControls({ reviewRejectedCount: positiveInteger(event.target.value, 2) })} style={fieldStyle()} /></label>
        </div>

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 10 }}>
          <label style={checkboxStyle}><input aria-label="Revisar identidad incompleta" type="checkbox" checked={controls.manualReviewOnMissingIdentity !== false} disabled={disabled} onChange={(event) => patchControls({ manualReviewOnMissingIdentity: event.target.checked })} /> Revisar si falta identidad estable</label>
          <label style={checkboxStyle}><input aria-label="Revisar excepciones de política" type="checkbox" checked={controls.manualReviewOnPolicyOverride !== false} disabled={disabled} onChange={(event) => patchControls({ manualReviewOnPolicyOverride: event.target.checked })} /> Revisar excepciones autorizadas</label>
        </div>
      </AdvancedSection>

      <AdvancedSection
        icon={OrderDetailIcons.Settings2}
        title="Políticas especiales"
        helper="Cambia la ventana y la solución por categoría, producto, canal o condición comercial."
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
            {rules.length ? `${rules.length} regla(s) configurada(s)` : 'Aún no hay reglas especiales.'}
          </span>
          <button
            type="button"
            disabled={disabled || rules.length >= 30}
            onClick={addRule}
            style={{
              border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
              background: ORDER_DETAIL_THEME.primarySoftBg,
              color: ORDER_DETAIL_THEME.primarySoftText,
              borderRadius: 12,
              padding: '8px 11px',
              fontSize: 10,
              fontWeight: 900,
              cursor: disabled ? 'not-allowed' : 'pointer',
            }}
          >
            Agregar política especial
          </button>
        </div>

        <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
          {rules.map((rule, index) => (
            <PolicyRuleCard
              key={rule.key || index}
              rule={rule}
              index={index}
              disabled={disabled}
              onChange={(patch) => patchRule(index, patch)}
              onRemove={() => onChange?.({ ...value, rules: rules.filter((_, position) => position !== index) })}
            />
          ))}
        </div>
      </AdvancedSection>

      <style>{`
        @media (max-width: 760px) {
          .order-return-risk-grid,
          .order-return-rule-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 520px) {
          .order-return-risk-grid,
          .order-return-rule-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
