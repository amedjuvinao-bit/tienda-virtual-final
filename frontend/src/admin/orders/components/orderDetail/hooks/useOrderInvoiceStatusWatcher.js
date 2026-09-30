import { useEffect } from 'react';

const ACTIVE_STATUSES = new Set(['pending', 'scheduling', 'failed']);
const PENDING_INTERVAL_MS = 5000;
const RETRY_INTERVAL_MS = 30000;

export default function useOrderInvoiceStatusWatcher({
  open,
  order,
  synchronizeAfterMutation,
  showToast,
}) {
  const orderId = String(order?._id || '');
  const status = String(order?.invoiceAutomation?.status || '').toLowerCase();
  const paid = String(order?.payment?.status || '').toLowerCase() === 'paid';
  const validated = ['accepted', 'validated'].includes(
    String(order?.electronicInvoice?.status || '').toLowerCase()
  ) || order?.electronicInvoice?.provider?.isValidated === true;

  useEffect(() => {
    if (!open || !orderId || !paid || validated || !ACTIVE_STATUSES.has(status)) {
      return undefined;
    }

    let active = true;
    let timer = null;
    let inFlight = false;
    const intervalFor = (value) => value === 'failed'
      ? RETRY_INTERVAL_MS
      : PENDING_INTERVAL_MS;

    const schedule = (delay) => {
      if (active) timer = window.setTimeout(poll, delay);
    };
    const poll = async () => {
      if (!active || inFlight) return;
      if (document.hidden) {
        schedule(RETRY_INTERVAL_MS);
        return;
      }
      inFlight = true;
      let nextStatus = status;
      try {
        const latest = await synchronizeAfterMutation?.(null, []);
        if (!active || String(latest?._id || '') !== orderId) return;
        nextStatus = String(latest?.invoiceAutomation?.status || '').toLowerCase();
        const invoice = latest?.electronicInvoice || {};
        if (['accepted', 'validated'].includes(String(invoice.status || '').toLowerCase()) ||
          invoice.provider?.isValidated === true) {
          nextStatus = 'accepted';
          showToast?.({
            type: 'success',
            title: 'Factura electrónica aceptada',
            message: 'El pago y la factura quedaron confirmados en la orden.',
          });
          return;
        }
        if (nextStatus === 'needs_review') {
          showToast?.({
            type: 'warning',
            title: 'Factura pendiente de corrección',
            message: latest.invoiceAutomation?.failureReason ||
              'Revisa el motivo en Facturación → Órdenes por facturar.',
          });
          return;
        }
      } catch {
        // El pago persiste; otra lectura volverá a consultar la factura.
      } finally {
        inFlight = false;
        if (active && ACTIVE_STATUSES.has(nextStatus)) {
          schedule(intervalFor(nextStatus));
        }
      }
    };

    schedule(intervalFor(status));
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, orderId, paid, showToast, status, synchronizeAfterMutation, validated]);
}
