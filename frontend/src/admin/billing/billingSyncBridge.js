// frontend/src/admin/billing/billingSyncBridge.js
// Mejora progresiva para sincronizar documentos visibles de Facturación.
// No modifica tablas ni crea módulos paralelos.

import { syncBillingCreditNote, syncBillingDocument } from './api/adminBillingApi';

const BRIDGE_MARK = 'billingSyncBridgeReady';
const BTN_ATTR = 'data-billing-sync-visible';
const NOTICE_ATTR = 'data-billing-sync-notice';
const DOCUMENTS_PATH = '/admin/facturacion/documentos';
const CREDIT_NOTES_PATH = '/admin/facturacion/notas-credito';

let mountTimer = null;

function isBillingPath() {
  return window.location.pathname.startsWith('/admin/facturacion/');
}

function getMode() {
  const path = window.location.pathname;
  if (path.includes(CREDIT_NOTES_PATH) || path.includes('/notas-credito')) return 'credit-notes';
  if (path.includes(DOCUMENTS_PATH) || path.includes('/documentos')) return 'documents';
  return '';
}

function getRefreshButton() {
  return [...window.document.querySelectorAll('button')].find((button) =>
    /actualizar/i.test(button.textContent || '')
  );
}

function prepareControlContainer(container) {
  if (!container) return;

  container.setAttribute('data-billing-sync-root', 'true');
  container.style.flexWrap = 'wrap';
  container.style.maxWidth = '100%';
  container.style.minWidth = '0';
  container.style.alignItems = 'center';
}

function setNotice(text, tone = 'success') {
  const root = window.document.querySelector('[data-billing-sync-root]') || window.document.body;
  let notice = window.document.querySelector(`[${NOTICE_ATTR}]`);

  if (!notice) {
    notice = window.document.createElement('div');
    notice.setAttribute(NOTICE_ATTR, 'true');
    notice.style.marginTop = '0';
    notice.style.borderRadius = '18px';
    notice.style.border = '1px solid rgba(16, 185, 129, 0.36)';
    notice.style.padding = '8px 12px';
    notice.style.fontSize = '11px';
    notice.style.fontWeight = '900';
    notice.style.lineHeight = '1.25';
    notice.style.maxWidth = '240px';
    notice.style.minWidth = '0';
    notice.style.whiteSpace = 'normal';
    notice.style.wordBreak = 'normal';
    notice.style.overflowWrap = 'break-word';
    root.appendChild(notice);
  }

  const isError = tone === 'error';
  notice.textContent = text;
  notice.style.borderColor = isError ? 'rgba(244, 63, 94, 0.36)' : 'rgba(16, 185, 129, 0.36)';
  notice.style.background = isError ? 'rgba(244, 63, 94, 0.1)' : 'rgba(16, 185, 129, 0.1)';
  notice.style.color = isError ? '#be123c' : '#047857';
}

function getText(cell, selector = 'p') {
  return (cell?.querySelector(selector)?.textContent || '').trim();
}

function collectDocumentRows() {
  return [...window.document.querySelectorAll('table tbody tr')]
    .map((row) => {
      const cells = row.querySelectorAll('td');
      const invoiceNumber = getText(cells[0]);
      return invoiceNumber && invoiceNumber !== 'Sin número' ? invoiceNumber : '';
    })
    .filter(Boolean);
}

function collectCreditNoteRows() {
  return [...window.document.querySelectorAll('table tbody tr')]
    .map((row) => {
      const cells = row.querySelectorAll('td');
      const noteNumber = getText(cells[0]);
      const invoiceNumber = getText(cells[1]);
      if (!noteNumber || !invoiceNumber || noteNumber === 'Sin número' || invoiceNumber === 'Sin factura') return null;
      return { invoiceNumber, noteNumber };
    })
    .filter(Boolean);
}

async function syncVisibleDocuments(button) {
  const mode = getMode();
  const previousText = button.textContent;

  try {
    button.disabled = true;
    button.textContent = 'Sincronizando...';

    if (mode === 'documents') {
      const invoiceNumbers = collectDocumentRows();
      if (invoiceNumbers.length === 0) {
        setNotice('No hay documentos visibles para sincronizar.', 'error');
        return;
      }

      for (const invoiceNumber of invoiceNumbers) {
        await syncBillingDocument(invoiceNumber);
      }

      setNotice(`${invoiceNumbers.length} documento(s) sincronizado(s).`);
    }

    if (mode === 'credit-notes') {
      const notes = collectCreditNoteRows();
      if (notes.length === 0) {
        setNotice('No hay notas crédito visibles para sincronizar.', 'error');
        return;
      }

      for (const note of notes) {
        await syncBillingCreditNote(note.invoiceNumber, note.noteNumber);
      }

      setNotice(`${notes.length} nota(s) crédito sincronizada(s).`);
    }

    window.setTimeout(() => getRefreshButton()?.click(), 250);
  } catch (error) {
    setNotice(error?.response?.data?.message || error?.message || 'No se pudo sincronizar la facturación.', 'error');
  } finally {
    button.disabled = false;
    button.textContent = previousText;
  }
}

function createButton() {
  const button = window.document.createElement('button');
  button.type = 'button';
  button.setAttribute(BTN_ATTR, 'true');
  button.textContent = 'Sincronizar';
  button.title = 'Sincronizar estados visibles contra el proveedor disponible';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.gap = '8px';
  button.style.border = '1px solid var(--admin-card-border)';
  button.style.borderRadius = '16px';
  button.style.padding = '9px 12px';
  button.style.background = 'var(--admin-soft-bg)';
  button.style.color = 'var(--admin-card-text)';
  button.style.fontSize = '12px';
  button.style.fontWeight = '900';
  button.style.cursor = 'pointer';
  button.style.whiteSpace = 'nowrap';
  button.style.flexShrink = '0';
  button.addEventListener('click', () => syncVisibleDocuments(button));
  return button;
}

function mountBillingSyncButton() {
  const mode = getMode();
  if (!isBillingPath() || !['documents', 'credit-notes'].includes(mode)) return;

  const refreshButton = getRefreshButton();
  if (!refreshButton) return;

  const container = refreshButton.parentElement;
  if (!container || container.querySelector(`[${BTN_ATTR}]`)) return;

  prepareControlContainer(container);
  container.appendChild(createButton());
}

function scheduleMount() {
  if (mountTimer) window.clearTimeout(mountTimer);
  mountTimer = window.setTimeout(() => {
    mountTimer = null;
    mountBillingSyncButton();
  }, 120);
}

if (typeof window !== 'undefined' && !window[BRIDGE_MARK]) {
  window[BRIDGE_MARK] = true;
  scheduleMount();
  window.addEventListener('popstate', scheduleMount);

  const historyPushState = window.history.pushState;
  const historyReplaceState = window.history.replaceState;

  window.history.pushState = function patchedPushState(...args) {
    const result = historyPushState.apply(this, args);
    scheduleMount();
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = historyReplaceState.apply(this, args);
    scheduleMount();
    return result;
  };

  const observer = new MutationObserver(() => scheduleMount());
  observer.observe(window.document.body, { childList: true, subtree: true });
}
