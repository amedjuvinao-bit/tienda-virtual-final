import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  recommendationExplanation,
  recommendedShippingRate,
  shippingRateKey,
} from './shippingRateRecommendation';
import { formatMoney } from './orderLogisticsViewModel';
import {
  inputStyle,
  planField,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

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
      selectedRate: recommendedShippingRate(view.shipmentRates, rateStrategy),
    });
  };

  return (
    <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
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
            <button key={`${shippingRateKey(rate)}-${index}`} type="button" onClick={() => onUpdateForm(view.shipmentId, { selectedRate: rate })} style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 10, padding: '8px 10px', background: ORDER_DETAIL_THEME.cardBg, color: ORDER_DETAIL_THEME.cardText, display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer', fontSize: 10, fontWeight: 850 }}>
              <span>{rate.carrier} · {rate.serviceDescription || rate.service} · {rate.deliveryEstimate || 'Entrega por confirmar'}</span>
              <span>{formatMoney(rate.totalPrice, rate.currency)}</span>
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
