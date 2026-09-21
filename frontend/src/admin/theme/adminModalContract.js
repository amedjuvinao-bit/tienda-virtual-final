const MODAL_OVERLAY_ATTRIBUTE = 'data-admin-modal-overlay';
const MODAL_SURFACE_ATTRIBUTE = 'data-admin-modal-surface';

function isElement(value) {
  return typeof HTMLElement !== 'undefined' && value instanceof HTMLElement;
}

function isViewportOverlay(element) {
  if (!isElement(element)) return false;

  const style = window.getComputedStyle(element);
  const className = typeof element.className === 'string' ? element.className : '';
  const hasFixedUtility = /(?:^|\s)fixed(?:\s|$)/.test(className);
  if (style.position !== 'fixed' && !hasFixedUtility) return false;

  const hasInsetUtility = /(?:^|\s)inset-0(?:\s|$)/.test(className);
  const hasInlineInset = ['0', '0px'].includes(element.style.inset);

  const hasFullInset =
    style.top === '0px' &&
    style.right === '0px' &&
    style.bottom === '0px' &&
    style.left === '0px';

  if (hasFullInset || hasInsetUtility || hasInlineInset) return true;

  const rect = element.getBoundingClientRect();
  return rect.width >= window.innerWidth * 0.8 && rect.height >= window.innerHeight * 0.8;
}

function findOverlay(dialog) {
  let current = dialog;

  while (isElement(current) && current !== document.body) {
    if (isViewportOverlay(current)) return current;
    current = current.parentElement;
  }

  return null;
}

function findSurface(dialog, overlay) {
  if (dialog !== overlay) return dialog;

  const candidates = Array.from(overlay.children).filter((child) => {
    if (!isElement(child) || child.tagName === 'BUTTON') return false;

    const style = window.getComputedStyle(child);
    const className = typeof child.className === 'string' ? child.className : '';
    const isBackdrop =
      style.position === 'absolute' ||
      /(?:backdrop|overlay)/i.test(className);

    return !isBackdrop && style.display !== 'none';
  });

  return candidates.at(-1) || null;
}

export function refreshAdminModalContract() {
  const modalCandidates = new Set([
    ...document.querySelectorAll('[role="dialog"][aria-modal="true"]'),
    ...document.querySelectorAll('.fixed.inset-0'),
    ...document.querySelectorAll('[class*="modal-overlay"], [class*="modal-backdrop"]'),
  ]);

  modalCandidates.forEach((candidate) => {
    const semanticDialog = candidate.matches('[role="dialog"][aria-modal="true"]')
      ? candidate
      : candidate.querySelector('[role="dialog"][aria-modal="true"]');
    const overlay = semanticDialog
      ? findOverlay(semanticDialog)
      : isViewportOverlay(candidate)
        ? candidate
        : null;

    if (!overlay) return;

    const surface = semanticDialog && semanticDialog !== overlay
      ? semanticDialog
      : findSurface(overlay, overlay);
    overlay.setAttribute(MODAL_OVERLAY_ATTRIBUTE, 'true');
    surface?.setAttribute(MODAL_SURFACE_ATTRIBUTE, 'true');
  });
}

export function installAdminModalContract() {
  const root = document.documentElement;
  root.dataset.adminRouteActive = 'true';
  refreshAdminModalContract();

  const observer = new MutationObserver(() => refreshAdminModalContract());
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    observer.disconnect();
    delete root.dataset.adminRouteActive;
    document.querySelectorAll(`[${MODAL_OVERLAY_ATTRIBUTE}]`).forEach((element) => {
      element.removeAttribute(MODAL_OVERLAY_ATTRIBUTE);
    });
    document.querySelectorAll(`[${MODAL_SURFACE_ATTRIBUTE}]`).forEach((element) => {
      element.removeAttribute(MODAL_SURFACE_ATTRIBUTE);
    });
  };
}
