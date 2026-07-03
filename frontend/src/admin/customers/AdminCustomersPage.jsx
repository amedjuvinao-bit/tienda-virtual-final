// frontend/src/admin/customers/AdminCustomersPage.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BadgeCheck,
  Loader2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  UserRound,
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

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border ${className}`}
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

function CustomerRow({ customer }) {
  return (
    <div
      className="grid gap-4 rounded-2xl border p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.8fr)_minmax(160px,0.7fr)] lg:items-center"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
            style={{
              borderColor: 'var(--admin-primary-soft-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-primary)',
            }}
          >
            <UserRound className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
              {customer.fullName || customer.displayName || 'Cliente sin nombre'}
            </p>
            <p className="mt-1 truncate text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
              {customer.customerCode || 'Sin código'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          {customer.phone || 'Sin celular'}
        </p>
        <p className="flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {customer.email || 'Sin correo'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 lg:justify-end">
        {customer.documentNumber ? (
          <span
            className="rounded-full px-3 py-1 text-xs font-black"
            style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
          >
            {customer.documentType || 'DOC'} {customer.documentNumber}
          </span>
        ) : null}
        <span
          className="rounded-full px-3 py-1 text-xs font-black"
          style={{ background: 'var(--admin-card-bg)', color: 'var(--admin-card-muted-text)' }}
        >
          {customer.source || 'admin'}
        </span>
      </div>
    </div>
  );
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const canSave = useMemo(() => {
    return cleanText(form.fullName).length >= 3 && !saving;
  }, [form.fullName, saving]);

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const loadCustomers = async (q = searchTerm) => {
    try {
      setLoading(true);
      setError('');
      const data = await getAdminCustomers({
        q,
        status: 'active',
        source: 'all',
        page: 1,
        limit: 30,
      });

      setCustomers(Array.isArray(data?.customers) ? data.customers : []);
      setTotal(Number(data?.total || 0));
    } catch (err) {
      setError(err?.message || 'No fue posible cargar los clientes.');
      setCustomers([]);
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
    } catch (err) {
      setError(err?.message || 'No fue posible crear el cliente.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadCustomers(searchTerm);
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  return (
    <div className="min-h-full space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border"
            style={{
              borderColor: 'var(--admin-primary-soft-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-primary)',
            }}
          >
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--admin-card-text)' }}>
              Clientes
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
              Administra clientes para ventas POS, pedidos web y seguimiento comercial.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => loadCustomers(searchTerm)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: 'var(--admin-primary-soft-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-primary)',
            }}
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
          <div>
            <p className="font-black">Error</p>
            <p className="mt-1">{error}</p>
          </div>
        </div>
      ) : null}

      {success ? (
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Listo</p>
            <p className="mt-1">{success}</p>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <Card className="p-5">
          <form className="space-y-4" onSubmit={handleCreateCustomer}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                  Crear cliente
                </h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Este cliente quedará disponible para seleccionarlo en el POS.
                </p>
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
              <Field label="Nombre completo">
                <TextInput value={form.fullName} onChange={(event) => updateForm('fullName', event.target.value)} placeholder="Nombre del cliente" />
              </Field>
              <Field label="Celular">
                <TextInput value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} placeholder="3000000000" />
              </Field>
              <Field label="Tipo documento">
                <select
                  value={form.documentType}
                  onChange={(event) => updateForm('documentType', event.target.value)}
                  className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none"
                  style={{
                    borderColor: 'var(--admin-card-border)',
                    background: 'var(--admin-card-bg)',
                    color: 'var(--admin-card-text)',
                  }}
                >
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="TI">TI</option>
                  <option value="NIT">NIT</option>
                  <option value="PP">Pasaporte</option>
                  <option value="OTHER">Otro</option>
                </select>
              </Field>
              <Field label="Documento">
                <TextInput value={form.documentNumber} onChange={(event) => updateForm('documentNumber', event.target.value)} placeholder="Número" />
              </Field>
              <Field label="Correo">
                <TextInput value={form.email} onChange={(event) => updateForm('email', event.target.value)} placeholder="correo@ejemplo.com" />
              </Field>
              <Field label="Dirección">
                <TextInput value={form.address} onChange={(event) => updateForm('address', event.target.value)} placeholder="Dirección" />
              </Field>
              <Field label="Ciudad">
                <TextInput value={form.city} onChange={(event) => updateForm('city', event.target.value)} placeholder="Ciudad" />
              </Field>
              <Field label="Departamento">
                <TextInput value={form.department} onChange={(event) => updateForm('department', event.target.value)} placeholder="Departamento" />
              </Field>
            </div>

            <Field label="Notas">
              <TextArea value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} placeholder="Observaciones internas del cliente" />
            </Field>
          </form>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>
                Listado de clientes
              </h2>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                {total} cliente(s) encontrado(s).
              </p>
            </div>
            <div
              className="flex min-w-full items-center gap-3 rounded-2xl border px-4 py-3 lg:min-w-[420px]"
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
        </div>

        <div className="p-5">
          {loading ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
              <Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                Cargando clientes...
              </p>
            </div>
          ) : customers.length === 0 ? (
            <div className="rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
              <UserRound className="mx-auto h-9 w-9" style={{ color: 'var(--admin-primary)' }} />
              <p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>
                No hay clientes registrados
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                Crea clientes desde este módulo o desde el POS cuando hagamos la conexión.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {customers.map((customer) => (
                <CustomerRow key={customer.id} customer={customer} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
