// frontend/src/admin/customers/AdminCustomersPageEnhanced.jsx

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

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-3xl border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        boxShadow: 'var(--admin-shadow-sm, 0 8px 24px rgba(0,0,0,0.06))',
      }}
    >
      {children}
    </section>
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
      className={`w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none ${props.className || ''}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        ...(props.style || {}),
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`min-h-[92px] w-full resize-none rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none ${props.className || ''}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
        ...(props.style || {}),
      }}
    />
  );
}

function StatCard({ icon: Icon, label, value, helper }) {
  return (
    <div
      className="rounded-3xl border p-4"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
          style={{
            borderColor: 'var(--admin-primary-soft-border)',
            background: 'var(--admin-primary-soft-bg)',
            color: 'var(--admin-primary)',
          }}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-black" style={{ color: 'var(--admin-card-text)' }}>
            {value}
          </p>
          {helper ? (
            <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
              {helper}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FilterButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-4 py-2 text-xs font-black transition"
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

function Chip({ children, tone = 'default' }) {
  const isPrimary = tone === 'primary';
  const isSuccess = tone === 'success';

  return (
    <span
      className="rounded-full px-3 py-1 text-xs font-black"
      style={{
        background: isSuccess ? '#ecfdf5' : isPrimary ? 'var(--admin-primary-soft-bg)' : 'var(--admin-card-bg)',
        color: isSuccess ? '#047857' : isPrimary ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)',
      }}
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

  return (
    <div
      className="rounded-3xl border p-4 transition hover:-translate-y-0.5 lg:p-5"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(220px,0.9fr)_minmax(260px,0.95fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
              style={{
                borderColor: 'var(--admin-primary-soft-border)',
                background: 'var(--admin-primary-soft-bg)',
                color: 'var(--admin-primary)',
              }}
            >
              <UserRound className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-black" style={{ color: 'var(--admin-card-text)' }}>
                {customerName(customer)}
              </p>
              <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                {customer.customerCode || 'Sin código'} · creado {formatDate(customer.createdAt)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {customer.documentNumber ? <Chip tone="primary">{customer.documentType || 'DOC'} {customer.documentNumber}</Chip> : <Chip>Sin documento</Chip>}
            <Chip>{sourceLabel(customer.source)}</Chip>
            {hasPurchases ? <Chip tone="success">Cliente comprador</Chip> : <Chip>Sin compras</Chip>}
          </div>
        </div>

        <div className="space-y-2 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            <span className="truncate">{customer.phone || 'Sin celular'}</span>
          </p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="truncate">{customer.email || 'Sin correo'}</span>
          </p>
          <p className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" />
            <span className="truncate">Última compra: {stats.lastPurchaseAt ? formatDate(stats.lastPurchaseAt) : 'sin registro'}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border p-3 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Compras</p>
            <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{ordersCount}</p>
          </div>
          <div className="rounded-2xl border p-3 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>POS</p>
            <p className="mt-1 text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>{Number(stats.posOrdersCount || 0)}</p>
          </div>
          <div className="rounded-2xl border p-3 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Gastado</p>
            <p className="mt-1 truncate text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{money(totalSpent)}</p>
          </div>
        </div>
      </div>
    </div>
  );
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
    acc.totalSpent += totalSpent;
    return acc;
  }, {
    totalCustomers: Number(total || customers.length),
    posCustomers: 0,
    webCustomers: 0,
    withPurchases: 0,
    withEmail: 0,
    totalSpent: 0,
    newestCustomer: customers[0] || null,
  });
}

export default function AdminCustomersPageEnhanced() {
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

  const activeFilterLabel = useMemo(() => {
    const source = SOURCE_FILTERS.find((item) => item.key === sourceFilter)?.label || 'Todos';
    const segment = SEGMENT_FILTERS.find((item) => item.key === segmentFilter)?.label || 'Todos';
    return `${source} · ${segment}`;
  }, [sourceFilter, segmentFilter]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
          >
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--admin-card-text)' }}>Clientes</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              CRM básico para clientes POS, pedidos web y seguimiento comercial.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadCustomers(searchTerm, sourceFilter, segmentFilter)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar
          </button>
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white"
            style={{ background: 'var(--admin-primary)' }}
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

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

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={UsersRound} label="Total clientes" value={safeSummary.totalCustomers || 0} helper={`${safeSummary.withEmail || 0} con correo`} />
        <StatCard icon={ShoppingBag} label="Clientes POS" value={safeSummary.posCustomers || 0} helper="Creados desde punto de venta" />
        <StatCard icon={BarChart3} label="Clientes web" value={safeSummary.webCustomers || 0} helper="Pedidos tienda virtual" />
        <StatCard icon={BadgeCheck} label="Con compras" value={safeSummary.withPurchases || 0} helper={`${safeSummary.totalOrders || 0} compras acumuladas`} />
        <StatCard icon={DollarSign} label="Ventas clientes" value={money(safeSummary.totalSpent)} helper={safeSummary.newestCustomer ? `Último: ${customerName(safeSummary.newestCustomer)}` : 'Sin cliente reciente'} />
      </div>

      {showForm ? (
        <Card className="p-5">
          <form className="space-y-4" onSubmit={handleCreateCustomer}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Crear cliente</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Este cliente quedará disponible para seleccionarlo en el POS.</p>
              </div>
              <button
                type="submit"
                disabled={!canSave}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: 'var(--admin-primary)' }}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Nombre completo"><TextInput value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Nombre del cliente" /></Field>
              <Field label="Celular"><TextInput value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="3000000000" /></Field>
              <Field label="Tipo documento">
                <select
                  value={form.documentType}
                  onChange={(event) => updateForm('documentType', event.target.value)}
                  className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none"
                  style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="TI">TI</option>
                  <option value="NIT">NIT</option>
                  <option value="PP">Pasaporte</option>
                  <option value="OTHER">Otro</option>
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
        <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Listado de clientes</h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                {total} cliente(s) encontrado(s). Filtro: {activeFilterLabel}.
              </p>
            </div>
            <div
              className="flex min-w-full items-center gap-3 rounded-2xl border px-4 py-3 xl:min-w-[420px]"
              style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
            >
              <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar por nombre, celular, correo o documento"
                className="w-full bg-transparent text-sm font-semibold outline-none"
                style={{ color: 'var(--admin-card-text)' }}
              />
              {loading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}
            </div>
          </div>

          <div className="mt-5 space-y-3">
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Origen</p>
              <div className="flex flex-wrap gap-2">
                {SOURCE_FILTERS.map((filter) => <FilterButton key={filter.key} active={sourceFilter === filter.key} onClick={() => setSourceFilter(filter.key)}>{filter.label}</FilterButton>)}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmento</p>
              <div className="flex flex-wrap gap-2">
                {SEGMENT_FILTERS.map((filter) => <FilterButton key={filter.key} active={segmentFilter === filter.key} onClick={() => setSegmentFilter(filter.key)}>{filter.label}</FilterButton>)}
                {(sourceFilter !== 'all' || segmentFilter !== 'all' || searchTerm) ? <FilterButton active={false} onClick={resetFilters}>Limpiar filtros</FilterButton> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
              <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Cargando clientes...</p>
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
              <UserRound className="mx-auto h-9 w-9" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>No hay clientes para este filtro</p>
              <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Cambia el filtro o crea un cliente nuevo.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => <CustomerRow key={customer.id} customer={customer} />)}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
