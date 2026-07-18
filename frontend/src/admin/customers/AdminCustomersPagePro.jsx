// frontend/src/admin/customers/AdminCustomersPagePro.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  DollarSign,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  UsersRound,
} from 'lucide-react';
import {
  createAdminCustomer,
  getAdminCustomers,
} from '../api/adminCustomersApi';

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
  { key: 'all', label: 'Todos' },
  { key: 'pos', label: 'POS' },
  { key: 'web', label: 'Web' },
  { key: 'admin', label: 'Admin' },
];

const SEGMENT_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'with-purchases', label: 'Con compras' },
  { key: 'without-purchases', label: 'Sin compras' },
  { key: 'with-email', label: 'Con correo' },
  { key: 'without-email', label: 'Sin correo' },
];

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function cleanText(value) {
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

function customerName(customer = {}) {
  return customer.fullName || customer.displayName || 'Cliente sin nombre';
}

function sourceLabel(value) {
  const source = cleanText(value).toLowerCase();
  if (source === 'pos') return 'POS';
  if (source === 'web') return 'Web';
  if (source === 'admin') return 'Admin';
  return source || 'Admin';
}

function sourceTone(value) {
  const source = cleanText(value).toLowerCase();
  if (source === 'pos') return { text: '#be185d', bg: '#fdf2f8', border: '#f9a8d4' };
  if (source === 'web') return { text: '#0369a1', bg: '#f0f9ff', border: '#bae6fd' };
  return { text: '#6d28d9', bg: '#f5f3ff', border: '#ddd6fe' };
}

function buildLocalSummary(customers = [], total = 0) {
  return customers.reduce((acc, customer) => {
    const stats = customer.stats || {};
    const ordersCount = Number(stats.ordersCount || 0);
    const totalSpent = Number(stats.totalSpent || 0);

    acc.totalCustomers = Number(total || customers.length);
    if (customer.source === 'pos') acc.posCustomers += 1;
    if (customer.source === 'web') acc.webCustomers += 1;
    if (ordersCount > 0) acc.withPurchases += 1;
    if (customer.email) acc.withEmail += 1;
    acc.totalOrders += ordersCount;
    acc.totalSpent += totalSpent;
    return acc;
  }, {
    totalCustomers: Number(total || customers.length),
    posCustomers: 0,
    webCustomers: 0,
    withPurchases: 0,
    withEmail: 0,
    totalOrders: 0,
    totalSpent: 0,
    newestCustomer: customers[0] || null,
  });
}

function Card({ children, className = '', style = {} }) {
  return (
    <section
      className={`rounded-[28px] border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(255,241,247,0.78))',
        boxShadow: '0 22px 58px rgba(190, 24, 93, 0.10)',
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function IconBox({ icon: Icon }) {
  return (
    <span
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
      style={{
        borderColor: 'rgba(236, 72, 153, 0.22)',
        background: 'linear-gradient(135deg, #fff, #fdf2f8)',
        color: 'var(--admin-primary)',
        boxShadow: '0 10px 24px rgba(236, 72, 153, 0.12)',
      }}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span
        className="mb-2 block text-xs font-black uppercase tracking-[0.18em]"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none ${props.className || ''}`}
      style={{
        borderColor: 'rgba(236, 72, 153, 0.28)',
        background: 'rgba(255,255,255,0.86)',
        color: 'var(--admin-card-text)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
        ...(props.style || {}),
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[92px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none ${props.className || ''}`}
      style={{
        borderColor: 'rgba(236, 72, 153, 0.28)',
        background: 'rgba(255,255,255,0.86)',
        color: 'var(--admin-card-text)',
        ...(props.style || {}),
      }}
    />
  );
}

function MetricCard({ icon: Icon, label, value, helper, highlight = false }) {
  return (
    <div
      className="relative overflow-hidden rounded-[26px] border p-5"
      style={{
        borderColor: highlight ? 'rgba(236,72,153,0.34)' : 'rgba(236,72,153,0.18)',
        background: highlight
          ? 'linear-gradient(135deg, rgba(236,72,153,0.14), rgba(255,255,255,0.92))'
          : 'rgba(255,255,255,0.74)',
        boxShadow: highlight ? '0 18px 42px rgba(236, 72, 153, 0.16)' : '0 12px 30px rgba(15, 23, 42, 0.05)',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>{label}</p>
          <p className="mt-3 break-words text-2xl font-black leading-none" style={{ color: highlight ? 'var(--admin-primary)' : 'var(--admin-card-text)' }}>{value}</p>
          {helper ? <p className="mt-3 line-clamp-2 text-xs font-bold leading-relaxed" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
        </div>
        <IconBox icon={Icon} />
      </div>
    </div>
  );
}

function FilterPill({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-2xl border px-4 py-2.5 text-xs font-black transition hover:-translate-y-0.5"
      style={{
        borderColor: active ? 'var(--admin-primary)' : 'rgba(236,72,153,0.20)',
        background: active ? 'linear-gradient(135deg, var(--admin-primary), #be185d)' : 'rgba(255,255,255,0.72)',
        color: active ? '#fff' : 'var(--admin-card-text)',
        boxShadow: active ? '0 14px 28px rgba(236,72,153,0.24)' : '0 8px 18px rgba(15,23,42,0.04)',
      }}
    >
      {children}
    </button>
  );
}

function Badge({ children, tone = 'default' }) {
  const styles = {
    primary: { bg: '#fdf2f8', text: '#be185d', border: '#f9a8d4' },
    success: { bg: '#ecfdf5', text: '#047857', border: '#bbf7d0' },
    muted: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
    default: { bg: '#fff', text: '#475569', border: '#fbcfe8' },
  }[tone] || { bg: '#fff', text: '#475569', border: '#fbcfe8' };

  return (
    <span
      className="inline-flex items-center rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em]"
      style={{ background: styles.bg, color: styles.text, borderColor: styles.border }}
    >
      {children}
    </span>
  );
}

function CustomerRow({ customer }) {
  const stats = customer.stats || {};
  const ordersCount = Number(stats.ordersCount || 0);
  const totalSpent = Number(stats.totalSpent || 0);
  const hasPurchases = ordersCount > 0;
  const tone = sourceTone(customer.source);

  return (
    <article
      className="group overflow-hidden rounded-[28px] border p-4 transition duration-200 hover:-translate-y-0.5 lg:p-5"
      style={{
        borderColor: 'rgba(236,72,153,0.20)',
        background: 'linear-gradient(135deg, rgba(255,255,255,0.96), rgba(253,242,248,0.74))',
        boxShadow: '0 14px 34px rgba(190, 24, 93, 0.08)',
      }}
    >
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.9fr)_minmax(310px,0.95fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-4">
            <IconBox icon={UserRound} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black leading-tight" style={{ color: 'var(--admin-card-text)' }}>
                {customerName(customer)}
              </p>
              <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                {customer.customerCode || 'Sin código'} · creado {formatDate(customer.createdAt)}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {customer.documentNumber ? <Badge tone="primary">{customer.documentType || 'DOC'} {customer.documentNumber}</Badge> : <Badge tone="muted">Sin documento</Badge>}
                <span
                  className="inline-flex items-center rounded-xl border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.08em]"
                  style={{ background: tone.bg, color: tone.text, borderColor: tone.border }}
                >
                  {sourceLabel(customer.source)}
                </span>
                {hasPurchases ? <Badge tone="success">Comprador</Badge> : <Badge tone="muted">Sin compras</Badge>}
              </div>
            </div>
          </div>
        </div>

        <div
          className="rounded-3xl border p-4"
          style={{ borderColor: 'rgba(236,72,153,0.16)', background: 'rgba(255,255,255,0.68)' }}
        >
          <p className="mb-3 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Contacto</p>
          <div className="space-y-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /><span className="truncate">{customer.phone || 'Sin celular'}</span></p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /><span className="truncate">{customer.email || 'Sin correo'}</span></p>
            <p className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /><span className="truncate">Última compra: {stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : 'sin registro'}</span></p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-3xl border p-4 text-center" style={{ borderColor: 'rgba(236,72,153,0.18)', background: '#fff' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Compras</p>
            <p className="mt-2 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>{ordersCount}</p>
          </div>
          <div className="rounded-3xl border p-4 text-center" style={{ borderColor: 'rgba(236,72,153,0.18)', background: '#fff' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>POS</p>
            <p className="mt-2 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>{Number(stats.posOrdersCount || 0)}</p>
          </div>
          <div className="rounded-3xl border p-4 text-center" style={{ borderColor: 'rgba(236,72,153,0.24)', background: '#fff7fb' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Gastado</p>
            <p className="mt-2 break-words text-sm font-black leading-tight" style={{ color: 'var(--admin-primary)' }}>{money(totalSpent)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function SegmentPanel({ title, children }) {
  return (
    <div
      className="rounded-[24px] border p-4"
      style={{ borderColor: 'rgba(236,72,153,0.16)', background: 'rgba(255,255,255,0.66)' }}
    >
      <p className="mb-3 text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function AdminCustomersPagePro() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canSave = useMemo(() => cleanText(form.fullName).length >= 3 && !saving, [form.fullName, saving]);
  const safeSummary = summary || buildLocalSummary(customers, total);
  const activeSourceLabel = SOURCE_FILTERS.find((item) => item.key === sourceFilter)?.label || 'Todos';
  const activeSegmentLabel = SEGMENT_FILTERS.find((item) => item.key === segmentFilter)?.label || 'Todos';

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const loadCustomers = async (q = searchTerm, source = sourceFilter, segment = segmentFilter) => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminCustomers({
        q,
        status: 'active',
        source,
        segment,
        page: 1,
        limit: 50,
      });

      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      setSummary(data?.summary || null);
      setTotal(Number(data?.total || 0));
    } catch (err) {
      setError(err?.message || 'No fue posible cargar los clientes.');
      setCustomers([]);
      setSummary(null);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomer = async (event) => {
    event.preventDefault();
    if (!canSave) return;

    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const data = await createAdminCustomer({
        ...form,
        source: 'admin',
        status: 'active',
      });

      setCustomers((prev) => [data.customer, ...prev.filter((customer) => customer.id !== data.customer.id)]);
      setTotal((prev) => prev + 1);
      setForm(EMPTY_FORM);
      setShowForm(false);
      setSuccess('Cliente creado correctamente.');
      await loadCustomers(searchTerm, sourceFilter, segmentFilter);
    } catch (err) {
      setError(err?.message || 'No fue posible crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  const resetFilters = () => {
    setSourceFilter('all');
    setSegmentFilter('all');
    setSearchTerm('');
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCustomers(searchTerm, sourceFilter, segmentFilter);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchTerm, sourceFilter, segmentFilter]);

  return (
    <div className="min-h-full space-y-5">
      <Card className="overflow-hidden p-5 lg:p-6" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(252,231,243,0.86))' }}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <IconBox icon={UserRound} />
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-2xl border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em]" style={{ borderColor: 'rgba(236,72,153,0.22)', background: 'rgba(255,255,255,0.78)', color: 'var(--admin-primary)' }}>
                <Sparkles className="h-3.5 w-3.5" /> CRM de clientes
              </div>
              <h1 className="text-2xl font-black tracking-tight lg:text-3xl" style={{ color: 'var(--admin-card-text)' }}>Clientes</h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--admin-card-muted-text)' }}>
                Administra clientes de POS y tienda web con historial comercial, compras acumuladas y segmentación rápida.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => loadCustomers(searchTerm, sourceFilter, segmentFilter)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderColor: 'rgba(236,72,153,0.24)', background: '#fff', color: 'var(--admin-primary)' }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setShowForm((prev) => !prev)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white shadow-lg transition hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--admin-primary), #be185d)', boxShadow: '0 18px 36px rgba(236,72,153,0.28)' }}
            >
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </button>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-black">Error</p><p className="mt-1">{error}</p></div>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-black">Listo</p><p className="mt-1">{success}</p></div>
        </div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
        <MetricCard icon={DollarSign} label="Ventas clientes" value={money(safeSummary.totalSpent)} helper={safeSummary.newestCustomer ? `Último cliente: ${customerName(safeSummary.newestCustomer)}` : 'Sin cliente reciente'} highlight />
        <MetricCard icon={UsersRound} label="Total clientes" value={safeSummary.totalCustomers || 0} helper={`${safeSummary.withEmail || 0} con correo`} />
        <MetricCard icon={ShoppingBag} label="Clientes POS" value={safeSummary.posCustomers || 0} helper="Creados desde punto de venta" />
        <MetricCard icon={BarChart3} label="Clientes web" value={safeSummary.webCustomers || 0} helper="Pedidos tienda virtual" />
        <MetricCard icon={BadgeCheck} label="Con compras" value={safeSummary.withPurchases || 0} helper={`${safeSummary.totalOrders || 0} compras acumuladas`} />
      </div>

      {showForm ? (
        <Card className="p-5">
          <form className="space-y-4" onSubmit={handleCreateCustomer}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Crear cliente</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Este cliente quedará disponible para seleccionarlo en el POS.</p>
              </div>
              <button type="submit" disabled={!canSave} className="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Nombre completo"><TextInput value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Nombre del cliente" /></Field>
              <Field label="Celular"><TextInput value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="3000000000" /></Field>
              <Field label="Tipo documento">
                <select value={form.documentType} onChange={(event) => updateForm('documentType', event.target.value)} className="w-full rounded-2xl border px-4 py-3 text-sm font-bold outline-none" style={{ borderColor: 'rgba(236,72,153,0.28)', background: 'rgba(255,255,255,0.86)', color: 'var(--admin-card-text)' }}>
                  <option value="CC">CC</option><option value="CE">CE</option><option value="TI">TI</option><option value="NIT">NIT</option><option value="PP">Pasaporte</option><option value="OTHER">Otro</option>
                </select>
              </Field>
              <Field label="Documento"><TextInput value={form.documentNumber} onChange={(event) => updateForm('documentNumber', event.target.value)} placeholder="Número" /></Field>
              <Field label="Correo"><TextInput value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="correo@ejemplo.com" /></Field>
              <Field label="Dirección"><TextInput value={form.address} onChange={(event) => updateForm('address', event.target.value)} placeholder="Dirección" /></Field>
              <Field label="Ciudad"><TextInput value={form.city} onChange={(event) => updateForm('city', event.target.value)} placeholder="Ciudad" /></Field>
              <Field label="Departamento"><TextInput value={form.department} onChange={(event) => updateForm('department', event.target.value)} placeholder="Departamento" /></Field>
            </div>
            <Field label="Notas"><TextArea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Observaciones internas del cliente" /></Field>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b p-5 lg:p-6" style={{ borderColor: 'rgba(236,72,153,0.18)' }}>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.7fr)] xl:items-start">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmentación</p>
              <h2 className="mt-1 text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>Listado de clientes</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                {total} cliente(s) encontrado(s) · Origen: {activeSourceLabel} · Segmento: {activeSegmentLabel}
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-[22px] border px-4 py-3" style={{ borderColor: 'rgba(236,72,153,0.22)', background: 'rgba(255,255,255,0.78)' }}>
              <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-primary)' }} />
              <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar por nombre, celular, correo o documento" className="w-full bg-transparent text-sm font-bold outline-none" style={{ color: 'var(--admin-card-text)' }} />
              {loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-2">
            <SegmentPanel title="Origen del cliente">
              {SOURCE_FILTERS.map((filter) => <FilterPill key={filter.key} active={sourceFilter === filter.key} onClick={() => setSourceFilter(filter.key)}>{filter.label}</FilterPill>)}
            </SegmentPanel>
            <SegmentPanel title="Segmento comercial">
              {SEGMENT_FILTERS.map((filter) => <FilterPill key={filter.key} active={segmentFilter === filter.key} onClick={() => setSegmentFilter(filter.key)}>{filter.label}</FilterPill>)}
              {(sourceFilter !== 'all' || segmentFilter !== 'all' || searchTerm) ? <FilterPill active={false} onClick={resetFilters}>Limpiar filtros</FilterPill> : null}
            </SegmentPanel>
          </div>
        </div>

        <div className="p-5 lg:p-6">
          {loading ? (
            <div className="rounded-[28px] border p-10 text-center" style={{ borderColor: 'rgba(236,72,153,0.18)', background: 'rgba(255,255,255,0.68)' }}>
              <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Cargando clientes...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-[28px] border p-10 text-center" style={{ borderColor: 'rgba(236,72,153,0.18)', background: 'rgba(255,255,255,0.68)' }}>
              <UserRound className="mx-auto h-9 w-9" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>No hay clientes para este filtro</p>
              <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Cambia el filtro o crea un cliente nuevo.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {customers.map((customer) => <CustomerRow key={customer.id} customer={customer} />)}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
