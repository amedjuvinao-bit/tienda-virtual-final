// frontend/src/admin/coupons/AdminCouponsPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BadgePercent,
  Calculator,
  Loader2,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { useAppConfirm } from '../../components/AppConfirmProvider';
import {
  changeAdminCouponStatus,
  createAdminCoupon,
  deleteAdminCoupon,
  fetchAdminCoupons,
  fetchCouponCampaignMetadata,
  simulateAdminCoupon,
  updateAdminCoupon,
} from './api/adminCouponsApi';

const PUBLIC_CODE_PREFIX = 'CUP';
const SAFE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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

const FILTER_STATUS_OPTIONS = [
  { value: 'active', label: 'Activos' },
  { value: 'scheduled', label: 'Programados' },
  { value: 'exhausted', label: 'Agotados' },
  { value: 'expired', label: 'Vencidos' },
  { value: 'inactive', label: 'Inactivos' },
  { value: 'draft', label: 'Borradores' },
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
  productIds: [],
  excludedProductIds: [],
  categories: [],
  excludedCategories: [],
  customerIds: [],
  newCustomersOnly: false,
  allowedChannels: ['web', 'pos'],
  branchIds: [],
  allowWithStoreCredit: true,
  allowWithManualDiscount: false,
  allowWithAutomaticPromotions: false,
  tagsText: '',
  internalNotes: '',
  simulationProductId: '',
  simulationQuantity: '1',
  simulationShipping: '0',
  simulationCustomerId: '',
  simulationChannel: 'web',
  simulationBranchId: '',
  simulationStoreCredit: '0',
  simulationManualDiscount: '0',
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

function getCryptoNumber() {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    window.crypto.getRandomValues(buffer);
    return buffer[0];
  }
  return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}

function randomSafeChunk(length = 4) {
  return Array.from({ length }, () => {
    const index = getCryptoNumber() % SAFE_CODE_ALPHABET.length;
    return SAFE_CODE_ALPHABET[index];
  }).join('');
}

function buildSecureCouponCode(coupons = []) {
  const existingCodes = new Set(
    (Array.isArray(coupons) ? coupons : [])
      .map((coupon) => String(coupon?.code || '').trim().toUpperCase())
      .filter(Boolean)
  );

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const candidate = `${PUBLIC_CODE_PREFIX}-${randomSafeChunk(4)}-${randomSafeChunk(4)}`;
    if (!existingCodes.has(candidate)) return candidate;
  }

  const fallback = Date.now().toString(36).toUpperCase().slice(-6);
  return `${PUBLIC_CODE_PREFIX}-${fallback}-${randomSafeChunk(3)}`;
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
    productIds: (coupon.productIds || []).map(String),
    excludedProductIds: (coupon.excludedProductIds || []).map(String),
    categories: Array.isArray(coupon.categories) ? coupon.categories : [],
    excludedCategories: Array.isArray(coupon.excludedCategories) ? coupon.excludedCategories : [],
    customerIds: (coupon.customerIds || []).map(String),
    newCustomersOnly: coupon.newCustomersOnly === true,
    allowedChannels: Array.isArray(coupon.allowedChannels) && coupon.allowedChannels.length ? coupon.allowedChannels : ['web', 'pos'],
    branchIds: (coupon.branchIds || []).map(String),
    allowWithStoreCredit: coupon.allowWithStoreCredit !== false,
    allowWithManualDiscount: coupon.allowWithManualDiscount === true,
    allowWithAutomaticPromotions: coupon.allowWithAutomaticPromotions === true,
    tagsText: joinTextList(coupon.tags),
    internalNotes: coupon.internalNotes || '',
    simulationProductId: '',
    simulationQuantity: '1',
    simulationShipping: '0',
    simulationCustomerId: '',
    simulationChannel: 'web',
    simulationBranchId: '',
    simulationStoreCredit: '0',
    simulationManualDiscount: '0',
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
    productIds: form.productIds || [],
    excludedProductIds: form.excludedProductIds || [],
    categories: form.categories || [],
    excludedCategories: form.excludedCategories || [],
    customerIds: form.customerIds || [],
    newCustomersOnly: form.newCustomersOnly === true,
    allowedChannels: form.allowedChannels || [],
    branchIds: form.branchIds || [],
    allowWithStoreCredit: form.allowWithStoreCredit !== false,
    allowWithManualDiscount: form.allowWithManualDiscount === true,
    allowWithAutomaticPromotions: form.allowWithAutomaticPromotions === true,
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

function ChoiceChecklist({ options = [], values = [], onChange, empty = 'No hay opciones disponibles.' }) {
  const selected = new Set((values || []).map(String));
  const toggle = (value) => {
    const key = String(value);
    onChange(selected.has(key)
      ? (values || []).filter((item) => String(item) !== key)
      : [...(values || []), key]);
  };

  return (
    <div className="max-h-44 space-y-2 overflow-y-auto rounded-2xl border p-3 admin-thin-scrollbar" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
      {options.length === 0 ? <p className="text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{empty}</p> : options.map((option) => (
        <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 text-xs font-bold hover:bg-black/5">
          <input type="checkbox" checked={selected.has(String(option.value))} onChange={() => toggle(option.value)} style={{ accentColor: 'var(--admin-primary)' }} />
          <span className="min-w-0"><span className="block truncate">{option.label}</span>{option.helper ? <span className="block truncate text-[10px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{option.helper}</span> : null}</span>
        </label>
      ))}
    </div>
  );
}

function ToggleRule({ checked, onChange, label, helper }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} style={{ accentColor: 'var(--admin-primary)' }} />
      <span><span className="block text-xs font-black">{label}</span><span className="mt-1 block text-[11px] font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>{helper}</span></span>
    </label>
  );
}

function CouponFormModal({
  open,
  editingId,
  form,
  saving,
  patchForm,
  closeForm,
  handleSave,
  handleGenerateCode,
  metadata,
  simulating,
  simulation,
  handleSimulate,
}) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') closeForm?.();
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, closeForm]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9990] flex min-h-screen items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[4px]"
        onClick={closeForm}
        aria-label="Cerrar formulario de cupón"
      />

      <form
        onSubmit={handleSave}
        className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[32px] border shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 94%, var(--admin-primary) 6%), var(--admin-card-bg))',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
          boxShadow: '0 36px 120px rgba(0,0,0,0.35)',
        }}
      >
        <div
          className="flex items-start justify-between gap-4 border-b px-6 py-5"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--admin-primary)' }}>
              {editingId ? 'editar cupón' : 'nuevo cupón'}
            </p>
            <h2 className="mt-1 text-2xl font-black leading-tight">
              {editingId ? form.code || 'Cupón' : 'Crear promoción'}
            </h2>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
              Configura descuento, vigencia y límites sin mover la página principal.
            </p>
          </div>

          <button
            type="button"
            onClick={closeForm}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full border transition hover:-translate-y-0.5"
            style={{
              borderColor: 'var(--admin-card-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-card-text)',
            }}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 admin-thin-scrollbar">
          <div
            className="mb-4 flex items-start gap-3 rounded-3xl border p-4"
            style={{
              borderColor: 'var(--admin-card-border)',
              background: 'var(--admin-primary-soft-bg)',
              color: 'var(--admin-card-text)',
            }}
          >
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" style={{ color: 'var(--admin-primary)' }} />
            <div>
              <p className="text-sm font-black">Código público seguro</p>
              <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>
                El botón Auto genera un código aleatorio no consecutivo para evitar que clientes lo adivinen probando números.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-4">
            <Field
              label="Código público"
              helper={editingId ? 'Puedes conservar o ajustar el código actual.' : 'Aleatorio seguro. Ejemplo: CUP-7K9X-P2Q4.'}
            >
              <div className="flex gap-2">
                <input
                  style={inputStyle}
                  value={form.code}
                  onChange={(e) => patchForm('code', e.target.value.toUpperCase())}
                  placeholder="CUP-7K9X-P2Q4"
                />
                {!editingId ? (
                  <button
                    type="button"
                    onClick={handleGenerateCode}
                    className="inline-flex shrink-0 items-center gap-2 rounded-[calc(var(--admin-radius)*0.55)] border px-3 text-xs font-black transition hover:-translate-y-0.5"
                    style={{
                      borderColor: 'var(--admin-card-border)',
                      background: 'var(--admin-primary-soft-bg)',
                      color: 'var(--admin-primary)',
                    }}
                    title="Generar código público aleatorio"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Auto
                  </button>
                ) : null}
              </div>
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

          <div className="mt-5 rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}>
            <h3 className="text-sm font-black">Alcance de productos y categorías</h3>
            <p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>Las inclusiones definen dónde aplica; las exclusiones siempre tienen prioridad.</p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {form.appliesTo === 'products' ? (
                <Field label="Productos incluidos" helper={`${form.productIds.length} seleccionado(s)`}>
                  <ChoiceChecklist
                    options={(metadata.products || []).map((product) => ({ value: product.id, label: product.title, helper: [product.sku, product.category].filter(Boolean).join(' · ') }))}
                    values={form.productIds}
                    onChange={(value) => patchForm('productIds', value)}
                  />
                </Field>
              ) : null}
              {form.appliesTo === 'categories' ? (
                <Field label="Categorías incluidas" helper={`${form.categories.length} seleccionada(s)`}>
                  <ChoiceChecklist options={(metadata.categories || []).map((category) => ({ value: category, label: category }))} values={form.categories} onChange={(value) => patchForm('categories', value)} />
                </Field>
              ) : null}
              <Field label="Productos excluidos" helper={`${form.excludedProductIds.length} seleccionado(s)`}>
                <ChoiceChecklist
                  options={(metadata.products || []).map((product) => ({ value: product.id, label: product.title, helper: product.sku || product.category }))}
                  values={form.excludedProductIds}
                  onChange={(value) => patchForm('excludedProductIds', value)}
                />
              </Field>
              <Field label="Categorías excluidas" helper={`${form.excludedCategories.length} seleccionada(s)`}>
                <ChoiceChecklist options={(metadata.categories || []).map((category) => ({ value: category, label: category }))} values={form.excludedCategories} onChange={(value) => patchForm('excludedCategories', value)} />
              </Field>
            </div>
          </div>

          <div className="mt-5 rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
            <h3 className="text-sm font-black">Clientes, canales y sedes</h3>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              <Field label="Clientes permitidos" helper="Vacío significa todos los clientes.">
                <ChoiceChecklist
                  options={(metadata.customers || []).map((customer) => ({ value: customer.id, label: customer.name, helper: [customer.customerCode, customer.documentNumber, `${customer.ordersCount} compra(s)`].filter(Boolean).join(' · ') }))}
                  values={form.customerIds}
                  onChange={(value) => patchForm('customerIds', value)}
                />
              </Field>
              <Field label="Canales habilitados" helper="Selecciona al menos uno.">
                <ChoiceChecklist
                  options={[{ value: 'web', label: 'Tienda virtual / Checkout' }, { value: 'pos', label: 'POS / Venta física' }]}
                  values={form.allowedChannels}
                  onChange={(value) => patchForm('allowedChannels', value)}
                />
              </Field>
              <Field label="Sedes permitidas" helper="Vacío significa todas las sedes.">
                <ChoiceChecklist
                  options={(metadata.branches || []).map((branch) => ({ value: branch.id, label: branch.name, helper: [branch.code, branch.type].filter(Boolean).join(' · ') }))}
                  values={form.branchIds}
                  onChange={(value) => patchForm('branchIds', value)}
                />
              </Field>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <ToggleRule checked={form.newCustomersOnly} onChange={(value) => patchForm('newCustomersOnly', value)} label="Solo primera compra" helper="Exige documento y bloquea clientes con compras confirmadas." />
              <ToggleRule checked={form.allowWithStoreCredit} onChange={(value) => patchForm('allowWithStoreCredit', value)} label="Permitir saldo a favor" helper="El cliente puede usar cupón y saldo en la misma orden." />
              <ToggleRule checked={form.allowWithManualDiscount} onChange={(value) => patchForm('allowWithManualDiscount', value)} label="Permitir descuento manual" helper="Útil en POS; desactivado evita duplicar descuentos." />
              <ToggleRule checked={form.allowWithAutomaticPromotions} onChange={(value) => patchForm('allowWithAutomaticPromotions', value)} label="Permitir otras promociones" helper="Autoriza combinación con promociones automáticas futuras." />
            </div>
          </div>

          <div className="mt-5 rounded-3xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
            <div className="flex items-start gap-3"><Calculator className="mt-0.5 h-5 w-5" style={{ color: 'var(--admin-primary)' }} /><div><h3 className="text-sm font-black">Simulador antes de guardar</h3><p className="mt-1 text-xs font-semibold" style={{ color: 'var(--admin-card-muted-text)' }}>Comprueba las reglas con precios reales sin crear ni modificar el cupón.</p></div></div>
            <div className="mt-4 grid gap-3 lg:grid-cols-4">
              <Field label="Producto de prueba"><select style={inputStyle} value={form.simulationProductId} onChange={(e) => patchForm('simulationProductId', e.target.value)}><option value="">Selecciona producto</option>{(metadata.products || []).map((product) => <option key={product.id} value={product.id}>{product.title}</option>)}</select></Field>
              <Field label="Cantidad"><input style={inputStyle} type="number" min="1" value={form.simulationQuantity} onChange={(e) => patchForm('simulationQuantity', e.target.value)} /></Field>
              <Field label="Canal"><select style={inputStyle} value={form.simulationChannel} onChange={(e) => patchForm('simulationChannel', e.target.value)}><option value="web">Tienda virtual</option><option value="pos">POS</option></select></Field>
              <Field label="Sede"><select style={inputStyle} value={form.simulationBranchId} onChange={(e) => patchForm('simulationBranchId', e.target.value)}><option value="">Sin sede específica</option>{(metadata.branches || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></Field>
              <Field label="Cliente"><select style={inputStyle} value={form.simulationCustomerId} onChange={(e) => patchForm('simulationCustomerId', e.target.value)}><option value="">Cliente nuevo/no identificado</option>{(metadata.customers || []).map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.ordersCount} compra(s)</option>)}</select></Field>
              <Field label="Envío"><input style={inputStyle} type="number" min="0" value={form.simulationShipping} onChange={(e) => patchForm('simulationShipping', e.target.value)} /></Field>
              <Field label="Saldo a favor"><input style={inputStyle} type="number" min="0" value={form.simulationStoreCredit} onChange={(e) => patchForm('simulationStoreCredit', e.target.value)} /></Field>
              <Field label="Descuento manual"><input style={inputStyle} type="number" min="0" value={form.simulationManualDiscount} onChange={(e) => patchForm('simulationManualDiscount', e.target.value)} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={handleSimulate} disabled={simulating || !form.simulationProductId} className="inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xs font-black text-white disabled:opacity-50" style={{ background: 'var(--admin-primary)' }}>{simulating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}{simulating ? 'Simulando...' : 'Probar reglas'}</button>
              {simulation ? <div className="rounded-2xl border px-4 py-2 text-xs font-bold" style={{ borderColor: simulation.validation?.valid ? '#10b981' : 'var(--admin-danger, #be123c)', color: 'var(--admin-card-text)' }}>{simulation.validation?.valid ? `Aplicable · descuento ${formatMoney(simulation.validation?.discount?.totalDiscountAmount)}` : simulation.validation?.message || 'El cupón no aplica.'}</div> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Descripción">
              <textarea style={textAreaStyle} value={form.description} onChange={(e) => patchForm('description', e.target.value)} placeholder="Texto visible o referencia interna del cupón" />
            </Field>
            <Field label="Notas internas">
              <textarea style={textAreaStyle} value={form.internalNotes} onChange={(e) => patchForm('internalNotes', e.target.value)} placeholder="Observaciones para administración" />
            </Field>
          </div>
        </div>

        <div
          className="flex flex-col gap-3 border-t px-6 py-4 md:flex-row md:items-center md:justify-between"
          style={{ borderColor: 'var(--admin-card-border)' }}
        >
          <label className="inline-flex items-center gap-3 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => patchForm('active', e.target.checked)}
              style={{ accentColor: 'var(--admin-primary)' }}
            />
            Cupón activo en los canales seleccionados
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black"
              style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
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
        </div>
      </form>
    </div>,
    document.body
  );
}

export default function AdminCouponsPage() {
  const confirm = useAppConfirm();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulation, setSimulation] = useState(null);
  const [metadata, setMetadata] = useState({ products: [], categories: [], customers: [], branches: [] });
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
      const data = await fetchAdminCoupons({
        q,
        type: typeFilter,
        effectiveStatus: statusFilter,
        limit: 80,
      });
      setRows(Array.isArray(data.rows) ? data.rows : []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudieron cargar los cupones.');
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    try {
      const data = await fetchCouponCampaignMetadata();
      setMetadata(data || { products: [], categories: [], customers: [], branches: [] });
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudieron cargar productos, clientes y sedes para las reglas.');
    }
  };

  useEffect(() => {
    loadCoupons();
    loadMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNewForm = () => {
    setEditingId('');
    setForm({
      ...EMPTY_FORM,
      code: buildSecureCouponCode(rows),
    });
    setFormOpen(true);
    setSimulation(null);
    setError('');
  };

  const openEditForm = (coupon) => {
    setEditingId(String(coupon?._id || coupon?.id || ''));
    setForm(buildFormFromCoupon(coupon));
    setFormOpen(true);
    setSimulation(null);
    setError('');
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId('');
    setForm(EMPTY_FORM);
    setSimulation(null);
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

  const handleGenerateCode = () => {
    patchForm('code', buildSecureCouponCode(rows));
  };

  const handleSimulate = async () => {
    if (!form.simulationProductId) return;
    const selectedCustomer = (metadata.customers || []).find((customer) => customer.id === form.simulationCustomerId);
    try {
      setSimulating(true);
      setSimulation(null);
      const result = await simulateAdminCoupon({
        coupon: buildPayloadFromForm(form),
        items: [{ productId: form.simulationProductId, quantity: Math.max(1, Number(form.simulationQuantity || 1)) }],
        shippingAmount: normalizeNumber(form.simulationShipping, 0),
        customerId: form.simulationCustomerId,
        customerDocument: selectedCustomer?.documentNumber || '',
        customerEmail: selectedCustomer?.email || '',
        channel: form.simulationChannel,
        branchId: form.simulationBranchId,
        storeCreditAmount: normalizeNumber(form.simulationStoreCredit, 0),
        manualDiscountAmount: normalizeNumber(form.simulationManualDiscount, 0),
      });
      setSimulation(result);
    } catch (err) {
      setError(err?.response?.data?.message || err?.userMessage || 'No se pudo simular el cupón.');
    } finally {
      setSimulating(false);
    }
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

    if (payload.appliesTo === 'categories' && payload.categories.length === 0) {
      setError('Selecciona al menos una categoría para aplicar este cupón.');
      return;
    }

    if (payload.appliesTo === 'products' && payload.productIds.length === 0) {
      setError('Selecciona al menos un producto para aplicar este cupón.');
      return;
    }

    if (payload.allowedChannels.length === 0) {
      setError('Selecciona al menos un canal de venta.');
      return;
    }

    if (payload.startsAt && payload.endsAt && new Date(payload.endsAt) <= new Date(payload.startsAt)) {
      setError('La fecha final debe ser posterior a la fecha inicial.');
      return;
    }

    for (const [value, label] of [
      [payload.usageLimit, 'El límite total de usos'],
      [payload.perCustomerLimit, 'El límite por cliente'],
    ]) {
      if (value !== null && (!Number.isInteger(value) || value < 1)) {
        setError(`${label} debe ser un número entero mayor que cero.`);
        return;
      }
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
    const isActive = coupon?.active !== false && coupon?.status === 'active';
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
      <CouponFormModal
        open={formOpen}
        editingId={editingId}
        form={form}
        saving={saving}
        patchForm={patchForm}
        closeForm={closeForm}
        handleSave={handleSave}
        handleGenerateCode={handleGenerateCode}
        metadata={metadata}
        simulating={simulating}
        simulation={simulation}
        handleSimulate={handleSimulate}
      />

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

      <div
        className="rounded-[calc(var(--admin-radius)*0.9)] border"
        style={{ background: 'var(--admin-card-bg)', borderColor: 'var(--admin-card-border)' }}
      >
        <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between" style={{ borderColor: 'var(--admin-card-border)' }}>
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
            <input
              aria-label="Buscar cupones"
              className="min-w-0 flex-1 bg-transparent text-sm font-bold outline-none"
              style={{ color: 'var(--admin-card-text)' }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadCoupons(); }}
              placeholder="Buscar por código, nombre o descripción"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filtrar por tipo" style={{ ...inputStyle, width: 170 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="">Todos los tipos</option>
              {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select aria-label="Filtrar por estado" style={{ ...inputStyle, width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Todos</option>
              {FILTER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
                  const isEnabled = coupon.active !== false && coupon.status === 'active';
                  const requiresRuleEdit = ['expired', 'exhausted'].includes(coupon.effectiveStatus);
                  const statusActionLabel = coupon.effectiveStatus === 'expired'
                    ? 'Editar vigencia'
                    : coupon.effectiveStatus === 'exhausted'
                      ? 'Ajustar límite'
                      : isEnabled
                        ? 'Desactivar'
                        : 'Activar';
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
                            onClick={() => (requiresRuleEdit ? openEditForm(coupon) : handleToggleStatus(coupon))}
                            className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-black"
                            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
                          >
                            <Power className="h-3.5 w-3.5" />
                            {statusActionLabel}
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
