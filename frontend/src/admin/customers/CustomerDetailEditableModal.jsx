// frontend/src/admin/customers/CustomerDetailEditableModal.jsx

import React, { useEffect, useState } from 'react';
import { FileText, Loader2, Mail, MapPin, Phone, Save, UserRound, X } from 'lucide-react';
import { customerToEditForm, isValidCustomerEditForm } from './customerEditHelpers';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function customerName(customer = {}) {
  return customer.fullName || customer.displayName || 'Cliente sin nombre';
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</span>
      {children}
    </label>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none disabled:opacity-60"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      {...props}
      className="min-h-[96px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none disabled:opacity-60"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}
    />
  );
}

function Select(props) {
  return (
    <select
      {...props}
      className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none disabled:opacity-60"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}
    />
  );
}

function Metric({ label, value, helper }) {
  return (
    <div className="rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: '#fff' }}>
      <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
      <p className="mt-2 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>{value}</p>
      {helper ? <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
    </div>
  );
}

function StatusChip({ children, tone = 'default' }) {
  const styles = tone === 'success'
    ? { background: '#ecfdf5', color: '#047857' }
    : { background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' };

  return <span className="rounded-full px-3 py-1 text-xs font-black uppercase" style={styles}>{children}</span>;
}

export default function CustomerDetailEditableModal({ data, loading, saving, error, onClose, onRefresh, onSave }) {
  const customer = data?.customer || null;
  const orders = Array.isArray(data?.recentOrders) ? data.recentOrders : [];
  const stats = customer?.stats || {};
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(customerToEditForm(customer));

  useEffect(() => {
    setForm(customerToEditForm(customer));
    setEditing(false);
  }, [customer?.id]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const canSave = isValidCustomerEditForm(form) && !saving;

  return (
    <div className="fixed left-0 top-0 z-[130] h-screen w-screen overflow-y-auto px-4 py-8" style={{ background: 'rgba(15, 23, 42, 0.58)', backdropFilter: 'blur(6px)' }}>
      <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'linear-gradient(145deg, #fff, #fff1f7)', color: 'var(--admin-card-text)', boxShadow: '0 30px 90px rgba(15, 23, 42, 0.28)' }}>
        <div className="flex flex-col gap-4 border-b p-5 lg:flex-row lg:items-start lg:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}><UserRound className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-primary)' }}>Detalle comercial</p>
              <h2 className="mt-1 text-2xl font-black">{customer ? customerName(customer) : 'Cliente'}</h2>
              <p className="text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer?.customerCode || 'Consultando...'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {customer?.id ? <button type="button" onClick={() => onRefresh(customer.id)} disabled={loading || saving} className="rounded-2xl border px-4 py-3 text-xs font-black disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>Actualizar</button> : null}
            {customer?.id ? <button type="button" onClick={() => setEditing((prev) => !prev)} disabled={loading || saving} className="rounded-2xl border px-4 py-3 text-xs font-black disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>{editing ? 'Cancelar edición' : 'Editar cliente'}</button> : null}
            {editing ? <button type="button" onClick={() => onSave(customer.id, form, () => setEditing(false))} disabled={!canSave} className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black text-white disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar</button> : null}
            <button type="button" onClick={onClose} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-black disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)' }}><X className="h-4 w-4" /> Cerrar</button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {loading ? <div className="rounded-2xl border p-6 text-center" style={{ borderColor: 'var(--admin-card-border)' }}><Loader2 className="mx-auto h-7 w-7 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-2 font-black">Cargando detalle...</p></div> : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}

          {customer && !loading ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Metric label="Compras" value={stats.ordersCount || 0} helper={`POS ${stats.posOrdersCount || 0} · Web ${stats.webOrdersCount || 0}`} />
                <Metric label="Total gastado" value={money(stats.totalSpent)} helper={`Última orden ${stats.lastOrderNumber || '—'}`} />
                <Metric label="Primera compra" value={stats.firstPurchaseAt ? formatDate(stats.firstPurchaseAt) : '—'} />
                <Metric label="Última compra" value={stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : '—'} />
              </div>

              {editing ? (
                <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--admin-card-border)', background: '#fff' }}>
                  <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Editar cliente</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <Field label="Nombre"><Input value={form.fullName} onChange={(e) => setField('fullName', e.target.value)} disabled={saving} /></Field>
                    <Field label="Celular"><Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} disabled={saving} /></Field>
                    <Field label="Tipo doc."><Select value={form.documentType} onChange={(e) => setField('documentType', e.target.value)} disabled={saving}><option value="CC">CC</option><option value="CE">CE</option><option value="TI">TI</option><option value="NIT">NIT</option><option value="PP">Pasaporte</option><option value="OTHER">Otro</option></Select></Field>
                    <Field label="Documento"><Input value={form.documentNumber} onChange={(e) => setField('documentNumber', e.target.value)} disabled={saving} /></Field>
                    <Field label="Correo"><Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} disabled={saving} /></Field>
                    <Field label="Dirección"><Input value={form.address} onChange={(e) => setField('address', e.target.value)} disabled={saving} /></Field>
                    <Field label="Ciudad"><Input value={form.city} onChange={(e) => setField('city', e.target.value)} disabled={saving} /></Field>
                    <Field label="Departamento"><Input value={form.department} onChange={(e) => setField('department', e.target.value)} disabled={saving} /></Field>
                  </div>
                  <div className="mt-4"><Field label="Notas internas"><Textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} disabled={saving} /></Field></div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--admin-card-border)', background: '#fff' }}>
                    <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Datos del cliente</h3>
                    <div className="space-y-3 text-sm font-bold">
                      <p><Phone className="mr-2 inline h-4 w-4" style={{ color: 'var(--admin-primary)' }} />{customer.phone || 'Sin celular'}</p>
                      <p><Mail className="mr-2 inline h-4 w-4" style={{ color: 'var(--admin-primary)' }} />{customer.email || 'Sin correo'}</p>
                      <p><FileText className="mr-2 inline h-4 w-4" style={{ color: 'var(--admin-primary)' }} />{customer.documentType || 'DOC'} {customer.documentNumber || 'Sin documento'}</p>
                      <p><MapPin className="mr-2 inline h-4 w-4" style={{ color: 'var(--admin-primary)' }} />{customer.address || 'Sin dirección'} {customer.city ? `· ${customer.city}` : ''}</p>
                    </div>
                  </div>
                  <div className="rounded-3xl border p-5" style={{ borderColor: 'var(--admin-card-border)', background: '#fff' }}>
                    <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Seguimiento interno</h3>
                    <div className="flex flex-wrap gap-2"><StatusChip>{customer.source || 'admin'}</StatusChip><StatusChip tone="success">{customer.status || 'active'}</StatusChip>{customer.acceptsMarketing ? <StatusChip tone="success">Acepta marketing</StatusChip> : <StatusChip>Sin marketing</StatusChip>}</div>
                    <p className="mt-4 rounded-2xl border p-4 text-sm font-bold" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>{customer.notes || 'Sin notas internas.'}</p>
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-3xl border" style={{ borderColor: 'var(--admin-card-border)', background: '#fff' }}>
                <div className="border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)' }}><h3 className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Historial reciente de compras</h3></div>
                {orders.length === 0 ? <p className="p-5 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>No se encontraron órdenes asociadas.</p> : <div className="divide-y" style={{ borderColor: 'var(--admin-card-border)' }}>{orders.map((order) => <div key={order.id} className="grid gap-3 p-5 lg:grid-cols-[160px_1fr_140px_100px] lg:items-center"><div><p className="font-black">Orden {order.orderNumber}</p><p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{formatDate(order.createdAt)} · {order.source}</p></div><p className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{(order.items || []).slice(0, 2).map((item) => item.title).join(', ') || 'Sin detalle'}</p><p className="font-black" style={{ color: 'var(--admin-primary)' }}>{money(order.total)}</p><StatusChip tone={order.status === 'paid' ? 'success' : 'default'}>{order.status || 'orden'}</StatusChip></div>)}</div>}
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
