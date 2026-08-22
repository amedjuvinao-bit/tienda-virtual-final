import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FileCheck2, PackageCheck, Truck } from 'lucide-react';

import {
  cancelOrderShipmentLabel,
  confirmOrderShipmentDropoff,
  generateOrderShipmentLabel,
  getOrderLogistics,
  getShippingProviderStatus,
  initializeOrderLogistics,
  quoteOrderShipment,
  scheduleOrderShipmentPickup,
  syncOrderShipmentTracking,
  testOrderShipmentWebhook,
  updateOrderShipment,
} from '../../orderLogisticsApi';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  rankShippingRates,
  recommendationExplanation,
  recommendedShippingRate,
  shippingRateKey,
  validShippingRates,
} from './shippingRateRecommendation';

const STATUS_LABELS = {
  ready_to_pick: 'Lista para preparar',
  picking: 'Reuniendo productos',
  picked: 'Productos reunidos',
  packing: 'Empacando',
  packed: 'Paquete listo',
  dispatched: 'Entregada a la transportadora',
  in_transit: 'En tránsito',
  delivered: 'Entregada',
  exception: 'Con incidencia',
  cancelled: 'Cancelada',
};

const NEXT_ACTIONS = {
  ready_to_pick: ['start_picking', 'Comenzar a reunir productos'],
  picking: ['complete_picking', 'Confirmar productos reunidos'],
  picked: ['start_packing', 'Comenzar a empacar'],
  packing: ['complete_packing', 'Confirmar paquete cerrado'],
  packed: ['dispatch', 'Confirmar entrega a la transportadora'],
  dispatched: ['mark_in_transit', 'Marcar en tránsito'],
  in_transit: ['deliver', 'Confirmar entrega'],
};

const STEPS = [
  ['ready_to_pick', 'Preparar'],
  ['picking', 'Reunir productos'],
  ['packing', 'Empacar'],
  ['dispatched', 'Transportadora'],
  ['in_transit', 'En tránsito'],
  ['delivered', 'Entrega'],
];

const WEBHOOK_TEST_LABELS = {
  'Picked Up': 'el paquete fue recolectado',
  Shipped: 'el paquete está en tránsito',
  Delivered: 'el paquete fue entregado',
  Canceled: 'el envío fue cancelado',
};

const STATUS_POSITION = {
  ready_to_pick: 0,
  picking: 1,
  picked: 2,
  packing: 3,
  packed: 3,
  dispatched: 4,
  in_transit: 5,
  delivered: 6,
};

const CUSTOMER_STAGE_LABELS = {
  initialize: 'Preparación logística iniciada',
  start_picking: 'Preparación iniciada',
  complete_picking: 'Productos seleccionados',
  start_packing: 'Empaque iniciado',
  complete_packing: 'Pedido empacado',
  dispatch: 'Pedido despachado',
  mark_in_transit: 'Pedido en tránsito',
  deliver: 'Entrega confirmada',
  report_incident: 'Novedad registrada',
  resolve_incident: 'Novedad solucionada',
};

function toLocalDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

function localDateAfter(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function formatDeadline(value) {
  if (!value) return 'Sin compromiso';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin compromiso';
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value, currency = 'COP') {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: currency || 'COP',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function isPublicHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function carrierActions(value) {
  return [...new Set((Array.isArray(value) ? value : [])
    .map((action) => String(action || '').trim().toLowerCase())
    .filter(Boolean))];
}

function planField(label, control) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900 }}>
        {label}
      </span>
      {control}
    </label>
  );
}

function shipmentForm(shipment = {}) {
  const packages = Array.isArray(shipment.packages) ? shipment.packages : [];
  const carrier = shipment.carrier || {};
  const sla = shipment.sla || {};
  return {
    priority: shipment.priority || 'normal',
    carrierCode: carrier.code || '',
    carrierName: carrier.name || '',
    serviceLevel: carrier.serviceLevel || '',
    trackingNumber: carrier.trackingNumber || '',
    trackingUrl: carrier.trackingUrl || '',
    pickingDueAt: toLocalDateTime(sla.pickingDueAt),
    dispatchDueAt: toLocalDateTime(sla.dispatchDueAt),
    deliveryDueAt: toLocalDateTime(sla.deliveryDueAt),
    packageCount: Math.max(1, packages.length || 1),
    weightGrams: Number(packages[0]?.weightGrams || 0),
    lengthCm: Number(packages[0]?.lengthCm || 0),
    widthCm: Number(packages[0]?.widthCm || 0),
    heightCm: Number(packages[0]?.heightCm || 0),
    selectedRate: null,
    rateStrategy: 'balanced',
    pickupDate: shipment.shippingIntegration?.pickup?.requestedDate || localDateAfter(1),
    pickupTimeStart: shipment.shippingIntegration?.pickup?.timeFrom || '09:00',
    pickupTimeEnd: shipment.shippingIntegration?.pickup?.timeTo || '14:00',
    pickupInstructions: shipment.shippingIntegration?.pickup?.instructions || '',
    testStatus: 'Shipped',
    dispatchReference: shipment.dispatchEvidence?.reference || '',
    deliveryReference: shipment.deliveryEvidence?.reference || '',
    recipient: shipment.deliveryEvidence?.recipient || '',
    incidentType: 'delay',
    severity: 'medium',
    incidentDescription: '',
    resolution: '',
    note: '',
  };
}

function planPayload(shipment, form) {
  const existingPackages = Array.isArray(shipment.packages)
    ? shipment.packages
    : [];
  const packageCount = Math.min(20, Math.max(1, Number(form.packageCount || 1)));
  const packages = Array.from({ length: packageCount }, (_, index) => ({
    ...(existingPackages[index] || {}),
    code:
      existingPackages[index]?.code ||
      `${shipment.code}-P${String(index + 1).padStart(2, '0')}`,
    weightGrams: Number(form.weightGrams || 0),
    lengthCm: Number(form.lengthCm || 0),
    widthCm: Number(form.widthCm || 0),
    heightCm: Number(form.heightCm || 0),
  }));
  return {
    priority: form.priority,
    carrier: {
      code: form.carrierCode,
      name: form.carrierName,
      serviceLevel: form.serviceLevel,
      trackingNumber: form.trackingNumber,
      trackingUrl: form.trackingUrl,
    },
    packages,
    sla: {
      pickingDueAt: form.pickingDueAt || null,
      dispatchDueAt: form.dispatchDueAt || null,
      deliveryDueAt: form.deliveryDueAt || null,
    },
  };
}

function hasPhysicalFulfillment(order) {
  if ((order?.inventoryAllocations || []).some((item) => Number(item?.soldQuantity || 0) > Number(item?.returnedQuantity || 0))) {
    return true;
  }
  return (order?.items || order?.cart || []).some((item) => {
    const type = String(item?.productType || '').toLowerCase();
    return !['digital', 'service'].includes(type) && item?.requiresShipping !== false;
  });
}

function summaryCard(label, value, tone = 'default') {
  const tones = {
    default: ['var(--admin-card-bg)', 'var(--admin-card-text)'],
    primary: ['var(--admin-primary-soft-bg)', 'var(--admin-primary)'],
    warning: ['#fff7ed', '#c2410c'],
    danger: ['#fff1f2', '#be123c'],
    success: ['#ecfdf5', '#047857'],
  };
  const [background, color] = tones[tone] || tones.default;
  return (
    <div
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 16,
        padding: '11px 12px',
        background,
        minWidth: 0,
      }}
    >
      <div style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: 5, color, fontSize: 18, fontWeight: 950 }}>
        {value}
      </div>
    </div>
  );
}

export default function OrderDetailLogisticsPanel({
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

  const applyResponse = (data) => {
    const nextShipments = Array.isArray(data?.shipments) ? data.shipments : [];
    const nextSummary = data?.summary || {};
    setShipments(nextShipments);
    setSummary(nextSummary);
    if (data?.eligibility) setEligibility(data.eligibility);
    setForms(
      Object.fromEntries(
        nextShipments.map((shipment) => [
          String(shipment._id),
          shipmentForm(shipment),
        ])
      )
    );
    if (order?._id) {
      const orderStatus = String(data?.orderStatus || '').trim();
      const fulfillmentStatus = String(data?.fulfillmentStatus || '').trim();
      onOrderUpdated?.({
        _id: order._id,
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
    setForms(
      Object.fromEntries(
        initialShipments.map((shipment) => [
          String(shipment._id),
          shipmentForm(shipment),
        ])
      )
    );
  }, [order?._id, order?.fulfillment?.logisticsSummary?.updatedAt]);

  useEffect(() => {
    setEligibility(null);
    setMessage(null);
    setLabelConfirmation('');
    setPickupConfirmation('');
  }, [order?._id]);

  useEffect(() => {
    if (!canManage || !physical || !order?._id || initialShipments.length > 0) {
      return undefined;
    }

    let active = true;
    setEligibilityLoading(true);
    getOrderLogistics(order._id)
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
  }, [canManage, order?._id, physical, initialShipments.length]);

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

  if (!physical) return null;

  const refresh = async () => {
    if (!order?._id) return;
    const data = await getOrderLogistics(order._id);
    applyResponse(data);
  };

  const initialize = async () => {
    if (!canManage || !order?._id || !eligibility?.canInitialize) return;
    try {
      setBusy('initialize');
      setMessage(null);
      const data = await initializeOrderLogistics(order._id);
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
    if (Object.prototype.hasOwnProperty.call(patch, 'selectedRate') || Object.prototype.hasOwnProperty.call(patch, 'rateStrategy')) {
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

      const data = await updateOrderShipment(order._id, shipmentId, payload);
      applyResponse(data);
      setMessage({ type: 'success', text: `Envío ${shipment.code} actualizado correctamente.` });
      await onRefreshTimeline?.();
      if (CUSTOMER_STAGE_LABELS[action]) {
        await onCustomerStageConfirmed?.({
          action,
          label: CUSTOMER_STAGE_LABELS[action],
          shipmentCode: shipment.code,
        });
      }
    } catch (error) {
      const code = error?.response?.data?.error;
      if (code === 'LOGISTICS_REVISION_CONFLICT') {
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

  const idempotencyKey = (shipment, action, rate = null) => {
    const safe = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 50);
    return [
      action,
      safe(order?._id),
      safe(shipment?._id),
      `r${Number(shipment?.revision || 0)}`,
      safe(rate?.carrier),
      safe(rate?.service),
    ].filter(Boolean).join(':');
  };

  const runProviderAction = async (shipment, action, options = {}) => {
    if (!canManage || !providers?.envia?.enabled) return;
    const shipmentId = String(shipment._id);
    const form = forms[shipmentId] || shipmentForm(shipment);
    try {
      setBusy(`${shipmentId}:provider:${action}`);
      setMessage(null);
      let data;
      if (action === 'quote') {
        const planned = await updateOrderShipment(order._id, shipmentId, {
          action: 'update_plan',
          expectedRevision: Number(shipment.revision || 0),
          ...planPayload(shipment, form),
          note: 'Medidas confirmadas antes de cotizar con Envia.',
        });
        applyResponse(planned);
        data = await quoteOrderShipment(order._id, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(planned.shipment?.revision || 0),
        });
        const providerRates = Array.isArray(data?.rates) ? data.rates : [];
        const receivedRates = validShippingRates(providerRates);
        const recommendedRate = recommendedShippingRate(receivedRates, form.rateStrategy);
        setRates((previous) => ({
          ...previous,
          [shipmentId]: receivedRates,
        }));
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
          setMessage({ type: 'error', text: 'Selecciona una tarifa antes de generar la guía.' });
          return;
        }
        if (
          providers.envia.mode === 'production' &&
          !options.productionConfirmed
        ) {
          setLabelConfirmation(shipmentId);
          return;
        }
        setLabelConfirmation('');
        data = await generateOrderShipmentLabel(
          order._id,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
            rate: form.selectedRate,
            pickupDate: form.pickupDate,
            pickupInstructions: form.pickupInstructions,
          },
          idempotencyKey(
            shipment,
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
            const trackingData = await syncOrderShipmentTracking(order._id, shipmentId, {
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
        data = await syncOrderShipmentTracking(order._id, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(shipment.revision || 0),
        });
        applyResponse(data);
        setMessage({ type: 'success', text: `Seguimiento de ${shipment.code} sincronizado.` });
      } else if (action === 'webhook_test') {
        data = await testOrderShipmentWebhook(order._id, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(shipment.revision || 0),
          testStatus: form.testStatus,
        });
        setMessage({
          type: 'success',
          text: `Prueba enviada: estamos imitando que Envia informó que ${WEBHOOK_TEST_LABELS[form.testStatus] || form.testStatus}. En un envío real, Envia enviará este aviso automáticamente y el administrador no tendrá que cambiar el estado.`,
        });
        window.setTimeout(() => refresh().catch(() => {}), 1800);
      } else if (action === 'dropoff') {
        data = await confirmOrderShipmentDropoff(order._id, shipmentId, {
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
          order._id,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
            pickupDate: form.pickupDate,
            pickupTimeStart: form.pickupTimeStart,
            pickupTimeEnd: form.pickupTimeEnd,
            pickupInstructions: form.pickupInstructions,
          },
          idempotencyKey(shipment, 'pickup')
        );
        applyResponse(data);
        setMessage({
          type: 'success',
          text: `Recolección de ${shipment.code} programada. Prepara el paquete antes de la ventana elegida.`,
        });
      } else if (action === 'cancel') {
        setLabelConfirmation('');
        data = await cancelOrderShipmentLabel(
          order._id,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
          },
          idempotencyKey(shipment, 'cancel')
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
  };

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
            {summaryCard('Envíos', summary.shipmentCount || shipments.length, 'primary')}
            {summaryCard('Listos', summary.readyCount || 0)}
            {summaryCard('Despachados', summary.dispatchedCount || 0, 'warning')}
            {summaryCard('Entregados', summary.deliveredCount || 0, 'success')}
            {summaryCard('Incidencias', summary.exceptionCount || 0, summary.exceptionCount ? 'danger' : 'default')}
            {summaryCard('SLA vencido', summary.slaBreachedCount || 0, summary.slaBreachedCount ? 'danger' : 'default')}
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            {shipments.map((shipment) => {
              const shipmentId = String(shipment._id);
              const form = forms[shipmentId] || shipmentForm(shipment);
              const status = shipment.status || 'ready_to_pick';
              const position = STATUS_POSITION[status] ?? -1;
              const next = NEXT_ACTIONS[status];
              const isBusy = busy.startsWith(`${shipmentId}:`);
              const openIncident = (shipment.incidents || []).find((incident) => incident.status === 'open');
              const shipmentRates = rates[shipmentId] || [];
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
              const savedCarrierActions = carrierActions(shipment.shippingIntegration?.carrierActions);
              const activeCarrierActions = hasActiveLabel
                ? savedCarrierActions
                : selectedCarrierActions;
              const pickupOnGenerate = activeCarrierActions.includes('pickup_on_generate');
              const standalonePickup = activeCarrierActions.includes('pickup');
              const pickupMandatory = activeCarrierActions.includes('pickup_mandatory');
              const dropoffAvailable = !pickupMandatory && !pickupOnGenerate;
              const lastTrackingEvent = (shipment.shippingIntegration?.trackingEvents || []).slice(-1)[0];
              const showPublicTracking = Boolean(
                hasActiveLabel &&
                isProductionGuide &&
                isPublicHttpUrl(shipment.carrier?.trackingUrl)
              );
              const automaticTrackingEnabled = Boolean(
                providerActive &&
                hasActiveLabel &&
                webhookRegistered
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
              const visualSteps = [
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
              const CurrentStepIcon = visualSteps[Math.max(visualStep - 1, 0)].Icon;
              const assistantTitle = !providerActive
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
              const assistantDescription = !providerActive
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
              const waitingForAutomaticHandoff = (
                providerActive &&
                status === 'ready_to_pick' &&
                (!hasActiveLabel || !handoffComplete)
              );
              return (
                <article
                  key={shipmentId}
                  style={{
                    border: `1px solid ${status === 'exception' ? '#fecdd3' : ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 20,
                    padding: 14,
                    background: status === 'exception' ? 'color-mix(in srgb, #fff1f2 70%, var(--admin-card-bg))' : 'var(--admin-card-bg)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ order: 1, display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 13, fontWeight: 950 }}>
                        {shipment.code} · {shipment.branchSnapshot?.name || shipment.branchSnapshot?.code || 'Sede operativa'}
                      </div>
                      <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
                        {shipment.quantity} unidad(es) · {shipment.packages?.length || 0} paquete(s) · revisión {Number(shipment.revision || 0)}
                      </div>
                    </div>
                    <span style={{ alignSelf: 'flex-start', borderRadius: 999, padding: '6px 10px', background: status === 'exception' ? '#ffe4e6' : 'var(--admin-primary-soft-bg)', color: status === 'exception' ? '#be123c' : 'var(--admin-primary)', fontSize: 10, fontWeight: 950 }}>
                      {STATUS_LABELS[status] || status}
                    </span>
                  </div>

                  <details style={{ order: 4, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${ORDER_DETAIL_THEME.cardBorder}` }}>
                    <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 900 }}>
                      Ver avance detallado del paquete
                    </summary>
                    <p style={{ margin: '4px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 720, lineHeight: 1.4 }}>
                      {waitingForAutomaticHandoff
                        ? 'Primero genera la guía y define cómo llegará el paquete a la transportadora. Después podrás comenzar a reunir los productos.'
                        : automaticTrackingEnabled && nextRequiresCarrierUpdate
                          ? 'Tu trabajo de preparación terminó. Los siguientes estados llegarán automáticamente desde Envia.'
                          : 'Pulsa únicamente el botón que describe la siguiente tarea.'}
                    </p>
                    <div className="order-logistics-step-grid" style={{ gap: 5, marginTop: 10 }}>
                      {STEPS.map(([step, label], index) => {
                        const active = status === 'exception' ? index <= (STATUS_POSITION[shipment.resumeStatus] ?? 0) : index <= position;
                        return (
                          <div key={step} style={{ borderRadius: 10, padding: '7px 4px', textAlign: 'center', background: active ? 'var(--admin-primary-soft-bg)' : 'var(--admin-bg)', color: active ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900 }}>
                            {label}
                          </div>
                        );
                      })}
                    </div>

                    <div className="order-logistics-deadline-grid" style={{ gap: 8, marginTop: 10 }}>
                      {[
                        ['Picking', shipment.sla?.pickingDueAt],
                        ['Despacho', shipment.sla?.dispatchDueAt],
                        ['Promesa de entrega', shipment.sla?.deliveryDueAt],
                      ].map(([label, value]) => (
                        <div key={label} style={{ borderRadius: 12, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, padding: 9 }}>
                          <div style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900, textTransform: 'uppercase' }}>{label}</div>
                          <div style={{ marginTop: 3, color: shipment.sla?.breachedAt ? '#be123c' : ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 850 }}>{formatDeadline(value)}</div>
                        </div>
                      ))}
                    </div>
                  </details>

                  <details style={{ order: 3, marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 900 }}>
                      {providerActive
                        ? 'Ver o corregir los datos utilizados por Envia'
                        : 'Plan manual de transportadora, paquetes y SLA'}
                    </summary>
                    <div className="order-logistics-plan-grid" style={{ gap: 8, marginTop: 10 }}>
                      {!providerActive ? (
                        <>
                          {planField('Prioridad', (
                            <select aria-label={`Prioridad ${shipment.code}`} value={form.priority} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { priority: event.target.value })} style={inputStyle()}>
                              <option value="normal">Normal</option>
                              <option value="high">Alta</option>
                              <option value="urgent">Urgente</option>
                            </select>
                          ))}
                          {planField('Transportadora', <input aria-label={`Transportadora ${shipment.code}`} value={form.carrierName} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { carrierName: event.target.value })} placeholder="Nombre de la transportadora" style={inputStyle()} />)}
                          {planField('Nivel de servicio', <input aria-label={`Servicio ${shipment.code}`} value={form.serviceLevel} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { serviceLevel: event.target.value })} placeholder="Servicio contratado" style={inputStyle()} />)}
                          {planField('Número de guía', <input aria-label={`Guía ${shipment.code}`} value={form.trackingNumber} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { trackingNumber: event.target.value })} placeholder="Número entregado por la transportadora" style={inputStyle()} />)}
                          {planField('Límite para picking', <input type="datetime-local" aria-label={`SLA picking ${shipment.code}`} value={form.pickingDueAt} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { pickingDueAt: event.target.value })} style={inputStyle()} />)}
                          {planField('Límite para despacho', <input type="datetime-local" aria-label={`SLA despacho ${shipment.code}`} value={form.dispatchDueAt} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { dispatchDueAt: event.target.value })} style={inputStyle()} />)}
                          {planField('Promesa de entrega', <input type="datetime-local" aria-label={`SLA entrega ${shipment.code}`} value={form.deliveryDueAt} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { deliveryDueAt: event.target.value })} style={inputStyle()} />)}
                        </>
                      ) : null}
                      {planField('Número de paquetes', <input type="number" min="1" max="20" aria-label={`Paquetes ${shipment.code}`} value={form.packageCount} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { packageCount: event.target.value })} style={inputStyle()} />)}
                      {planField('Peso por paquete (g)', <input type="number" min="0" aria-label={`Peso ${shipment.code}`} value={form.weightGrams} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { weightGrams: event.target.value })} style={inputStyle()} />)}
                      {planField('Largo (cm)', <input type="number" min="0" aria-label={`Largo ${shipment.code}`} value={form.lengthCm} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { lengthCm: event.target.value })} style={inputStyle()} />)}
                      {planField('Ancho (cm)', <input type="number" min="0" aria-label={`Ancho ${shipment.code}`} value={form.widthCm} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { widthCm: event.target.value })} style={inputStyle()} />)}
                      {planField('Alto (cm)', <input type="number" min="0" aria-label={`Alto ${shipment.code}`} value={form.heightCm} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { heightCm: event.target.value })} style={inputStyle()} />)}
                    </div>
                    <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700 }}>
                      {providerActive
                        ? 'Envia utilizará estos datos para calcular las tarifas. La transportadora, el servicio y la guía se completan automáticamente.'
                        : 'Registra manualmente la transportadora y la guía. El peso y las dimensiones se aplican a cada paquete.'}
                    </p>
                    {canManage ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button type="button" onClick={() => runAction(shipment, 'update_plan')} disabled={isBusy} style={secondaryButtonStyle()}>
                          {providerActive ? 'Guardar peso y medidas' : 'Guardar plan manual'}
                        </button>
                      </div>
                    ) : null}
                  </details>

                  <div style={{ order: 2, marginTop: 12, border: '2px solid var(--admin-primary)', borderRadius: 22, padding: 16, background: 'color-mix(in srgb, var(--admin-primary-soft-bg) 32%, var(--admin-card-bg))', boxShadow: '0 12px 30px color-mix(in srgb, var(--admin-primary) 13%, transparent)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 18, fontWeight: 950 }}>
                          Despacha este pedido en 3 pasos
                        </div>
                        <div style={{ marginTop: 5, color: ORDER_DETAIL_THEME.mutedText, fontSize: 13, fontWeight: 750, lineHeight: 1.45 }}>
                          {providerActive
                            ? 'El panel te mostrará una sola tarea a la vez.'
                            : 'Activa Envia para comenzar el recorrido guiado.'}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ borderRadius: 999, padding: '7px 11px', background: providerMode === 'production' ? '#fff7ed' : '#eef2ff', color: providerMode === 'production' ? '#9a3412' : '#4338ca', fontSize: 11, fontWeight: 950, letterSpacing: '.03em' }}>
                          {providerMode === 'production' ? 'ENVÍO REAL' : 'PRUEBA SIN ENVÍO REAL'}
                        </span>
                        {providerActive && visualStep ? (
                          <span style={{ borderRadius: 999, padding: '7px 11px', background: 'var(--admin-primary)', color: '#fff', fontSize: 11, fontWeight: 950, letterSpacing: '.03em' }}>
                            {shipmentDelivered ? '3 PASOS LISTOS' : `PASO ACTUAL ${visualStep} DE 3`}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {providerActive ? (
                      <div role="note" style={{ marginTop: 12, borderRadius: 14, padding: '11px 13px', background: providerMode === 'production' ? '#fff7ed' : '#eef2ff', color: providerMode === 'production' ? '#9a3412' : '#4338ca', fontSize: 13, fontWeight: 820, lineHeight: 1.45 }}>
                        {providerMode === 'production'
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
                          {assistantTitle}
                        </div>
                        <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 13, fontWeight: 720, lineHeight: 1.5 }}>
                          {assistantDescription}
                        </p>
                        {!providerActive ? (
                          <a href="/admin/configuracion/envios" style={{ ...secondaryButtonStyle(), display: 'inline-flex', marginTop: 12, minHeight: 44, alignItems: 'center', fontSize: 13, textDecoration: 'none' }}>
                            {providerConfigured ? 'Activar Envia' : 'Configurar Envia'}
                          </a>
                        ) : canManage && !hasActiveLabel && shipmentRates.length === 0 ? (
                          <button type="button" onClick={() => runProviderAction(shipment, 'quote')} disabled={isBusy} style={{ ...primaryButtonStyle(), marginTop: 12, minHeight: 44, fontSize: 13 }}>
                            {labelCancelled ? 'Buscar otra opción de envío' : 'Buscar opciones de envío'}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {providerActive ? (
                      <div className="order-logistics-visual-steps" aria-label="Recorrido del envío en tres pasos" style={{ marginTop: 14 }}>
                        {visualSteps.map(({ title, description, Icon }, index) => {
                          const stepNumber = index + 1;
                          const isComplete = shipmentDelivered || visualStep > stepNumber;
                          const isActive = !shipmentDelivered && visualStep === stepNumber;
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

                    {shipmentRates.length > 0 && !hasActiveLabel ? (
                      <div style={{ display: 'grid', gap: 9, marginTop: 10 }}>
                        {selectedRate ? (
                          <div aria-label={`Tarifa seleccionada ${shipment.code}`} style={{ border: '1px solid var(--admin-primary)', borderRadius: 14, padding: 12, background: 'var(--admin-primary-soft-bg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div>
                                <span style={{ display: 'inline-block', borderRadius: 999, padding: '4px 8px', background: 'var(--admin-primary)', color: '#fff', fontSize: 8, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                                  {shippingRateKey(selectedRate) === shippingRateKey(recommendedRate) ? 'Opción recomendada' : 'Opción seleccionada'}
                                </span>
                                <div style={{ marginTop: 7, color: ORDER_DETAIL_THEME.cardText, fontSize: 13, fontWeight: 950 }}>
                                  {selectedRate.carrier} · {selectedRate.serviceDescription || selectedRate.service}
                                </div>
                                <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 750 }}>
                                  Entrega: {selectedRate.deliveryEstimate || 'por confirmar'}
                                </div>
                              </div>
                              <strong style={{ color: 'var(--admin-primary)', fontSize: 18 }}>
                                {formatMoney(selectedRate.totalPrice, selectedRate.currency)}
                              </strong>
                            </div>
                            <p style={{ margin: '8px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700 }}>
                              {shippingRateKey(selectedRate) === shippingRateKey(recommendedRate)
                                ? recommendationExplanation(form.rateStrategy)
                                : 'Elegida manualmente entre las opciones recibidas.'}
                            </p>
                            {pickupOnGenerate ? (
                              <div style={{ marginTop: 10, border: '1px solid #fdba74', borderRadius: 12, padding: 10, background: '#fff7ed' }}>
                                <div style={{ color: '#9a3412', fontSize: 10, fontWeight: 950 }}>
                                  Esta transportadora programa la recolección al crear la guía
                                </div>
                                <p style={{ margin: '4px 0 8px', color: '#9a3412', fontSize: 9, fontWeight: 720, lineHeight: 1.45 }}>
                                  Elige el día en que el paquete estará empacado. Envia enviará la guía y la solicitud de recolección en una sola operación.
                                </p>
                                {planField('Fecha de recolección', (
                                  <input type="date" aria-label={`Fecha de recolección al generar ${shipment.code}`} value={form.pickupDate} onChange={(event) => updateForm(shipmentId, { pickupDate: event.target.value })} style={inputStyle()} />
                                ))}
                              </div>
                            ) : null}
                            {canManage ? (
                              <button type="button" onClick={() => runProviderAction(shipment, 'label')} disabled={isBusy} style={{ ...primaryButtonStyle(), width: '100%', justifyContent: 'center', marginTop: 10 }}>
                                {pickupOnGenerate
                                  ? providerMode === 'production'
                                    ? 'Crear guía y pedir recolección'
                                    : 'Crear guía de prueba y pedir recolección'
                                  : providerMode === 'production'
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
                                value={form.rateStrategy}
                                onChange={(event) => {
                                  const rateStrategy = event.target.value;
                                  updateForm(shipmentId, {
                                    rateStrategy,
                                    selectedRate: recommendedShippingRate(shipmentRates, rateStrategy),
                                  });
                                }}
                                style={inputStyle()}
                              >
                                <option value="balanced">Equilibrio entre precio y tiempo</option>
                                <option value="cheapest">Menor precio</option>
                                <option value="fastest">Entrega más rápida</option>
                              </select>
                            </label>
                            {alternatives.map((rate, index) => (
                              <button key={`${shippingRateKey(rate)}-${index}`} type="button" onClick={() => updateForm(shipmentId, { selectedRate: rate })} style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 10, padding: '8px 10px', background: ORDER_DETAIL_THEME.cardBg, color: ORDER_DETAIL_THEME.cardText, display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', cursor: 'pointer', fontSize: 10, fontWeight: 850 }}>
                                <span>{rate.carrier} · {rate.serviceDescription || rate.service} · {rate.deliveryEstimate || 'Entrega por confirmar'}</span>
                                <span>{formatMoney(rate.totalPrice, rate.currency)}</span>
                              </button>
                            ))}
                            <button type="button" onClick={() => runProviderAction(shipment, 'quote')} disabled={isBusy} style={{ ...secondaryButtonStyle(), justifySelf: 'start' }}>
                              Volver a consultar tarifas
                            </button>
                          </div>
                        </details>
                      </div>
                    ) : null}

                    {hasActiveLabel ? (
                      <div style={{ marginTop: 10, border: '1px solid #86efac', borderRadius: 14, padding: 12, background: '#ecfdf5' }}>
                        <div style={{ color: '#047857', fontSize: 9, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                          Guía lista
                        </div>
                        <div style={{ marginTop: 5, color: ORDER_DETAIL_THEME.cardText, fontSize: 13, fontWeight: 950 }}>
                          {shipment.carrier?.name || shipment.shippingIntegration?.selectedRate?.carrier || 'Transportadora'} · {shipment.carrier?.serviceLevel || shipment.shippingIntegration?.selectedRate?.service || 'Servicio'}
                        </div>
                        <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 750 }}>
                          Número de guía: {shipment.carrier?.trackingNumber || 'generado'}
                        </div>
                        <div style={{ marginTop: 7, borderRadius: 10, padding: '7px 9px', background: '#d1fae5', color: '#047857', fontSize: 9, fontWeight: 850 }}>
                          {webhookRegistered
                            ? isProductionGuide
                              ? 'Seguimiento automático listo: Envia actualizará esta orden. No selecciones estados manualmente.'
                              : 'Seguimiento automático listo para probar. La simulación está separada abajo en “Pruebas Sandbox”.'
                            : 'Seguimiento automático pendiente. Registra el webhook desde Configuración → Envíos.'}
                        </div>
                        {(shipment.shippingIntegration?.providerStatus || lastTrackingEvent?.status) ? (
                          <div style={{ marginTop: 7, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 750 }}>
                            {isProductionGuide ? 'Último estado de Envia' : 'Último aviso de prueba de Envia'}: <strong>{shipment.shippingIntegration?.providerStatus || lastTrackingEvent?.status}</strong>
                            {shipment.shippingIntegration?.providerStatusDescription ? ` · ${shipment.shippingIntegration.providerStatusDescription}` : ''}
                            {!isProductionGuide ? ' · simulación, no cambia el paquete real' : ''}
                          </div>
                        ) : null}
                        <div style={{ display: 'flex', gap: 7, marginTop: 10, flexWrap: 'wrap' }}>
                          <a href={shipment.shippingIntegration.labelUrl} target="_blank" rel="noreferrer" style={{ ...primaryButtonStyle(), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                            Descargar etiqueta
                          </a>
                          {showPublicTracking ? (
                            <a href={shipment.carrier.trackingUrl} target="_blank" rel="noreferrer" style={{ ...secondaryButtonStyle(), display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
                              Ver seguimiento público
                            </a>
                          ) : null}
                        </div>
                        {!isProductionGuide ? (
                          <p style={{ margin: '8px 0 0', color: '#047857', fontSize: 9, fontWeight: 800 }}>
                            El seguimiento público se habilitará únicamente para las guías reales de producción.
                          </p>
                        ) : null}
                      </div>
                    ) : labelCancelled && shipment.shippingIntegration?.labelUrl ? (
                      <div style={{ marginTop: 9, borderRadius: 12, padding: 9, background: '#fff1f2', color: '#be123c', fontSize: 9, fontWeight: 850 }}>
                        La guía anterior está cancelada y ya no puede utilizarse.
                        {shipment.shippingIntegration?.cancellation?.status === 'refund_pending'
                          ? ' El reintegro del saldo sigue pendiente de confirmación.'
                          : shipment.shippingIntegration?.cancellation?.status === 'refunded'
                            ? ' Envia confirmó el reintegro del saldo.'
                            : ''}
                      </div>
                    ) : null}

                    {canManage && hasActiveLabel && providerConfigured ? (
                      <div style={{ marginTop: 10, border: `1px solid ${handoffComplete ? '#86efac' : ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 14, padding: 12, background: handoffComplete ? '#f0fdf4' : ORDER_DETAIL_THEME.cardBg }}>
                        <div style={{ color: handoffComplete ? '#047857' : ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 950 }}>
                          Paso final: entrega física a la transportadora
                        </div>
                        {pickupFailed ? (
                          <div style={{ marginTop: 8, borderRadius: 10, padding: 9, background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 800, lineHeight: 1.5 }}>
                            La guía existe, pero falta la confirmación de la recolección que debía programarse al generarla. Cancela esta guía desde “Gestionar guía” y crea otra antes de preparar los productos.
                          </div>
                        ) : pickupScheduled ? (
                          <div style={{ marginTop: 7, color: '#047857', fontSize: 10, fontWeight: 800, lineHeight: 1.5 }}>
                            Recolección confirmada <strong>{pickup.confirmation}</strong> para el {pickup.requestedDate}{pickup.timeFrom && pickup.timeTo ? `, entre ${pickup.timeFrom} y ${pickup.timeTo}` : ''}. Ten el paquete cerrado y etiquetado antes de esa fecha.
                          </div>
                        ) : handoffMode === 'dropoff' ? (
                          <div style={{ marginTop: 7, color: '#047857', fontSize: 10, fontWeight: 800, lineHeight: 1.5 }}>
                            Entrega en punto seleccionada. Imprime la etiqueta, prepara el paquete y llévalo a un punto autorizado de la transportadora.
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 9, marginTop: 9 }}>
                            {dropoffAvailable ? (
                              <div style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 12, padding: 10 }}>
                                <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 950 }}>Llevar a un punto autorizado</div>
                                <p style={{ margin: '4px 0 8px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
                                  No genera una solicitud adicional. Lleva el paquete etiquetado y conserva el comprobante.
                                </p>
                                <button type="button" onClick={() => runProviderAction(shipment, 'dropoff')} disabled={isBusy} style={secondaryButtonStyle()}>
                                  Elegir entrega en punto
                                </button>
                              </div>
                            ) : null}
                            {(standalonePickup || pickupMandatory) ? (
                              <div style={{ border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 12, padding: 10 }}>
                              <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 10, fontWeight: 950 }}>Opción B · Solicitar recolección</div>
                              <p style={{ margin: '4px 0 8px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
                                Envia consulta si la transportadora admite recolección. En producción puede tener un costo adicional.
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                                {planField('Fecha', <input type="date" aria-label={`Fecha de recolección ${shipment.code}`} value={form.pickupDate} onChange={(event) => updateForm(shipmentId, { pickupDate: event.target.value })} style={inputStyle()} />)}
                                {planField('Desde', <input type="time" aria-label={`Inicio de recolección ${shipment.code}`} value={form.pickupTimeStart} onChange={(event) => updateForm(shipmentId, { pickupTimeStart: event.target.value })} style={inputStyle()} />)}
                                {planField('Hasta', <input type="time" aria-label={`Fin de recolección ${shipment.code}`} value={form.pickupTimeEnd} onChange={(event) => updateForm(shipmentId, { pickupTimeEnd: event.target.value })} style={inputStyle()} />)}
                              </div>
                              <input aria-label={`Instrucciones de recolección ${shipment.code}`} value={form.pickupInstructions} onChange={(event) => updateForm(shipmentId, { pickupInstructions: event.target.value })} placeholder="Instrucciones internas (opcional)" style={{ ...inputStyle(), width: '100%', marginTop: 6 }} />
                              <button type="button" onClick={() => runProviderAction(shipment, 'pickup')} disabled={isBusy} style={{ ...primaryButtonStyle(), marginTop: 8 }}>
                                {isProductionGuide ? 'Solicitar recolección real' : 'Solicitar recolección Sandbox'}
                              </button>
                              </div>
                            ) : null}
                            {!dropoffAvailable && !standalonePickup && !pickupMandatory ? (
                              <div style={{ borderRadius: 12, padding: 10, background: '#fff7ed', color: '#9a3412', fontSize: 10, fontWeight: 800 }}>
                                Esta guía requería programar la recolección al generarla. Cancélala y crea una nueva indicando la fecha.
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {canManage && hasActiveLabel && providerConfigured && !isProductionGuide && webhookRegistered && shipment.carrier?.trackingNumber ? (
                      <details style={{ marginTop: 10, border: '1px dashed #a5b4fc', borderRadius: 13, padding: '9px 10px', background: '#f8faff' }}>
                        <summary style={{ cursor: 'pointer', color: '#4338ca', fontSize: 10, fontWeight: 950 }}>
                          Pruebas Sandbox · solo para verificar la integración
                        </summary>
                        <div style={{ marginTop: 9 }}>
                          <div style={{ color: '#4338ca', fontSize: 9, fontWeight: 780, lineHeight: 1.5 }}>
                            Esto no forma parte del trabajo diario. Imita un aviso de la transportadora para comprobar que la tienda lo recibe automáticamente.
                          </div>
                          <div className="order-logistics-sandbox-grid" style={{ gap: 7, marginTop: 9 }}>
                            <label style={{ display: 'grid', gap: 5 }}>
                              <span style={{ color: '#4338ca', fontSize: 9, fontWeight: 900 }}>Estado que deseas imitar</span>
                              <select aria-label={`Estado de webhook de prueba ${shipment.code}`} value={form.testStatus} onChange={(event) => updateForm(shipmentId, { testStatus: event.target.value })} style={inputStyle()}>
                                <option value="Picked Up">Paquete recolectado</option>
                                <option value="Shipped">Paquete en tránsito</option>
                                <option value="Delivered">Paquete entregado</option>
                                <option value="Canceled">Envío cancelado</option>
                              </select>
                            </label>
                            <button type="button" onClick={() => runProviderAction(shipment, 'webhook_test')} disabled={isBusy} style={{ ...secondaryButtonStyle(), alignSelf: 'end' }}>
                              Enviar aviso de prueba
                            </button>
                          </div>
                        </div>
                      </details>
                    ) : null}

                    {canManage && hasActiveLabel && providerConfigured ? (
                      <details style={{ marginTop: 9 }}>
                        <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.mutedText, fontSize: 10, fontWeight: 900 }}>
                          Gestionar guía o resolver un problema
                        </summary>
                        <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700, lineHeight: 1.45 }}>
                          Usa estas opciones solo si el seguimiento no cambia o si necesitas anular la guía.
                        </p>
                        <div style={{ display: 'flex', gap: 7, marginTop: 7, flexWrap: 'wrap' }}>
                          {shipment.carrier?.trackingNumber ? (
                            <button type="button" onClick={() => runProviderAction(shipment, 'track')} disabled={isBusy} style={secondaryButtonStyle()}>
                              Consultar estado ahora
                            </button>
                          ) : null}
                          <button type="button" onClick={() => runProviderAction(shipment, 'cancel')} disabled={isBusy} style={dangerButtonStyle()}>
                            Cancelar esta guía
                          </button>
                        </div>
                      </details>
                    ) : null}

                    {pickupConfirmation === shipmentId ? (
                      <div role="alertdialog" aria-label={`Confirmar recolección de producción ${shipment.code}`} style={{ marginTop: 10, border: '1px solid #fdba74', borderRadius: 14, padding: 12, background: '#fff7ed' }}>
                        <div style={{ color: '#9a3412', fontSize: 11, fontWeight: 950 }}>
                          La recolección puede generar un cobro real
                        </div>
                        <p style={{ margin: '5px 0 0', color: '#9a3412', fontSize: 10, fontWeight: 700, lineHeight: 1.45 }}>
                          Se solicitará a Envia una recolección para el {form.pickupDate}, de {form.pickupTimeStart} a {form.pickupTimeEnd}. Confirma que el paquete estará listo.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 9 }}>
                          <button type="button" onClick={() => setPickupConfirmation('')} style={secondaryButtonStyle()}>Volver</button>
                          <button type="button" onClick={() => runProviderAction(shipment, 'pickup', { productionConfirmed: true })} disabled={isBusy} style={primaryButtonStyle()}>Sí, solicitar recolección</button>
                        </div>
                      </div>
                    ) : null}

                    {labelConfirmation === shipmentId ? (
                      <div role="alertdialog" aria-label={`Confirmar guía de producción ${shipment.code}`} style={{ marginTop: 10, border: '1px solid #fdba74', borderRadius: 14, padding: 12, background: '#fff7ed' }}>
                        <div style={{ color: '#9a3412', fontSize: 11, fontWeight: 950 }}>
                          Esta acción puede generar cobros reales
                        </div>
                        <p style={{ margin: '5px 0 0', color: '#9a3412', fontSize: 10, fontWeight: 700, lineHeight: 1.45 }}>
                          Envia creará una guía de producción y descontará de tu saldo la tarifa seleccionada.{pickupOnGenerate ? ` También solicitará la recolección para el ${form.pickupDate}.` : ''} Confirma solo cuando el paquete y los datos del destinatario estén listos.
                        </p>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
                          <button type="button" onClick={() => setLabelConfirmation('')} style={secondaryButtonStyle()}>
                            Volver
                          </button>
                          <button type="button" onClick={() => runProviderAction(shipment, 'label', { productionConfirmed: true })} disabled={isBusy} style={primaryButtonStyle()}>
                            Sí, generar guía real
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {status === 'packed' ? (
                    <input aria-label={`Referencia de despacho ${shipment.code}`} value={form.dispatchReference} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { dispatchReference: event.target.value })} placeholder="Referencia de entrega al transportador (obligatoria)" style={{ ...inputStyle(), order: 7, width: '100%', marginTop: 10 }} />
                  ) : null}
                  {status === 'in_transit' && !automaticTrackingEnabled ? (
                    <div style={{ order: 7, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                      <input aria-label={`Evidencia de entrega ${shipment.code}`} value={form.deliveryReference} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { deliveryReference: event.target.value })} placeholder="Referencia de evidencia (obligatoria)" style={inputStyle()} />
                      <input aria-label={`Recibe ${shipment.code}`} value={form.recipient} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { recipient: event.target.value })} placeholder="Nombre de quien recibe" style={inputStyle()} />
                    </div>
                  ) : null}

                  <div style={{ order: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {status === 'exception' ? (
                      <div style={{ flex: '1 1 420px', borderRadius: 14, background: '#fff1f2', padding: 10 }}>
                        <div style={{ color: '#9f1239', fontSize: 11, fontWeight: 900 }}>{openIncident?.type || 'Incidencia'} · {openIncident?.severity || 'medium'}</div>
                        <div style={{ marginTop: 4, color: '#881337', fontSize: 11 }}>{openIncident?.description}</div>
                        {canManage ? (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <input aria-label={`Resolución ${shipment.code}`} value={form.resolution} onChange={(event) => updateForm(shipmentId, { resolution: event.target.value })} placeholder="Resolución aplicada" style={{ ...inputStyle(), flex: 1 }} />
                            <button type="button" onClick={() => runAction(shipment, 'resolve_incident')} disabled={isBusy} style={secondaryButtonStyle()}>Resolver incidencia</button>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <details>
                        <summary style={{ cursor: 'pointer', color: '#be123c', fontSize: 10, fontWeight: 900 }}>Reportar incidencia</summary>
                        {canManage ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '140px 120px minmax(220px, 1fr) auto', gap: 6, marginTop: 8 }}>
                            <select aria-label={`Tipo de incidencia ${shipment.code}`} value={form.incidentType} onChange={(event) => updateForm(shipmentId, { incidentType: event.target.value })} style={inputStyle()}>
                              <option value="delay">Retraso</option><option value="stock_mismatch">Diferencia de inventario</option><option value="damage">Daño</option><option value="address">Dirección</option><option value="carrier">Transportadora</option><option value="customer_unavailable">Cliente ausente</option><option value="other">Otra</option>
                            </select>
                            <select aria-label={`Severidad ${shipment.code}`} value={form.severity} onChange={(event) => updateForm(shipmentId, { severity: event.target.value })} style={inputStyle()}>
                              <option value="low">Baja</option><option value="medium">Media</option><option value="high">Alta</option><option value="critical">Crítica</option>
                            </select>
                            <input aria-label={`Descripción de incidencia ${shipment.code}`} value={form.incidentDescription} onChange={(event) => updateForm(shipmentId, { incidentDescription: event.target.value })} placeholder="Describe lo ocurrido" style={inputStyle()} />
                            <button type="button" onClick={() => runAction(shipment, 'report_incident')} disabled={isBusy} style={dangerButtonStyle()}>Abrir incidencia</button>
                          </div>
                        ) : null}
                      </details>
                    )}
                    {automaticTrackingEnabled && status === 'delivered' ? (
                      <div role="status" style={{ marginLeft: 'auto', borderRadius: 12, padding: '9px 11px', background: '#ecfdf5', color: '#047857', fontSize: 10, fontWeight: 900 }}>
                        Entrega confirmada automáticamente
                      </div>
                    ) : automaticTrackingEnabled && nextRequiresCarrierUpdate ? (
                      <div role="status" style={{ marginLeft: 'auto', borderRadius: 12, padding: '9px 11px', background: '#eef2ff', color: '#4338ca', fontSize: 10, fontWeight: 900 }}>
                        Esperando actualización automática de Envia
                      </div>
                    ) : canManage && next && !waitingForAutomaticHandoff ? (
                      <button type="button" onClick={() => runAction(shipment, next[0])} disabled={isBusy} style={primaryButtonStyle()}>
                        {isBusy ? 'Actualizando…' : next[1]}
                      </button>
                    ) : null}
                  </div>
                </article>
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

function inputStyle() {
  return {
    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
    borderRadius: 10,
    minHeight: 38,
    padding: '0 10px',
    background: ORDER_DETAIL_THEME.cardBg,
    color: ORDER_DETAIL_THEME.cardText,
    fontSize: 11,
    fontWeight: 700,
  };
}

function primaryButtonStyle() {
  return { border: 0, borderRadius: 12, minHeight: 38, padding: '0 14px', background: 'var(--admin-primary)', color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer' };
}

function secondaryButtonStyle() {
  return { border: '1px solid var(--admin-primary)', borderRadius: 12, minHeight: 36, padding: '0 12px', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)', fontSize: 10, fontWeight: 900, cursor: 'pointer' };
}

function dangerButtonStyle() {
  return { border: '1px solid #fecdd3', borderRadius: 10, minHeight: 38, padding: '0 12px', background: '#fff1f2', color: '#be123c', fontSize: 10, fontWeight: 900, cursor: 'pointer' };
}
