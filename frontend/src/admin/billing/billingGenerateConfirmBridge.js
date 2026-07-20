// frontend/src/admin/billing/billingGenerateConfirmBridge.js
// Confirmación visual para el botón Generar factura en el módulo unificado de Facturación.
// Usa el proveedor global AppConfirmProvider porque este intercepta window.confirm.

const BRIDGE_FLAG = '__rbBillingGenerateConfirmBridgeInstalled';
const ACCEPTED_ATTR = 'data-billing-generate-confirmed';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function isBillingOrdersPage() {
  return window.location.pathname === '/admin/facturacion/ordenes';
}

function isGenerateButton(button) {
  if (!button || button.disabled) return false;
  return normalizeText(button.textContent) === 'Generar';
}

function getOrderNumber(button) {
  const firstCell = button.closest('tr')?.querySelector('td');
  const value = normalizeText(firstCell?.querySelector('p')?.textContent || firstCell?.textContent || '');
  return value || 'esta orden';
}

function markAsAccepted(button) {
  button.setAttribute(ACCEPTED_ATTR, '1');
}

function consumeAccepted(button) {
  if (button.getAttribute(ACCEPTED_ATTR) !== '1') return false;
  button.removeAttribute(ACCEPTED_ATTR);
  return true;
}

function installBillingGenerateConfirmBridge() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window[BRIDGE_FLAG]) return;

  window[BRIDGE_FLAG] = true;

  document.addEventListener(
    'click',
    (event) => {
      if (!isBillingOrdersPage()) return;

      const button = event.target?.closest?.('button');
      if (!isGenerateButton(button)) return;

      if (consumeAccepted(button)) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();

      const orderNumber = getOrderNumber(button);
      const accepted = window.confirm(
        `¿Seguro que deseas generar factura para la orden ${orderNumber}?\n\nEsta acción creará un registro en ElectronicInvoice.`
      );

      if (!accepted) return;

      markAsAccepted(button);
      window.setTimeout(() => {
        button.click();
      }, 0);
    },
    true
  );
}

installBillingGenerateConfirmBridge();
