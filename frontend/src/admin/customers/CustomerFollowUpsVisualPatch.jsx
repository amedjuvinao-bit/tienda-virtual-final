// frontend/src/admin/customers/CustomerFollowUpsVisualPatch.jsx

import { useEffect } from 'react';
import {
  createAdminCustomerFollowUp,
  deleteAdminCustomerFollowUp,
  getAdminCustomerFollowUps,
  getAdminCustomers,
  updateAdminCustomerFollowUp,
} from '../api/adminCustomersApi';

const TYPE_OPTIONS = [
  ['note', 'Nota interna'],
  ['whatsapp', 'WhatsApp'],
  ['call', 'Llamada'],
  ['payment', 'Pago pendiente'],
  ['size_request', 'Solicitud de talla'],
  ['reminder', 'Recordatorio'],
  ['complaint', 'Reclamo'],
  ['task', 'Tarea'],
  ['other', 'Otro'],
];

const STATUS_OPTIONS = [
  ['pending', 'Pendiente'],
  ['done', 'Realizado'],
  ['cancelled', 'Cancelado'],
];

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function optionsHtml(options, selected) {
  return options
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
}

function findHeading(text) {
  const target = clean(text).toLowerCase();
  return Array.from(document.querySelectorAll('h3'))
    .find((item) => clean(item.textContent).toLowerCase() === target);
}

function findFollowUpPanel() {
  const heading = findHeading('seguimiento interno');
  if (!heading) return null;
  return heading.closest('.rounded-3xl') || heading.parentElement;
}

function findCustomerCode(modal) {
  const text = modal?.textContent || '';
  const match = text.match(/CLI-[A-Z0-9]+-[A-Z0-9]+/i);
  return match?.[0]?.toUpperCase() || '';
}

function isModalOverlay(node) {
  const classes = String(node?.className || '');
  return classes.includes('fixed') && classes.includes('inset-0');
}

function findModalShell(fromNode) {
  let node = fromNode;

  while (node && node !== document.body) {
    if (node.tagName === 'SECTION' && isModalOverlay(node.parentElement)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

function getCardFromHeading(text) {
  const heading = findHeading(text);
  if (!heading) return null;
  return heading.closest('.rounded-3xl, .overflow-hidden') || heading.parentElement;
}

function applyStableModalLayout(panel) {
  const shell = findModalShell(panel);
  if (!shell) return;

  const overlay = shell.parentElement;
  if (overlay) {
    overlay.style.alignItems = 'flex-start';
    overlay.style.justifyContent = 'center';
    overlay.style.overflowY = 'auto';
    overlay.style.padding = '24px 16px';
    overlay.style.background = 'rgba(15,23,42,.55)';
  }

  shell.style.width = 'min(1180px, calc(100vw - 36px))';
  shell.style.maxWidth = '1180px';
  shell.style.maxHeight = 'calc(100vh - 48px)';
  shell.style.height = 'auto';
  shell.style.display = 'flex';
  shell.style.flexDirection = 'column';
  shell.style.overflow = 'hidden';
  shell.style.borderRadius = '30px';
  shell.style.background = 'linear-gradient(145deg, #fff, #fff7fb)';
  shell.style.boxShadow = '0 28px 90px rgba(15,23,42,.26)';

  const header = shell.children?.[0];
  const body = shell.children?.[1];

  if (header) {
    header.style.flex = '0 0 auto';
    header.style.padding = '18px 24px';
    header.style.background = 'linear-gradient(135deg, rgba(255,255,255,.98), rgba(255,241,247,.88))';
  }

  if (body) {
    body.style.flex = '1 1 auto';
    body.style.overflowY = 'auto';
    body.style.maxHeight = 'calc(100vh - 178px)';
    body.style.padding = '18px 24px 22px';
  }

  const metricHeading = Array.from(shell.querySelectorAll('p'))
    .find((item) => clean(item.textContent).toLowerCase() === 'compras');
  const metricsGrid = metricHeading?.closest('.grid');
  if (metricsGrid) {
    metricsGrid.style.gap = '12px';
  }

  Array.from(metricsGrid?.children || []).forEach((card) => {
    card.style.padding = '14px 16px';
    card.style.borderRadius = '22px';
    card.style.minHeight = '108px';
  });

  const dataCard = getCardFromHeading('Datos del cliente');
  const followCard = getCardFromHeading('Seguimiento interno');
  const grid = dataCard?.parentElement;

  if (grid && followCard && grid.contains(followCard)) {
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'minmax(300px,.85fr) minmax(0,1.15fr)';
    grid.style.alignItems = 'start';
    grid.style.gap = '16px';
  }

  [dataCard, followCard].forEach((card) => {
    if (!card) return;
    card.style.padding = '18px';
    card.style.borderRadius = '24px';
    card.style.alignSelf = 'start';
    card.style.minHeight = 'auto';
  });

  const ordersCard = getCardFromHeading('Historial reciente de compras');
  if (ordersCard) {
    ordersCard.style.borderRadius = '24px';
    ordersCard.style.maxHeight = '260px';
    ordersCard.style.overflow = 'hidden';
  }

  const ordersList = ordersCard?.querySelector('.divide-y');
  if (ordersList) {
    ordersList.style.maxHeight = '200px';
    ordersList.style.overflowY = 'auto';
  }
}

function statusTone(status) {
  if (status === 'done') return { bg: '#ecfdf5', text: '#047857', border: '#bbf7d0' };
  if (status === 'cancelled') return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
  return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
}

async function resolveCustomerByCode(customerCode) {
  const data = await getAdminCustomers({ q: customerCode, status: 'active', source: 'all', segment: 'all', page: 1, limit: 10 });
  const rows = Array.isArray(data?.customers) ? data.customers : [];
  return rows.find((customer) => clean(customer.customerCode).toUpperCase() === customerCode) || rows[0] || null;
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="mt-3 rounded-2xl border p-4 text-xs font-bold" style="border-color: rgba(236,72,153,.16); background: #fff; color: var(--admin-card-muted-text);">
      Cargando seguimiento comercial...
    </div>
  `;
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs font-bold text-red-700">
      ${escapeHtml(message || 'No fue posible cargar el seguimiento del cliente.')}
    </div>
  `;
}

function renderHistory(rows) {
  if (!rows.length) {
    return `
      <div class="rounded-2xl border p-4 text-xs font-bold" style="border-color: rgba(236,72,153,.14); background: #fff; color: var(--admin-card-muted-text);">
        Sin gestiones registradas.
      </div>
    `;
  }

  return rows.map((item) => {
    const tone = statusTone(item.status);
    return `
      <article class="rounded-2xl border px-4 py-3" style="border-color: rgba(236,72,153,.14); background: #fff;">
        <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap gap-2">
              <span class="rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase" style="border-color: #f9a8d4; background: #fdf2f8; color: #be185d;">${escapeHtml(item.typeLabel || item.type || 'Nota')}</span>
              <span class="rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase" style="border-color: ${tone.border}; background: ${tone.bg}; color: ${tone.text};">${escapeHtml(item.statusLabel || item.status || 'Pendiente')}</span>
            </div>
            <p class="mt-2 text-xs font-black leading-relaxed" style="color: var(--admin-card-text);">${escapeHtml(item.note)}</p>
            ${item.nextAction ? `<p class="mt-1 text-[11px] font-bold" style="color: var(--admin-card-muted-text);">Próxima acción: ${escapeHtml(item.nextAction)}</p>` : ''}
            <p class="mt-1 text-[10px] font-bold" style="color: var(--admin-card-muted-text);">${escapeHtml(formatDate(item.createdAt))}${item.dueAt ? ` · Programado: ${escapeHtml(formatDate(item.dueAt))}` : ''}</p>
          </div>
          <div class="flex shrink-0 flex-wrap gap-2">
            ${item.status !== 'done' ? `<button type="button" data-followup-done="${escapeHtml(item.id)}" class="rounded-xl border px-3 py-2 text-[10px] font-black" style="border-color: #bbf7d0; background: #ecfdf5; color: #047857;">Realizado</button>` : ''}
            <button type="button" data-followup-delete="${escapeHtml(item.id)}" class="rounded-xl border px-3 py-2 text-[10px] font-black" style="border-color: #fecaca; background: #fef2f2; color: #b91c1c;">Eliminar</button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderFollowUps(container, customer, followUps, feedback = '') {
  const rows = Array.isArray(followUps) ? followUps : [];
  const pending = rows.filter((item) => item.status !== 'done' && item.status !== 'cancelled').length;
  const last = rows[0] || null;

  container.innerHTML = `
    <div class="mt-4 border-t pt-4" style="border-color: rgba(236,72,153,.14);">
      <section class="rounded-[22px] border p-4" style="border-color: rgba(236,72,153,.16); background: linear-gradient(145deg, rgba(255,255,255,.96), rgba(255,247,251,.88));">
        <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p class="text-[11px] font-black uppercase tracking-[.16em]" style="color: var(--admin-card-muted-text);">Gestión comercial</p>
            <h4 class="mt-1 text-sm font-black" style="color: var(--admin-card-text);">Seguimiento del cliente</h4>
            <p class="mt-1 text-[11px] font-bold" style="color: var(--admin-card-muted-text);">Notas, tareas, cobros y contactos.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <span class="rounded-2xl border px-3 py-2 text-[10px] font-black uppercase" style="border-color: #fed7aa; background: #fff7ed; color: #c2410c;">${pending} pendiente(s)</span>
            <span class="rounded-2xl border px-3 py-2 text-[10px] font-black uppercase" style="border-color: #fbcfe8; background: #fdf2f8; color: #be185d;">${rows.length} gestión(es)</span>
            <button type="button" data-followup-open-dialog="note" class="rounded-2xl px-4 py-2 text-xs font-black text-white" style="background: var(--admin-primary);">+ Nueva gestión</button>
          </div>
        </div>

        ${feedback ? `<div class="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-700">${escapeHtml(feedback)}</div>` : ''}

        <div class="mt-4 rounded-2xl border p-3" style="border-color: rgba(236,72,153,.14); background: #fff;">
          <p class="text-[10px] font-black uppercase tracking-[.16em]" style="color: var(--admin-card-muted-text);">Última gestión</p>
          ${last ? `
            <p class="mt-2 text-xs font-black leading-relaxed" style="color: var(--admin-card-text);">${escapeHtml(last.note)}</p>
            <p class="mt-1 text-[10px] font-bold" style="color: var(--admin-card-muted-text);">${escapeHtml(last.typeLabel || last.type)} · ${escapeHtml(last.statusLabel || last.status)} · ${escapeHtml(formatDate(last.createdAt))}</p>
          ` : `
            <p class="mt-2 text-xs font-black" style="color: var(--admin-card-text);">Sin gestión registrada</p>
          `}
        </div>

        <details class="mt-3 rounded-2xl border p-3" style="border-color: rgba(236,72,153,.14); background: rgba(255,255,255,.72);">
          <summary class="cursor-pointer text-[11px] font-black uppercase tracking-[.16em]" style="color: var(--admin-primary);">Ver historial</summary>
          <div class="mt-3 max-h-[210px] space-y-2 overflow-y-auto pr-1">
            ${renderHistory(rows)}
          </div>
        </details>
      </section>
    </div>
  `;

  container.dataset.customerId = customer.id;
  container.dataset.customerCode = customer.customerCode || '';
  container._followUps = rows;
  window.requestAnimationFrame(() => applyStableModalLayout(container));
}

function openFollowUpDialog(root, type = 'note') {
  document.querySelector('[data-followup-dialog="true"]')?.remove();

  const overlay = document.createElement('div');
  overlay.dataset.followupDialog = 'true';
  overlay.dataset.customerId = root.dataset.customerId || '';
  overlay.dataset.customerCode = root.dataset.customerCode || '';
  overlay.className = 'fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm';
  overlay.innerHTML = `
    <section class="w-full max-w-2xl overflow-hidden rounded-[30px] border" style="border-color: rgba(236,72,153,.28); background: linear-gradient(145deg,#fff,#fff7fb); box-shadow: 0 30px 90px rgba(15,23,42,.24);">
      <div class="flex items-start justify-between gap-4 border-b p-5" style="border-color: rgba(236,72,153,.18);">
        <div>
          <p class="text-xs font-black uppercase tracking-[.18em]" style="color: var(--admin-primary);">Nueva gestión comercial</p>
          <h3 class="mt-1 text-xl font-black" style="color: var(--admin-card-text);">Registrar seguimiento</h3>
          <p class="mt-1 text-sm font-bold" style="color: var(--admin-card-muted-text);">Guarda información útil para vender, cobrar o contactar.</p>
        </div>
        <button type="button" data-followup-close-dialog="true" class="rounded-2xl border px-4 py-3 text-xs font-black" style="border-color: rgba(236,72,153,.22); background:#fff; color: var(--admin-card-text);">Cerrar</button>
      </div>
      <form data-customer-followup-modal-form="true" class="space-y-4 p-5">
        <div class="grid gap-4 md:grid-cols-3">
          <label class="block"><span class="mb-2 block text-[11px] font-black uppercase tracking-[.14em]" style="color: var(--admin-card-muted-text);">Tipo</span><select name="type" class="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style="border-color: rgba(236,72,153,.28); background:#fff; color: var(--admin-card-text);">${optionsHtml(TYPE_OPTIONS, type)}</select></label>
          <label class="block"><span class="mb-2 block text-[11px] font-black uppercase tracking-[.14em]" style="color: var(--admin-card-muted-text);">Estado</span><select name="status" class="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style="border-color: rgba(236,72,153,.28); background:#fff; color: var(--admin-card-text);">${optionsHtml(STATUS_OPTIONS, 'pending')}</select></label>
          <label class="block"><span class="mb-2 block text-[11px] font-black uppercase tracking-[.14em]" style="color: var(--admin-card-muted-text);">Fecha</span><input type="datetime-local" name="dueAt" class="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style="border-color: rgba(236,72,153,.28); background:#fff; color: var(--admin-card-text);" /></label>
        </div>
        <label class="block"><span class="mb-2 block text-[11px] font-black uppercase tracking-[.14em]" style="color: var(--admin-card-muted-text);">Nota clara</span><textarea name="note" class="min-h-[110px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style="border-color: rgba(236,72,153,.28); background:#fff; color: var(--admin-card-text);" placeholder="Ej: Cliente pidió talla 6. Confirmar disponibilidad mañana por WhatsApp."></textarea></label>
        <label class="block"><span class="mb-2 block text-[11px] font-black uppercase tracking-[.14em]" style="color: var(--admin-card-muted-text);">Próxima acción</span><input name="nextAction" class="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style="border-color: rgba(236,72,153,.28); background:#fff; color: var(--admin-card-text);" placeholder="Ej: escribir por WhatsApp mañana" /></label>
        <div class="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <button type="button" data-followup-close-dialog="true" class="rounded-2xl border px-5 py-3 text-sm font-black" style="border-color: rgba(236,72,153,.22); background:#fff; color: var(--admin-card-text);">Cancelar</button>
          <button type="submit" class="rounded-2xl px-5 py-3 text-sm font-black text-white" style="background: var(--admin-primary);">Guardar gestión</button>
        </div>
      </form>
    </section>
  `;

  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.querySelector('textarea[name="note"]')?.focus(), 60);
}

async function mountFollowUps(container, customerCode) {
  renderLoading(container);
  const customer = await resolveCustomerByCode(customerCode);

  if (!customer?.id) {
    renderError(container, 'No fue posible identificar el cliente abierto para cargar el seguimiento.');
    return;
  }

  const response = await getAdminCustomerFollowUps(customer.id, { status: 'all', limit: 20 });
  renderFollowUps(container, customer, response?.followUps || []);
}

export default function CustomerFollowUpsVisualPatch() {
  useEffect(() => {
    let destroyed = false;

    const tryMount = async () => {
      if (destroyed) return;

      const panel = findFollowUpPanel();
      if (!panel) return;
      applyStableModalLayout(panel);

      const modalShell = findModalShell(panel);
      const customerCode = findCustomerCode(modalShell || panel);
      if (!customerCode) return;

      const current = panel.querySelector('[data-customer-followups-root="true"]');
      if (current?.dataset?.customerCode === customerCode) {
        applyStableModalLayout(panel);
        return;
      }
      if (current) current.remove();

      const container = document.createElement('div');
      container.dataset.customerFollowupsRoot = 'true';
      container.dataset.customerCode = customerCode;
      panel.appendChild(container);

      try {
        await mountFollowUps(container, customerCode);
      } catch (error) {
        renderError(container, error?.message || 'No fue posible cargar el seguimiento del cliente.');
      } finally {
        applyStableModalLayout(panel);
      }
    };

    const refreshRoot = async (root, feedback = '') => {
      const customerId = root?.dataset?.customerId;
      const customerCode = root?.dataset?.customerCode;
      if (!customerId) return;
      const response = await getAdminCustomerFollowUps(customerId, { status: 'all', limit: 20 });
      renderFollowUps(root, { id: customerId, customerCode }, response?.followUps || [], feedback);
    };

    const onSubmit = async (event) => {
      const form = event.target?.closest?.('[data-customer-followup-modal-form="true"]');
      if (!form) return;

      event.preventDefault();
      const dialog = form.closest('[data-followup-dialog="true"]');
      const customerId = dialog?.dataset?.customerId;
      const customerCode = dialog?.dataset?.customerCode;
      const root = document.querySelector(`[data-customer-followups-root="true"][data-customer-code="${customerCode}"]`);
      if (!customerId || !root) return;

      const payload = {
        type: form.elements.type?.value || 'note',
        status: form.elements.status?.value || 'pending',
        note: form.elements.note?.value || '',
        nextAction: form.elements.nextAction?.value || '',
        dueAt: form.elements.dueAt?.value || null,
      };

      if (!clean(payload.note)) {
        form.elements.note?.focus();
        return;
      }

      try {
        await createAdminCustomerFollowUp(customerId, payload);
        dialog.remove();
        renderLoading(root);
        await refreshRoot(root, 'Gestión guardada correctamente.');
      } catch (error) {
        renderError(root, error?.message || 'No fue posible guardar el seguimiento.');
      }
    };

    const onClick = async (event) => {
      const closeDialog = event.target?.closest?.('[data-followup-close-dialog]');
      if (closeDialog) {
        closeDialog.closest('[data-followup-dialog="true"]')?.remove();
        return;
      }

      const openButton = event.target?.closest?.('[data-followup-open-dialog]');
      if (openButton) {
        const root = openButton.closest('[data-customer-followups-root="true"]');
        if (!root) return;
        openFollowUpDialog(root, openButton.dataset.followupOpenDialog || 'note');
        return;
      }

      const doneButton = event.target?.closest?.('[data-followup-done]');
      const deleteButton = event.target?.closest?.('[data-followup-delete]');
      if (!doneButton && !deleteButton) return;

      const root = event.target.closest('[data-customer-followups-root="true"]');
      const customerId = root?.dataset?.customerId;
      const followUps = Array.isArray(root?._followUps) ? root._followUps : [];
      const followUpId = doneButton?.dataset.followupDone || deleteButton?.dataset.followupDelete;
      const current = followUps.find((item) => item.id === followUpId);

      if (!customerId || !followUpId) return;

      try {
        renderLoading(root);
        if (doneButton) {
          await updateAdminCustomerFollowUp(customerId, followUpId, {
            ...current,
            status: 'done',
          });
        } else {
          await deleteAdminCustomerFollowUp(customerId, followUpId);
        }

        await refreshRoot(root, doneButton ? 'Gestión marcada como realizada.' : 'Gestión eliminada.');
      } catch (error) {
        renderError(root, error?.message || 'No fue posible actualizar el seguimiento.');
      }
    };

    const observer = new MutationObserver(() => tryMount());
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('click', onClick, true);

    const interval = window.setInterval(tryMount, 700);
    tryMount();

    return () => {
      destroyed = true;
      observer.disconnect();
      document.removeEventListener('submit', onSubmit, true);
      document.removeEventListener('click', onClick, true);
      window.clearInterval(interval);
      document.querySelector('[data-followup-dialog="true"]')?.remove();
    };
  }, []);

  return null;
}
