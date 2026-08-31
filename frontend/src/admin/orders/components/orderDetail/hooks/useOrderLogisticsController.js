import { useEffect, useMemo, useState } from 'react';
import {
  getOrderLogistics,
  getShippingProviderStatus,
  initializeOrderLogistics,
  updateOrderShipment,
} from '../../../orderLogisticsApi';
import {
  CUSTOMER_STAGE_LABELS,
  hasPhysicalFulfillment,
  planPayload,
  shipmentForm,
} from '../orderLogisticsViewModel';
import useOrderShippingProviderActions from './useOrderShippingProviderActions';

function formsFor(shipments = []) {
  return Object.fromEntries(
    shipments.map((shipment) => [String(shipment._id), shipmentForm(shipment)])
  );
}

export default function useOrderLogisticsController({
  order,
  canManage = false,
  onRefreshTimeline,
  onCustomerStageConfirmed,
  onOrderUpdated,
}) {
  const initialShipments = Array.isArray(order?.fulfillment?.shipments)
    ? order.fulfillment.shipments
    : [];
  const [shipments, setShipments] = useState(initialShipments);
  const [summary, setSummary] = useState(order?.fulfillment?.logisticsSummary || {});
  const [eligibility, setEligibility] = useState(null);
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [forms, setForms] = useState({});
  const [providers, setProviders] = useState(null);
  const [rates, setRates] = useState({});
  const [labelConfirmation, setLabelConfirmation] = useState('');
  const [pickupConfirmation, setPickupConfirmation] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState(null);
  const physical = useMemo(() => hasPhysicalFulfillment(order), [order]);
  const orderId = order?._id;

  const applyResponse = (data) => {
    const nextShipments = Array.isArray(data?.shipments) ? data.shipments : [];
    const nextSummary = data?.summary || {};
    setShipments(nextShipments);
    setSummary(nextSummary);
    if (data?.eligibility) setEligibility(data.eligibility);
    setForms(formsFor(nextShipments));

    if (orderId) {
      const orderStatus = String(data?.orderStatus || '').trim();
      const fulfillmentStatus = String(data?.fulfillmentStatus || '').trim();
      onOrderUpdated?.({
        _id: orderId,
        ...(orderStatus ? { status: orderStatus } : {}),
        ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
        fulfillment: {
          ...(order.fulfillment || {}),
          ...(fulfillmentStatus ? { status: fulfillmentStatus } : {}),
          shipments: nextShipments,
          logisticsSummary: nextSummary,
        },
      });
    }
  };

  useEffect(() => {
    setShipments(initialShipments);
    setSummary(order?.fulfillment?.logisticsSummary || {});
    setForms(formsFor(initialShipments));
  }, [orderId, order?.fulfillment?.logisticsSummary?.updatedAt]);

  useEffect(() => {
    setEligibility(null);
    setMessage(null);
    setLabelConfirmation('');
    setPickupConfirmation('');
  }, [orderId]);

  useEffect(() => {
    if (!canManage || !physical || !orderId || initialShipments.length > 0) {
      return undefined;
    }

    let active = true;
    setEligibilityLoading(true);
    getOrderLogistics(orderId)
      .then((data) => {
        if (active) applyResponse(data);
      })
      .catch(() => {
        if (!active) return;
        setEligibility({
          canInitialize: false,
          code: 'ORDER_LOGISTICS_ELIGIBILITY_UNAVAILABLE',
          message: 'No fue posible verificar el pago y el inventario vendido.',
        });
      })
      .finally(() => {
        if (active) setEligibilityLoading(false);
      });

    return () => {
      active = false;
    };
  }, [canManage, orderId, physical, initialShipments.length]);

  useEffect(() => {
    if (!physical) return undefined;
    let active = true;
    getShippingProviderStatus()
      .then((data) => {
        if (active) setProviders(data?.providers || null);
      })
      .catch(() => {
        if (active) setProviders(null);
      });
    return () => {
      active = false;
    };
  }, [physical]);

  const refresh = async () => {
    if (!orderId) return;
    applyResponse(await getOrderLogistics(orderId));
  };

  const initialize = async () => {
    if (!canManage || !orderId || !eligibility?.canInitialize) return;
    try {
      setBusy('initialize');
      setMessage(null);
      const data = await initializeOrderLogistics(orderId);
      applyResponse(data);
      setMessage({
        type: 'success',
        text: providers?.envia?.enabled
          ? 'Envíos creados por sede. Continúa con la validación automática de datos y tarifas.'
          : 'Envíos creados por sede. Completa ahora el plan de operación manual.',
      });
      await onRefreshTimeline?.();
      await onCustomerStageConfirmed?.({
        action: 'initialize',
        label: CUSTOMER_STAGE_LABELS.initialize,
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: error?.response?.data?.message || 'No fue posible preparar la logística de la orden.',
      });
    } finally {
      setBusy('');
    }
  };

  const updateForm = (shipmentId, patch) => {
    if (
      Object.prototype.hasOwnProperty.call(patch, 'selectedRate') ||
      Object.prototype.hasOwnProperty.call(patch, 'rateStrategy') ||
      Object.prototype.hasOwnProperty.call(patch, 'handoffPreference')
    ) {
      setLabelConfirmation((current) => current === shipmentId ? '' : current);
    }
    setForms((previous) => ({
      ...previous,
      [shipmentId]: { ...(previous[shipmentId] || {}), ...patch },
    }));
  };

  const runAction = async (shipment, action, extra = {}) => {
    if (!canManage) return;
    const shipmentId = String(shipment._id);
    const form = forms[shipmentId] || shipmentForm(shipment);
    try {
      setBusy(`${shipmentId}:${action}`);
      setMessage(null);
      const payload = {
        action,
        expectedRevision: Number(shipment.revision || 0),
        note: form.note,
        ...extra,
      };
      if (['update_plan', 'dispatch'].includes(action)) {
        Object.assign(payload, planPayload(shipment, form));
      }
      if (action === 'dispatch') payload.dispatchReference = form.dispatchReference;
      if (action === 'deliver') {
        payload.deliveryReference = form.deliveryReference;
        payload.recipient = form.recipient;
      }
      if (action === 'report_incident') {
        payload.incidentType = form.incidentType;
        payload.severity = form.severity;
        payload.description = form.incidentDescription;
      }
      if (action === 'resolve_incident') payload.resolution = form.resolution;

      const data = await updateOrderShipment(orderId, shipmentId, payload);
      applyResponse(data);
      setMessage({
        type: 'success',
        text: `Envío ${shipment.code} actualizado correctamente.`,
      });
      await onRefreshTimeline?.();
      if (CUSTOMER_STAGE_LABELS[action]) {
        await onCustomerStageConfirmed?.({
          action,
          label: CUSTOMER_STAGE_LABELS[action],
          shipmentCode: shipment.code,
        });
      }
    } catch (error) {
      if (error?.response?.data?.error === 'LOGISTICS_REVISION_CONFLICT') {
        await refresh().catch(() => {});
      }
      setMessage({
        type: 'error',
        text: error?.response?.data?.message || 'No fue posible actualizar el envío.',
      });
    } finally {
      setBusy('');
    }
  };

  const runProviderAction = useOrderShippingProviderActions({
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
  });

  return {
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
  };
}
