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
