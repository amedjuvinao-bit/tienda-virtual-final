// frontend/src/admin/configuracion/sections/SedesSection.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  RefreshCw,
  Save,
  Search,
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
import api from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { hasAdminPermission } from '../../security/adminPermissions';
import SedesList from './SedesList';

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

function normalizeGeoText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
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

export default function SedesSection() {
  const { adminUser } = useAuth();
  const canCreate = hasAdminPermission(adminUser, 'branches:create');
  const canEdit = hasAdminPermission(adminUser, 'branches:update');
  const canDisable = hasAdminPermission(adminUser, 'branches:disable');
  const [branches, setBranches] = useState([]);
  const [meta, setMeta] = useState({
    types: ['store', 'warehouse', 'office', 'pickup_point', 'virtual'],
    statuses: ['active', 'inactive', 'closed', 'maintenance'],
    paymentMethods: ['cash', 'transfer', 'card', 'mixed', 'other'],
  });

  const [form, setForm] = useState(EMPTY_FORM);
  const [editingBranch, setEditingBranch] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formStep, setFormStep] = useState('general');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [geoLoading, setGeoLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const editingBranchId = getBranchId(editingBranch);

  const selectedCountry = useMemo(() => {
    const expected = normalizeGeoText(form.address.country);
    return countries.find(
      (country) =>
        normalizeGeoText(country.code) === expected ||
        normalizeGeoText(country.name) === expected
    ) || null;
  }, [countries, form.address.country]);

  const selectedCountryCode = String(
    selectedCountry?.code ||
      (/^[A-Za-z]{2}$/.test(form.address.country)
        ? form.address.country
        : normalizeGeoText(form.address.country) === 'colombia'
          ? 'CO'
          : '')
  ).toUpperCase();

  const selectedRegionCode = useMemo(() => {
    if (form.address.departmentCode) return form.address.departmentCode;
    const expected = normalizeGeoText(form.address.department);
    const match = regions.find(
      (region) => normalizeGeoText(region.name) === expected
    );
    return match?.code || match?.isoCode || '';
  }, [form.address.department, form.address.departmentCode, regions]);

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
        page,
        limit: pageSize,
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
  }, [search, statusFilter, typeFilter, page]);

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
    let active = true;
    api.get('/api/geo/countries')
      .then(({ data }) => {
        if (!active) return;
        setCountries(
          (Array.isArray(data) ? data : []).map((country) => ({
            ...country,
            code: String(country?.code || '').toUpperCase(),
          }))
        );
      })
      .catch((geoError) => {
        console.warn('No fue posible cargar el catálogo de países.', geoError);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showForm || !selectedCountryCode) {
      setRegions([]);
      setCities([]);
      return undefined;
    }
    let active = true;
    setGeoLoading(true);
    api.get('/api/geo/regions', { params: { country: selectedCountryCode } })
      .then(({ data }) => {
        if (!active) return;
        setRegions(Array.isArray(data) ? data : []);
      })
      .catch((geoError) => {
        if (!active) return;
        setRegions([]);
        console.warn('No fue posible cargar el catálogo de regiones.', geoError);
      })
      .finally(() => {
        if (active) setGeoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCountryCode, showForm]);

  useEffect(() => {
    if (!regions.length || form.address.departmentCode) return;
    const expected = normalizeGeoText(form.address.department);
    const match = regions.find(
      (region) => normalizeGeoText(region.name) === expected
    );
    if (!match) return;
    setForm((current) => ({
      ...current,
      address: {
        ...current.address,
        department: match.name,
        departmentCode: match.code || match.isoCode || '',
      },
    }));
  }, [form.address.department, form.address.departmentCode, regions]);

  useEffect(() => {
    if (!showForm || !selectedCountryCode || !selectedRegionCode) {
      setCities([]);
      return undefined;
    }
    let active = true;
    setGeoLoading(true);
    api.get('/api/geo/cities', {
      params: {
        country: selectedCountryCode,
        region: selectedRegionCode,
        limit: 10000,
      },
    })
      .then(({ data }) => {
        if (!active) return;
        setCities(Array.isArray(data) ? data : []);
      })
      .catch((geoError) => {
        if (!active) return;
        setCities([]);
        console.warn('No fue posible cargar el catálogo de ciudades.', geoError);
      })
      .finally(() => {
        if (active) setGeoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCountryCode, selectedRegionCode, showForm]);

  useEffect(() => {
    if (!cities.length || form.address.cityCode) return;
    const expected = normalizeGeoText(form.address.city);
    const match = cities.find((city) => normalizeGeoText(city.name) === expected);
    if (!match) return;
    setForm((current) => ({
      ...current,
      address: {
        ...current.address,
        city: match.name,
        cityCode: match.code || '',
      },
    }));
  }, [cities, form.address.city, form.address.cityCode]);

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
    setFormStep('general');
    setSaving(false);
    setError('');
  };

  const openCreateForm = () => {
    setMessage('');
    setError('');
    setEditingBranch(null);
    setForm(EMPTY_FORM);
    setFormStep('general');
    setShowForm(true);
  };

  const openEditForm = (branch) => {
    setMessage('');
    setError('');
    setEditingBranch(branch);
    setForm(normalizeBranchToForm(branch));
    setFormStep('general');
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.name.trim()) {
      setError('El nombre de la sede es obligatorio.');
      setFormStep('general');
      return;
    }

    if (!form.code.trim()) {
      setError('El código de la sede es obligatorio.');
      setFormStep('general');
      return;
    }

    if (formStep !== 'operation') {
      setError('');
      setFormStep(formStep === 'general' ? 'location' : 'operation');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');

      const payload = buildBranchPayload(form);

      if (editingBranchId) {
        if (
          !canDisable ||
          (
            payload.status === (editingBranch.status || 'active') &&
            payload.active === (editingBranch.active !== false)
          )
        ) {
          delete payload.status;
          delete payload.active;
        }
        await updateAdminBranch(editingBranchId, payload);
        setMessage('Sede actualizada correctamente.');
      } else {
        await createAdminBranch(payload);
        setMessage('Sede creada correctamente.');
      }

      resetForm();
      if (page !== 1) setPage(1);
      else await loadBranches();
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
      if (branches.length === 1 && page > 1) setPage(page - 1);
      else await loadBranches();
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
              className="absolute inset-0 cursor-default backdrop-blur-xl"
              style={{ backgroundColor: 'rgba(24, 22, 34, 0.12)' }}
              onClick={resetForm}
            />

            <form
              onSubmit={handleSubmit}
              className="relative z-10 flex max-h-[min(760px,88vh)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border backdrop-blur-2xl shadow-2xl"
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
                    {formStep === 'general' && 'Identifica la sede y añade sus datos de contacto.'}
                    {formStep === 'location' && 'Indica dónde se encuentra esta sede.'}
                    {formStep === 'operation' && 'Configura los servicios que prestará la sede.'}
                  </p>
                </div>

                <button
                  type="button"
                  aria-label="Cerrar formulario de sede"
                  onClick={resetForm}
                  className="shrink-0 rounded-2xl border p-2"
                  style={borderOnlyButtonStyle}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav aria-label="Secciones del formulario de sede" className="flex shrink-0 gap-2 border-b px-5 py-3 md:px-6" style={{ borderColor: 'var(--admin-card-border)' }}>
                {[
                  ['general', '1. Datos'],
                  ['location', '2. Ubicación'],
                  ['operation', '3. Operación'],
                ].map(([step, label]) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => { setFormStep(step); setError(''); }}
                    aria-current={formStep === step ? 'step' : undefined}
                    className="min-w-0 flex-1 rounded-xl border px-2 py-2 text-center text-xs font-semibold sm:text-sm"
                    style={formStep === step ? primaryBadgeStyle : borderOnlyButtonStyle}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {error && <div role="alert" className="mx-5 mt-3 rounded-xl border px-3 py-2 text-sm font-semibold md:mx-6" style={dangerButtonStyle}>{error}</div>}

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 md:px-6">
                <div>
                  <div className={formStep === 'general' ? 'space-y-4' : 'hidden'}>
                    <h4
                      className="text-sm font-bold"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Información general
                    </h4>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-semibold">Nombre</span>
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
                        <span className="text-sm font-semibold">Código</span>
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
                        <span className="text-sm font-semibold">Tipo de sede</span>
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
                        <span className="text-sm font-semibold">Estado</span>
                        <select
                          value={form.status}
                          disabled={Boolean(editingBranchId) && !canDisable}
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

                    <div className="grid gap-3 sm:grid-cols-2">
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
                      className="text-sm font-bold"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Contacto
                    </h4>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="space-y-1">
                        <span className="text-sm font-semibold">Teléfono</span>
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
                        <span className="text-sm font-semibold">WhatsApp</span>
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
                        <span className="text-sm font-semibold">Correo</span>
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

                  <div className={formStep === 'location' ? 'space-y-4' : 'hidden'}>
                    <h4
                      className="text-sm font-bold"
                      style={{ color: 'var(--admin-primary)' }}
                    >
                      Ubicación
                    </h4>

                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-sm font-semibold">País</span>
                        {countries.length ? (
                          <select
                            value={selectedCountryCode}
                            onChange={(event) => {
                              const country = countries.find(
                                (item) => item.code === event.target.value
                              );
                              setForm((current) => ({
                                ...current,
                                address: {
                                  ...current.address,
                                  country: country?.name || event.target.value,
                                  department: '',
                                  departmentCode: '',
                                  city: '',
                                  cityCode: '',
                                },
                              }));
                            }}
                            autoComplete="country"
                            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                          >
                            <option value="">Selecciona un país</option>
                            {countries.map((country) => (
                              <option key={country.code} value={country.code}>
                                {country.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={form.address.country}
                            onChange={(event) =>
                              updateNestedField('address', 'country', event.target.value)
                            }
                            autoComplete="country-name"
                            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                          />
                        )}
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-semibold">
                          {selectedCountryCode === 'CO'
                            ? 'Departamento'
                            : 'Estado / provincia'}
                        </span>
                        {regions.length ? (
                          <select
                            value={selectedRegionCode}
                            onChange={(event) => {
                              const region = regions.find(
                                (item) =>
                                  (item.code || item.isoCode) === event.target.value
                              );
                              setForm((current) => ({
                                ...current,
                                address: {
                                  ...current.address,
                                  department: region?.name || '',
                                  departmentCode: event.target.value,
                                  city: '',
                                  cityCode: '',
                                },
                              }));
                            }}
                            disabled={geoLoading}
                            autoComplete="address-level1"
                            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                          >
                            <option value="">Selecciona una región</option>
                            {regions.map((region) => {
                              const code = region.code || region.isoCode;
                              return <option key={code} value={code}>{region.name}</option>;
                            })}
                          </select>
                        ) : (
                          <input
                            value={form.address.department}
                            onChange={(event) => {
                              const value = event.target.value;
                              setForm((current) => ({
                                ...current,
                                address: {
                                  ...current.address,
                                  department: value,
                                  departmentCode: value,
                                  city: '',
                                  cityCode: '',
                                },
                              }));
                            }}
                            autoComplete="address-level1"
                            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                          />
                        )}
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-semibold">Ciudad</span>
                        {cities.length ? (
                          <select
                            value={
                              form.address.cityCode ||
                              cities.find(
                                (city) =>
                                  normalizeGeoText(city.name) ===
                                  normalizeGeoText(form.address.city)
                              )?.code ||
                              ''
                            }
                            onChange={(event) => {
                              const city = cities.find(
                                (item) => item.code === event.target.value
                              );
                              setForm((current) => ({
                                ...current,
                                address: {
                                  ...current.address,
                                  city: city?.name || '',
                                  cityCode: event.target.value,
                                },
                              }));
                            }}
                            disabled={geoLoading}
                            autoComplete="address-level2"
                            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                          >
                            <option value="">Selecciona una ciudad</option>
                            {cities.map((city) => (
                              <option key={city.code} value={city.code}>{city.name}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            value={form.address.city}
                            onChange={(event) => {
                              const value = event.target.value;
                              setForm((current) => ({
                                ...current,
                                address: {
                                  ...current.address,
                                  city: value,
                                  cityCode: '',
                                },
                              }));
                            }}
                            autoComplete="address-level2"
                            className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                            style={inputStyle}
                          />
                        )}
                      </label>

                      <label className="space-y-1">
                        <span className="text-sm font-semibold">Barrio</span>
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
                        <span className="text-sm font-semibold">Dirección</span>
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

                      <label className="space-y-1 md:col-span-2">
                        <span className="text-sm font-semibold">Código postal</span>
                        <input
                          value={form.address.postalCode}
                          onChange={(event) =>
                            updateNestedField(
                              'address',
                              'postalCode',
                              event.target.value
                            )
                          }
                          autoComplete="postal-code"
                          className="w-full rounded-2xl border px-3 py-2 text-sm outline-none"
                          style={inputStyle}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={formStep === 'operation' ? 'space-y-4' : 'hidden'}>
                    <h4
                      className="text-sm font-bold"
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
                        <span className="text-sm font-semibold">
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
                        <span className="text-sm font-semibold">
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

                    <label className="block space-y-1">
                      <span className="text-sm font-semibold">Observaciones</span>
                      <textarea
                        value={form.notes}
                        onChange={(event) => updateField('notes', event.target.value)}
                        rows={2}
                        className="w-full resize-none rounded-2xl border px-3 py-2 text-sm outline-none"
                        style={inputStyle}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div
                className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t px-5 py-3 md:px-6"
                style={{
                  borderColor: 'var(--admin-card-border)',
                  backgroundColor: 'var(--admin-modal-bg)',
                }}
              >
                <button
                  type="button"
                  onClick={resetForm}
                  className="mr-auto inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={borderOnlyButtonStyle}
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>

                {formStep !== 'general' && <button
                  type="button"
                  onClick={() => { setFormStep(formStep === 'operation' ? 'location' : 'general'); setError(''); }}
                  className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  style={borderOnlyButtonStyle}
                >
                  Anterior
                </button>}

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold shadow-sm disabled:opacity-60"
                  style={primaryButtonStyle}
                >
                  {formStep === 'operation' && <Save className="h-4 w-4" />}
                  {saving ? 'Guardando...' : formStep === 'operation' ? 'Guardar sede' : 'Siguiente'}
                </button>
              </div>
            </form>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div className="space-y-3">
        <div
          className="rounded-2xl border p-4 backdrop-blur-xl"
          style={glassCardStyle}
        >
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3
                className="text-xl font-bold"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Sedes
              </h3>

              <p
                className="mt-1 max-w-3xl text-sm leading-6"
                style={mutedTextStyle}
              >
                Administra tiendas, bodegas y puntos de recogida.
              </p>
            </div>

            {canCreate && <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-sm transition hover:scale-[1.01] active:scale-[0.99]"
              style={primaryButtonStyle}
            >
              <Plus className="h-4 w-4" />
              Nueva sede
            </button>}
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
          className="rounded-2xl border p-3 backdrop-blur-xl"
          style={cardStyle}
        >
          <div className="grid gap-2 lg:grid-cols-[1fr_180px_180px_auto]">
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
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                aria-label="Buscar sedes"
                placeholder="Buscar por nombre, código, ciudad, correo..."
                className="w-full border-0 bg-transparent text-sm outline-none"
                style={{ color: 'var(--admin-input-text)' }}
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar sedes por estado"
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
              onChange={(event) => {
                setTypeFilter(event.target.value);
                setPage(1);
              }}
              aria-label="Filtrar sedes por tipo"
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

        </div>

        <SedesList
          branches={branches}
          total={total}
          loading={loading}
          canEdit={canEdit}
          canDisable={canDisable}
          onEdit={openEditForm}
          onToggleStatus={handleToggleStatus}
          onMarkAsMain={handleMarkAsMain}
          onMarkAsOnlineDefault={handleMarkAsOnlineDefault}
          onDelete={handleDelete}
        />
        {totalPages > 1 && (
          <nav aria-label="Páginas de sedes" className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm" style={cardStyle}>
            <span>Página {page} de {totalPages} · {total} sedes</span>
            <div className="flex gap-2">
              <button type="button" disabled={page === 1 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-xl border px-3 py-2 disabled:opacity-40" style={borderOnlyButtonStyle}>Anterior</button>
              <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-xl border px-3 py-2 disabled:opacity-40" style={borderOnlyButtonStyle}>Siguiente</button>
            </div>
          </nav>
        )}
      </div>

      {modalContent}
    </>
  );
}
