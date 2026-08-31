import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { fmtDate, toCOP } from './orderDetailUtils';
import { SoftBadge } from './OrderDetailPrimitives';
import {
  positiveInteger,
  resolutionLabel,
  riskLevelLabel,
  returnItemId,
  returnStatusMeta,
} from './orderReturnPanelModel';
import { ReturnMetric } from './OrderReturnPanelUi';
import {
  ReturnAuthorizationSection,
  ReturnReceivingSection,
} from './OrderReturnCaseWorkflow';
import OrderReturnInspectionSection from './OrderReturnInspectionSection';
import OrderReturnResolutionSection from './OrderReturnResolutionSection';
import OrderReturnShippingSection from './OrderReturnShippingSection';

export default function OrderReturnCaseCard({
  busyId,
  canManage,
  canRefund,
  draft,
  onAction,
  onAutomaticExchange,
  onExchange,
  onRefund,
  onStoreCredit,
  onShipping,
  policy,
  returnCase,
  shippingDestinations,
  shippingProviders,
  setDraft,
  setInspection,
  setLineValue,
}) {
  const id = String(returnCase._id || returnCase.returnNumber);
  const [statusLabel, variant] = returnStatusMeta(returnCase.status);
  const busy = busyId === id || busyId === 'create' || busyId.startsWith(`${id}:`);
  const requestedUnits = (returnCase.items || []).reduce(
    (sum, item) => sum + positiveInteger(item.requestedQuantity),
    0
  );
  const acceptedUnits = (returnCase.items || []).reduce(
    (sum, item) => sum + positiveInteger(item.acceptedQuantity),
    0
  );
  const risk = returnCase.riskAssessment || {};

  return (
    <article style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, background: ORDER_DETAIL_THEME.inputBg, borderRadius: 19, padding: 14 }}>
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
        <ReturnMetric label="Solicitadas" value={requestedUnits} />
        <ReturnMetric label="Aceptadas" value={acceptedUnits} tone={ORDER_DETAIL_THEME.success} />
        <ReturnMetric label="Estimado" value={toCOP(returnCase.estimatedRefundAmount)} />
        <ReturnMetric label="Revisión" value={`v${returnCase.revision || 0}`} />
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
          <div key={returnItemId(item)} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) repeat(4, 72px)', gap: 7, alignItems: 'center', padding: '8px 10px', borderRadius: 13, background: ORDER_DETAIL_THEME.cardBg, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, fontSize: 11 }}>
            <strong>{item.title}</strong>
            <span>Aut. {item.authorizedQuantity || 0}</span>
            <span>Rec. {item.receivedQuantity || 0}</span>
            <span>Apta {item.sellableQuantity || 0}</span>
            <span>Ret. {item.rejectedQuantity || 0}</span>
          </div>
        ))}
      </div>

      {canManage && returnCase.status === 'requested' ? (
        <ReturnAuthorizationSection
          busy={busy}
          draft={draft}
          id={id}
          onAction={onAction}
          policy={policy}
          returnCase={returnCase}
          setDraft={setDraft}
          setLineValue={setLineValue}
        />
      ) : null}

      {canManage && ['authorized', 'in_transit'].includes(returnCase.status) ? (
        <>
          <OrderReturnShippingSection
            busy={busy}
            destinations={shippingDestinations}
            draft={draft}
            id={id}
            onShipping={onShipping}
            policy={policy}
            providers={shippingProviders}
            returnCase={returnCase}
            setDraft={setDraft}
          />
          <ReturnReceivingSection
            busy={busy}
            draft={draft}
            id={id}
            onAction={onAction}
            policy={policy}
            returnCase={returnCase}
            setDraft={setDraft}
            setLineValue={setLineValue}
          />
        </>
      ) : null}

      {canManage && returnCase.status === 'received' ? (
        <OrderReturnInspectionSection
          busy={busy}
          draft={draft}
          id={id}
          onAction={onAction}
          returnCase={returnCase}
          setInspection={setInspection}
        />
      ) : null}

      <OrderReturnResolutionSection
        busy={busy}
        canManage={canManage}
        canRefund={canRefund}
        draft={draft}
        id={id}
        onAutomaticExchange={onAutomaticExchange}
        onExchange={onExchange}
        onRefund={onRefund}
        onStoreCredit={onStoreCredit}
        policy={policy}
        returnCase={returnCase}
        setDraft={setDraft}
      />
    </article>
  );
}
