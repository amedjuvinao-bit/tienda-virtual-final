// frontend/src/admin/coupons/AdminCouponsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useAppConfirm } from '../../components/AppConfirmProvider';
import {
  changeAdminCouponStatus,
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  updateAdminCoupon,
} from './api/adminCouponsApi';

const TYPE_OPTIONS = [
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'fixed', label: 'Valor fijo' },
  { value: 'free_shipping', label: 'Envío gratis' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Activo' },
  { value: 'draft', label: 'Borrador' },
  { value: 'inactive', label: 'Inactivo' },
  { value: 'expired', label: 'Vencido' },
];

const APPLIES_TO_OPTIONS = [
  { value: 'all', label: 'Todos los productos' },
  { value: 'categories', label: 'Categorías' },
  { value: 'products', label: 'Productos específicos' },
];

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  type: 'percentage',
  value: '10',
  maxDiscountAmount: '',
  minSubtotal: '0',
  status: 'active',
  active: true,
  startsAt: '',
  endsAt: '',
  usageLimit: '',
  perCustomerLimit: '',
  appliesTo: 'all',
  categoriesText: '',
  excludedCategoriesText: '',
  tagsText: '',
  internalNotes: '',
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return date.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

function toInputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function splitTextList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function joinTextList(values) {
  return Array.isArray(values) ? values.filter(Boolean).join(', ') : '';
}

function normalizeNumber(value, fallback = 0) {
  if (value === '' || value === null || value === undefined) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function nullableNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function getTypeLabel(type) {
  return TYPE_OPTIONS.find((option) => option.value === type)?.label || type || 'Cupón';
}

function getStatusLabel(status) {
  const labels = {
    active: 'Activo',
    inactive: 'Inactivo',
    draft: 'Borrador',
    expired: 'Vencido',
    scheduled: 'Programado',
    exhausted: 'Agotado',
    deleted: 'Eliminado',
  };
  return labels[status] || status || 'Sin estado';
}

function buildFormFromCoupon(coupon = {}) {
  return {
    code: coupon.code || '',
    name: coupon.name || '',
    description: coupon.description || '',
    type: coupon.type || 'percentage',
    value: coupon.type === 'free_shipping' ? '0' : String(coupon.value ?? ''),
    maxDiscountAmount: coupon.maxDiscountAmount == null ? '' : String(coupon.maxDiscountAmount),
    minSubtotal: String(coupon.minSubtotal ?? 0),
    status: coupon.status || 'active',
    active: coupon.active !== false,
    startsAt: toInputDateTime(coupon.startsAt),
    endsAt: toInputDateTime(coupon.endsAt),
    usageLimit: coupon.usageLimit == null ? '' : String(coupon.usageLimit),
    perCustomerLimit: coupon.perCustomerLimit == null ? '' : String(coupon.perCustomerLimit),
    appliesTo: coupon.appliesTo || 'all',
    categoriesText: joinTextList(coupon.categories),
    excludedCategoriesText: joinTextList(coupon.excludedCategories),
    tagsText: joinTextList(coupon.tags),
    internalNotes: coupon.internalNotes || '',
  };
}

function buildPayloadFromForm(form) {
  const type = form.type || 'percentage';
  return {
    code: String(form.code || '').trim().toUpperCase().replace(/\s+/g, ''),
    name: String(form.name || '').trim(),
    description: String(form.description || '').trim(),
    type,
    value: type === 'free_shipping' ? 0 : normalizeNumber(form.value, 0),
    maxDiscountAmount: nullableNumber(form.maxDiscountAmount),
    minSubtotal: normalizeNumber(form.minSubtotal, 0),
    status: form.status || 'active',
    active: form.active !== false,
    startsAt: form.startsAt || null,
    endsAt: form.endsAt || null,
    usageLimit: nullableNumber(form.usageLimit),
    perCustomerLimit: nullableNumber(form.perCustomerLimit),
    appliesTo: form.appliesTo || 'all',
    categories: splitTextList(form.categoriesText),
    excludedCategories: splitTextList(form.excludedCategoriesText),
    tags: splitTextList(form.tagsText),
    internalNotes: String(form.internalNotes || '').trim(),
  };
}

function StatCard({ label, value, helper }) {
  return (
    <div
      className="rounded-3xl border p-4"
      style={{
        background: 'var(--admin-card-bg)',
        borderColor: 'var(--admin-card-border)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        {label}
      </p>
      <p className="mt-2 text-2xl font-black" style={{ color: 'var(--admin-card-text)' }}>{value}</p>
      {helper ? <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</p> : null}
    </div>
  );
}

function Field({ label, children, helper }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>
        {label}
      </span>
      {children}
      {helper ? <span className="mt-1 block text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</span> : null}
    </label>
  );
}

const inputStyle = {
  width: '100%',
  minHeight: 42,
  borderRadius: 'calc(var(--admin-radius) * 0.55)',
  border: '1px solid var(--admin-card-border)',
  background: 'var(--admin-card-bg)',
  color: 'var(--admin-card-text)',
  outline: 'none',
  padding: '0 13px',
  fontSize: 13,
  fontWeight: 700,
};

const textAreaStyle = {
  ...inputStyle,
  minHeight: 78,
  padding: '10px 13px',
  resize: 'vertical',
};

export default function AdminCouponsPage() {
  const confirm = useAppConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const stats = useMemo(() => {
    const active = rows.filter((coupon) => coupon.effectiveStatus === 'active').length;
    const scheduled = rows.filter((coupon) => coupon.effectiveStatus === 'scheduled').length;
    const exhausted = rows.filter((coupon) => coupon.effectiveStatus === 'exhausted').length;
    const totalUses = rows.reduce((sum, coupon) => sum + Number(coupon.usageCount || 0), 0);
    return { active, scheduled, exhausted, totalUses };
  }, [rows]);

  const loadCoupons = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await fetchAdminCoupons({ q, type: typeFilter, status: statusFilter, limit: 80 });
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudieron cargar los cupones.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewForm = () => {
    setEditingId('');
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setError('');
  };

  const openEditForm = (coupon) => {
    setEditingId(String(coupon?._id || coupon?.id || ''));
    setForm(buildFormFromCoupon(coupon));
    setFormOpen(true);
    setError('');
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId('');
    setForm(EMPTY_FORM);
  };

  const patchForm = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'type' && value === 'free_shipping') next.value = '0';
      if (field === 'status') next.active = value === 'active';
      if (field === 'active') next.status = value ? 'active' : 'inactive';
      return next;
    });
  };

  const handleSave = async (event) => {
    event.preventDefault();
    const payload = buildPayloadFromForm(form);

    if (!payload.code || payload.code.length < 3) {
      setError('El código del cupón debe tener mínimo 3 caracteres.');
      return;
    }

    if (payload.type !== 'free_shipping' && payload.value <= 0) {
      setError('El valor del cupón debe ser mayor que cero.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      if (editingId) {
        await updateAdminCoupon(editingId, payload);
      } else {
        await createAdminCoupon(payload);
      }
      closeForm();
      await loadCoupons();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudo guardar el cupón.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (coupon) => {
    const id = coupon?._id || coupon?.id;
    if (!id) return;
    const isActive = coupon?.active !== false && coupon?.effectiveStatus === 'active';
    const accepted = await confirm({
      title: isActive ? 'Desactivar cupón' : 'Activar cupón',
      message: isActive
        ? `¿Deseas desactivar el cupón ${coupon.code}?`
        : `¿Deseas activar el cupón ${coupon.code}?`,
      confirmLabel: isActive ? 'Desactivar' : 'Activar',
      cancelLabel: 'Cancelar',
      tone: isActive ? 'danger' : 'info',
    });
    if (!accepted) return;

    try {
      setError('');
      await changeAdminCouponStatus(id, {
        active: !isActive,
        status: isActive ? 'inactive' : 'active',
      });
      await loadCoupons();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudo cambiar el estado del cupón.');
    }
  };

  const handleDelete = async (coupon) => {
    const id = coupon?._id || coupon?.id;
    if (!id) return;
    const accepted = await confirm({
      title: 'Eliminar cupón',
      message: `¿Seguro que deseas eliminar el cupón ${coupon.code}? Esta acción lo ocultará del panel y no se podrá usar en checkout.`,
      confirmLabel: 'Sí, eliminar',
      cancelLabel: 'Cancelar',
      tone: 'danger',
    });
    if (!accepted) return;

    try {
      setError('');
      await deleteAdminCoupon(id);
      await loadCoupons();
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudo eliminar el cupón.');
    }
  };

  return (
    <div className="space-y-5" style={{ color: 'var(--admin-card-text)' }}>
      <div
        className="overflow-hidden rounded-[calc(var(--admin-radius)*0.9)] border"
        style={{
          borderColor: 'var(--admin-card-border)',
          background: 'linear-gradient(135deg, var(--admin-card-bg), color-mix(in srgb, var(--admin-card-bg) 82%, var(--admin-primary) 18%))',
        }}
      >
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: 'var(--admin-primary)' }}>
              promociones
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-tight">Cupones</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
              Crea descuentos, envío gratis, límites de uso y vigencias para el checkout de la tienda.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadCoupons}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-black transition hover:scale-[1.01] disabled:opacity-60"
              style={{
                borderColor: 'var(--admin-card-border)',
                background: 'var(--admin-card-bg)',
                color: 'var(--admin-card-text)',
              }}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Recargar
            </button>
            <button
              type="button"
              onClick={openNewForm}
              className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white transition hover:scale-[1.01]"
              style={{ background: 'var(--admin-primary)' }}
            >
              <Plus className="h-4 w-4" />
              Nuevo cupón
            </button>
          </div>
        </div>

        <div className="grid gap-3 border-t p-5 md:grid-cols-4" style={{ borderColor: 'var(--admin-card-border)' }}>
          <StatCard label="Activos" value={stats.active} helper="Disponibles en checkout" />
          <StatCard label="Programados" value={stats.scheduled} helper="Con fecha futura" />
          <StatCard label="Agotados" value={stats.exhausted} helper="Sin usos restantes" />
          <StatCard label="Usos totales" value={stats.totalUses} helper="Redenciones registradas" />
        </div>
      </div>

      {error ? (
        <div
          className="rounded-2xl border px-4 py-3 text-sm font-bold"
          style={{
            borderColor: 'color-mix(in srgb, var(--admin-danger, #dc2626) 45%, var(--admin-card-border))',
            background: 'color-mix(in srgb, var(--admin-danger, #dc2626) 9%, var(--admin-card-bg))',
            color: 'var(--admin-card-text)',
          }}
        >
          {error}
        </div>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={handleSave}
          className="rounded-[calc(var(--admin-radius)*0.9)] border p-5"
          style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)' }}
        >
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>
                {editingId ? 'editar cupón' : 'nuevo cupón'}
              </p>
              <h2 className="mt-1 text-xl font-black">{editingId ? form.code || 'Cupón' : 'Crear promoción'}</h2>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-black"
              style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <Field label="Código">
              <input style={inputStyle} value={form.code} onChange={(e) => patchForm('code', e.target.value.toUpperCase())} placeholder="ROSAPRUEBA10" />
            </Field>
            <Field label="Nombre">
              <input style={inputStyle} value={form.name} onChange={(e) => patchForm('name', e.target.value)} placeholder="10% lanzamiento" />
            </Field>
            <Field label="Tipo">
              <select style={inputStyle} value={form.type} onChange={(e) => patchForm('type', e.target.value)}>
                {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Valor" helper={form.type === 'percentage' ? 'Porcentaje 1 a 100' : form.type === 'fixed' ? 'Valor en pesos' : 'No aplica'}>
              <input
                style={inputStyle}
                type="number"
                min="0"
                max={form.type === 'percentage' ? '100' : undefined}
                value={form.type === 'free_shipping' ? '0' : form.value}
                disabled={form.type === 'free_shipping'}
                onChange={(e) => patchForm('value', e.target.value)}
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <Field label="Compra mínima">
              <input style={inputStyle} type="number" min="0" value={form.minSubtotal} onChange={(e) => patchForm('minSubtotal', e.target.value)} />
            </Field>
            <Field label="Tope descuento">
              <input style={inputStyle} type="number" min="0" value={form.maxDiscountAmount} onChange={(e) => patchForm('maxDiscountAmount', e.target.value)} placeholder="Opcional" />
            </Field>
            <Field label="Límite total usos">
              <input style={inputStyle} type="number" min="0" value={form.usageLimit} onChange={(e) => patchForm('usageLimit', e.target.value)} placeholder="Sin límite" />
            </Field>
            <Field label="Límite por cliente">
              <input style={inputStyle} type="number" min="0" value={form.perCustomerLimit} onChange={(e) => patchForm('perCustomerLimit', e.target.value)} placeholder="Sin límite" />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-4">
            <Field label="Estado">
              <select style={inputStyle} value={form.status} onChange={(e) => patchForm('status', e.target.value)}>
                {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Aplicar a">
              <select style={inputStyle} value={form.appliesTo} onChange={(e) => patchForm('appliesTo', e.target.value)}>
                {APPLIES_TO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label="Inicio">
              <input style={inputStyle} type="datetime-local" value={form.startsAt} onChange={(e) => patchForm('startsAt', e.target.value)} />
            </Field>
            <Field label="Vence">
              <input style={inputStyle} type="datetime-local" value={form.endsAt} onChange={(e) => patchForm('endsAt', e.target.value)} />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Categorías incluidas" helper="Separadas por coma. Útil si aplica a categorías.">
              <input style={inputStyle} value={form.categoriesText} onChange={(e) => patchForm('categoriesText', e.target.value)} placeholder="Vestidos largos, Bebé" />
            </Field>
            <Field label="Categorías excluidas">
              <input style={inputStyle} value={form.excludedCategoriesText} onChange={(e) => patchForm('excludedCategoriesText', e.target.value)} placeholder="Ofertas, Liquidación" />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Descripción">
              <textarea style={textAreaStyle} value={form.description} onChange={(e) => patchForm('description', e.target.value)} placeholder="Texto visible o referencia interna del cupón" />
            </Field>
            <Field label="Notas internas">
              <textarea style={textAreaStyle} value={form.internalNotes} onChange={(e) => patchForm('internalNotes', e.target.value)} placeholder="Observaciones para administración" />
            </Field>
          </div>

          <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="inline-flex items-center gap-3 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => patchForm('active', e.target.checked)}
                style={{ accentColor: 'var(--admin-primary)' }}
              />
              Cupón activo para checkout
            </label>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white disabled:opacity-60"
              style={{ background: 'var(--admin-primary)' }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Guardando...' : 'Guardar cupón'}
            </button>
          </div>
        </form>
      ) : null}

      <div
        className="rounded-[calc(var(--admin-radius)*0.9)] border"
        style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)' }}
      >
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
              style={{ color: 'var(--admin-card-text)' }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadCoupons(); }}
              placeholder="Buscar por código, nombre o descripción"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select style={{ ...inputStyle, width: 170 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select style={{ ...inputStyle, width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button
              type="button"
              onClick={loadCoupons}
              className="rounded-2xl px-4 py-2 text-sm font-black text-white"
              style={{ background: 'var(--admin-primary)' }}
            >
              Filtrar
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando cupones...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <BadgePercent className="mx-auto h-10 w-10" style={{ color: 'var(--admin-primary)' }} />
            <p className="mt-3 text-lg font-black">No hay cupones registrados</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
              Crea el primer cupón para usarlo en checkout.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr style={{ color: 'var(--admin-card-muted-text)' }}>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Cupón</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Tipo</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Reglas</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Vigencia</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em]">Usos</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.14em] text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((coupon) => {
                  const id = coupon._id || coupon.id;
                  const isActive = coupon.active !== false && coupon.effectiveStatus === 'active';
                  const usageLimit = coupon.usageLimit == null ? 'Sin límite' : Number(coupon.usageLimit || 0).toLocaleString('es-CO');
                  return (
                    <tr key={id || coupon.code} style={{ borderTop: '1px solid var(--admin-card-border)' }}>
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>
                            <BadgePercent className="h-4 w-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="font-black" style={{ color: 'var(--admin-card-text)' }}>{coupon.code}</p>
                            <p className="mt-0.5 truncate text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                              {coupon.name || coupon.description || 'Sin nombre'}
                            </p>
                            <span className="mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]" style={{ borderColor: 'var(--admin-primary-soft-border)', color: 'var(--admin-primary)', background: 'var(--admin-primary-soft-bg)' }}>
                              {getStatusLabel(coupon.effectiveStatus)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black">{getTypeLabel(coupon.type)}</p>
                        <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                          {coupon.type === 'percentage'
                            ? `${Number(coupon.value || 0)}%`
                            : coupon.type === 'fixed'
                              ? formatMoney(coupon.value)
                              : 'Descuenta el envío'}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold">Mínimo: {formatMoney(coupon.minSubtotal)}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                          Aplica: {APPLIES_TO_OPTIONS.find((option) => option.value === coupon.appliesTo)?.label || coupon.appliesTo}
                        </p>
                        {coupon.maxDiscountAmount ? (
                          <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                            Tope: {formatMoney(coupon.maxDiscountAmount)}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-bold">Desde: {formatDate(coupon.startsAt)}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                          Hasta: {formatDate(coupon.endsAt)}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-black">{Number(coupon.usageCount || 0).toLocaleString('es-CO')} / {usageLimit}</p>
                        <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                          Por cliente: {coupon.perCustomerLimit == null ? 'Sin límite' : coupon.perCustomerLimit}
                        </p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditForm(coupon)}
                            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black"
                            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(coupon)}
                            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black"
                            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {isActive ? 'Desactivar' : 'Activar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(coupon)}
                            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-black text-white"
                            style={{ background: 'var(--admin-danger, #be123c)' }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
