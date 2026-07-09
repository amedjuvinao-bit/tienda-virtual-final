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
  return date.toLocaleString('es-CO', { hour12: false });
}

function findCustomerCode(modal) {
  const text = modal?.textContent || '';
  const match = text.match(/CLI-[A-Z0-9]+-[A-Z0-9]+/i);
  return match?.[0]?.toUpperCase() || '';
}

function findFollowUpPanel() {
  const headings = Array.from(document.querySelectorAll('h3'));
  const heading = headings.find((item) => clean(item.textContent).toLowerCase() === 'seguimiento interno');
  if (!heading) return null;

  return heading.closest('.rounded-3xl') || heading.parentElement;
}

function getStatusTone(status) {
  if (status === 'done') return { bg: '#ecfdf5', text: '#047857', border: '#bbf7d0' };
  if (status === 'cancelled') return { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' };
  return { bg: '#fff7ed', text: '#c2410c', border: '#fed7aa' };
}

function optionsHtml(options, selected) {
  return options
    .map(([value, label]) => `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`)
    .join('');
}

async function resolveCustomerByCode(customerCode) {
  const data = await getAdminCustomers({ q: customerCode, status: 'active', source: 'all', segment: 'all', page: 1, limit: 10 });
  const rows = Array.isArray(data?.customers) ? data.customers : [];
  return rows.find((customer) => clean(customer.customerCode).toUpperCase() === customerCode) || rows[0] || null;
}

function renderLoading(container) {
  container.innerHTML = `
    <div class="mt-4 rounded-2xl border p-4 text-sm font-bold" style="border-color: rgba(236,72,153,0.18); background: #fff; color: var(--admin-card-muted-text);">
      Cargando seguimiento del cliente...
    </div>
  `;
}

function renderError(container, message) {
  container.innerHTML = `
    <div class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
      ${escapeHtml(message || 'No fue posible cargar el seguimiento del cliente.')}
    </div>
  `;
}

function renderFollowUps(container, customer, followUps, feedback = '') {
  const rows = Array.isArray(followUps) ? followUps : [];

  container.innerHTML = `
    <div class="mt-5 border-t pt-4" style="border-color: rgba(236,72,153,0.16);">
      <div class="mb-3">
        <p class="text-xs font-black uppercase tracking-[0.18em]" style="color: var(--admin-card-muted-text);">Nuevo seguimiento</p>
        <p class="mt-1 text-xs font-bold" style="color: var(--admin-card-muted-text);">Registra llamadas, WhatsApp, pagos pendientes, tallas o recordatorios.</p>
      </div>

      ${feedback ? `<div class="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-black text-emerald-700">${escapeHtml(feedback)}</div>` : ''}

      <form data-customer-followup-form="true" class="space-y-3">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="block">
            <span class="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]" style="color: var(--admin-card-muted-text);">Tipo</span>
            <select name="type" class="w-full rounded-2xl border px-4 py-3 text-xs font-bold outline-none" style="border-color: rgba(236,72,153,0.28); background: rgba(255,255,255,0.9); color: var(--admin-card-text);">
              ${optionsHtml(TYPE_OPTIONS, 'whatsapp')}
            </select>
          </label>
          <label class="block">
            <span class="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]" style="color: var(--admin-card-muted-text);">Estado</span>
            <select name="status" class="w-full rounded-2xl border px-4 py-3 text-xs font-bold outline-none" style="border-color: rgba(236,72,153,0.28); background: rgba(255,255,255,0.9); color: var(--admin-card-text);">
              ${optionsHtml(STATUS_OPTIONS, 'pending')}
            </select>
          </label>
        </div>
        <label class="block">
          <span class="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]" style="color: var(--admin-card-muted-text);">Nota</span>
          <textarea name="note" class="min-h-[80px] w-full resize-none rounded-2xl border px-4 py-3 text-xs font-bold outline-none" style="border-color: rgba(236,72,153,0.28); background: rgba(255,255,255,0.9); color: var(--admin-card-text);" placeholder="Ej: Cliente pidió confirmar disponibilidad de talla 6"></textarea>
        </label>
        <div class="grid gap-3 md:grid-cols-[1fr_190px_auto] md:items-end">
          <label class="block">
            <span class="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]" style="color: var(--admin-card-muted-text);">Próxima acción</span>
            <input name="nextAction" class="w-full rounded-2xl border px-4 py-3 text-xs font-bold outline-none" style="border-color: rgba(236,72,153,0.28); background: rgba(255,255,255,0.9); color: var(--admin-card-text);" placeholder="Ej: escribir por WhatsApp mañana" />
          </label>
          <label class="block">
            <span class="mb-2 block text-[11px] font-black uppercase tracking-[0.16em]" style="color: var(--admin-card-muted-text);">Fecha</span>
            <input type="datetime-local" name="dueAt" class="w-full rounded-2xl border px-4 py-3 text-xs font-bold outline-none" style="border-color: rgba(236,72,153,0.28); background: rgba(255,255,255,0.9); color: var(--admin-card-text);" />
          </label>
          <button type="submit" class="inline-flex justify-center rounded-2xl px-4 py-3 text-xs font-black text-white" style="background: var(--admin-primary);">Guardar seguimiento</button>
        </div>
      </form>

      <div class="mt-5">
        <p class="mb-3 text-xs font-black uppercase tracking-[0.18em]" style="color: var(--admin-card-muted-text);">Historial de seguimiento</p>
        <div class="space-y-3" data-customer-followup-list="true">
          ${rows.length === 0 ? `
            <div class="rounded-2xl border p-4 text-xs font-bold" style="border-color: rgba(236,72,153,0.16); background: #fff; color: var(--admin-card-muted-text);">
              Este cliente todavía no tiene seguimientos registrados.
            </div>
          ` : rows.map((item) => {
            const tone = getStatusTone(item.status);
            return `
              <article class="rounded-2xl border p-4" style="border-color: rgba(236,72,153,0.16); background: #fff;">
                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap gap-2">
                      <span class="rounded-xl border px-3 py-1 text-[11px] font-black uppercase" style="border-color: #f9a8d4; background: #fdf2f8; color: #be185d;">${escapeHtml(item.typeLabel || item.type || 'Nota')}</span>
                      <span class="rounded-xl border px-3 py-1 text-[11px] font-black uppercase" style="border-color: ${tone.border}; background: ${tone.bg}; color: ${tone.text};">${escapeHtml(item.statusLabel || item.status || 'Pendiente')}</span>
                    </div>
                    <p class="mt-3 text-sm font-black" style="color: var(--admin-card-text);">${escapeHtml(item.note)}</p>
                    ${item.nextAction ? `<p class="mt-2 text-xs font-bold" style="color: var(--admin-card-muted-text);">Próxima acción: ${escapeHtml(item.nextAction)}</p>` : ''}
                    <p class="mt-2 text-[11px] font-bold" style="color: var(--admin-card-muted-text);">Creado: ${escapeHtml(formatDate(item.createdAt))}${item.dueAt ? ` · Fecha: ${escapeHtml(formatDate(item.dueAt))}` : ''}</p>
                  </div>
                  <div class="flex shrink-0 flex-wrap gap-2">
                    ${item.status !== 'done' ? `<button type="button" data-followup-done="${escapeHtml(item.id)}" class="rounded-xl border px-3 py-2 text-[11px] font-black" style="border-color: #bbf7d0; background: #ecfdf5; color: #047857;">Realizado</button>` : ''}
                    <button type="button" data-followup-delete="${escapeHtml(item.id)}" class="rounded-xl border px-3 py-2 text-[11px] font-black" style="border-color: #fecaca; background: #fef2f2; color: #b91c1c;">Eliminar</button>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  container.dataset.customerId = customer.id;
  container.dataset.customerCode = customer.customerCode || '';
  container._followUps = rows;
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

      const modal = panel.closest('section') || panel.parentElement;
      const customerCode = findCustomerCode(modal);
      if (!customerCode) return;

      const current = panel.querySelector('[data-customer-followups-root="true"]');
      if (current?.dataset?.customerCode === customerCode) return;
      if (current) current.remove();

      const container = document.createElement('div');
      container.dataset.customerFollowupsRoot = 'true';
      container.dataset.customerCode = customerCode;
      panel.appendChild(container);

      try {
        await mountFollowUps(container, customerCode);
      } catch (error) {
        renderError(container, error?.message || 'No fue posible cargar el seguimiento del cliente.');
      }
    };

    const onSubmit = async (event) => {
      const form = event.target?.closest?.('[data-customer-followup-form="true"]');
      if (!form) return;

      event.preventDefault();
      const root = form.closest('[data-customer-followups-root="true"]');
      const customerId = root?.dataset?.customerId;
      const customerCode = root?.dataset?.customerCode;
      if (!customerId) return;

      const payload = {
        type: form.elements.type?.value || 'note',
        status: form.elements.status?.value || 'pending',
        note: form.elements.note?.value || '',
        nextAction: form.elements.nextAction?.value || '',
        dueAt: form.elements.dueAt?.value || null,
      };

      if (!clean(payload.note)) {
        renderError(root, 'Debes escribir una nota de seguimiento.');
        return;
      }

      try {
        renderLoading(root);
        await createAdminCustomerFollowUp(customerId, payload);
        const response = await getAdminCustomerFollowUps(customerId, { status: 'all', limit: 20 });
        renderFollowUps(root, { id: customerId, customerCode }, response?.followUps || [], 'Seguimiento guardado correctamente.');
      } catch (error) {
        renderError(root, error?.message || 'No fue posible guardar el seguimiento.');
      }
    };

    const onClick = async (event) => {
      const doneButton = event.target?.closest?.('[data-followup-done]');
      const deleteButton = event.target?.closest?.('[data-followup-delete]');
      if (!doneButton && !deleteButton) return;

      const root = event.target.closest('[data-customer-followups-root="true"]');
      const customerId = root?.dataset?.customerId;
      const customerCode = root?.dataset?.customerCode;
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

        const response = await getAdminCustomerFollowUps(customerId, { status: 'all', limit: 20 });
        renderFollowUps(root, { id: customerId, customerCode }, response?.followUps || [], doneButton ? 'Seguimiento marcado como realizado.' : 'Seguimiento eliminado.');
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
    };
  }, []);

  return null;
}
