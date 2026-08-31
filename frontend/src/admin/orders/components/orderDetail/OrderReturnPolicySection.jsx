import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { GhostButton, PrimaryButton } from './OrderDetailPrimitives';
import OrderReturnPolicyAdvancedEditor from './OrderReturnPolicyAdvancedEditor';
import {
  positiveInteger,
  resolutionLabel,
  returnInputStyle,
} from './orderReturnPanelModel';

export default function OrderReturnPolicySection({
  busyId,
  canManagePolicy,
  onSavePolicy,
  patchPolicy,
  policy,
  policyDraft,
  policyOpen,
  setPolicyDraft,
  setPolicyOpen,
  togglePolicyResolution,
}) {
  return (
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
            <label style={{ fontSize: 10, fontWeight: 850 }}>
              Ventana (días)
              <input aria-label="Ventana de devoluciones" type="number" min="1" max="365" value={policyDraft.windowDays || 30} onChange={(event) => patchPolicy({ windowDays: positiveInteger(event.target.value) })} style={returnInputStyle({ marginTop: 4 })} />
            </label>
            <label style={{ fontSize: 10, fontWeight: 850 }}>
              Costo del retorno
              <select aria-label="Responsable del envío de retorno" value={policyDraft.returnShippingPaidBy || 'case_by_case'} onChange={(event) => patchPolicy({ returnShippingPaidBy: event.target.value })} style={returnInputStyle({ marginTop: 4 })}>
                <option value="case_by_case">Según el caso</option>
                <option value="store">Lo paga la tienda</option>
                <option value="customer">Lo paga el cliente</option>
              </select>
            </label>
            <label style={{ fontSize: 10, fontWeight: 850 }}>
              Vigencia saldo (días)
              <input aria-label="Vigencia del saldo a favor" type="number" min="30" max="1825" value={policyDraft.storeCreditExpirationDays || 365} onChange={(event) => patchPolicy({ storeCreditExpirationDays: positiveInteger(event.target.value) })} style={returnInputStyle({ marginTop: 4 })} />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, fontWeight: 800 }}>
            <label><input type="checkbox" checked={policyDraft.enabled !== false} onChange={(event) => patchPolicy({ enabled: event.target.checked })} /> Política activa</label>
            <label><input type="checkbox" checked={policyDraft.customerPortalEnabled !== false} onChange={(event) => patchPolicy({ customerPortalEnabled: event.target.checked })} /> Autoservicio cliente</label>
            <label><input type="checkbox" checked={policyDraft.autoAuthorize === true} onChange={(event) => patchPolicy({ autoAuthorize: event.target.checked })} /> Autorizar automáticamente</label>
            <label><input type="checkbox" checked={policyDraft.requireReasonText === true} onChange={(event) => patchPolicy({ requireReasonText: event.target.checked })} /> Exigir detalle</label>
            <label>
              <input
                type="checkbox"
                checked={policyDraft.storeCreditEnabled !== false}
                onChange={(event) => patchPolicy({
                  storeCreditEnabled: event.target.checked,
                  allowedResolutions: event.target.checked
                    ? policyDraft.allowedResolutions
                    : (policyDraft.allowedResolutions || []).filter((value) => value !== 'store_credit'),
                })}
              /> Emitir saldo a favor
            </label>
            <label><input type="checkbox" checked={policyDraft.automaticExchangeEnabled !== false} onChange={(event) => patchPolicy({ automaticExchangeEnabled: event.target.checked })} /> Cambio automático</label>
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, fontWeight: 800 }}>
            {['refund', 'exchange', 'store_credit'].map((value) => (
              <label key={value}>
                <input type="checkbox" checked={(policyDraft.allowedResolutions || []).includes(value)} onChange={() => togglePolicyResolution(value)} /> {resolutionLabel(value)}
              </label>
            ))}
          </div>

          <OrderReturnPolicyAdvancedEditor
            value={policyDraft}
            disabled={busyId === 'policy'}
            onChange={setPolicyDraft}
          />
          <textarea aria-label="Texto público de la política" rows="2" value={policyDraft.policyText || ''} onChange={(event) => patchPolicy({ policyText: event.target.value })} placeholder="Resumen visible para el cliente" style={returnInputStyle()} />
          <textarea aria-label="Instrucciones de devolución" rows="2" value={policyDraft.instructions || ''} onChange={(event) => patchPolicy({ instructions: event.target.value })} placeholder="Instrucciones después de autorizar" style={returnInputStyle()} />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <PrimaryButton disabled={busyId === 'policy' || !(policyDraft.allowedResolutions || []).length} onClick={() => onSavePolicy?.({ ...policyDraft, expectedRevision: policy.revision || 0 })}>
              Guardar política
            </PrimaryButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
