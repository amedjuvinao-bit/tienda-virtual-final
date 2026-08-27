import OrderLogisticsShipmentCard from './OrderLogisticsShipmentCard';
import { SummaryCard } from './OrderLogisticsUi';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { shipmentForm } from './orderLogisticsViewModel';
import useOrderLogisticsController from './hooks/useOrderLogisticsController';

export default function OrderDetailLogisticsPanel({
  order,
  canManage = false,
  onRefreshTimeline,
  onCustomerStageConfirmed,
  onOrderUpdated,
}) {
  const {
    busy,
    eligibility,
    eligibilityLoading,
    forms,
    initialize,
    labelConfirmation,
    message,
    physical,
    pickupConfirmation,
    providers,
    rates,
    runAction,
    runProviderAction,
    setLabelConfirmation,
    setPickupConfirmation,
    shipments,
    summary,
    updateForm,
  } = useOrderLogisticsController({
    order,
    canManage,
    onRefreshTimeline,
    onCustomerStageConfirmed,
    onOrderUpdated,
  });

  if (!physical) return null;

  return (
    <section
      aria-label="Centro logístico de la orden"
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 24,
        background: ORDER_DETAIL_THEME.cardBg,
        padding: 18,
        boxShadow: '0 18px 50px rgba(15, 23, 42, 0.07)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: 'var(--admin-primary)', fontSize: 10, fontWeight: 950, letterSpacing: '.18em', textTransform: 'uppercase' }}>
            Preparación y entrega por sede
          </div>
          <h3 style={{ margin: '5px 0 0', color: ORDER_DETAIL_THEME.cardText, fontSize: 18, fontWeight: 950 }}>
            Centro logístico
          </h3>
          <p style={{ margin: '5px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 12, fontWeight: 650 }}>
            Prepara cada paquete, entrégalo a la transportadora y consulta su seguimiento desde la orden.
          </p>
        </div>
        {canManage && shipments.length === 0 ? (
          <div
            title={eligibility?.message || 'Verificando pago e inventario vendido.'}
            style={{ maxWidth: 310, textAlign: 'right' }}
          >
            <button
              type="button"
              onClick={initialize}
              aria-describedby="orders-logistics-eligibility"
              disabled={
                eligibilityLoading ||
                busy === 'initialize' ||
                !eligibility?.canInitialize
              }
              style={{
                border: 0,
                borderRadius: 14,
                minHeight: 40,
                padding: '0 16px',
                background: eligibility?.canInitialize
                  ? 'var(--admin-primary)'
                  : 'var(--admin-input-bg)',
                color: eligibility?.canInitialize
                  ? '#fff'
                  : ORDER_DETAIL_THEME.mutedText,
                fontSize: 12,
                fontWeight: 900,
                cursor: eligibility?.canInitialize ? 'pointer' : 'not-allowed',
                opacity: eligibilityLoading ? 0.7 : 1,
              }}
            >
              {busy === 'initialize'
                ? 'Preparando…'
                : providers?.envia?.enabled
                  ? 'Iniciar envío automático'
                  : 'Preparar logística manual'}
            </button>
            <p
              id="orders-logistics-eligibility"
              style={{
                margin: '6px 0 0',
                color: eligibility?.canInitialize
                  ? '#047857'
                  : ORDER_DETAIL_THEME.mutedText,
                fontSize: 10,
                fontWeight: 750,
                lineHeight: 1.35,
              }}
            >
              {eligibilityLoading
                ? 'Verificando pago e inventario vendido…'
                : eligibility?.message || 'Verificando pago e inventario vendido…'}
            </p>
          </div>
        ) : null}
      </div>

      {shipments.length > 0 ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(92px, 1fr))', gap: 8, marginTop: 16 }}>
            <SummaryCard label="Envíos" value={summary.shipmentCount || shipments.length} tone="primary" />
            <SummaryCard label="Listos" value={summary.readyCount || 0} />
            <SummaryCard label="Despachados" value={summary.dispatchedCount || 0} tone="warning" />
            <SummaryCard label="Entregados" value={summary.deliveredCount || 0} tone="success" />
            <SummaryCard label="Incidencias" value={summary.exceptionCount || 0} tone={summary.exceptionCount ? 'danger' : 'default'} />
            <SummaryCard label="SLA vencido" value={summary.slaBreachedCount || 0} tone={summary.slaBreachedCount ? 'danger' : 'default'} />
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {shipments.map((shipment) => {
              const shipmentId = String(shipment._id);
              return (
                <OrderLogisticsShipmentCard
                  key={shipmentId}
                  shipment={shipment}
                  providedForm={forms[shipmentId] || shipmentForm(shipment)}
                  providedRates={rates[shipmentId] || []}
                  providers={providers}
                  canManage={canManage}
                  busy={busy}
                  labelConfirmation={labelConfirmation}
                  pickupConfirmation={pickupConfirmation}
                  onUpdateForm={updateForm}
                  onRunAction={runAction}
                  onRunProviderAction={runProviderAction}
                  onSetLabelConfirmation={setLabelConfirmation}
                  onSetPickupConfirmation={setPickupConfirmation}
                />
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 14, border: `1px dashed ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 18, padding: 22, textAlign: 'center', color: ORDER_DETAIL_THEME.mutedText, fontSize: 12, fontWeight: 700 }}>
          La orden física aún no tiene envíos operativos. Se crearán por sede usando únicamente inventario vendido y confirmado.
        </div>
      )}

      {message ? (
        <div role="status" style={{ marginTop: 12, borderRadius: 12, padding: '9px 11px', background: message.type === 'error' ? '#fff1f2' : message.type === 'warning' ? '#fff7ed' : '#ecfdf5', color: message.type === 'error' ? '#be123c' : message.type === 'warning' ? '#c2410c' : '#047857', fontSize: 11, fontWeight: 800 }}>
          {message.text}
          {message.configureBranch ? (
            <a href="/admin/configuracion/sedes" style={{ display: 'inline-block', marginLeft: 8, color: 'inherit', fontWeight: 950, textDecoration: 'underline' }}>
              Configurar datos de la sede
            </a>
          ) : null}
        </div>
      ) : null}

      <style>{`
        .order-logistics-plan-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
        .order-logistics-step-grid { display: grid; grid-template-columns: repeat(6, minmax(88px, 1fr)); overflow-x: auto; }
        .order-logistics-main-action { display: flex; align-items: center; gap: 16px; }
        .order-logistics-visual-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .order-logistics-deadline-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
        .order-logistics-sandbox-grid { display: grid; grid-template-columns: minmax(180px, 1fr) auto; }
        @media (max-width: 900px) {
          section[aria-label="Centro logístico de la orden"] > div:nth-of-type(2) { grid-template-columns: repeat(3, minmax(92px, 1fr)) !important; }
          .order-logistics-plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 620px) {
          .order-logistics-plan-grid { grid-template-columns: 1fr; }
          .order-logistics-main-action { align-items: flex-start; }
          .order-logistics-main-action-icon { width: 56px !important; height: 56px !important; border-radius: 17px !important; }
          .order-logistics-visual-steps,
          .order-logistics-deadline-grid,
          .order-logistics-sandbox-grid { grid-template-columns: 1fr; }
          section[aria-label="Centro logístico de la orden"] input,
          section[aria-label="Centro logístico de la orden"] select { min-width: 0 !important; }
        }
      `}</style>
    </section>
  );
}
