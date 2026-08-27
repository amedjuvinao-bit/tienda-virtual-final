import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Header from '../components/Header';
import FooterSection from '../components/FooterSection';
import { API_BASE_URL } from '../config/apiBaseUrl';
import {
  buildOrderReturnAccessHeaders,
  getOrderReturnAccess,
  storeOrderReturnAccess,
} from '../utils/orderReturnAccess';
import { createRmaCreationIdempotency } from '../utils/rmaCreationIdempotency';

const REASONS = [
  ['wrong_size', 'Talla incorrecta'],
  ['wrong_item', 'Producto equivocado'],
  ['damaged', 'Llegó averiado'],
  ['defective', 'Defecto de fabricación'],
  ['not_as_described', 'No coincide con la descripción'],
  ['changed_mind', 'Cambio de decisión'],
  ['warranty', 'Garantía'],
  ['other', 'Otro motivo'],
];

const STATUS_LABELS = {
  requested: 'Solicitud recibida',
  authorized: 'Devolución autorizada',
  rejected: 'Solicitud rechazada',
  in_transit: 'Paquete en camino',
  received: 'Paquete recibido',
  resolution_required: 'Inspección completada',
  resolved: 'Caso resuelto',
  cancelled: 'Solicitud cancelada',
};

function quantity(value) {
  const number = Math.floor(Number(value));
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

function resolutionLabel(value) {
  if (value === 'exchange') return 'Cambio de producto';
  if (value === 'store_credit') return 'Saldo a favor';
  return 'Reembolso';
}

function ReturnCaseCard({ returnCase, access, orderId, onChanged, onError }) {
  const [busy, setBusy] = useState(false);
  const canCancel =
    returnCase.requestSource === 'customer' &&
    ['requested', 'authorized'].includes(returnCase.status);
  const canDownloadLabel = ['authorized', 'in_transit', 'received', 'resolution_required', 'resolved']
    .includes(returnCase.status);

  const cancel = async () => {
    if (!canCancel || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/returns/self-service/${returnCase._id}/cancel`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...buildOrderReturnAccessHeaders(access),
          },
          body: JSON.stringify({
            expectedRevision: returnCase.revision,
            reason: 'Cancelado por solicitud del cliente.',
          }),
        }
      );
      if (!response.ok) throw new Error('No fue posible cancelar la solicitud.');
      await onChanged?.();
    } catch (requestError) {
      onError?.(requestError.message || 'No fue posible cancelar la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  const labelUrl = `${API_BASE_URL}/api/orders/${orderId}/returns/self-service/${returnCase._id}/label`;
  const openLabel = async () => {
    const carrierLabelUrl = String(returnCase.shipping?.labelUrl || '').trim();
    if (/^https:\/\//i.test(carrierLabelUrl)) {
      window.open(carrierLabelUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(labelUrl, {
        headers: buildOrderReturnAccessHeaders(access),
      });
      if (!response.ok) throw new Error('La etiqueta todavía no está disponible.');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      onError?.(requestError.message || 'La etiqueta todavía no está disponible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="orp-case">
      <div className="orp-case-head">
        <div>
          <strong>{returnCase.returnNumber}</strong>
          <span>{resolutionLabel(returnCase.requestedResolution)} · {formatDate(returnCase.requestedAt)}</span>
        </div>
        <span className={`orp-status is-${returnCase.status}`}>
          {STATUS_LABELS[returnCase.status] || returnCase.status}
        </span>
      </div>
      <div className="orp-case-items">
        {(returnCase.items || []).map((item) => (
          <div key={String(item.orderItemId || item._id)}>
            <strong>{item.title}</strong>
            <span>{item.requestedQuantity} unidad(es) · {REASONS.find(([code]) => code === item.reasonCode)?.[1] || 'Otro motivo'}</span>
            {item.policyRuleName && item.policyRuleName !== 'Política general' ? (
              <span>Política aplicada: {item.policyRuleName} · {item.policyWindowDays || 30} días</span>
            ) : null}
          </div>
        ))}
      </div>
      {returnCase.shipping?.instructions ? (
        <p className="orp-note">{returnCase.shipping.instructions}</p>
      ) : null}
      {returnCase.resolution?.state === 'completed' ? (
        <p className="orp-result">
          Resolución: <strong>{resolutionLabel(returnCase.resolution.type)}</strong>
          {returnCase.resolution.storeCreditNumber
            ? ` · ${returnCase.resolution.storeCreditNumber}`
            : ''}
          {returnCase.resolution.replacementOrderNumber
            ? ` · orden #${returnCase.resolution.replacementOrderNumber}`
            : ''}
        </p>
      ) : null}
      <div className="orp-actions">
        {canDownloadLabel ? (
          <button type="button" className="orp-button secondary" disabled={busy} onClick={openLabel}>
            Descargar etiqueta RMA
          </button>
        ) : null}
        {canCancel ? (
          <button type="button" className="orp-button ghost" disabled={busy} onClick={cancel}>
            Cancelar solicitud
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default function OrderReturnsPage() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const stateAccess = location.state?.returnAccess || null;
  const [access, setAccess] = useState(() => stateAccess || getOrderReturnAccess(orderId));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resolution, setResolution] = useState('exchange');
  const [reasonSummary, setReasonSummary] = useState('');
  const [items, setItems] = useState({});
  const createAttemptRef = useRef(null);
  if (!createAttemptRef.current) {
    createAttemptRef.current = createRmaCreationIdempotency();
  }

  useEffect(() => {
    createAttemptRef.current.reset();
  }, [orderId]);

  useEffect(() => {
    if (!stateAccess) return;
    if (storeOrderReturnAccess(stateAccess)) setAccess(stateAccess);
  }, [stateAccess]);

  const load = async () => {
    const currentAccess = access || getOrderReturnAccess(orderId);
    if (!currentAccess) {
      setError('Este enlace no está disponible en este navegador. Abre la página desde el enlace seguro de tu compra.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/returns/self-service`,
        { headers: buildOrderReturnAccessHeaders(currentAccess) }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No fue posible consultar la orden.');
      setData(payload);
      setError('');
      const firstAllowed = payload.policy?.allowedResolutions?.[0];
      if (firstAllowed && !payload.policy.allowedResolutions.includes(resolution)) {
        setResolution(firstAllowed);
      }
    } catch (requestError) {
      setError(requestError.message || 'No fue posible consultar la orden.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [orderId, access]);

  const eligibleItems = useMemo(
    () => (data?.eligibility || []).filter((item) => item.eligible && item.availableQuantity > 0),
    [data]
  );

  const selectedItems = eligibleItems
    .map((item) => ({
      orderItemId: item.orderItemId,
      quantity: Math.min(item.availableQuantity, quantity(items[item.orderItemId]?.quantity)),
      reasonCode: items[item.orderItemId]?.reasonCode || 'other',
      reasonText: String(items[item.orderItemId]?.reasonText || '').trim(),
    }))
    .filter((item) => item.quantity > 0);
  const selectedEligibility = selectedItems.map((item) => (
    eligibleItems.find((entry) => entry.orderItemId === item.orderItemId)
  )).filter(Boolean);
  const selectedRequiresReview = selectedEligibility.some(
    (item) => item.policyManualReview === true
  );
  const globalResolutions = Array.isArray(data?.policy?.allowedResolutions)
    ? data.policy.allowedResolutions
    : [];
  const selectedResolutions = selectedEligibility.length
    ? globalResolutions.filter((option) => selectedEligibility.every(
        (item) => !Array.isArray(item.allowedResolutions) || item.allowedResolutions.includes(option)
      ))
    : globalResolutions;

  useEffect(() => {
    if (selectedResolutions.length && !selectedResolutions.includes(resolution)) {
      setResolution(selectedResolutions[0]);
    }
  }, [selectedResolutions.join('|'), resolution]);

  const setItem = (id, patch) => {
    setItems((current) => ({
      ...current,
      [id]: { ...(current[id] || {}), ...patch },
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!selectedItems.length || busy) return;
    if (
      selectedItems.some((item) => (
        selectedEligibility.find((entry) => entry.orderItemId === item.orderItemId)?.requireReasonText &&
        item.reasonText.length < 5
      ))
    ) {
      setError('Describe brevemente el motivo de cada producto seleccionado.');
      return;
    }
    try {
      setBusy(true);
      setError('');
      setSuccess('');
      const requestBody = {
        requestedResolution: resolution,
        reasonSummary: reasonSummary.trim(),
        items: selectedItems,
      };
      const requestDescriptor = {
        endpoint: 'customer-order-return-create',
        orderId,
        payload: requestBody,
      };
      const idempotencyKey = createAttemptRef.current.keyFor(
        requestDescriptor
      );
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/returns/self-service`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...buildOrderReturnAccessHeaders(access),
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(requestBody),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No fue posible crear la solicitud.');
      createAttemptRef.current.complete(requestDescriptor, idempotencyKey);
      setSuccess(`Solicitud ${payload.returnCase?.returnNumber || ''} creada correctamente.`);
      setItems({});
      setReasonSummary('');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'No fue posible crear la solicitud.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="orp-page">
      <style>{`
        .orp-page{min-height:100vh;background:var(--color-bg);color:var(--color-text);font-family:var(--font-base)}
        .orp-main{width:min(1080px,calc(100% - 28px));margin:0 auto;padding:34px 0 64px}
        .orp-hero,.orp-panel,.orp-case{border:1px solid color-mix(in srgb,var(--color-primary) 18%,transparent);background:color-mix(in srgb,var(--color-bg) 94%,var(--color-primary) 6%);border-radius:26px;box-shadow:0 18px 55px color-mix(in srgb,var(--color-primary) 12%,transparent)}
        .orp-hero{padding:26px}.orp-eyebrow{color:var(--color-accent);font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.orp-hero h1{margin:7px 0 4px;font-size:clamp(26px,5vw,44px)}
        .orp-hero p,.orp-muted{color:var(--color-secondary)}.orp-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(300px,.75fr);gap:18px;margin-top:18px}.orp-panel{padding:20px}.orp-panel h2{font-size:19px;margin:0 0 5px}
        .orp-policy{border-left:4px solid var(--color-accent);padding:11px 13px;margin:14px 0;background:color-mix(in srgb,var(--color-accent) 8%,var(--color-bg));border-radius:0 14px 14px 0;font-size:13px}.orp-line{display:grid;grid-template-columns:minmax(150px,1fr) 78px 180px;gap:9px;align-items:center;padding:12px 0;border-top:1px solid color-mix(in srgb,var(--color-primary) 14%,transparent)}
        .orp-line strong,.orp-line span{display:block}.orp-line span{font-size:12px;color:var(--color-secondary)}.orp-input{width:100%;min-width:0;border:1px solid color-mix(in srgb,var(--color-primary) 24%,transparent);background:var(--color-bg);color:var(--color-text);border-radius:13px;padding:10px 11px}.orp-detail{grid-column:1/-1}.orp-actions{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:13px}.orp-button{border:0;border-radius:13px;padding:11px 15px;font-weight:850;cursor:pointer}.orp-button:disabled{opacity:.5;cursor:not-allowed}.orp-button.primary{background:var(--color-primary);color:var(--color-bg)}.orp-button.secondary{background:var(--color-accent);color:var(--color-bg)}.orp-button.ghost{background:transparent;color:var(--color-text);border:1px solid color-mix(in srgb,var(--color-primary) 22%,transparent)}
        .orp-alert{border-radius:14px;padding:11px 13px;margin:12px 0;font-size:13px}.orp-alert.error{background:color-mix(in srgb,#dc2626 10%,var(--color-bg));color:#991b1b}.orp-alert.success{background:color-mix(in srgb,#16a34a 11%,var(--color-bg));color:#166534}.orp-cases{display:grid;gap:12px}.orp-case{padding:16px}.orp-case-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.orp-case-head strong,.orp-case-head span{display:block}.orp-case-head span{font-size:12px;color:var(--color-secondary);margin-top:3px}.orp-status{border:1px solid currentColor;border-radius:999px;padding:6px 9px!important;font-size:10px!important;font-weight:900;color:var(--color-accent)!important;white-space:nowrap}.orp-status.is-resolved{color:#15803d!important}.orp-status.is-rejected,.orp-status.is-cancelled{color:#b91c1c!important}.orp-case-items{display:grid;gap:6px;margin-top:12px}.orp-case-items>div{background:var(--color-bg);border-radius:12px;padding:9px 11px}.orp-case-items strong,.orp-case-items span{display:block;font-size:12px}.orp-case-items span{color:var(--color-secondary);margin-top:2px}.orp-note,.orp-result{font-size:12px;line-height:1.55;padding:10px 11px;border-radius:12px;background:color-mix(in srgb,var(--color-accent) 7%,var(--color-bg));margin:10px 0 0}.orp-empty{text-align:center;padding:24px;color:var(--color-secondary)}
        @media(max-width:780px){.orp-grid{grid-template-columns:1fr}.orp-line{grid-template-columns:1fr 80px}.orp-line select{grid-column:1/-1}.orp-case-head{flex-direction:column}.orp-status{white-space:normal}}
        @media(max-width:480px){.orp-main{width:min(100% - 18px,1080px);padding-top:18px}.orp-hero,.orp-panel,.orp-case{border-radius:20px}.orp-hero,.orp-panel{padding:16px}.orp-line{grid-template-columns:1fr}.orp-actions>*{width:100%}}
      `}</style>
      <Header />
      <main className="orp-main">
        <section className="orp-hero">
          <div className="orp-eyebrow">Centro de posventa</div>
          <h1>Cambios y devoluciones</h1>
          <p>Orden #{data?.order?.orderNumber || '—'} · consulta el avance o crea una solicitud sin repetir tus datos.</p>
        </section>

        {error ? <div role="alert" className="orp-alert error">{error}</div> : null}
        {success ? <div role="status" className="orp-alert success">{success}</div> : null}

        {loading ? <div className="orp-empty">Consultando tu orden…</div> : null}
        {!loading && data ? (
          <div className="orp-grid">
            <section className="orp-panel">
              <h2>Crear una solicitud</h2>
              <p className="orp-muted">Selecciona solo los productos que deseas devolver.</p>
              <div className="orp-policy">
                {data.policy?.policyText} Ventana: {data.policy?.windowDays} días desde la entrega.
              </div>
              {eligibleItems.length ? (
                <form onSubmit={submit}>
                  <label>
                    <span className="orp-muted">¿Cómo quieres resolverlo?</span>
                    <select className="orp-input" value={resolution} onChange={(event) => setResolution(event.target.value)}>
                      {selectedResolutions.map((option) => (
                        <option key={option} value={option}>{resolutionLabel(option)}</option>
                      ))}
                    </select>
                  </label>
                  {eligibleItems.map((item) => {
                    const draft = items[item.orderItemId] || {};
                    return (
                      <div className="orp-line" key={item.orderItemId}>
                        <div>
                          <strong>{item.title}</strong>
                          <span>Disponible {item.availableQuantity} · hasta {formatDate(item.eligibleUntil)}</span>
                          {item.policyRuleName && item.policyRuleName !== 'Política general' ? (
                            <span>Política: {item.policyRuleName} · {item.policyWindowDays || data.policy?.windowDays || 30} días{item.policyManualReview ? ' · requiere revisión' : ''}</span>
                          ) : null}
                        </div>
                        <input className="orp-input" aria-label={`Cantidad ${item.title}`} type="number" min="0" max={item.availableQuantity} value={draft.quantity || ''} onChange={(event) => setItem(item.orderItemId, { quantity: Math.min(item.availableQuantity, quantity(event.target.value)) })} />
                        <select className="orp-input" aria-label={`Motivo ${item.title}`} value={draft.reasonCode || 'other'} onChange={(event) => setItem(item.orderItemId, { reasonCode: event.target.value })}>
                          {REASONS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                        </select>
                        {quantity(draft.quantity) > 0 ? (
                          <input className="orp-input orp-detail" aria-label={`Detalle ${item.title}`} value={draft.reasonText || ''} onChange={(event) => setItem(item.orderItemId, { reasonText: event.target.value })} placeholder={item.requireReasonText ? 'Describe el motivo (obligatorio)' : 'Detalle adicional (opcional)'} />
                        ) : null}
                      </div>
                    );
                  })}
                  {selectedRequiresReview ? (
                    <div className="orp-policy">Tu solicitud será revisada por el equipo antes de autorizar la devolución.</div>
                  ) : null}
                  {selectedItems.length && !selectedResolutions.length ? (
                    <div role="alert" className="orp-alert error">Los productos seleccionados no comparten una solución disponible.</div>
                  ) : null}
                  <textarea className="orp-input" rows="3" value={reasonSummary} onChange={(event) => setReasonSummary(event.target.value)} placeholder="Comentario general (opcional)" />
                  <div className="orp-actions"><button className="orp-button primary" type="submit" disabled={!selectedItems.length || !selectedResolutions.length || busy}>{busy ? 'Enviando…' : 'Enviar solicitud'}</button></div>
                </form>
              ) : (
                <div className="orp-empty">Todavía no hay productos entregados disponibles para devolución.</div>
              )}
            </section>

            <section className="orp-panel">
              <h2>Mis solicitudes</h2>
              <p className="orp-muted">Aquí verás autorización, guía, recepción y solución final.</p>
              <div className="orp-cases">
                {(data.returns || []).length ? (data.returns || []).map((returnCase) => (
                  <ReturnCaseCard key={returnCase._id} returnCase={returnCase} access={access} orderId={orderId} onChanged={load} onError={setError} />
                )) : <div className="orp-empty">Aún no tienes solicitudes.</div>}
              </div>
            </section>
          </div>
        ) : null}
        <div className="orp-actions"><Link className="orp-button ghost" to="/">Volver a la tienda</Link></div>
      </main>
      <FooterSection />
    </div>
  );
}
