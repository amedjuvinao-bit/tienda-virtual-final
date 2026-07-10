// frontend/src/admin/customers/CustomerModalPortalFix.jsx

import { useEffect } from 'react';

function isCustomerModalOverlay(node) {
  if (!node || node.nodeType !== 1) return false;

  const classes = String(node.className || '');
  const text = String(node.textContent || '');

  return (
    classes.includes('fixed') &&
    classes.includes('inset-0') &&
    text.includes('Ficha comercial del cliente')
  );
}

function normalizeCustomerModal(overlay) {
  if (!overlay || !isCustomerModalOverlay(overlay)) return;

  // No mover este nodo al document.body: si se mueve, se rompen los eventos React.
  // Tampoco usar 100vw aquí: dentro del layout admin eso empuja el modal hacia la derecha
  // y lo recorta cuando el navegador está reducido o DevTools está abierto.
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.padding = '16px';
  overlay.style.overflow = 'hidden';
  overlay.style.transform = 'none';
  overlay.style.pointerEvents = 'auto';

  const modal = overlay.querySelector('section');
  if (!modal) return;

  modal.style.margin = '0 auto';
  modal.style.position = 'relative';
  modal.style.top = 'auto';
  modal.style.left = 'auto';
  modal.style.right = 'auto';
  modal.style.transform = 'none';
  modal.style.width = 'min(900px, calc(100% - 12px))';
  modal.style.height = 'min(720px, calc(100% - 12px))';
  modal.style.maxWidth = '900px';
  modal.style.maxHeight = 'calc(100% - 12px)';
  modal.style.overflow = 'hidden';
}

export default function CustomerModalPortalFix() {
  useEffect(() => {
    const run = () => {
      const overlays = Array.from(document.querySelectorAll('.fixed.inset-0'));
      overlays.forEach((overlay) => {
        if (isCustomerModalOverlay(overlay)) normalizeCustomerModal(overlay);
      });
    };

    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    run();
    const interval = window.setInterval(run, 300);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
