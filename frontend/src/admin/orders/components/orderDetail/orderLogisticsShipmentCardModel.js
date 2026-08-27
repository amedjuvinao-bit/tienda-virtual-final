import {
  rankShippingRates,
  shippingRateKey,
} from './shippingRateRecommendation';
import {
  NEXT_ACTIONS,
  STATUS_POSITION,
  carrierActions,
  isPublicHttpUrl,
  shipmentForm,
} from './orderLogisticsViewModel';

function assistantCopy({
  automaticTrackingEnabled,
  handoffMode,
  hasActiveLabel,
  labelCancelled,
  pickup,
  pickupFailed,
  pickupScheduled,
  providerActive,
  providerConfigured,
  shipmentRates,
  status,
}) {
  const title = !providerActive
    ? providerConfigured
      ? 'Activa Envia para comenzar'
      : 'Configura Envia para comenzar'
    : automaticTrackingEnabled && status === 'delivered'
      ? 'Listo: el pedido ya fue entregado'
      : automaticTrackingEnabled && status === 'in_transit'
        ? 'No hagas nada: el paquete va en camino'
        : automaticTrackingEnabled && status === 'dispatched'
          ? 'No hagas nada: espera la actualización'
          : pickupFailed
            ? 'Corrige la recolección antes de continuar'
            : pickupScheduled
              ? 'Prepara el paquete para la recolección'
              : handoffMode === 'dropoff'
                ? 'Prepara el paquete y llévalo al punto elegido'
                : hasActiveLabel
                  ? 'Descarga la etiqueta y elige cómo entregar el paquete'
                  : shipmentRates.length
                    ? 'Crea la guía con esta opción'
                    : labelCancelled
                      ? 'Busca otra opción de envío'
                      : 'Busca el mejor envío para este pedido';

  const description = !providerActive
    ? 'Ve a Configuración de envíos y deja activa la conexión con Envia.'
    : automaticTrackingEnabled && status === 'delivered'
      ? 'Envia confirmó la entrega y la tienda actualizó la orden por ti.'
      : automaticTrackingEnabled && status === 'in_transit'
        ? 'Envia avisará cuando la transportadora confirme la entrega.'
        : automaticTrackingEnabled && status === 'dispatched'
          ? 'Envia actualizará esta orden cuando el paquete comience a moverse.'
          : pickupFailed
            ? 'No entregues el paquete todavía. Cancela esta guía y crea una nueva.'
            : pickupScheduled
              ? `Ten el paquete listo para el ${pickup.requestedDate || 'día elegido'}${pickup.timeFrom && pickup.timeTo ? `, de ${pickup.timeFrom} a ${pickup.timeTo}` : ''}.`
              : handoffMode === 'dropoff'
                ? 'Pon la etiqueta, lleva el paquete al punto autorizado y conserva el comprobante.'
                : hasActiveLabel
                  ? 'Primero descarga la etiqueta. Después elige si llevarás el paquete o pedirás recolección.'
                  : shipmentRates.length
                    ? 'La tienda ya comparó precio y tiempo. Confirma para crear la guía.'
                    : labelCancelled
                      ? 'La guía anterior fue cancelada. Busca una nueva opción para continuar.'
                      : 'La tienda revisará los datos y comparará las opciones disponibles.';

  return { title, description };
}

export function buildShipmentCardViewModel({
  shipment,
  providedForm,
  providedRates,
  providers,
  busy,
}) {
  const shipmentId = String(shipment._id);
  const form = providedForm || shipmentForm(shipment);
  const status = shipment.status || 'ready_to_pick';
  const position = STATUS_POSITION[status] ?? -1;
  const next = NEXT_ACTIONS[status];
  const isBusy = busy.startsWith(`${shipmentId}:`);
  const openIncident = (shipment.incidents || []).find(
    (incident) => incident.status === 'open'
  );
  const shipmentRates = providedRates || [];
  const rankedRates = rankShippingRates(shipmentRates, form.rateStrategy);
  const recommendedRate = rankedRates[0] || null;
  const selectedRate = form.selectedRate || recommendedRate;
  const selectedRateKey = shippingRateKey(selectedRate);
  const alternatives = rankedRates.filter(
    (rate) => shippingRateKey(rate) !== selectedRateKey
  );
  const labelCancelled = shipment.shippingIntegration?.status === 'cancelled';
  const hasActiveLabel = Boolean(shipment.shippingIntegration?.labelUrl) && !labelCancelled;
  const providerConfigured = Boolean(providers?.envia?.configured);
  const providerActive = Boolean(providers?.envia?.enabled);
  const providerMode = providers?.envia?.mode || 'sandbox';
  const guideMode = shipment.shippingIntegration?.mode || providerMode;
  const isProductionGuide = guideMode === 'production';
  const webhookRegistered = Boolean(providers?.envia?.webhookRegistered);
  const handoffMode = shipment.shippingIntegration?.handoffMode || 'pending';
  const pickup = shipment.shippingIntegration?.pickup || {};
  const pickupScheduled = pickup.status === 'scheduled';
  const pickupFailed = pickup.status === 'failed';
  const handoffComplete = handoffMode === 'dropoff' || pickupScheduled;
  const selectedCarrierActions = carrierActions(selectedRate?.carrierActions);
  const savedCarrierActions = carrierActions(
    shipment.shippingIntegration?.carrierActions
  );
  const activeCarrierActions = hasActiveLabel
    ? savedCarrierActions
    : selectedCarrierActions;
  const pickupOnGenerate = activeCarrierActions.includes('pickup_on_generate');
  const standalonePickup = activeCarrierActions.includes('pickup');
  const pickupMandatory = activeCarrierActions.includes('pickup_mandatory');
  const dropoffAvailable = !pickupMandatory && !pickupOnGenerate;
  const lastTrackingEvent = (
    shipment.shippingIntegration?.trackingEvents || []
  ).slice(-1)[0];
  const showPublicTracking = Boolean(
    hasActiveLabel &&
    isProductionGuide &&
    isPublicHttpUrl(shipment.carrier?.trackingUrl)
  );
  const automaticTrackingEnabled = Boolean(
    providerActive && hasActiveLabel && webhookRegistered
  );
  const nextRequiresCarrierUpdate = Boolean(
    next && ['mark_in_transit', 'deliver'].includes(next[0])
  );
  const carrierHasPackage = ['dispatched', 'in_transit', 'delivered'].includes(status);
  const shipmentDelivered = status === 'delivered';
  const visualStep = !providerActive
    ? 0
    : !hasActiveLabel
      ? 1
      : carrierHasPackage
        ? 3
        : 2;
  const copy = assistantCopy({
    automaticTrackingEnabled,
    handoffMode,
    hasActiveLabel,
    labelCancelled,
    pickup,
    pickupFailed,
    pickupScheduled,
    providerActive,
    providerConfigured,
    shipmentRates,
    status,
  });
  const waitingForAutomaticHandoff = (
    providerActive &&
    status === 'ready_to_pick' &&
    (!hasActiveLabel || !handoffComplete)
  );

  return {
    alternatives,
    assistantDescription: copy.description,
    assistantTitle: copy.title,
    automaticTrackingEnabled,
    dropoffAvailable,
    form,
    handoffComplete,
    handoffMode,
    hasActiveLabel,
    isBusy,
    isProductionGuide,
    labelCancelled,
    lastTrackingEvent,
    next,
    nextRequiresCarrierUpdate,
    openIncident,
    pickup,
    pickupFailed,
    pickupMandatory,
    pickupOnGenerate,
    pickupScheduled,
    position,
    providerActive,
    providerConfigured,
    providerMode,
    recommendedRate,
    selectedRate,
    shipmentDelivered,
    shipmentId,
    shipmentRates,
    showPublicTracking,
    standalonePickup,
    status,
    visualStep,
    waitingForAutomaticHandoff,
    webhookRegistered,
  };
}
