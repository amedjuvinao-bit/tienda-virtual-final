import api from '../../lib/api';

export async function getOrderLogistics(orderId) {
  const { data } = await api.get(
    `/api/orders/${orderId}/fulfillment/logistics`
  );
  return data;
}

export async function initializeOrderLogistics(orderId) {
  const { data } = await api.post(
    `/api/orders/${orderId}/fulfillment/logistics/initialize`
  );
  return data;
}

export async function getShippingProviderStatus() {
  const { data } = await api.get('/api/orders/admin/shipping/providers');
  return data;
}

export async function updateOrderShipment(
  orderId,
  shipmentId,
  payload
) {
  const { data } = await api.patch(
    `/api/orders/${orderId}/fulfillment/logistics/shipments/${shipmentId}`,
    payload
  );
  return data;
}

export async function quoteOrderShipment(orderId, shipmentId, payload) {
  const { data } = await api.post(
    `/api/orders/${orderId}/fulfillment/logistics/shipments/${shipmentId}/rates`,
    payload
  );
  return data;
}

export async function generateOrderShipmentLabel(
  orderId,
  shipmentId,
  payload,
  idempotencyKey
) {
  const { data } = await api.post(
    `/api/orders/${orderId}/fulfillment/logistics/shipments/${shipmentId}/label`,
    payload,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return data;
}

export async function syncOrderShipmentTracking(orderId, shipmentId, payload) {
  const { data } = await api.post(
    `/api/orders/${orderId}/fulfillment/logistics/shipments/${shipmentId}/tracking/sync`,
    payload
  );
  return data;
}

export async function cancelOrderShipmentLabel(
  orderId,
  shipmentId,
  payload,
  idempotencyKey
) {
  const { data } = await api.post(
    `/api/orders/${orderId}/fulfillment/logistics/shipments/${shipmentId}/label/cancel`,
    payload,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return data;
}
