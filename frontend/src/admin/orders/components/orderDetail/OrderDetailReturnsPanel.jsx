import { useEffect, useMemo, useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { fmtDate, toCOP } from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import OrderReturnPolicyAdvancedEditor from './OrderReturnPolicyAdvancedEditor';
import {
  EmptyState,
  GhostButton,
  OrderDetailPanel,
  PrimaryButton,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

const STATUS_META = {
  requested: ['Solicitado', 'warning'],
  authorized: ['Autorizado', 'primary'],
  rejected: ['Rechazado', 'danger'],
  in_transit: ['En tránsito', 'primary'],
  received: ['Recibido', 'warning'],
  inspected: ['Inspeccionado', 'warning'],
  resolution_required: ['Requiere resolución', 'warning'],
  resolved: ['Resuelto', 'success'],
  cancelled: ['Cancelado', 'neutral'],
};

const REASONS = [
  ['wrong_size', 'Talla incorrecta'],
  ['wrong_item', 'Producto equivocado'],
  ['damaged', 'Llegó averiado'],
  ['defective', 'Defecto de fabricación'],
  ['not_as_described', 'No coincide con la descripción'],
  ['changed_mind', 'Cambio de decisión'],
  ['warranty', 'Garantía'],
  ['other', 'Otro'],
];

const inputStyle = (extra = {}) => ({
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

function itemId(item) {
  return String(item?.orderItemId?._id || item?.orderItemId || item?._id || '');
}

function positiveInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function statusMeta(status) {
  return STATUS_META[status] || [status || 'Sin estado', 'neutral'];
}

function resolutionLabel(value) {
  if (value === 'no_refund') return 'Sin reembolso';
  if (value === 'exchange') return 'Cambio';
  if (value === 'store_credit') return 'Saldo a favor';
  return 'Reembolso';
}

function riskLevelLabel(value) {
  if (value === 'blocked') return 'crítico';
  if (value === 'high') return 'alto';
  if (value === 'medium') return 'medio';
  return 'bajo';
}

function Metric({ label, value, tone = '' }) {
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

function InspectionField({
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
        style={inputStyle({ marginTop: 2 })}
      />
    </label>
  );
}

function WorkflowGuide() {
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

export default function OrderDetailReturnsPanel({
  data = {},
  loading = false,
  busyId = '',
  canManage = false,
  canManagePolicy = false,
  canRefund = false,
  onCreate,
  onAction,
  onRefund,
  onExchange,
  onAutomaticExchange,
  onStoreCredit,
  onSavePolicy,
}) {
  const eligibility = Array.isArray(data?.eligibility) ? data.eligibility : [];
  const returns = Array.isArray(data?.returns) ? data.returns : [];
  const policy = data?.policy || {};
  const [createOpen, setCreateOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [policyDraft, setPolicyDraft] = useState(policy);
  const [resolution, setResolution] = useState('refund');
  const [reasonSummary, setReasonSummary] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [requestItems, setRequestItems] = useState({});
  const [drafts, setDrafts] = useState({});
  const allowedCreateResolutions = (
    Array.isArray(policy.allowedResolutions) && policy.allowedResolutions.length
      ? policy.allowedResolutions
      : ['refund', 'exchange']
  ).filter((value) => policy.storeCreditEnabled !== false || value !== 'store_credit');

  useEffect(() => {
    setCreateOpen(false);
    setResolution('refund');
    setReasonSummary('');
    setOverrideReason('');
    setRequestItems({});
    setDrafts({});
  }, [data?.orderId]);

  useEffect(() => {
    setPolicyDraft(policy);
  }, [policy?.revision, data?.orderId]);

  useEffect(() => {
    if (!allowedCreateResolutions.includes(resolution)) {
      setResolution(allowedCreateResolutions[0] || 'refund');
    }
  }, [allowedCreateResolutions.join('|'), resolution]);

  const patchPolicy = (patch) => {
    setPolicyDraft((current) => ({ ...current, ...patch }));
  };

  const togglePolicyResolution = (value) => {
    const current = new Set(policyDraft.allowedResolutions || []);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    patchPolicy({ allowedResolutions: Array.from(current) });
  };

  const requestable = useMemo(
    () => eligibility.filter((item) => positiveInteger(item.availableQuantity) > 0),
    [eligibility]
  );

  const selectedItems = requestable
    .map((item) => {
      const draft = requestItems[item.orderItemId] || {};
      return {
        orderItemId: item.orderItemId,
        quantity: positiveInteger(draft.quantity),
        reasonCode: draft.reasonCode || 'other',
        reasonText: String(draft.reasonText || '').trim(),
        expired: item.expired === true,
        policyReturnable: item.policyReturnable !== false,
        policyManualReview: item.policyManualReview === true,
        allowedResolutions: Array.isArray(item.allowedResolutions)
          ? item.allowedResolutions
          : allowedCreateResolutions,
      };
    })
    .filter((item) => item.quantity > 0);
  const needsOverride = selectedItems.some(
    (item) => item.expired || !item.policyReturnable
  );
  const selectedNeedsManualReview = selectedItems.some(
    (item) => item.policyManualReview
  );
  const resolutionAllowedForSelection = selectedItems.every(
    (item) => item.allowedResolutions.includes(resolution)
  );

  const setRequestItem = (id, patch) => {
    setRequestItems((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));
  };

  const setDraft = (returnId, patch) => {
    setDrafts((current) => ({
      ...current,
      [returnId]: { ...(current[returnId] || {}), ...patch },
    }));
  };

  const setLineValue = (returnId, group, lineId, value) => {
    setDrafts((current) => ({
      ...current,
      [returnId]: {
        ...(current[returnId] || {}),
        [group]: {
          ...(current[returnId]?.[group] || {}),
          [lineId]: value,
        },
      },
    }));
  };

  const setInspection = (returnId, lineId, patch) => {
    setDrafts((current) => ({
      ...current,
      [returnId]: {
        ...(current[returnId] || {}),
        inspections: {
          ...(current[returnId]?.inspections || {}),
          [lineId]: {
            ...(current[returnId]?.inspections?.[lineId] || {}),
            ...patch,
          },
        },
      },
    }));
  };

  const submitCreate = async () => {
    if (
      !selectedItems.length ||
      !resolutionAllowedForSelection ||
      (needsOverride && overrideReason.trim().length < 8)
    ) return;
    await onCreate?.({
      requestedResolution: resolution,
      reasonSummary: reasonSummary.trim(),
      overrideEligibility: needsOverride,
      overrideReason: needsOverride ? overrideReason.trim() : '',
      items: selectedItems.map(({
        expired,
        policyReturnable,
        policyManualReview,
        allowedResolutions,
        ...item
      }) => item),
    });
  };

  const inspectionPayload = (returnCase, draft) => ({
    items: (returnCase.items || []).map((item) => {
      const id = itemId(item);
      const values = draft?.inspections?.[id] || {};
      return {
        orderItemId: id,
        sellableQuantity: positiveInteger(
          values.sellableQuantity ?? item.receivedQuantity
        ),
        damagedQuantity: positiveInteger(values.damagedQuantity),
        quarantineQuantity: positiveInteger(values.quarantineQuantity),
        rejectedQuantity: positiveInteger(values.rejectedQuantity),
        inspectionNote: String(values.inspectionNote || '').trim(),
      };
    }),
  });

  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.RotateCcw}
        title="Posventa · RMA"
        subtitle="Devoluciones y cambios con autorización, recepción, inspección e inventario trazable."
        action={loading ? <SoftBadge variant="warning">Consultando</SoftBadge> : null}
      />

      <WorkflowGuide />

      <div style={{ marginTop: 12, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 16, padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ display: 'block', fontSize: 12 }}>Política activa · {policy.windowDays || 30} días</strong>
            <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
              Portal cliente {policy.customerPortalEnabled === false ? 'desactivado' : 'activo'} · envío {policy.returnShippingPaidBy === 'store' ? 'pagado por la tienda' : policy.returnShippingPaidBy === 'customer' ? 'pagado por el cliente' : 'según el caso'} · antifraude {policy.riskControls?.enabled === false ? 'desactivado' : 'activo'} · {(policy.rules || []).length} regla(s) especial(es) · versión {policy.revision || 0}
            </span>
          </div>
          {canManagePolicy ? (
            <GhostButton disabled={busyId === 'policy'} onClick={() => setPolicyOpen((open) => !open)}>
              {policyOpen ? 'Cerrar política' : 'Configurar política'}
            </GhostButton>
          ) : null}
        </div>
        {policyOpen ? (
          <div style={{ marginTop: 11, display: 'grid', gap: 9 }}>
            <div className="order-return-policy-grid" style={{ display: 'grid', gridTemplateColumns: '140px minmax(190px, 1fr) minmax(190px, 1fr)', gap: 8 }}>
              <label style={{ fontSize: 10, fontWeight: 850 }}>Ventana (días)<input aria-label="Ventana de devoluciones" type="number" min="1" max="365" value={policyDraft.windowDays || 30} onChange={(event) => patchPolicy({ windowDays: positiveInteger(event.target.value) })} style={inputStyle({ marginTop: 4 })} /></label>
              <label style={{ fontSize: 10, fontWeight: 850 }}>Costo del retorno<select aria-label="Responsable del envío de retorno" value={policyDraft.returnShippingPaidBy || 'case_by_case'} onChange={(event) => patchPolicy({ returnShippingPaidBy: event.target.value })} style={inputStyle({ marginTop: 4 })}><option value="case_by_case">Según el caso</option><option value="store">Lo paga la tienda</option><option value="customer">Lo paga el cliente</option></select></label>
              <label style={{ fontSize: 10, fontWeight: 850 }}>Vigencia saldo (días)<input aria-label="Vigencia del saldo a favor" type="number" min="30" max="1825" value={policyDraft.storeCreditExpirationDays || 365} onChange={(event) => patchPolicy({ storeCreditExpirationDays: positiveInteger(event.target.value) })} style={inputStyle({ marginTop: 4 })} /></label>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, fontWeight: 800 }}>
              <label><input type="checkbox" checked={policyDraft.enabled !== false} onChange={(event) => patchPolicy({ enabled: event.target.checked })} /> Política activa</label>
              <label><input type="checkbox" checked={policyDraft.customerPortalEnabled !== false} onChange={(event) => patchPolicy({ customerPortalEnabled: event.target.checked })} /> Autoservicio cliente</label>
              <label><input type="checkbox" checked={policyDraft.autoAuthorize === true} onChange={(event) => patchPolicy({ autoAuthorize: event.target.checked })} /> Autorizar automáticamente</label>
              <label><input type="checkbox" checked={policyDraft.requireReasonText === true} onChange={(event) => patchPolicy({ requireReasonText: event.target.checked })} /> Exigir detalle</label>
              <label><input type="checkbox" checked={policyDraft.storeCreditEnabled !== false} onChange={(event) => patchPolicy({ storeCreditEnabled: event.target.checked, allowedResolutions: event.target.checked ? policyDraft.allowedResolutions : (policyDraft.allowedResolutions || []).filter((value) => value !== 'store_credit') })} /> Emitir saldo a favor</label>
              <label><input type="checkbox" checked={policyDraft.automaticExchangeEnabled !== false} onChange={(event) => patchPolicy({ automaticExchangeEnabled: event.target.checked })} /> Cambio automático</label>
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, fontWeight: 800 }}>
              {['refund', 'exchange', 'store_credit'].map((value) => (
                <label key={value}><input type="checkbox" checked={(policyDraft.allowedResolutions || []).includes(value)} onChange={() => togglePolicyResolution(value)} /> {resolutionLabel(value)}</label>
              ))}
            </div>
            <OrderReturnPolicyAdvancedEditor
              value={policyDraft}
              disabled={busyId === 'policy'}
              onChange={setPolicyDraft}
            />
            <textarea aria-label="Texto público de la política" rows="2" value={policyDraft.policyText || ''} onChange={(event) => patchPolicy({ policyText: event.target.value })} placeholder="Resumen visible para el cliente" style={inputStyle()} />
            <textarea aria-label="Instrucciones de devolución" rows="2" value={policyDraft.instructions || ''} onChange={(event) => patchPolicy({ instructions: event.target.value })} placeholder="Instrucciones después de autorizar" style={inputStyle()} />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}><PrimaryButton disabled={busyId === 'policy' || !(policyDraft.allowedResolutions || []).length} onClick={() => onSavePolicy?.({ ...policyDraft, expectedRevision: policy.revision || 0 })}>Guardar política</PrimaryButton></div>
          </div>
        ) : null}
      </div>

      {canManage && requestable.length > 0 ? (
        <div style={{ marginTop: 14 }}>
          <PrimaryButton onClick={() => setCreateOpen((open) => !open)} disabled={Boolean(busyId)}>
            {createOpen ? 'Cerrar solicitud' : 'Nueva devolución o cambio'}
          </PrimaryButton>
        </div>
      ) : null}

      {createOpen ? (
        <div style={{ marginTop: 14, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 18, padding: 14 }}>
          <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 10 }}>
            <select aria-label="Resolución solicitada" value={resolution} onChange={(event) => setResolution(event.target.value)} style={inputStyle()}>
              {allowedCreateResolutions.map((value) => (
                <option key={value} value={value}>{resolutionLabel(value)}</option>
              ))}
            </select>
            <input aria-label="Resumen de la devolución" value={reasonSummary} onChange={(event) => setReasonSummary(event.target.value)} placeholder="Resumen para el expediente" style={inputStyle()} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 11 }}>
            {requestable.map((item) => {
              const draft = requestItems[item.orderItemId] || {};
              const quantity = positiveInteger(draft.quantity);
              return (
                <div key={item.orderItemId} className="order-return-request-line" style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 90px 190px minmax(150px, 1fr)', gap: 8, alignItems: 'center', padding: 10, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 14, background: ORDER_DETAIL_THEME.cardBg }}>
                  <div>
                    <strong style={{ display: 'block', fontSize: 12 }}>{item.title}</strong>
                    <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
                      Disponible {item.availableQuantity} de {item.deliveredQuantity} · hasta {fmtDate(item.eligibleUntil)}
                    </span>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 5 }}>
                      {item.policyRuleKey && item.policyRuleKey !== 'default' ? (
                        <SoftBadge variant="primary">{item.policyRuleName || 'Política especial'} · {item.policyWindowDays || policy.windowDays || 30} días</SoftBadge>
                      ) : null}
                      {item.policyManualReview ? <SoftBadge variant="warning">Revisión manual</SoftBadge> : null}
                      {item.expired || item.policyReturnable === false ? <SoftBadge variant="danger">Requiere excepción</SoftBadge> : null}
                    </div>
                  </div>
                  <input aria-label={`Cantidad ${item.title}`} type="number" min="0" max={item.availableQuantity} value={draft.quantity || ''} onChange={(event) => setRequestItem(item.orderItemId, { quantity: Math.min(item.availableQuantity, positiveInteger(event.target.value)) })} style={inputStyle()} />
                  <select aria-label={`Motivo ${item.title}`} value={draft.reasonCode || 'other'} disabled={!quantity} onChange={(event) => setRequestItem(item.orderItemId, { reasonCode: event.target.value })} style={inputStyle()}>
                    {REASONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <input aria-label={`Detalle ${item.title}`} value={draft.reasonText || ''} disabled={!quantity} onChange={(event) => setRequestItem(item.orderItemId, { reasonText: event.target.value })} placeholder="Detalle opcional" style={inputStyle()} />
                </div>
              );
            })}
          </div>

          {needsOverride ? (
            <input aria-label="Justificación fuera de política" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Justificación obligatoria para excepción de política" style={inputStyle({ marginTop: 10, borderColor: ORDER_DETAIL_THEME.warning })} />
          ) : null}

          {selectedNeedsManualReview ? (
            <div style={{ marginTop: 10, padding: '10px 12px', border: `1px solid ${ORDER_DETAIL_THEME.warning}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 13, color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>
              La política seleccionada exige revisión manual. El expediente se creará solicitado y no se autorizará automáticamente.
            </div>
          ) : null}

          {selectedItems.length && !resolutionAllowedForSelection ? (
            <div role="alert" style={{ marginTop: 10, color: ORDER_DETAIL_THEME.danger, fontSize: 11, fontWeight: 850 }}>
              La solución elegida no está permitida para todos los productos seleccionados.
            </div>
          ) : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <PrimaryButton onClick={submitCreate} disabled={!selectedItems.length || !resolutionAllowedForSelection || Boolean(busyId) || (needsOverride && overrideReason.trim().length < 8)}>
              Crear expediente RMA
            </PrimaryButton>
          </div>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {!loading && returns.length === 0 ? (
          <EmptyState>No hay expedientes RMA para esta orden.</EmptyState>
        ) : null}

        {returns.map((returnCase) => {
          const id = String(returnCase._id || returnCase.returnNumber);
          const [statusLabel, variant] = statusMeta(returnCase.status);
          const draft = drafts[id] || {};
          const busy = busyId === id || busyId === 'create';
          const requestedUnits = (returnCase.items || []).reduce((sum, item) => sum + positiveInteger(item.requestedQuantity), 0);
          const acceptedUnits = (returnCase.items || []).reduce((sum, item) => sum + positiveInteger(item.acceptedQuantity), 0);
          const risk = returnCase.riskAssessment || {};
          const needsRiskReview = risk.decision === 'manual_review';

          return (
            <article key={id} style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 19, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <strong style={{ display: 'block', fontSize: 14 }}>{returnCase.returnNumber}</strong>
                  <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
                    {resolutionLabel(returnCase.requestedResolution)} · {returnCase.requestSource === 'customer' ? 'Solicitado por cliente' : 'Creado por administrador'} · {fmtDate(returnCase.requestedAt || returnCase.createdAt)}
                  </span>
                </div>
                <SoftBadge variant={variant}>{statusLabel}</SoftBadge>
              </div>

              <div className="order-return-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 11 }}>
                <Metric label="Solicitadas" value={requestedUnits} />
                <Metric label="Aceptadas" value={acceptedUnits} tone={ORDER_DETAIL_THEME.success} />
                <Metric label="Estimado" value={toCOP(returnCase.estimatedRefundAmount)} />
                <Metric label="Revisión" value={`v${returnCase.revision || 0}`} />
              </div>

              {risk.decision && risk.decision !== 'clear' ? (
                <div style={{ marginTop: 10, padding: 11, border: `1px solid ${risk.level === 'blocked' ? ORDER_DETAIL_THEME.danger : ORDER_DETAIL_THEME.warning}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 12 }}>
                      {risk.decision === 'approved' ? 'Revisión antifraude aprobada' : 'Revisión antifraude requerida'}
                    </strong>
                    <SoftBadge variant={risk.decision === 'approved' ? 'success' : 'warning'}>
                      Riesgo {riskLevelLabel(risk.level)} · {Number(risk.score || 0)}/100
                    </SoftBadge>
                  </div>
                  <div style={{ display: 'grid', gap: 5, marginTop: 8 }}>
                    {(risk.signals || []).map((signal) => (
                      <span key={signal.code} style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, lineHeight: 1.4 }}>
                        • {signal.message}
                      </span>
                    ))}
                  </div>
                  <span style={{ display: 'block', marginTop: 7, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9 }}>
                    Historial: {risk.history?.requestCount || 0} solicitud(es), {risk.history?.unitCount || 0} unidad(es), {toCOP(risk.history?.amount || 0)} en {risk.history?.lookbackDays || 90} días.
                  </span>
                </div>
              ) : null}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
                {(returnCase.items || []).map((item) => (
                  <div key={itemId(item)} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) repeat(4, 72px)', gap: 7, alignItems: 'center', padding: '8px 10px', borderRadius: 13, background: ORDER_DETAIL_THEME.cardBg, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, fontSize: 11 }}>
                    <strong>{item.title}</strong>
                    <span>Aut. {item.authorizedQuantity || 0}</span>
                    <span>Rec. {item.receivedQuantity || 0}</span>
                    <span>Apta {item.sellableQuantity || 0}</span>
                    <span>Ret. {item.rejectedQuantity || 0}</span>
                  </div>
                ))}
              </div>

              {canManage && returnCase.status === 'requested' ? (
                <div style={{ marginTop: 11 }}>
                  {needsRiskReview ? (
                    <label style={{ display: 'block', marginBottom: 9, color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 850 }}>
                      Conclusión de la revisión antifraude
                      <input
                        aria-label={`Conclusión antifraude ${returnCase.returnNumber}`}
                        value={draft.riskReviewNote || ''}
                        onChange={(event) => setDraft(id, { riskReviewNote: event.target.value })}
                        placeholder="Explica qué verificaste antes de autorizar (obligatorio)"
                        style={inputStyle({ marginTop: 5, borderColor: ORDER_DETAIL_THEME.warning })}
                      />
                    </label>
                  ) : null}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {(returnCase.items || []).map((item) => (
                      <label key={itemId(item)} style={{ flex: '1 1 180px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 800 }}>
                        Autorizar · {item.title}
                        <input aria-label={`Autorizar ${item.title}`} type="number" min="0" max={item.requestedQuantity} value={draft.authorized?.[itemId(item)] ?? item.requestedQuantity} onChange={(event) => setLineValue(id, 'authorized', itemId(item), Math.min(item.requestedQuantity, positiveInteger(event.target.value)))} style={inputStyle({ marginTop: 5 })} />
                      </label>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: 8 }}>
                    <input aria-label={`Motivo rechazo ${returnCase.returnNumber}`} value={draft.reason || ''} onChange={(event) => setDraft(id, { reason: event.target.value })} placeholder="Motivo si se rechaza" style={inputStyle()} />
                    <GhostButton disabled={busy || String(draft.reason || '').trim().length < 5} onClick={() => onAction?.(returnCase, 'reject', { reason: String(draft.reason || '').trim() })}>Rechazar</GhostButton>
                    <PrimaryButton disabled={busy || (needsRiskReview && String(draft.riskReviewNote || '').trim().length < 8) || !(returnCase.items || []).some((item) => positiveInteger(draft.authorized?.[itemId(item)] ?? item.requestedQuantity) > 0)} onClick={() => onAction?.(returnCase, 'authorize', { riskReviewNote: String(draft.riskReviewNote || '').trim(), items: (returnCase.items || []).map((item) => ({ orderItemId: itemId(item), authorizedQuantity: positiveInteger(draft.authorized?.[itemId(item)] ?? item.requestedQuantity) })), shipping: { method: draft.carrierName ? 'carrier' : 'drop_off', carrierName: draft.carrierName || '', trackingNumber: draft.trackingNumber || '', labelUrl: draft.labelUrl || '', instructions: draft.instructions || policy.instructions || '' } })}>Autorizar</PrimaryButton>
                  </div>
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 850 }}>Logística y etiqueta de retorno</summary>
                    <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
                      <input aria-label={`Transportadora ${returnCase.returnNumber}`} value={draft.carrierName || ''} onChange={(event) => setDraft(id, { carrierName: event.target.value })} placeholder="Transportadora (opcional)" style={inputStyle()} />
                      <input aria-label={`Guía ${returnCase.returnNumber}`} value={draft.trackingNumber || ''} onChange={(event) => setDraft(id, { trackingNumber: event.target.value })} placeholder="Número de guía (opcional)" style={inputStyle()} />
                      <input aria-label={`URL etiqueta ${returnCase.returnNumber}`} value={draft.labelUrl || ''} onChange={(event) => setDraft(id, { labelUrl: event.target.value })} placeholder="URL HTTPS de etiqueta de transportadora" style={inputStyle()} />
                      <input aria-label={`Instrucciones ${returnCase.returnNumber}`} value={draft.instructions || policy.instructions || ''} onChange={(event) => setDraft(id, { instructions: event.target.value })} placeholder="Instrucciones para el cliente" style={inputStyle()} />
                    </div>
                  </details>
                </div>
              ) : null}

              {canManage && ['authorized', 'in_transit'].includes(returnCase.status) ? (
                <div style={{ marginTop: 11 }}>
                  <div className="order-return-form-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 8 }}>
                    <input aria-label={`Transportadora ${returnCase.returnNumber}`} value={draft.carrierName || returnCase.shipping?.carrierName || ''} onChange={(event) => setDraft(id, { carrierName: event.target.value })} placeholder="Transportadora" style={inputStyle()} />
                    <input aria-label={`Guía ${returnCase.returnNumber}`} value={draft.trackingNumber || returnCase.shipping?.trackingNumber || ''} onChange={(event) => setDraft(id, { trackingNumber: event.target.value })} placeholder="Número de guía" style={inputStyle()} />
                    <input aria-label={`URL etiqueta ${returnCase.returnNumber}`} value={draft.labelUrl || returnCase.shipping?.labelUrl || ''} onChange={(event) => setDraft(id, { labelUrl: event.target.value })} placeholder="URL HTTPS de etiqueta" style={inputStyle()} />
                    <input aria-label={`Instrucciones ${returnCase.returnNumber}`} value={draft.instructions || returnCase.shipping?.instructions || policy.instructions || ''} onChange={(event) => setDraft(id, { instructions: event.target.value })} placeholder="Instrucciones para el cliente" style={inputStyle()} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {(returnCase.items || []).filter((item) => positiveInteger(item.authorizedQuantity) > 0).map((item) => (
                      <label key={itemId(item)} style={{ flex: '1 1 180px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 800 }}>
                        Recibir · {item.title}
                        <input aria-label={`Recibir ${item.title}`} type="number" min="0" max={item.authorizedQuantity} value={draft.received?.[itemId(item)] ?? item.authorizedQuantity} onChange={(event) => setLineValue(id, 'received', itemId(item), Math.min(item.authorizedQuantity, positiveInteger(event.target.value)))} style={inputStyle({ marginTop: 5 })} />
                      </label>
                    ))}
                  </div>
                  <input aria-label={`Motivo cancelación ${returnCase.returnNumber}`} value={draft.cancellationReason || ''} onChange={(event) => setDraft(id, { cancellationReason: event.target.value })} placeholder="Motivo si el cliente cancela el RMA" style={inputStyle({ marginTop: 8 })} />
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                    <GhostButton disabled={busy || String(draft.cancellationReason || '').trim().length < 5} onClick={() => onAction?.(returnCase, 'cancel', { reason: String(draft.cancellationReason || '').trim() })}>Cancelar RMA</GhostButton>
                    {returnCase.status === 'authorized' ? (
                      <GhostButton disabled={busy} onClick={() => onAction?.(returnCase, 'mark_in_transit', { shipping: { carrierName: draft.carrierName || returnCase.shipping?.carrierName, trackingNumber: draft.trackingNumber || returnCase.shipping?.trackingNumber, labelUrl: draft.labelUrl || returnCase.shipping?.labelUrl, instructions: draft.instructions || returnCase.shipping?.instructions || policy.instructions } })}>Marcar en tránsito</GhostButton>
                    ) : null}
                    <PrimaryButton disabled={busy || !(returnCase.items || []).some((item) => positiveInteger(draft.received?.[itemId(item)] ?? item.authorizedQuantity) > 0)} onClick={() => onAction?.(returnCase, 'receive', { items: (returnCase.items || []).map((item) => ({ orderItemId: itemId(item), receivedQuantity: positiveInteger(draft.received?.[itemId(item)] ?? item.authorizedQuantity) })) })}>Registrar recepción</PrimaryButton>
                  </div>
                </div>
              ) : null}

              {canManage && returnCase.status === 'received' ? (
                <div style={{ marginTop: 11, padding: 11, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 15 }}>
                  <strong style={{ display: 'block', marginBottom: 8, fontSize: 12 }}>Inspección física por unidad</strong>
                  {(returnCase.items || []).map((item) => {
                    const lineId = itemId(item);
                    const values = draft.inspections?.[lineId] || {};
                    const receivedQuantity = positiveInteger(item.receivedQuantity);
                    return (
                      <div key={lineId} className="order-return-inspection" style={{ marginTop: 9, padding: 10, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.cardBg, borderRadius: 14 }}>
                        <strong style={{ display: 'block', color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>{item.title}</strong>
                        <div style={{ marginTop: 4, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, lineHeight: 1.45 }}>
                          Clasifica las {receivedQuantity} unidad(es) recibida(s). La suma de Aptas, Averiadas, En cuarentena y Rechazadas debe ser exactamente {receivedQuantity}.
                        </div>
                        <div className="order-return-inspection-fields" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(105px, 1fr)) minmax(170px, 1.4fr)', gap: 8, marginTop: 9, alignItems: 'stretch' }}>
                          <InspectionField
                            label="Aptas"
                            helper="Vuelven al inventario disponible."
                            ariaLabel={`Aptas ${item.title}`}
                            value={values.sellableQuantity ?? receivedQuantity}
                            max={receivedQuantity}
                            onChange={(event) => setInspection(id, lineId, { sellableQuantity: event.target.value })}
                          />
                          <InspectionField
                            label="Averiadas"
                            helper="Se acepta la devolución, pero no se venden."
                            ariaLabel={`Averiadas ${item.title}`}
                            value={values.damagedQuantity || ''}
                            max={receivedQuantity}
                            onChange={(event) => setInspection(id, lineId, { damagedQuantity: event.target.value })}
                          />
                          <InspectionField
                            label="En cuarentena"
                            helper="Quedan separadas para una revisión posterior."
                            ariaLabel={`Cuarentena ${item.title}`}
                            value={values.quarantineQuantity || ''}
                            max={receivedQuantity}
                            onChange={(event) => setInspection(id, lineId, { quarantineQuantity: event.target.value })}
                          />
                          <InspectionField
                            label="Rechazadas"
                            helper="No se acepta la devolución de estas unidades."
                            ariaLabel={`Rechazadas ${item.title}`}
                            value={values.rejectedQuantity || ''}
                            max={receivedQuantity}
                            onChange={(event) => setInspection(id, lineId, { rejectedQuantity: event.target.value })}
                          />
                          <label style={{ display: 'flex', minWidth: 0, flexDirection: 'column', gap: 4, padding: 9, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 13 }}>
                            <strong style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 11 }}>Nota de inspección</strong>
                            <span style={{ minHeight: 26, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, lineHeight: 1.35 }}>Explica el daño o la decisión tomada.</span>
                            <input aria-label={`Nota inspección ${item.title}`} value={values.inspectionNote || ''} onChange={(event) => setInspection(id, lineId, { inspectionNote: event.target.value })} placeholder="Ej.: empaque abierto" style={inputStyle({ marginTop: 2 })} />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <PrimaryButton disabled={busy} onClick={() => onAction?.(returnCase, 'inspect', inspectionPayload(returnCase, draft))}>Cerrar inspección</PrimaryButton>
                  </div>
                </div>
              ) : null}

              {returnCase.status === 'resolution_required' && returnCase.requestedResolution === 'refund' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 11 }}>
                  <input aria-label={`Monto reembolso ${returnCase.returnNumber}`} type="number" min="1" max={returnCase.estimatedRefundAmount} value={draft.amount ?? returnCase.estimatedRefundAmount} disabled={!canRefund} onChange={(event) => setDraft(id, { amount: event.target.value })} style={inputStyle()} />
                  <PrimaryButton disabled={!canRefund || busy || positiveInteger(draft.amount ?? returnCase.estimatedRefundAmount) <= 0} onClick={() => onRefund?.(returnCase, Number(draft.amount ?? returnCase.estimatedRefundAmount))}>Crear reembolso</PrimaryButton>
                </div>
              ) : null}

              {returnCase.status === 'resolution_required' && returnCase.requestedResolution === 'store_credit' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 11 }}>
                  <input aria-label={`Monto saldo a favor ${returnCase.returnNumber}`} type="number" min="1" max={returnCase.estimatedRefundAmount} value={draft.amount ?? returnCase.estimatedRefundAmount} disabled={!canRefund} onChange={(event) => setDraft(id, { amount: event.target.value })} style={inputStyle()} />
                  <PrimaryButton disabled={!canRefund || busy || positiveInteger(draft.amount ?? returnCase.estimatedRefundAmount) <= 0} onClick={() => onStoreCredit?.(returnCase, Number(draft.amount ?? returnCase.estimatedRefundAmount))}>Emitir saldo a favor</PrimaryButton>
                </div>
              ) : null}

              {canManage && returnCase.status === 'resolution_required' && returnCase.requestedResolution === 'exchange' ? (
                <div style={{ marginTop: 11, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 15, padding: 11, background: ORDER_DETAIL_THEME.cardBg }}>
                  <strong style={{ display: 'block', fontSize: 12 }}>Siguiente paso: crear la orden de cambio</strong>
                  <span style={{ display: 'block', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, marginTop: 3 }}>La opción automática crea una orden sin cobro y reserva el inventario aceptado.</span>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 9 }}>
                    <input aria-label={`Referencia cambio ${returnCase.returnNumber}`} value={draft.reference || 'Cambio automático por RMA'} onChange={(event) => setDraft(id, { reference: event.target.value })} placeholder="Referencia o motivo del cambio" style={inputStyle()} />
                    <PrimaryButton disabled={busy || policy.automaticExchangeEnabled === false} onClick={() => onAutomaticExchange?.(returnCase, String(draft.reference || 'Cambio automático por RMA').trim())}>Crear orden de cambio</PrimaryButton>
                  </div>
                  <details style={{ marginTop: 9 }}>
                    <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 850 }}>Ya existe una orden de reemplazo</summary>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, marginTop: 8 }}>
                      <input aria-label={`Orden reemplazo ${returnCase.returnNumber}`} value={draft.replacementOrderId || ''} onChange={(event) => setDraft(id, { replacementOrderId: event.target.value })} placeholder="ID interno de la orden existente" style={inputStyle()} />
                      <GhostButton disabled={busy || String(draft.replacementOrderId || '').trim().length < 12 || String(draft.reference || '').trim().length < 4} onClick={() => onExchange?.(returnCase, String(draft.replacementOrderId || '').trim(), String(draft.reference || '').trim())}>Vincular existente</GhostButton>
                    </div>
                  </details>
                </div>
              ) : null}

              {returnCase.resolution?.state ? (
                <div style={{ marginTop: 10, color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
                  Resolución: <strong style={{ color: ORDER_DETAIL_THEME.cardText }}>{resolutionLabel(returnCase.resolution.type)}</strong>
                  {returnCase.resolution.reference ? ` · ${returnCase.resolution.reference}` : ''}
                  {returnCase.resolution.replacementOrderNumber ? ` · ${returnCase.resolution.replacementOrderNumber}` : ''}
                  {returnCase.resolution.state !== 'completed'
                    ? ' · conciliación en curso'
                    : ''}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

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
    </OrderDetailPanel>
  );
}
