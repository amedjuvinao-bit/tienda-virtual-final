import { useCallback } from 'react';
import {
  cancelOrderShipmentLabel,
  confirmOrderShipmentDropoff,
  generateOrderShipmentLabel,
  quoteOrderShipment,
  scheduleOrderShipmentPickup,
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
  updateOrderShipment,
} from '../../../orderLogisticsApi';
import {
  recommendedShippingRate,
  validShippingRates,
} from '../shippingRateRecommendation';
import {
  planPayload,
  shipmentForm,
  shipmentIdempotencyKey,
} from '../orderLogisticsViewModel';

export default function useOrderShippingProviderActions({
  applyResponse,
  canManage,
  forms,
  orderId,
  providers,
  refresh,
  setBusy,
  setLabelConfirmation,
  setMessage,
  setPickupConfirmation,
  setRates,
  updateForm,
  onRefreshTimeline,
}) {
  return useCallback(async (shipment, action, options = {}) => {
    if (!canManage || !providers?.envia?.enabled) return;
    const shipmentId = String(shipment._id);
    const form = forms[shipmentId] || shipmentForm(shipment);
    const idempotencyKey = (operation, rate = null) => (
      shipmentIdempotencyKey(orderId, shipment, operation, rate)
    );

    try {
      setBusy(`${shipmentId}:provider:${action}`);
      setMessage(null);
      let data;

      if (action === 'quote') {
        const planned = await updateOrderShipment(orderId, shipmentId, {
          action: 'update_plan',
          expectedRevision: Number(shipment.revision || 0),
          ...planPayload(shipment, form),
          note: 'Medidas confirmadas antes de cotizar con Envia.',
        });
        applyResponse(planned);
        data = await quoteOrderShipment(orderId, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(planned.shipment?.revision || 0),
        });
        const receivedRates = validShippingRates(
          Array.isArray(data?.rates) ? data.rates : []
        );
        const recommendedRate = recommendedShippingRate(
          receivedRates,
          form.rateStrategy
        );
        setRates((previous) => ({ ...previous, [shipmentId]: receivedRates }));
        applyResponse(data);
        updateForm(shipmentId, {
          rateStrategy: form.rateStrategy,
          selectedRate: recommendedRate,
        });
        setMessage({
          type: recommendedRate ? 'success' : 'warning',
          text: recommendedRate
            ? `Encontramos ${receivedRates.length} opción(es) de envío y seleccionamos la más conveniente.`
            : 'Envia no devolvió tarifas válidas para este envío.',
        });
      } else if (action === 'label') {
        if (!form.selectedRate) {
          setMessage({
            type: 'error',
            text: 'Selecciona una tarifa antes de generar la guía.',
          });
          return;
        }
        if (providers.envia.mode === 'production' && !options.productionConfirmed) {
          setLabelConfirmation(shipmentId);
          return;
        }
        setLabelConfirmation('');
        data = await generateOrderShipmentLabel(
          orderId,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
            rate: form.selectedRate,
            pickupDate: form.pickupDate,
            pickupInstructions: form.pickupInstructions,
          },
          idempotencyKey(
            `label-${form.pickupDate || 'without-pickup'}`,
            form.selectedRate
          )
        );
        applyResponse(data);
        const generatedShipment = data?.shipment || (data?.shipments || []).find(
          (item) => String(item?._id) === shipmentId
        );
        let trackingPending = !generatedShipment?.carrier?.trackingNumber;
        if (generatedShipment?.carrier?.trackingNumber) {
          try {
            const trackingData = await syncOrderShipmentTracking(orderId, shipmentId, {
              provider: 'envia',
              expectedRevision: Number(generatedShipment.revision || 0),
            });
            applyResponse(trackingData);
          } catch {
            trackingPending = true;
          }
        }
        setMessage({
          type: trackingPending ? 'warning' : 'success',
          text: trackingPending
            ? `Guía de ${shipment.code} generada. El seguimiento aún no está disponible; puedes actualizarlo más tarde.`
            : providers.envia.mode === 'production'
              ? `Guía real de ${shipment.code} generada y seguimiento actualizado.`
              : `Guía de prueba de ${shipment.code} creada. Descarga la etiqueta para continuar.`,
        });
      } else if (action === 'track') {
        data = await syncOrderShipmentTracking(orderId, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(shipment.revision || 0),
        });
        applyResponse(data);
        setMessage({
          type: 'success',
          text: `Seguimiento de ${shipment.code} sincronizado.`,
        });
      } else if (action === 'webhook_test') {
        const webhookStatus = options.webhookStatus === 'Delivered'
          ? 'Delivered'
          : 'Shipped';
        await testOrderShipmentWebhook(orderId, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(shipment.revision || 0),
          status: webhookStatus,
        });
        setMessage({
          type: 'success',
          text: webhookStatus === 'Delivered'
            ? 'Prueba oficial de entrega solicitada. La orden cambiará únicamente cuando llegue el aviso de Envia.'
            : 'Prueba oficial de envío solicitada. Envia enviará el aviso a la URL registrada y la tienda lo procesará automáticamente.',
        });
        window.setTimeout(() => refresh().catch(() => {}), 1800);
      } else if (action === 'dropoff') {
        data = await confirmOrderShipmentDropoff(orderId, shipmentId, {
          expectedRevision: Number(shipment.revision || 0),
        });
        applyResponse(data);
        setMessage({
          type: 'success',
          text: `Entrega en punto seleccionada para ${shipment.code}. Imprime la etiqueta y continúa con la preparación.`,
        });
      } else if (action === 'pickup') {
        if (providers.envia.mode === 'production' && !options.productionConfirmed) {
          setPickupConfirmation(shipmentId);
          return;
        }
        setPickupConfirmation('');
        data = await scheduleOrderShipmentPickup(
          orderId,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
            pickupDate: form.pickupDate,
            pickupTimeStart: form.pickupTimeStart,
            pickupTimeEnd: form.pickupTimeEnd,
            pickupInstructions: form.pickupInstructions,
          },
          idempotencyKey('pickup')
        );
        applyResponse(data);
        setMessage({
          type: 'success',
          text: `Recolección de ${shipment.code} programada. Prepara el paquete antes de la ventana elegida.`,
        });
      } else if (action === 'cancel') {
        setLabelConfirmation('');
        data = await cancelOrderShipmentLabel(
          orderId,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
          },
          idempotencyKey('cancel')
        );
        applyResponse(data);
        setRates((previous) => ({ ...previous, [shipmentId]: [] }));
        const cancellation = data?.shipment?.shippingIntegration?.cancellation;
        setMessage({
          type: 'success',
          text: cancellation?.status === 'refunded'
            ? `Guía ${shipment.code} cancelada y saldo reintegrado.`
            : `Guía ${shipment.code} cancelada. El reintegro del saldo está pendiente de confirmación de Envia.`,
        });
      }
      await onRefreshTimeline?.();
    } catch (error) {
      if (error?.response?.data?.error === 'LOGISTICS_REVISION_CONFLICT') {
        await refresh().catch(() => {});
      }
      const providerError = error?.response?.data || {};
      const missing = Array.isArray(providerError?.details?.missing)
        ? providerError.details.missing
        : [];
      setMessage({
        type: 'error',
        text: providerError.message || 'No fue posible completar la operación con la transportadora.',
        configureBranch:
          (
            providerError.error === 'SHIPPING_DATA_INCOMPLETE' &&
            missing.some((item) => String(item).includes('sede'))
          ) || (
            providerError.error === 'SHIPPING_CITY_NOT_RESOLVED' &&
            providerError?.details?.address === 'origin'
          ),
      });
    } finally {
      setBusy('');
    }
  }, [
    applyResponse,
    canManage,
    forms,
    onRefreshTimeline,
    orderId,
    providers,
    refresh,
    setBusy,
    setLabelConfirmation,
    setMessage,
    setPickupConfirmation,
    setRates,
    updateForm,
  ]);
}
