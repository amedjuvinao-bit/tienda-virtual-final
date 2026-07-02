// frontend/src/admin/configuracion/sections/SedesSection.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  CheckCircle2,
  Edit3,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
  Warehouse,
  X,
} from 'lucide-react';

import {
  createAdminBranch,
  deleteAdminBranch,
  getAdminBranches,
  getAdminBranchesMeta,
  markAdminBranchAsMain,
  markAdminBranchAsOnlineDefault,
  updateAdminBranch,
  updateAdminBranchStatus,
} from '../../api/adminBranchesApi';

const EMPTY_FORM = {
  name: '',
  code: '',
  type: 'store',
  status: 'active',
  active: true,
  isMain: false,
  isDefaultForOnlineOrders: false,
  contact: {
    phone: '',
    whatsapp: '',
    email: '',
  },
  address: {
    country: 'Colombia',
    department: '',
    departmentCode: '',
    city: '',
    cityCode: '',
    addressLine: '',
    neighborhood: '',
    postalCode: '',
  },
  fiscal: {
    useCompanyFiscalInfo: true,
    legalName: '',
    nit: '',
    dv: '',
    billingEmail: '',
    dianResolutionPrefix: '',
  },
  settings: {
    allowPosSales: true,
    allowManualOrders: true,
    allowInventoryMovements: true,
    allowElectronicInvoice: true,
    requireCashSessionForPos: true,
    allowNegativeStock: false,
    defaultPaymentMethod: 'cash',
    defaultCustomerName: 'Consumidor final',
  },
  notes: '',
};

const TYPE_LABELS = {
  store: 'Tienda física',
  warehouse: 'Bodega',
  office: 'Oficina',
  pickup_point: 'Punto de recogida',
  virtual: 'Sede virtual',
};

const STATUS_LABELS = {
  active: 'Activa',
  inactive: 'Inactiva',
  closed: 'Cerrada',
  maintenance: 'Mantenimiento',
};

const PAYMENT_METHOD_LABELS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  mixed: 'Mixto',
  other: 'Otro',
};

function getBranchId(branch) {
  return branch?._id || branch?.id || '';
}

function getInitials(text) {
  const value = String(text || '').trim();

  if (!value) return 'S';

  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function resolveBranchesList(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.branches)) return response.branches;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.branches)) return response.data.branches;
  if (Array.isArray(response?.data?.items)) return response.data.items;

  return [];
}

function resolveTotal(response, branchesLength) {
  return (
    response?.total ||
    response?.data?.total ||
    response?.pagination?.total ||
    branchesLength ||
    0
  );
}

function normalizeBranchToForm(branch) {
  return {
    name: branch?.name || '',
    code: branch?.code || '',
    type: branch?.type || 'store',
    status: branch?.status || 'active',
    active: branch?.active !== false,
    isMain: branch?.isMain === true,
    isDefaultForOnlineOrders: branch?.isDefaultForOnlineOrders === true,
    contact: {
      phone: branch?.contact?.phone || '',
      whatsapp: branch?.contact?.whatsapp || '',
      email: branch?.contact?.email || '',
    },
    address: {
      country: branch?.address?.country || 'Colombia',
      department: branch?.address?.department || '',
      departmentCode: branch?.address?.departmentCode || '',
      city: branch?.address?.city || '',
      cityCode: branch?.address?.cityCode || '',
      addressLine: branch?.address?.addressLine || '',
      neighborhood: branch?.address?.neighborhood || '',
      postalCode: branch?.address?.postalCode || '',
    },
    fiscal: {
      useCompanyFiscalInfo: branch?.fiscal?.useCompanyFiscalInfo !== false,
      legalName: branch?.fiscal?.legalName || '',
      nit: branch?.fiscal?.nit || '',
      dv: branch?.fiscal?.dv || '',
      billingEmail: branch?.fiscal?.billingEmail || '',
      dianResolutionPrefix: branch?.fiscal?.dianResolutionPrefix || '',
    },
    settings: {
      allowPosSales: branch?.settings?.allowPosSales !== false,
      allowManualOrders: branch?.settings?.allowManualOrders !== false,
      allowInventoryMovements:
        branch?.settings?.allowInventoryMovements !== false,
      allowElectronicInvoice: branch?.settings?.allowElectronicInvoice !== false,
      requireCashSessionForPos:
        branch?.settings?.requireCashSessionForPos !== false,
      allowNegativeStock: branch?.settings?.allowNegativeStock === true,
      defaultPaymentMethod: branch?.settings?.defaultPaymentMethod || 'cash',
      defaultCustomerName:
        branch?.settings?.defaultCustomerName || 'Consumidor final',
    },
    notes: branch?.notes || '',
  };
}

function buildBranchPayload(form) {
  return {
    name: form.name,
    code: form.code,
    type: form.type,
    status: form.status,
    active: form.status === 'active' ? form.active : false,
    isMain: form.isMain,
    isDefaultForOnlineOrders: form.isDefaultForOnlineOrders,
    contact: {
      phone: form.contact.phone,
      whatsapp: form.contact.whatsapp,
      email: form.contact.email,
    },
    address: {
      country: form.address.country,
      department: form.address.department,
      departmentCode: form.address.departmentCode,
      city: form.address.city,
      cityCode: form.address.cityCode,
      addressLine: form.address.addressLine,
      neighborhood: form.address.neighborhood,
      postalCode: form.address.postalCode,
    },
    fiscal: {
      useCompanyFiscalInfo: form.fiscal.useCompanyFiscalInfo,
      legalName: form.fiscal.legalName,
      nit: form.fiscal.nit,
      dv: form.fiscal.dv,
      billingEmail: form.fiscal.billingEmail,
      dianResolutionPrefix: form.fiscal.dianResolutionPrefix,
    },
    settings: {
      allowPosSales: form.settings.allowPosSales,
      allowManualOrders: form.settings.allowManualOrders,
      allowInventoryMovements: form.settings.allowInventoryMovements,
      allowElectronicInvoice: form.settings.allowElectronicInvoice,
      requireCashSessionForPos: form.settings.requireCashSessionForPos,
      allowNegativeStock: form.settings.allowNegativeStock,
      defaultPaymentMethod: form.settings.defaultPaymentMethod,
      defaultCustomerName: form.settings.defaultCustomerName,
    },
    notes: form.notes,
  };
}

function getStatusBadgeStyle(status, active) {
  if (status === 'maintenance') {
    return {
      backgroundColor: 'var(--admin-warning-soft-bg)',
      borderColor: 'var(--admin-warning)',
      color: 'var(--admin-warning-text)',
    };
  }

  if (active === true && status === 'active') {
    return {
      backgroundColor: 'var(--admin-primary-soft-bg)',
      borderColor: 'var(--admin-primary-soft-border)',
      color: 'var(--admin-primary-soft-text)',
    };
  }

  return {
    backgroundColor: 'var(--admin-danger-soft-bg)',
    borderColor: 'var(--admin-danger)',
    color: 'var(--admin-danger-text)',
  };
}

export default function SedesSection() {
  const [branches, setBranches] = useState([]);
  const [meta, setMeta] = useState({
    types: ['store', 'warehouse', 'office', 'pickup_point', 'virtual'],
    statuses: ['active', 'inactive', 'closed', 'maintenance'],
    paymentMethods: ['cash', 'transfer', 'card', 'mixed', 'other'],
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingBranch, setEditingBranch] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);

  const editingBranchId = getBranchId(editingBranch);

  const filteredMetaTypes = useMemo(() => {
    return Array.isArray(meta.types) && meta.types.length > 0
      ? meta.types
      : ['store', 'warehouse', 'office', 'pickup_point', 'virtual'];
  }, [meta.types]);

  const filteredMetaStatuses = useMemo(() => {
    return Array.isArray(meta.statuses) && meta.statuses.length > 0
      ? meta.statuses
      : ['active', 'inactive', 'closed', 'maintenance'];
  }, [meta.statuses]);

  const paymentMethods = useMemo(() => {
    const methods =
      Array.isArray(meta.paymentMethods) && meta.paymentMethods.length > 0
        ? meta.paymentMethods
        : ['cash', 'transfer', 'card', 'mixed', 'other'];

    return methods.filter(Boolean);
  }, [meta.paymentMethods]);

  const cardStyle = {
    backgroundColor: 'var(--admin-card-bg)',
    borderColor: 'var(--admin-card-border)',
    color: 'var(--admin-card-text)',
  };

  const glassCardStyle = {
    background: 'var(--admin-glass-bg)',
    borderColor: 'var(--admin-glass-border)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  };

  const inputStyle = {
    backgroundColor: 'var(--admin-input-bg)',
    borderColor: 'var(--admin-input-border)',
    color: 'var(--admin-input-text)',
  };

  const mutedTextStyle = {
    color: 'var(--admin-card-muted-text)',
  };

  const modalMutedTextStyle = {
    color: 'var(--admin-modal-muted-text)',
  };

  const primaryButtonStyle = {
    backgroundColor: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    borderColor: 'var(--admin-button-bg)',
  };

  const softButtonStyle = {
    backgroundColor: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    borderColor: 'var(--admin-button-soft-border)',
  };

  const borderOnlyButtonStyle = {
    backgroundColor: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    borderColor: 'var(--admin-card-border)',
  };

  const dangerButtonStyle = {
    backgroundColor: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
    borderColor: 'var(--admin-danger)',
  };

  const warningBadgeStyle = {
    backgroundColor: 'var(--admin-warning-soft-bg)',
    color: 'var(--admin-warning-text)',
    borderColor: 'var(--admin-warning)',
  };

  const primaryBadgeStyle = {
    backgroundColor: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
    borderColor: 'var(--admin-primary-soft-border)',
  };

  const loadBranches = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await getAdminBranches({
        q: search,
        status: statusFilter,
        type: typeFilter,
        page: 1,
        limit: 100,
        sort: '-createdAt',
      });

      const list = resolveBranchesList(response);

      setBranches(list);
      setTotal(resolveTotal(response, list.length));
    } catch (loadError) {
      setError(
        loadError?.response?.data?.message ||
          loadError?.message ||
          'No fue posible cargar las sedes.'
      );
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, typeFilter]);

  const loadMeta = useCallback(async () => {
    try {
      const response = await getAdminBranchesMeta();

      setMeta((currentMeta) => ({
        types: response?.data?.types || response?.types || currentMeta.types,
        statuses:
          response?.data?.statuses || response?.statuses || currentMeta.statuses,
        paymentMethods:
          response?.data?.paymentMethods ||
          response?.paymentMethods ||
          currentMeta.paymentMethods,
      }));
    } catch (metaError) {
      console.warn('No fue posible cargar la información base de sedes.', metaError);
    }
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    if (!showForm) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        resetForm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showForm]);

  const updateField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateNestedField = (group, field, value) => {
    setForm((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [field]: value,
      },
    }));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingBranch(null);
    setShowForm(false);
    setSaving(false);
  };

  const openCreateForm = () => {
    setMessage('');
    setError('');
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEditForm = (branch) => {
    setMessage('');
    setError('');
    setEditingBranch(branch);
    setForm(normalizeBranchToForm(branch));
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('El nombre de la sede es obligatorio.');
      return;
    }

    if (!form.code.trim()) {
      setError('El código de la sede es obligatorio.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload = buildBranchPayload(form);

      if (editingBranchId) {
        await updateAdminBranch(editingBranchId, payload);
        setMessage('Sede actualizada correctamente.');
      } else {
        await createAdminBranch(payload);
        setMessage('Sede creada correctamente.');
      }

      resetForm();
      await loadBranches();
    } catch (saveError) {
      setError(
        saveError?.response?.data?.message ||
          saveError?.response?.data?.errors?.join(' ') ||
          saveError?.message ||
          'No fue posible guardar la sede.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (branch) => {
    const branchId = getBranchId(branch);

    if (!branchId) return;

    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar la sede "${branch.name}"?`
    );

    if (!confirmed) return;

    try {
      setError('');
      setMessage('');

      await deleteAdminBranch(branchId);
      setMessage('Sede eliminada correctamente.');
      await loadBranches();
    } catch (deleteError) {
      setError(
        deleteError?.response?.data?.message ||
          deleteError?.message ||
          'No fue posible eliminar la sede.'
      );
    }
  };

  const handleToggleStatus = async (branch) => {
    const branchId = getBranchId(branch);

    if (!branchId) return;

    const nextActive = branch.active !== true;
    const nextStatus = nextActive ? 'active' : 'inactive';

    try {
      setError('');
      setMessage('');

      await updateAdminBranchStatus(branchId, {
        active: nextActive,
        status: nextStatus,
      });

      setMessage(
        nextActive
          ? 'Sede activada correctamente.'
          : 'Sede desactivada correctamente.'
      );

      await loadBranches();
    } catch (statusError) {
      setError(
        statusError?.response?.data?.message ||
          statusError?.message ||
          'No fue posible cambiar el estado de la sede.'
      );
    }
  };

  const handleMarkAsMain = async (branch) => {
    const branchId = getBranchId(branch);

    if (!branchId) return;

    try {
      setError('');
      setMessage('');

      await markAdminBranchAsMain(branchId);
      setMessage('Sede principal actualizada correctamente.');
      await loadBranches();
    } catch (mainError) {
      setError(
        mainError?.response?.data?.message ||
          mainError?.message ||
          'No fue posible marcar la sede como principal.'
      );
    }
  };

  const handleMarkAsOnlineDefault = async (branch) => {
    const branchId = getBranchId(branch);

    if (!branchId) return;

    try {
      setError('');
      setMessage('');

      await markAdminBranchAsOnlineDefault(branchId);
      setMessage('Sede online predeterminada actualizada correctamente.');
      await loadBranches();
    } catch (onlineError) {
      setError(
        onlineError?.response?.data?.message ||
          onlineError?.message ||
          'No fue posible marcar la sede para pedidos online.'
      );
    }
  };

  const modalContent =
    showForm && typeof document !== 'undefined'
      ? createPortal(
          <div
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-modal-title"
          >
            <button
              type="button"
              aria-label="Cerrar formulario de sede"
              className="absolute inset-0 cursor-default backdrop-blur-sm"
              style={{ backgroundColor: 'var(--admin-modal-overlay)' }}
              onClick={resetForm}
            />

            <form
              onSubmit={handleSubmit}
              className="relative z-10 flex max-h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border shadow-2xl"
              style={{
                backgroundColor: 'var(--admin-modal-bg)',
                borderColor: 'var(--admin-glass-border)',
                color: 'var(--admin-modal-text)',
                boxShadow: 'var(--admin-glass-shadow)',
              }}
            >
              <div
                className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 md:px-6"
                style={{ borderColor: 'var(--admin-card-border)' }}
              >
                <div>
                  <h3
                    id="branch-modal-title"
                    className="text-lg font-bold"
                    style={{ color: 'var(--admin-modal-text)' }}
                  >
                    {editingBranchId ? 'Editar sede' : 'Crear nueva sede'}
                  </h3>

                  <p className="mt-1 text-sm" style={modalMutedTextStyle}>
                    Completa la información básica, ubicación, contacto y permisos
                    operativos.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetForm}
                  className="shrink-0 rounded-2xl border p-2"
                  style={borderOnlyButtonStyle}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="grid gap-5 lg:grid-cols-2">
                  <div className="space-y-4">
                    <h4
                      className="text-sm font-bold uppercase tracking-wide"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Información general
                    </h4>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Nombre</span>
                        <input
                          value={form.name}
                          onChange={(event) =>
                            updateField('name', event.target.value)
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                          placeholder="Ej: Sede principal"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Código</span>
                        <input
                          value={form.code}
                          onChange={(event) =>
                            updateField('code', event.target.value.toUpperCase())
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                          placeholder="Ej: PRINCIPAL"
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Tipo de sede</span>
                        <select
                          value={form.type}
                          onChange={(event) =>
                            updateField('type', event.target.value)
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        >
                          {filteredMetaTypes.map((type) => (
                            <option key={type} value={type}>
                              {TYPE_LABELS[type] || type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Estado</span>
                        <select
                          value={form.status}
                          onChange={(event) => {
                            const nextStatus = event.target.value;

                            updateField('status', nextStatus);
                            updateField('active', nextStatus === 'active');
                          }}
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        >
                          {filteredMetaStatuses.map((status) => (
                            <option key={status} value={status}>
                              {STATUS_LABELS[status] || status}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label
                        className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={form.isMain}
                          onChange={(event) =>
                            updateField('isMain', event.target.checked)
                          }
                        />
                        Sede principal
                      </label>

                      <label
                        className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={form.isDefaultForOnlineOrders}
                          onChange={(event) =>
                            updateField(
                              'isDefaultForOnlineOrders',
                              event.target.checked
                            )
                          }
                        />
                        Sede pedidos online
                      </label>
                    </div>

                    <h4
                      className="pt-2 text-sm font-bold uppercase tracking-wide"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Contacto
                    </h4>

                    <div className="grid gap-3 md:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Teléfono</span>
                        <input
                          value={form.contact.phone}
                          onChange={(event) =>
                            updateNestedField(
                              'contact',
                              'phone',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">WhatsApp</span>
                        <input
                          value={form.contact.whatsapp}
                          onChange={(event) =>
                            updateNestedField(
                              'contact',
                              'whatsapp',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Correo</span>
                        <input
                          value={form.contact.email}
                          onChange={(event) =>
                            updateNestedField(
                              'contact',
                              'email',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4
                      className="text-sm font-bold uppercase tracking-wide"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Ubicación
                    </h4>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold">País</span>
                        <input
                          value={form.address.country}
                          onChange={(event) =>
                            updateNestedField(
                              'address',
                              'country',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">
                          Departamento
                        </span>
                        <input
                          value={form.address.department}
                          onChange={(event) =>
                            updateNestedField(
                              'address',
                              'department',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Ciudad</span>
                        <input
                          value={form.address.city}
                          onChange={(event) =>
                            updateNestedField(
                              'address',
                              'city',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">Barrio</span>
                        <input
                          value={form.address.neighborhood}
                          onChange={(event) =>
                            updateNestedField(
                              'address',
                              'neighborhood',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>

                      <label className="space-y-1 md:col-span-2">
                        <span className="text-xs font-semibold">Dirección</span>
                        <input
                          value={form.address.addressLine}
                          onChange={(event) =>
                            updateNestedField(
                              'address',
                              'addressLine',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>
                    </div>

                    <h4
                      className="pt-2 text-sm font-bold uppercase tracking-wide"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Operación
                    </h4>

                    <div className="grid gap-2 md:grid-cols-2">
                      <label
                        className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={form.settings.allowPosSales}
                          onChange={(event) =>
                            updateNestedField(
                              'settings',
                              'allowPosSales',
                              event.target.checked
                            )
                          }
                        />
                        Permite ventas POS
                      </label>

                      <label
                        className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={form.settings.allowManualOrders}
                          onChange={(event) =>
                            updateNestedField(
                              'settings',
                              'allowManualOrders',
                              event.target.checked
                            )
                          }
                        />
                        Permite pedidos manuales
                      </label>

                      <label
                        className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={form.settings.allowInventoryMovements}
                          onChange={(event) =>
                            updateNestedField(
                              'settings',
                              'allowInventoryMovements',
                              event.target.checked
                            )
                          }
                        />
                        Maneja inventario
                      </label>

                      <label
                        className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm"
                        style={inputStyle}
                      >
                        <input
                          type="checkbox"
                          checked={form.settings.allowElectronicInvoice}
                          onChange={(event) =>
                            updateNestedField(
                              'settings',
                              'allowElectronicInvoice',
                              event.target.checked
                            )
                          }
                        />
                        Facturación electrónica
                      </label>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-xs font-semibold">
                          Método de pago base
                        </span>
                        <select
                          value={form.settings.defaultPaymentMethod}
                          onChange={(event) =>
                            updateNestedField(
                              'settings',
                              'defaultPaymentMethod',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        >
                          {paymentMethods.map((method) => (
                            <option key={method} value={method}>
                              {PAYMENT_METHOD_LABELS[method] || method}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1">
                        <span className="text-xs font-semibold">
                          Cliente por defecto
                        </span>
                        <input
                          value={form.settings.defaultCustomerName}
                          onChange={(event) =>
                            updateNestedField(
                              'settings',
                              'defaultCustomerName',
                              event.target.value
                            )
                          }
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <label className="space-y-1">
                    <span className="text-xs font-semibold">Observaciones</span>
                    <textarea
                      value={form.notes}
                      onChange={(event) => updateField('notes', event.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none"
                      style={inputStyle}
                    />
                  </label>
                </div>
              </div>

              <div
                className="flex shrink-0 flex-col gap-3 border-t px-5 py-4 sm:flex-row sm:justify-end md:px-6"
                style={{
                  borderColor: 'var(--admin-card-border)',
                  backgroundColor: 'var(--admin-modal-bg)',
                }}
              >
                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold"
                  style={borderOnlyButtonStyle}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm disabled:opacity-60"
                  style={primaryButtonStyle}
                >
                  <Save className="h-4 w-4" />
                  {saving ? 'Guardando...' : 'Guardar sede'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="space-y-5">
        <div
          className="rounded-[28px] border p-5 backdrop-blur-xl"
          style={glassCardStyle}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div
                className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                style={primaryBadgeStyle}
              >
                <Building2 className="h-4 w-4" />
                Módulo de sedes
              </div>

              <h3
                className="mt-3 text-xl font-bold"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Administra las sedes de la tienda
              </h3>

              <p
                className="mt-1 max-w-3xl text-sm leading-6"
                style={mutedTextStyle}
              >
                Crea sedes, bodegas, oficinas o puntos de recogida. Después estas
                sedes podrán relacionarse con usuarios, inventario, ventas, caja y
                facturación.
              </p>
            </div>

            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition hover:scale-[1.01] active:scale-[0.99]"
              style={primaryButtonStyle}
            >
              <Plus className="h-4 w-4" />
              Nueva sede
            </button>
          </div>
        </div>

        {(message || error) && (
          <div
            className="rounded-2xl border px-4 py-3 text-sm font-semibold"
            style={error ? dangerButtonStyle : primaryBadgeStyle}
          >
            {error || message}
          </div>
        )}

        <div
          className="rounded-[28px] border p-4 backdrop-blur-xl"
          style={cardStyle}
        >
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
            <div
              className="flex items-center gap-2 rounded-2xl border px-3 py-2"
              style={inputStyle}
            >
              <Search
                className="h-4 w-4"
                style={{ color: 'var(--admin-input-placeholder)' }}
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nombre, código, ciudad, correo..."
                className="w-full border-0 bg-transparent text-sm outline-none"
                style={{ color: 'var(--admin-input-text)' }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            >
              <option value="all">Todos los estados</option>
              {filteredMetaStatuses.map((status) => (
                <option key={status} value={status}>
                  {STATUS_LABELS[status] || status}
                </option>
              ))}
            </select>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="rounded-2xl border px-3 py-2 text-sm outline-none"
              style={inputStyle}
            >
              <option value="all">Todos los tipos</option>
              {filteredMetaTypes.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type] || type}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={loadBranches}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
              style={softButtonStyle}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span style={mutedTextStyle}>
              Total de sedes: <strong>{total}</strong>
            </span>
          </div>
        </div>

        <div
          className="overflow-hidden rounded-[28px] border backdrop-blur-xl"
          style={cardStyle}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead
                style={{
                  backgroundColor: 'var(--admin-table-head-bg)',
                  color: 'var(--admin-table-head-text)',
                }}
              >
                <tr>
                  <th className="px-4 py-3 font-bold">Sede</th>
                  <th className="px-4 py-3 font-bold">Tipo</th>
                  <th className="px-4 py-3 font-bold">Ubicación</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 font-bold">Marcadores</th>
                  <th className="px-4 py-3 text-right font-bold">Acciones</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-8 text-center text-sm"
                      style={{ color: 'var(--admin-table-muted-text)' }}
                    >
                      Cargando sedes...
                    </td>
                  </tr>
                )}

                {!loading && branches.length === 0 && (
                  <tr>
                    <td
                      colSpan="6"
                      className="px-4 py-10 text-center"
                      style={{ color: 'var(--admin-table-muted-text)' }}
                    >
                      <Building2 className="mx-auto mb-3 h-8 w-8 opacity-60" />
                      No hay sedes registradas todavía.
                    </td>
                  </tr>
                )}

                {!loading &&
                  branches.map((branch) => {
                    const branchId = getBranchId(branch);
                    const statusBadgeStyle = getStatusBadgeStyle(
                      branch.status,
                      branch.active
                    );

                    return (
                      <tr
                        key={branchId}
                        className="border-t transition"
                        style={{
                          borderColor: 'var(--admin-table-border)',
                          color: 'var(--admin-table-text)',
                        }}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold"
                              style={primaryBadgeStyle}
                            >
                              {getInitials(branch.name)}
                            </div>

                            <div>
                              <div className="font-bold">{branch.name}</div>
                              <div
                                className="text-xs"
                                style={{ color: 'var(--admin-table-muted-text)' }}
                              >
                                Código: {branch.code || 'Sin código'}
                              </div>
                              {branch.contact?.email && (
                                <div
                                  className="text-xs"
                                  style={{ color: 'var(--admin-table-muted-text)' }}
                                >
                                  {branch.contact.email}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold"
                            style={softButtonStyle}
                          >
                            {branch.type === 'warehouse' ? (
                              <Warehouse className="h-3.5 w-3.5" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5" />
                            )}
                            {TYPE_LABELS[branch.type] || branch.type}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex items-start gap-2">
                            <MapPin
                              className="mt-0.5 h-4 w-4"
                              style={{ color: 'var(--admin-primary)' }}
                            />
                            <div>
                              <div className="font-semibold">
                                {branch.address?.city || 'Sin ciudad'}
                              </div>
                              <div
                                className="text-xs"
                                style={{ color: 'var(--admin-table-muted-text)' }}
                              >
                                {branch.address?.department || 'Sin departamento'}
                              </div>
                              {branch.address?.addressLine && (
                                <div
                                  className="text-xs"
                                  style={{ color: 'var(--admin-table-muted-text)' }}
                                >
                                  {branch.address.addressLine}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(branch)}
                            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold"
                            style={statusBadgeStyle}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {STATUS_LABELS[branch.status] || branch.status}
                          </button>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-2">
                            {branch.isMain && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold"
                                style={primaryBadgeStyle}
                              >
                                <Star className="h-3 w-3" />
                                Principal
                              </span>
                            )}

                            {branch.isDefaultForOnlineOrders && (
                              <span
                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold"
                                style={warningBadgeStyle}
                              >
                                Online
                              </span>
                            )}

                            {!branch.isMain && !branch.isDefaultForOnlineOrders && (
                              <span
                                className="text-xs"
                                style={{ color: 'var(--admin-table-muted-text)' }}
                              >
                                Sin marcador especial
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            {!branch.isMain && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsMain(branch)}
                                className="rounded-xl border p-2"
                                title="Marcar como principal"
                                style={softButtonStyle}
                              >
                                <Star className="h-4 w-4" />
                              </button>
                            )}

                            {!branch.isDefaultForOnlineOrders && (
                              <button
                                type="button"
                                onClick={() => handleMarkAsOnlineDefault(branch)}
                                className="rounded-xl border p-2"
                                title="Marcar para pedidos online"
                                style={warningBadgeStyle}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => openEditForm(branch)}
                              className="rounded-xl border p-2"
                              title="Editar"
                              style={borderOnlyButtonStyle}
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(branch)}
                              className="rounded-xl border p-2"
                              title="Eliminar"
                              style={dangerButtonStyle}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalContent}
    </>
  );
}