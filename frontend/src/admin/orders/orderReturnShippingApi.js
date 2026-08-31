import api from '../../lib/api';

const PATHS = Object.freeze({
  quote: 'rates',
  label: 'label',
  track: 'tracking/sync',
  test_webhook: 'webhook/test',
  pickup: 'pickup',
  dropoff: 'handoff/dropoff',
  cancel_label: 'label/cancel',
});

export async function runOrderReturnShippingOperation(
  orderId,
  returnId,
  action,
  payload,
  idempotencyKey = ''
) {
  const path = PATHS[action];
  if (!path) throw new Error('RETURN_SHIPPING_ACTION_INVALID');
  const config = idempotencyKey
    ? { headers: { 'Idempotency-Key': idempotencyKey } }
    : undefined;
  const { data } = await api.post(
    `/api/orders/${orderId}/returns/${returnId}/shipping/${path}`,
    payload,
    config
  );
  return data;
}
