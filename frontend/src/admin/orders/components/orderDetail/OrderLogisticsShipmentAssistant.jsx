import { CheckCircle2, FileCheck2, PackageCheck, Truck } from 'lucide-react';

import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  primaryButtonStyle,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

const VISUAL_STEPS = [
  {
    title: 'Crear la guía',
    description: 'La tienda busca y recomienda la mejor opción.',
    Icon: FileCheck2,
  },
  {
    title: 'Preparar el paquete',
    description: 'Empaca, pon la etiqueta y entrégalo.',
    Icon: PackageCheck,
  },
  {
    title: 'Esperar la entrega',
    description: 'Envia actualiza la orden automáticamente.',
    Icon: Truck,
  },
];

export default function OrderLogisticsShipmentAssistant({
  canManage,
  onRunProviderAction,
  shipment,
  view,
}) {
  const CurrentStepIcon = VISUAL_STEPS[Math.max(view.visualStep - 1, 0)].Icon;

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 18, fontWeight: 950 }}>
            Despacha este pedido en 3 pasos
          </div>
          <div style={{ marginTop: 5, color: ORDER_DETAIL_THEME.mutedText, fontSize: 13, fontWeight: 750, lineHeight: 1.45 }}>
            {view.providerActive
              ? 'El panel te mostrará una sola tarea a la vez.'
              : 'Activa Envia para comenzar el recorrido guiado.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ borderRadius: 999, padding: '7px 11px', background: view.providerMode === 'production' ? '#fff7ed' : '#eef2ff', color: view.providerMode === 'production' ? '#9a3412' : '#4338ca', fontSize: 11, fontWeight: 950, letterSpacing: '.03em' }}>
            {view.providerMode === 'production' ? 'ENVÍO REAL' : 'PRUEBA SIN ENVÍO REAL'}
          </span>
          {view.providerActive && view.visualStep ? (
            <span style={{ borderRadius: 999, padding: '7px 11px', background: 'var(--admin-primary)', color: '#fff', fontSize: 11, fontWeight: 950, letterSpacing: '.03em' }}>
              {view.shipmentDelivered ? '3 PASOS LISTOS' : `PASO ACTUAL ${view.visualStep} DE 3`}
            </span>
          ) : null}
        </div>
      </div>

      {view.providerActive ? (
        <div role="note" style={{ marginTop: 12, borderRadius: 14, padding: '11px 13px', background: view.providerMode === 'production' ? '#fff7ed' : '#eef2ff', color: view.providerMode === 'production' ? '#9a3412' : '#4338ca', fontSize: 13, fontWeight: 820, lineHeight: 1.45 }}>
          {view.providerMode === 'production'
            ? 'Modo real: crear la guía puede generar un cobro en Envia.'
            : 'Modo de prueba: aquí no se enviará ningún paquete real.'}
        </div>
      ) : null}

      <div className="order-logistics-main-action" role="region" aria-label={`Siguiente paso de envío ${shipment.code}`} style={{ marginTop: 14, borderRadius: 18, padding: 16, background: ORDER_DETAIL_THEME.cardBg, border: `2px solid ${ORDER_DETAIL_THEME.cardBorder}` }}>
        <div className="order-logistics-main-action-icon" aria-hidden="true" style={{ width: 68, height: 68, borderRadius: 20, display: 'grid', placeItems: 'center', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)', flex: '0 0 auto' }}>
          <CurrentStepIcon size={36} strokeWidth={2.3} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: 'var(--admin-primary)', fontSize: 13, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Haz esto ahora
          </div>
          <div style={{ marginTop: 6, color: ORDER_DETAIL_THEME.cardText, fontSize: 20, fontWeight: 950, lineHeight: 1.2 }}>
            {view.assistantTitle}
          </div>
          <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 13, fontWeight: 720, lineHeight: 1.5 }}>
            {view.assistantDescription}
          </p>
          {!view.providerActive ? (
            <a href="/admin/configuracion/envios" style={{ ...secondaryButtonStyle(), display: 'inline-flex', marginTop: 12, minHeight: 44, alignItems: 'center', fontSize: 13, textDecoration: 'none' }}>
              {view.providerConfigured ? 'Activar Envia' : 'Configurar Envia'}
            </a>
          ) : canManage && !view.hasActiveLabel && view.shipmentRates.length === 0 ? (
            <button type="button" onClick={() => onRunProviderAction(shipment, 'quote')} disabled={view.isBusy} style={{ ...primaryButtonStyle(), marginTop: 12, minHeight: 44, fontSize: 13 }}>
              {view.labelCancelled ? 'Buscar otra opción de envío' : 'Buscar opciones de envío'}
            </button>
          ) : null}
        </div>
      </div>

      {view.providerActive ? (
        <div className="order-logistics-visual-steps" aria-label="Recorrido del envío en tres pasos" style={{ marginTop: 14 }}>
          {VISUAL_STEPS.map(({ title, description, Icon }, index) => {
            const stepNumber = index + 1;
            const isComplete = view.shipmentDelivered || view.visualStep > stepNumber;
            const isActive = !view.shipmentDelivered && view.visualStep === stepNumber;
            return (
              <div
                key={title}
                aria-current={isActive ? 'step' : undefined}
                style={{
                  border: `${isActive ? 2 : 1}px solid ${isActive ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.cardBorder}`,
                  borderRadius: 17,
                  padding: 14,
                  background: isActive
                    ? 'var(--admin-primary-soft-bg)'
                    : isComplete
                      ? '#ecfdf5'
                      : ORDER_DETAIL_THEME.cardBg,
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 15, display: 'grid', placeItems: 'center', background: isComplete ? '#d1fae5' : isActive ? 'color-mix(in srgb, var(--admin-primary) 16%, #fff)' : 'var(--admin-bg)', color: isComplete ? '#047857' : isActive ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.mutedText }}>
                    {isComplete ? <CheckCircle2 size={29} strokeWidth={2.4} /> : <Icon size={29} strokeWidth={2.2} />}
                  </div>
                  <span style={{ color: isComplete ? '#047857' : isActive ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.mutedText, fontSize: 12, fontWeight: 950 }}>
                    {isComplete ? 'LISTO' : `PASO ${stepNumber}`}
                  </span>
                </div>
                <div style={{ marginTop: 11, color: ORDER_DETAIL_THEME.cardText, fontSize: 15, fontWeight: 950, lineHeight: 1.25 }}>
                  {title}
                </div>
                <p style={{ margin: '6px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 12, fontWeight: 720, lineHeight: 1.45 }}>
                  {description}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
