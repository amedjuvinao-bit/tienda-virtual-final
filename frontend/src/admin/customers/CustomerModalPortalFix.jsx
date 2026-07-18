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

function scrollModalAncestorsToTop(overlay) {
  if (!overlay || overlay.dataset.customerModalScrolled === 'true') return;

  overlay.dataset.customerModalScrolled = 'true';

  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch (_) {
    window.scrollTo(0, 0);
  }

  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  let node = overlay.parentElement;

  while (node && node !== document.body) {
    if (typeof node.scrollTop === 'number') node.scrollTop = 0;
    if (typeof node.scrollLeft === 'number') node.scrollLeft = 0;
    node = node.parentElement;
  }

  const scrollContainers = document.querySelectorAll(
    'main, [class*="overflow-y-auto"], [class*="overflow-auto"], [class*="overflow-y-scroll"], [class*="overflow-scroll"]'
  );

  scrollContainers.forEach((item) => {
    if (item === overlay || overlay.contains(item)) return;
    if (typeof item.scrollTop === 'number') item.scrollTop = 0;
    if (typeof item.scrollLeft === 'number') item.scrollLeft = 0;
  });
}

function normalizeCustomerModal(overlay) {
  if (!overlay || !isCustomerModalOverlay(overlay)) return;

  // No mover este nodo al document.body: si se mueve, se rompen los eventos React.
  // Cuando se abre desde el final de la tabla, el contenedor admin conserva su scroll
  // y deja el modal fuera de vista. Se corrige subiendo el scroll una sola vez al abrir.
  scrollModalAncestorsToTop(overlay);

  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'flex-start';
  overlay.style.justifyContent = 'center';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.padding = '24px 16px 16px';
  overlay.style.overflow = 'hidden';
  overlay.style.transform = 'none';
  overlay.style.pointerEvents = 'auto';

  const modal = overlay.querySelector('section');
  if (!modal) return;

  modal.style.margin = '0 auto';
  modal.style.position = 'relative';
  modal.style.top = '0';
  modal.style.left = 'auto';
  modal.style.right = 'auto';
  modal.style.transform = 'none';
  modal.style.width = 'min(940px, calc(100% - 12px))';
  modal.style.height = 'min(720px, calc(100vh - 64px))';
  modal.style.maxWidth = '940px';
  modal.style.maxHeight = 'calc(100vh - 64px)';
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
