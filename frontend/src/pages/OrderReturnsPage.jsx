import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import useServicePage from '../components/service-pages/useServicePage';
import StorefrontLoadingScreen from '../components/StorefrontLoadingScreen';
import OrderReturnsView from './returns/OrderReturnsView';
import { quantity } from './returns/returnsModel';
import { API_BASE_URL } from '../config/apiBaseUrl';
import {
  buildOrderReturnAccessHeaders,
  getOrderReturnAccess,
  storeOrderReturnAccess,
} from '../utils/orderReturnAccess';
import { createRmaCreationIdempotency } from '../utils/rmaCreationIdempotency';


export default function OrderReturnsPage() {
  const appearance = useServicePage('returns-page');
  const { orderId = '' } = useParams();
  const location = useLocation();
  const offeredAccess = location.state?.returnAccess;
  const stateAccess = offeredAccess?.orderId === orderId && Object.keys(buildOrderReturnAccessHeaders(offeredAccess)).length ? offeredAccess : null;
  const access = useMemo(() => stateAccess || getOrderReturnAccess(orderId), [orderId, stateAccess]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resolution, setResolution] = useState('exchange');
  const [reasonSummary, setReasonSummary] = useState('');
  const [items, setItems] = useState({});
  const createAttemptRef = useRef(null);
  const loadRequest = useRef(null), mutationPending = useRef(false), mutationRequest = useRef(null);
  if (!createAttemptRef.current) {
    createAttemptRef.current = createRmaCreationIdempotency();
  }

  useEffect(() => {
    createAttemptRef.current.reset();
    setItems({}); setReasonSummary(''); setSuccess(''); setData(null);
    return () => mutationRequest.current?.abort();
  }, [orderId]);

  useEffect(() => {
    if (!stateAccess) return;
    storeOrderReturnAccess(stateAccess);
  }, [stateAccess]);

  const load = useCallback(async () => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    const currentAccess = access;
    if (!currentAccess) {
      setData(null);
      setError('Este enlace no está disponible en este navegador. Abre la página desde el enlace seguro de tu compra.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(
        `${API_BASE_URL}/api/orders/${orderId}/returns/self-service`,
        { headers: buildOrderReturnAccessHeaders(currentAccess), signal: controller.signal }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'No fue posible consultar la orden.');
      if (controller.signal.aborted) return;
      setData(payload);
      setError('');
      const firstAllowed = payload.policy?.allowedResolutions?.[0];
      if (firstAllowed) setResolution(current => payload.policy.allowedResolutions.includes(current) ? current : firstAllowed);
    } catch (requestError) {
      if (controller.signal.aborted) return;
      setError(requestError.message || 'No fue posible consultar la orden.');
      setData(null);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [orderId, access]);

  useEffect(() => {
    load();
    return () => loadRequest.current?.abort();
  }, [load]);

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
    if (!selectedItems.length || !selectedResolutions.includes(resolution) || busy || mutationPending.current) return;
    if (
      selectedItems.some((item) => (
        selectedEligibility.find((entry) => entry.orderItemId === item.orderItemId)?.requireReasonText &&
        item.reasonText.length < 5
      ))
    ) {
      setError('Describe brevemente el motivo de cada producto seleccionado.');
      return;
    }
    mutationPending.current = true;
    const mutation = new AbortController();
    mutationRequest.current = mutation;
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
          signal: mutation.signal,
          headers: {
            'Content-Type': 'application/json',
            ...buildOrderReturnAccessHeaders(access),
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(requestBody),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (mutation.signal.aborted) return;
      if (!response.ok) throw new Error(payload.message || 'No fue posible crear la solicitud.');
      createAttemptRef.current.complete(requestDescriptor, idempotencyKey);
      setSuccess(`Solicitud ${payload.returnCase?.returnNumber || ''} creada correctamente.`);
      setItems({});
      setReasonSummary('');
      await load();
    } catch (requestError) {
      if (!mutation.signal.aborted) setError(requestError.message || 'No fue posible crear la solicitud.');
    } finally {
      mutationPending.current = false;
      setBusy(false);
    }
  };

  if (appearance.loading) return <StorefrontLoadingScreen/>;
  return <OrderReturnsView {...appearance} page={appearance.page || { useHeader: false, useFooter: false }}
    configError={appearance.error} onRetryConfig={appearance.retry}
    data={data} loading={loading} busy={busy} error={error} success={success}
    resolution={resolution} setResolution={setResolution} items={items} setItem={setItem}
    reasonSummary={reasonSummary} setReasonSummary={setReasonSummary} eligibleItems={eligibleItems}
    selectedItems={selectedItems} selectedRequiresReview={selectedRequiresReview} selectedResolutions={selectedResolutions}
    submit={submit} load={load} access={access} orderId={orderId} setError={setError}/>;
}
