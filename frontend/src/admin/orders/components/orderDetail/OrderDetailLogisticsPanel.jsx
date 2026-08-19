import { useEffect, useMemo, useState } from 'react';

import {
  cancelOrderShipmentLabel,
  generateOrderShipmentLabel,
  getOrderLogistics,
  getShippingProviderStatus,
  initializeOrderLogistics,
  quoteOrderShipment,
  syncOrderShipmentTracking,
  updateOrderShipment,
} from '../../orderLogisticsApi';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';

const STATUS_LABELS = {
  ready_to_pick: 'Lista para picking',
  picking: 'Picking en curso',
  picked: 'Picking completo',
  packing: 'Empaque en curso',
  packed: 'Empacada',
  dispatched: 'Despachada',
  in_transit: 'En tránsito',
  delivered: 'Entregada',
  exception: 'Con incidencia',
  cancelled: 'Cancelada',
};

const NEXT_ACTIONS = {
  ready_to_pick: ['start_picking', 'Iniciar picking'],
  picking: ['complete_picking', 'Completar picking'],
  picked: ['start_packing', 'Iniciar empaque'],
  packing: ['complete_packing', 'Sellar paquetes'],
  packed: ['dispatch', 'Confirmar despacho'],
  dispatched: ['mark_in_transit', 'Marcar en tránsito'],
  in_transit: ['deliver', 'Confirmar entrega'],
};

const STEPS = [
  ['ready_to_pick', 'Preparar'],
  ['picking', 'Picking'],
  ['packing', 'Empaque'],
  ['dispatched', 'Despacho'],
  ['in_transit', 'Tránsito'],
  ['delivered', 'Entrega'],
];

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
      setMessage({ type: 'success', text: 'Envíos creados desde las asignaciones confirmadas de inventario.' });
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

  const runProviderAction = async (shipment, action) => {
    if (!canManage || !providers?.envia?.configured) return;
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
        setRates((previous) => ({
          ...previous,
          [shipmentId]: Array.isArray(data?.rates) ? data.rates : [],
        }));
        applyResponse(data);
        setMessage({ type: 'success', text: `Se recibieron ${data?.rates?.length || 0} tarifa(s) de Envia.` });
      } else if (action === 'label') {
        if (!form.selectedRate) {
          setMessage({ type: 'error', text: 'Selecciona una tarifa antes de generar la guía.' });
          return;
        }
        data = await generateOrderShipmentLabel(
          order._id,
          shipmentId,
          {
            provider: 'envia',
            expectedRevision: Number(shipment.revision || 0),
            rate: form.selectedRate,
          },
          idempotencyKey(shipment, 'label', form.selectedRate)
        );
        applyResponse(data);
        setMessage({ type: 'success', text: `Guía de ${shipment.code} generada en ${providers.envia.mode}.` });
      } else if (action === 'track') {
        data = await syncOrderShipmentTracking(order._id, shipmentId, {
          provider: 'envia',
          expectedRevision: Number(shipment.revision || 0),
        });
        applyResponse(data);
        setMessage({ type: 'success', text: `Seguimiento de ${shipment.code} sincronizado.` });
      } else if (action === 'cancel') {
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
        setMessage({ type: 'success', text: `Cancelación de la guía ${shipment.code} registrada.` });
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
            Operación física multisede
          </div>
          <h3 style={{ margin: '5px 0 0', color: ORDER_DETAIL_THEME.cardText, fontSize: 18, fontWeight: 950 }}>
            Centro logístico
          </h3>
          <p style={{ margin: '5px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 12, fontWeight: 650 }}>
            Picking, empaque, despacho, seguimiento, SLA e incidencias con trazabilidad por sede.
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
              {busy === 'initialize' ? 'Preparando…' : 'Preparar logística'}
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
              return (
                <article
                  key={shipmentId}
                  style={{
                    border: `1px solid ${status === 'exception' ? '#fecdd3' : ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 20,
                    padding: 14,
                    background: status === 'exception' ? 'color-mix(in srgb, #fff1f2 70%, var(--admin-card-bg))' : 'var(--admin-card-bg)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
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

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 5, marginTop: 12 }}>
                    {STEPS.map(([step, label], index) => {
                      const active = status === 'exception' ? index <= (STATUS_POSITION[shipment.resumeStatus] ?? 0) : index <= position;
                      return (
                        <div key={step} style={{ borderRadius: 10, padding: '7px 4px', textAlign: 'center', background: active ? 'var(--admin-primary-soft-bg)' : 'var(--admin-bg)', color: active ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900 }}>
                          {label}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
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

                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: 'pointer', color: ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 900 }}>
                      Plan de transportadora, paquetes y SLA
                    </summary>
                    <div className="order-logistics-plan-grid" style={{ gap: 8, marginTop: 10 }}>
                      {planField('Prioridad', (
                        <select aria-label={`Prioridad ${shipment.code}`} value={form.priority} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { priority: event.target.value })} style={inputStyle()}>
                          <option value="normal">Normal</option>
                          <option value="high">Alta</option>
                          <option value="urgent">Urgente</option>
                        </select>
                      ))}
                      {planField('Transportadora', <input aria-label={`Transportadora ${shipment.code}`} value={form.carrierName} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { carrierName: event.target.value })} placeholder="Asignada al elegir tarifa" style={inputStyle()} />)}
                      {planField('Nivel de servicio', <input aria-label={`Servicio ${shipment.code}`} value={form.serviceLevel} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { serviceLevel: event.target.value })} placeholder="Asignado al elegir tarifa" style={inputStyle()} />)}
                      {planField('Número de guía', <input aria-label={`Guía ${shipment.code}`} value={form.trackingNumber} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { trackingNumber: event.target.value })} placeholder="Se genera después" style={inputStyle()} />)}
                      {planField('Límite para picking', <input type="datetime-local" aria-label={`SLA picking ${shipment.code}`} value={form.pickingDueAt} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { pickingDueAt: event.target.value })} style={inputStyle()} />)}
                      {planField('Límite para despacho', <input type="datetime-local" aria-label={`SLA despacho ${shipment.code}`} value={form.dispatchDueAt} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { dispatchDueAt: event.target.value })} style={inputStyle()} />)}
                      {planField('Promesa de entrega', <input type="datetime-local" aria-label={`SLA entrega ${shipment.code}`} value={form.deliveryDueAt} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { deliveryDueAt: event.target.value })} style={inputStyle()} />)}
                      {planField('Número de paquetes', <input type="number" min="1" max="20" aria-label={`Paquetes ${shipment.code}`} value={form.packageCount} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { packageCount: event.target.value })} style={inputStyle()} />)}
                      {planField('Peso por paquete (g)', <input type="number" min="0" aria-label={`Peso ${shipment.code}`} value={form.weightGrams} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { weightGrams: event.target.value })} style={inputStyle()} />)}
                      {planField('Largo (cm)', <input type="number" min="0" aria-label={`Largo ${shipment.code}`} value={form.lengthCm} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { lengthCm: event.target.value })} style={inputStyle()} />)}
                      {planField('Ancho (cm)', <input type="number" min="0" aria-label={`Ancho ${shipment.code}`} value={form.widthCm} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { widthCm: event.target.value })} style={inputStyle()} />)}
                      {planField('Alto (cm)', <input type="number" min="0" aria-label={`Alto ${shipment.code}`} value={form.heightCm} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { heightCm: event.target.value })} style={inputStyle()} />)}
                    </div>
                    <p style={{ margin: '7px 0 0', color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 700 }}>
                      El peso y las dimensiones indicadas se aplican a cada paquete. Son obligatorios para cotizar externamente.
                    </p>
                    {canManage ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button type="button" onClick={() => runAction(shipment, 'update_plan')} disabled={isBusy} style={secondaryButtonStyle()}>
                          Guardar plan logístico
                        </button>
                      </div>
                    ) : null}
                  </details>

                  <div style={{ marginTop: 10, border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`, borderRadius: 14, padding: 11, background: 'var(--admin-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ color: ORDER_DETAIL_THEME.cardText, fontSize: 11, fontWeight: 950 }}>
                          Transportadoras conectadas
                        </div>
                        <div style={{ marginTop: 3, color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 750 }}>
                          {providers?.defaultProvider === 'envia' ? 'Envia activo' : 'Manual activo'} · {providers?.envia?.message || 'Consultando estado de Envia…'}
                        </div>
                      </div>
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => runProviderAction(shipment, 'quote')}
                          disabled={isBusy || !providers?.envia?.configured}
                          title={providers?.envia?.message || 'Consultando configuración.'}
                          style={{
                            ...secondaryButtonStyle(),
                            cursor: providers?.envia?.configured ? 'pointer' : 'not-allowed',
                            opacity: providers?.envia?.configured ? 1 : 0.55,
                          }}
                        >
                          Cotizar con Envia
                        </button>
                      ) : null}
                    </div>

                    {(rates[shipmentId] || []).length > 0 ? (
                      <div style={{ display: 'grid', gap: 6, marginTop: 9 }}>
                        {(rates[shipmentId] || []).map((rate, index) => {
                          const selected = form.selectedRate === rate;
                          return (
                            <button
                              key={`${rate.carrier}-${rate.service}-${index}`}
                              type="button"
                              onClick={() => updateForm(shipmentId, { selectedRate: rate })}
                              style={{
                                border: `1px solid ${selected ? 'var(--admin-primary)' : ORDER_DETAIL_THEME.cardBorder}`,
                                borderRadius: 10,
                                padding: '8px 10px',
                                background: selected ? 'var(--admin-primary-soft-bg)' : ORDER_DETAIL_THEME.cardBg,
                                color: ORDER_DETAIL_THEME.cardText,
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: 8,
                                textAlign: 'left',
                                cursor: 'pointer',
                                fontSize: 10,
                                fontWeight: 850,
                              }}
                            >
                              <span>{rate.carrier} · {rate.serviceDescription || rate.service} · {rate.deliveryEstimate || 'Entrega por confirmar'}</span>
                              <span>{formatMoney(rate.totalPrice, rate.currency)}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {shipment.shippingIntegration?.labelUrl ? (
                      <div style={{ marginTop: 9, fontSize: 10, fontWeight: 800 }}>
                        <a href={shipment.shippingIntegration.labelUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--admin-primary)' }}>
                          Descargar etiqueta PDF
                        </a>
                        <span style={{ color: ORDER_DETAIL_THEME.mutedText }}> · {shipment.carrier?.trackingNumber || 'Guía generada'}</span>
                      </div>
                    ) : null}

                    {canManage && providers?.envia?.configured ? (
                      <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 9 }}>
                        {form.selectedRate && !shipment.shippingIntegration?.labelUrl ? (
                          <button type="button" onClick={() => runProviderAction(shipment, 'label')} disabled={isBusy} style={primaryButtonStyle()}>
                            Generar guía {providers.envia.mode === 'production' ? 'Producción' : 'Sandbox'}
                          </button>
                        ) : null}
                        {shipment.carrier?.trackingNumber ? (
                          <button type="button" onClick={() => runProviderAction(shipment, 'track')} disabled={isBusy} style={secondaryButtonStyle()}>
                            Sincronizar seguimiento
                          </button>
                        ) : null}
                        {shipment.shippingIntegration?.labelUrl && shipment.shippingIntegration?.status !== 'cancelled' ? (
                          <button type="button" onClick={() => runProviderAction(shipment, 'cancel')} disabled={isBusy} style={dangerButtonStyle()}>
                            Cancelar guía
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {status === 'packed' ? (
                    <input aria-label={`Referencia de despacho ${shipment.code}`} value={form.dispatchReference} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { dispatchReference: event.target.value })} placeholder="Referencia de entrega al transportador (obligatoria)" style={{ ...inputStyle(), width: '100%', marginTop: 10 }} />
                  ) : null}
                  {status === 'in_transit' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                      <input aria-label={`Evidencia de entrega ${shipment.code}`} value={form.deliveryReference} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { deliveryReference: event.target.value })} placeholder="Referencia de evidencia (obligatoria)" style={inputStyle()} />
                      <input aria-label={`Recibe ${shipment.code}`} value={form.recipient} disabled={!canManage} onChange={(event) => updateForm(shipmentId, { recipient: event.target.value })} placeholder="Nombre de quien recibe" style={inputStyle()} />
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
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
                    {canManage && next ? (
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
        <div role="status" style={{ marginTop: 12, borderRadius: 12, padding: '9px 11px', background: message.type === 'error' ? '#fff1f2' : '#ecfdf5', color: message.type === 'error' ? '#be123c' : '#047857', fontSize: 11, fontWeight: 800 }}>
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
        @media (max-width: 900px) {
          section[aria-label="Centro logístico de la orden"] > div:nth-of-type(2) { grid-template-columns: repeat(3, minmax(92px, 1fr)) !important; }
          .order-logistics-plan-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 620px) {
          .order-logistics-plan-grid { grid-template-columns: 1fr; }
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
