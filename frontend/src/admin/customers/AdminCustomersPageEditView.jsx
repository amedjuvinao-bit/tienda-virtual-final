// frontend/src/admin/customers/AdminCustomersPageEditView.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, BadgeCheck, Eye, Loader2, Mail, Phone, Plus, RefreshCw, Save, Search, UserRound } from 'lucide-react';
import { createAdminCustomer, getAdminCustomer, getAdminCustomers, updateAdminCustomer } from '../api/adminCustomersApi';
import CustomerDetailEditableModal from './CustomerDetailEditableModal';

const EMPTY_FORM = {
  fullName: '',
  phone: '',
  documentType: 'CC',
  documentNumber: '',
  email: '',
  address: '',
  city: '',
  department: '',
  notes: '',
};

const SOURCE_FILTERS = [
  ['all', 'Todos'],
  ['pos', 'POS'],
  ['web', 'Web'],
  ['admin', 'Admin'],
];

const SEGMENT_FILTERS = [
  ['all', 'Todos'],
  ['with-purchases', 'Con compras'],
  ['without-purchases', 'Sin compras'],
  ['with-email', 'Con correo'],
  ['without-email', 'Sin correo'],
];

const moneyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

function clean(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function formatDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
}

function getName(customer = {}) {
  return customer.fullName || customer.displayName || 'Cliente sin nombre';
}

function summaryFallback(customers = [], total = 0) {
  return customers.reduce((acc, customer) => {
    const stats = customer.stats || {};
    acc.totalCustomers = Number(total || customers.length);
    acc.totalSpent += Number(stats.totalSpent || 0);
    acc.totalOrders += Number(stats.ordersCount || 0);
    if (customer.email) acc.withEmail += 1;
    if (customer.source === 'pos') acc.posCustomers += 1;
    if (customer.source === 'web') acc.webCustomers += 1;
    if (Number(stats.ordersCount || 0) > 0) acc.withPurchases += 1;
    return acc;
  }, { totalCustomers: Number(total || customers.length), totalSpent: 0, totalOrders: 0, withEmail: 0, posCustomers: 0, webCustomers: 0, withPurchases: 0 });
}

function cardStyle(extra = {}) {
  return {
    borderColor: 'var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: '0 18px 44px rgba(190, 24, 93, 0.09)',
    ...extra,
  };
}

function Pill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border px-4 py-2 text-xs font-black transition"
      style={{
        borderColor: active ? 'var(--admin-primary)' : 'var(--admin-card-border)',
        background: active ? 'var(--admin-primary)' : 'var(--admin-card-bg)',
        color: active ? '#fff' : 'var(--admin-card-text)',
      }}
    >
      {children}
    </button>
  );
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
  return <input {...props} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }} />;
}

function Textarea(props) {
  return <textarea {...props} className="min-h-[96px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }} />;
}

function SummaryCard({ label, value, helper }) {
  return (
    <div className="rounded-3xl border p-5" style={cardStyle({ background: 'linear-gradient(145deg, #fff, #fff1f7)' })}>
      <p className="text-xs font-black uppercase tracking-[0.15em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
      <p className="mt-3 break-words text-2xl font-black" style={{ color: 'var(--admin-primary)' }}>{value}</p>
      <p className="mt-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p>
    </div>
  );
}

function CustomerRow({ customer, onDetail }) {
  const stats = customer.stats || {};

  return (
    <article className="rounded-3xl border p-5" style={cardStyle({ background: 'linear-gradient(145deg, #fff, #fff7fb)' })}>
      <div className="grid gap-4 xl:grid-cols-[1fr_280px_320px_120px] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}><UserRound className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-lg font-black">{getName(customer)}</p>
              <p className="truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{customer.customerCode || 'Sin código'} · {customer.source || 'admin'}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
            <span className="rounded-full px-3 py-1" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>{customer.documentType || 'DOC'} {customer.documentNumber || 'Sin documento'}</span>
            <span className="rounded-full px-3 py-1" style={{ background: Number(stats.ordersCount || 0) > 0 ? '#ecfdf5' : '#f8fafc', color: Number(stats.ordersCount || 0) > 0 ? '#047857' : '#64748b' }}>{Number(stats.ordersCount || 0) > 0 ? 'Comprador' : 'Sin compras'}</span>
          </div>
        </div>

        <div className="space-y-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
          <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> {customer.phone || 'Sin celular'}</p>
          <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> {customer.email || 'Sin correo'}</p>
          <p>Última compra: {stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : 'sin registro'}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--admin-card-border)' }}><p className="text-[11px] font-black" style={{ color: 'var(--admin-card-muted-text)' }}>COMPRAS</p><p className="text-xl font-black">{stats.ordersCount || 0}</p></div>
          <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--admin-card-border)' }}><p className="text-[11px] font-black" style={{ color: 'var(--admin-card-muted-text)' }}>POS</p><p className="text-xl font-black">{stats.posOrdersCount || 0}</p></div>
          <div className="rounded-2xl border p-3" style={{ borderColor: 'var(--admin-card-border)' }}><p className="text-[11px] font-black" style={{ color: 'var(--admin-card-muted-text)' }}>GASTADO</p><p className="text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{money(stats.totalSpent)}</p></div>
        </div>

        <button type="button" onClick={() => onDetail(customer)} className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}><Eye className="h-4 w-4" /> Detalle</button>
      </div>
    </article>
  );
}

export default function AdminCustomersPageEditView() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailSaving, setDetailSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [detail, setDetail] = useState(null);

  const canCreate = useMemo(() => clean(form.fullName).length >= 3 && !saving, [form.fullName, saving]);
  const safeSummary = summary || summaryFallback(customers, total);

  async function loadCustomers(q = searchTerm, source = sourceFilter, segment = segmentFilter) {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminCustomers({ q, status: 'active', source, segment, page: 1, limit: 50 });
      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      setSummary(data?.summary || null);
      setTotal(Number(data?.total || 0));
    } catch (err) {
      setError(err?.message || 'No fue posible cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(customer) {
    if (!customer?.id) return;
    setDetail({ customer, recentOrders: [] });
    setDetailLoading(true);
    setDetailError('');
    try {
      const data = await getAdminCustomer(customer.id);
      setDetail(data || { customer, recentOrders: [] });
    } catch (err) {
      setDetailError(err?.message || 'No fue posible cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function saveDetail(customerId, payload, afterSave) {
    try {
      setDetailSaving(true);
      setDetailError('');
      setSuccess('');
      const updated = await updateAdminCustomer(customerId, payload);
      const data = await getAdminCustomer(customerId);
      const nextCustomer = data?.customer || updated?.customer;
      setDetail(data || { customer: nextCustomer, recentOrders: detail?.recentOrders || [] });
      if (nextCustomer) setCustomers((prev) => prev.map((item) => (item.id === nextCustomer.id ? nextCustomer : item)));
      setSuccess('Cliente actualizado correctamente.');
      if (typeof afterSave === 'function') afterSave();
      await loadCustomers(searchTerm, sourceFilter, segmentFilter);
    } catch (err) {
      setDetailError(err?.message || 'No fue posible actualizar el cliente.');
    } finally {
      setDetailSaving(false);
    }
  }

  async function createCustomer(event) {
    event.preventDefault();
    if (!canCreate) return;
    try {
      setSaving(true);
      setError('');
      const data = await createAdminCustomer({ ...form, source: 'admin', status: 'active' });
      setCustomers((prev) => [data.customer, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess('Cliente creado correctamente.');
      await loadCustomers(searchTerm, sourceFilter, segmentFilter);
    } catch (err) {
      setError(err?.message || 'No fue posible crear el cliente.');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => loadCustomers(searchTerm, sourceFilter, segmentFilter), 350);
    return () => window.clearTimeout(timer);
  }, [searchTerm, sourceFilter, segmentFilter]);

  const setCreateField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5">
      {detail ? <CustomerDetailEditableModal data={detail} loading={detailLoading} saving={detailSaving} error={detailError} onClose={() => setDetail(null)} onRefresh={(id) => openDetail({ id })} onSave={saveDetail} /> : null}

      <section className="rounded-3xl border p-5" style={cardStyle({ background: 'linear-gradient(135deg, #fff, #fff1f7)' })}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}><UserRound className="h-5 w-5" /></span><div><p className="inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em]" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>CRM de clientes</p><h1 className="mt-2 text-3xl font-black">Clientes</h1><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Clientes POS, tienda web, compras acumuladas y seguimiento comercial.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => loadCustomers()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-primary)' }}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Actualizar</button><button type="button" onClick={() => setShowForm((prev) => !prev)} className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white" style={{ background: 'var(--admin-primary)' }}><Plus className="h-4 w-4" /> Nuevo cliente</button></div>
        </div>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700"><AlertCircle className="mr-2 inline h-5 w-5" />{error}</div> : null}
      {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700"><BadgeCheck className="mr-2 inline h-5 w-5" />{success}</div> : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Ventas clientes" value={money(safeSummary.totalSpent)} helper="Total comprado por clientes" />
        <SummaryCard label="Total clientes" value={safeSummary.totalCustomers || 0} helper={`${safeSummary.withEmail || 0} con correo`} />
        <SummaryCard label="Clientes POS" value={safeSummary.posCustomers || 0} helper="Desde punto de venta" />
        <SummaryCard label="Clientes web" value={safeSummary.webCustomers || 0} helper="Desde tienda virtual" />
        <SummaryCard label="Con compras" value={safeSummary.withPurchases || 0} helper={`${safeSummary.totalOrders || 0} compras acumuladas`} />
      </div>

      {showForm ? <section className="rounded-3xl border p-5" style={cardStyle()}><form onSubmit={createCustomer} className="space-y-4"><div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black">Crear cliente</h2><p className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Disponible para POS y seguimiento comercial.</p></div><button type="submit" disabled={!canCreate} className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar</button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Nombre"><Input value={form.fullName} onChange={(e) => setCreateField('fullName', e.target.value)} /></Field><Field label="Celular"><Input value={form.phone} onChange={(e) => setCreateField('phone', e.target.value)} /></Field><Field label="Documento"><Input value={form.documentNumber} onChange={(e) => setCreateField('documentNumber', e.target.value)} /></Field><Field label="Correo"><Input value={form.email} onChange={(e) => setCreateField('email', e.target.value)} /></Field><Field label="Dirección"><Input value={form.address} onChange={(e) => setCreateField('address', e.target.value)} /></Field><Field label="Ciudad"><Input value={form.city} onChange={(e) => setCreateField('city', e.target.value)} /></Field><Field label="Departamento"><Input value={form.department} onChange={(e) => setCreateField('department', e.target.value)} /></Field></div><Field label="Notas"><Textarea value={form.notes} onChange={(e) => setCreateField('notes', e.target.value)} /></Field></form></section> : null}

      <section className="rounded-3xl border" style={cardStyle()}>
        <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:items-start"><div><p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmentación</p><h2 className="mt-1 text-xl font-black">Listado de clientes</h2><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{total} cliente(s) · origen {sourceFilter} · segmento {segmentFilter}</p></div><div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)' }}><Search className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} /><input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar por nombre, celular, correo o documento" className="w-full bg-transparent text-sm font-bold outline-none" />{loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}</div></div>
          <div className="mt-5 grid gap-3 xl:grid-cols-2"><div className="rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}><p className="mb-3 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Origen</p><div className="flex flex-wrap gap-2">{SOURCE_FILTERS.map(([key, label]) => <Pill key={key} active={sourceFilter === key} onClick={() => setSourceFilter(key)}>{label}</Pill>)}</div></div><div className="rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}><p className="mb-3 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmento</p><div className="flex flex-wrap gap-2">{SEGMENT_FILTERS.map(([key, label]) => <Pill key={key} active={segmentFilter === key} onClick={() => setSegmentFilter(key)}>{label}</Pill>)}</div></div></div>
        </div>
        <div className="space-y-4 p-5">{loading ? <p className="py-8 text-center font-black">Cargando clientes...</p> : customers.length === 0 ? <p className="py-8 text-center font-black">No hay clientes para este filtro.</p> : customers.map((customer) => <CustomerRow key={customer.id} customer={customer} onDetail={openDetail} />)}</div>
      </section>
    </div>
  );
}
