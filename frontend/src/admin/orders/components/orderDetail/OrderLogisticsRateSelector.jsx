import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  filterShippingRatesByHandoff,
  recommendationExplanation,
  recommendedShippingRate,
  shippingRateHandoff,
  shippingRateKey,
} from './shippingRateRecommendation';
import { formatMoney } from './orderLogisticsViewModel';
import {
  inputStyle,
  planField,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

const HANDOFF_TONES = {
  success: { background: '#dcfce7', border: '#86efac', color: '#166534' },
  warning: { background: '#fff7ed', border: '#fdba74', color: '#9a3412' },
  neutral: { background: '#f8fafc', border: '#cbd5e1', color: '#475569' },
  unknown: { background: '#fffbeb', border: '#fde68a', color: '#92400e' },
};

function RateHandoff({ rate, detailed = false }) {
  const handoff = shippingRateHandoff(rate);
  const tone = HANDOFF_TONES[handoff.tone] || HANDOFF_TONES.unknown;
  return (
    <div style={{ display: 'grid', gap: detailed ? 3 : 0, justifyItems: 'start' }}>
      <span
        title={handoff.description}
        style={{
          display: 'inline-flex',
          border: `1px solid ${tone.border}`,
          borderRadius: 999,
          padding: '3px 7px',
          background: tone.background,
          color: tone.color,
          fontSize: 8,
          fontWeight: 950,
          lineHeight: 1.2,
        }}
      >
        {handoff.label}
      </span>
      {detailed ? (
        <span style={{ color: tone.color, fontSize: 9, fontWeight: 720, lineHeight: 1.4 }}>
          {handoff.description}
        </span>
      ) : null}
    </div>
  );
}

export default function OrderLogisticsRateSelector({
  canManage,
  onRunProviderAction,
  onUpdateForm,
  shipment,
  view,
}) {
  if (!view.shipmentRates.length || view.hasActiveLabel) return null;

  const selectStrategy = (rateStrategy) => {
    onUpdateForm(view.shipmentId, {
      rateStrategy,
      selectedRate: recommendedShippingRate(view.compatibleRates, rateStrategy),
    });
  };

  const selectHandoffPreference = (handoffPreference) => {
    const compatibleRates = filterShippingRatesByHandoff(
      view.shipmentRates,
      handoffPreference
    );
    onUpdateForm(view.shipmentId, {
      handoffPreference,
      selectedRate: recommendedShippingRate(
        compatibleRates,
        view.form.rateStrategy
      ),
    });
  };

  const noCompatibleRates = (
    view.form.handoffPreference !== 'any' && !view.compatibleRates.length
  );

  return (
    <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
      <div style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 14, padding: 11, background: ORDER_DETAIL_THEME.cardBg }}>
        <label style={{ display: 'grid', gap: 5 }}>
          <span style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 950 }}>
            ¿Cómo entregarás el paquete a la transportadora?
          </span>
          <select
            aria-label={`Forma de entrega ${shipment.code}`}
            disabled={!canManage}
            value={view.form.handoffPreference}
            onChange={(event) => selectHandoffPreference(event.target.value)}
            style={inputStyle()}
          >
            <option value="any">Todavía no lo he decidido</option>
            <option value="pickup">Quiero que recojan el paquete</option>
            <option value="dropoff">Lo llevaré a un punto autorizado</option>
          </select>
        </label>
        <p style={{ margin: '6px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
          La lista mostrará únicamente tarifas compatibles. Envia debe confirmar la recolección; la tienda no la supondrá.
        </p>
      </div>

      {noCompatibleRates ? (
        <div role="alert" style={{ border: '1px solid #fdba74', borderRadius: 12, padding: 10, background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 800, lineHeight: 1.45 }}>
          Envia no confirmó ninguna tarifa compatible con esta forma de entrega. Elige otra opción o vuelve a consultar tarifas.
        </div>
      ) : null}

      {view.selectedRate ? (
        <div aria-label={`Tarifa seleccionada ${shipment.code}`} style={{ border: '1px solid var(--admin-primary)', borderRadius: 14, padding: 12, background: 'var(--admin-primary-soft-bg)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div>
              <span style={{ display: 'inline-block', borderRadius: 999, padding: '4px 8px', background: 'var(--admin-primary)', color: '#fff', fontSize: 8, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {shippingRateKey(view.selectedRate) === shippingRateKey(view.recommendedRate) ? 'Opción recomendada' : 'Opción seleccionada'}
              </span>
              <div style={{ marginTop: 7, color: ORDER_DETAIL_THEME.cardText, fontSize: 13, fontWeight: 950 }}>
                {view.selectedRate.carrier} · {view.selectedRate.serviceDescription || view.selectedRate.service}
              </div>
              <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 750 }}>
                Entrega: {view.selectedRate.deliveryEstimate || 'por confirmar'}
              </div>
              <div style={{ marginTop: 7 }}>
                <RateHandoff rate={view.selectedRate} detailed />
              </div>
            </div>
            <strong style={{ color: 'var(--admin-primary)', fontSize: 18 }}>
              {formatMoney(view.selectedRate.totalPrice, view.selectedRate.currency)}
            </strong>
          </div>
          <p style={{ margin: '8px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700 }}>
            {shippingRateKey(view.selectedRate) === shippingRateKey(view.recommendedRate)
              ? recommendationExplanation(view.form.rateStrategy)
              : 'Elegida manualmente entre las opciones recibidas.'}
          </p>
          {view.pickupOnGenerate ? (
            <div style={{ marginTop: 10, border: '1px solid #fdba74', borderRadius: 12, padding: 10, background: '#fff7ed' }}>
              <div style={{ color: '#9a3412', fontSize: 10, fontWeight: 950 }}>
                Esta transportadora programa la recolección al crear la guía
              </div>
              <p style={{ margin: '4px 0 8px', color: '#9a3412', fontSize: 9, fontWeight: 720, lineHeight: 1.45 }}>
                Elige el día en que el paquete estará empacado. Envia enviará la guía y la solicitud de recolección en una sola operación.
              </p>
              {planField('Fecha de recolección', (
                <input type="date" aria-label={`Fecha de recolección al generar ${shipment.code}`} value={view.form.pickupDate} onChange={(event) => onUpdateForm(view.shipmentId, { pickupDate: event.target.value })} style={inputStyle()} />
              ))}
            </div>
          ) : null}
          {canManage ? (
            <button type="button" onClick={() => onRunProviderAction(shipment, 'label')} disabled={view.isBusy} style={{ ...primaryButtonStyle(), width: '100%', justifyContent: 'center', marginTop: 10 }}>
              {view.pickupOnGenerate
                ? view.providerMode === 'production'
                  ? 'Crear guía y pedir recolección'
                  : 'Crear guía de prueba y pedir recolección'
                : view.providerMode === 'production'
                  ? 'Crear guía real'
                  : 'Crear guía de prueba'}
            </button>
          ) : null}
        </div>
      ) : null}

      <details>
        <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 900 }}>
          Cambiar recomendación o ver alternativas
        </summary>
        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <label style={{ display: 'grid', gap: 5, maxWidth: 270 }}>
            <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900 }}>
              ¿Qué prefieres priorizar?
            </span>
            <select
              aria-label={`Criterio de tarifa ${shipment.code}`}
              value={view.form.rateStrategy}
              onChange={(event) => selectStrategy(event.target.value)}
              style={inputStyle()}
            >
              <option value="balanced">Equilibrio entre precio y tiempo</option>
              <option value="cheapest">Menor precio</option>
              <option value="fastest">Entrega más rápida</option>
            </select>
          </label>
          {view.alternatives.map((rate, index) => (
            <button key={`${shippingRateKey(rate)}-${index}`} type="button" onClick={() => onUpdateForm(view.shipmentId, { selectedRate: rate })} style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 10, padding: '8px 10px', background: ORDER_DETAIL_THEME.cardBg, color: ORDER_DETAIL_THEME.cardText, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer', fontSize: 10, fontWeight: 850 }}>
              <span style={{ display: 'grid', gap: 5 }}>
                <span>{rate.carrier} · {rate.serviceDescription || rate.service} · {rate.deliveryEstimate || 'Entrega por confirmar'}</span>
                <RateHandoff rate={rate} />
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{formatMoney(rate.totalPrice, rate.currency)}</span>
            </button>
          ))}
          <button type="button" onClick={() => onRunProviderAction(shipment, 'quote')} disabled={view.isBusy} style={{ ...secondaryButtonStyle(), justifySelf: 'start' }}>
            Volver a consultar tarifas
          </button>
        </div>
      </details>
    </div>
  );
}
