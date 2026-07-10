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

  if (overlay.parentElement !== document.body) {
    document.body.appendChild(overlay);
  }

  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.right = '0';
  overlay.style.bottom = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '18px';
  overlay.style.overflow = 'hidden';
  overlay.style.transform = 'none';

  const modal = overlay.querySelector('section');
  if (!modal) return;

  modal.style.margin = '0';
  modal.style.position = 'relative';
  modal.style.top = 'auto';
  modal.style.left = 'auto';
  modal.style.transform = 'none';
  modal.style.width = 'min(1160px, calc(100vw - 36px))';
  modal.style.height = 'min(760px, calc(100vh - 36px))';
  modal.style.maxHeight = 'calc(100vh - 36px)';
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
