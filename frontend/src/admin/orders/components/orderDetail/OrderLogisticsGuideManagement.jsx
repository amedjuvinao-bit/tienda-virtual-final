import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  dangerButtonStyle,
  primaryButtonStyle,
  secondaryButtonStyle,
} from './OrderLogisticsUi';

export default function OrderLogisticsGuideManagement({
  canManage,
  labelConfirmation,
  onRunProviderAction,
  onSetLabelConfirmation,
  onSetPickupConfirmation,
  pickupConfirmation,
  shipment,
  view,
}) {
  const guideManageable = canManage && view.hasActiveLabel && view.providerConfigured;

  return (
    <>
      {guideManageable && !view.isProductionGuide && view.webhookRegistered && shipment.carrier?.trackingNumber ? (
        <details style={{ marginTop: 10, border: '1px dashed #a5b4fc', borderRadius: 13, padding: '9px 10px', background: '#f8faff' }}>
          <summary style={{ cursor: 'pointer', color: '#4338ca', fontSize: 10, fontWeight: 950 }}>
            Pruebas Sandbox · solo para verificar la integración
          </summary>
          <div style={{ marginTop: 9 }}>
            <div style={{ color: '#4338ca', fontSize: 9, fontWeight: 780, lineHeight: 1.5 }}>
              Esto no forma parte del trabajo diario. Solicita a Envia un aviso externo de prueba para comprobar que la tienda lo recibe automáticamente.
            </div>
            <div className="order-logistics-sandbox-grid" style={{ gap: 7, marginTop: 9 }}>
              <div style={{ color: '#4338ca', fontSize: 9, fontWeight: 780, lineHeight: 1.5 }}>
                Envia elegirá el contenido de prueba y lo enviará a la URL registrada.
              </div>
              <button type="button" onClick={() => onRunProviderAction(shipment, 'webhook_test')} disabled={view.isBusy} style={{ ...secondaryButtonStyle(), alignSelf: 'end' }}>
                Solicitar prueba oficial
              </button>
            </div>
          </div>
        </details>
      ) : null}

      {guideManageable ? (
        <details style={{ marginTop: 9 }}>
          <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 900 }}>
            Gestionar guía o resolver un problema
          </summary>
          <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
            Usa estas opciones solo si el seguimiento no cambia o si necesitas anular la guía.
          </p>
          <div style={{ display: 'flex', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
            {shipment.carrier?.trackingNumber ? (
              <button type="button" onClick={() => onRunProviderAction(shipment, 'track')} disabled={view.isBusy} style={secondaryButtonStyle()}>
                Consultar estado ahora
              </button>
            ) : null}
            <button type="button" onClick={() => onRunProviderAction(shipment, 'cancel')} disabled={view.isBusy} style={dangerButtonStyle()}>
              Cancelar esta guía
            </button>
          </div>
        </details>
      ) : null}

      {pickupConfirmation === view.shipmentId ? (
        <div role="alertdialog" aria-label={`Confirmar recolección de producción ${shipment.code}`} style={{ marginTop: 10, border: '1px solid #fdba74', borderRadius: 14, padding: 12, background: '#fff7ed' }}>
          <div style={{ color: '#9a3412', fontSize: 11, fontWeight: 950 }}>
            La recolección puede generar un cobro real
          </div>
          <p style={{ margin: '5px 0 0', color: '#9a3412', fontSize: 10, fontWeight: 700, lineHeight: 1.45 }}>
            Se solicitará a Envia una recolección para el {view.form.pickupDate}, de {view.form.pickupTimeStart} a {view.form.pickupTimeEnd}. Confirma que el paquete estará listo.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 9 }}>
            <button type="button" onClick={() => onSetPickupConfirmation('')} style={secondaryButtonStyle()}>Volver</button>
            <button type="button" onClick={() => onRunProviderAction(shipment, 'pickup', { productionConfirmed: true })} disabled={view.isBusy} style={primaryButtonStyle()}>Sí, solicitar recolección</button>
          </div>
        </div>
      ) : null}

      {labelConfirmation === view.shipmentId ? (
        <div role="alertdialog" aria-label={`Confirmar guía de producción ${shipment.code}`} style={{ marginTop: 10, border: '1px solid #fdba74', borderRadius: 14, padding: 12, background: '#fff7ed' }}>
          <div style={{ color: '#9a3412', fontSize: 11, fontWeight: 950 }}>
            Esta acción puede generar cobros reales
          </div>
          <p style={{ margin: '5px 0 0', color: '#9a3412', fontSize: 10, fontWeight: 700, lineHeight: 1.45 }}>
            Envia creará una guía de producción y descontará de tu saldo la tarifa seleccionada.{view.pickupOnGenerate ? ` También solicitará la recolección para el ${view.form.pickupDate}.` : ''} Confirma solo cuando el paquete y los datos del destinatario estén listos.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => onSetLabelConfirmation('')} style={secondaryButtonStyle()}>
              Volver
            </button>
            <button type="button" onClick={() => onRunProviderAction(shipment, 'label', { productionConfirmed: true })} disabled={view.isBusy} style={primaryButtonStyle()}>
              Sí, generar guía real
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
