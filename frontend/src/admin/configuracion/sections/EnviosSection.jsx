// src/admin/configuracion/sections/EnviosSection.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import {
  fetchShippingRates,
  saveShippingRates,
} from '../api/shippingRatesApi';
import { getAdminShippingSettings } from '../../api/adminShippingSettingsApi';
import ShippingProvidersCard from './envios/ShippingProvidersCard';
import './envios/ShippingCenter.css';

function buildDefaultZone() {
  return {
    id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    countryCode: 'CO',
    country: 'Colombia',
    departmentCode: '',
    department: '',
    cityCode: '',
    city: '',
    price: '',
    eta: '',
  };
}

function normalizeZone(zone, index = 0) {
  const raw = zone && typeof zone === 'object' ? zone : {};
  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id
        : `zone_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 8)}`,
    countryCode:
      typeof raw.countryCode === 'string' && raw.countryCode.trim()
        ? raw.countryCode.trim().toUpperCase()
        : String(raw.country || '').trim().toLowerCase() === 'colombia'
          ? 'CO'
          : '',
    country:
      typeof raw.country === 'string' && raw.country.trim()
        ? raw.country
        : 'Colombia',
    departmentCode: typeof raw.departmentCode === 'string' ? raw.departmentCode : '',
    department: typeof raw.department === 'string' ? raw.department : '',
    cityCode: typeof raw.cityCode === 'string' ? raw.cityCode : '',
    city: typeof raw.city === 'string' ? raw.city : '',
    price:
      raw.price === 0 || raw.price === '0'
        ? '0'
        : typeof raw.price === 'string' || typeof raw.price === 'number'
          ? String(raw.price)
          : '',
    eta: typeof raw.eta === 'string' ? raw.eta : '',
  };
}

function normalizeEnvios(raw) {
  const envios = raw && typeof raw === 'object' ? raw : {};

  const freeShipping =
    envios.freeShipping && typeof envios.freeShipping === 'object'
      ? envios.freeShipping
      : {};

  const fallback =
    envios.fallback && typeof envios.fallback === 'object'
      ? envios.fallback
      : {};

  const zones = Array.isArray(envios.zones)
    ? envios.zones.map((zone, index) => normalizeZone(zone, index))
    : [];

  return {
    active: envios.active !== false,
    mode:
      envios.mode === 'fixed' || envios.mode === 'zones'
        ? envios.mode
        : 'fixed',
    fixedPrice:
      envios.fixedPrice === 0 || envios.fixedPrice === '0'
        ? '0'
        : typeof envios.fixedPrice === 'string' || typeof envios.fixedPrice === 'number'
          ? String(envios.fixedPrice)
          : '',
    estimatedTime: typeof envios.estimatedTime === 'string' ? envios.estimatedTime : '',
    freeShipping: {
      enabled: freeShipping.enabled === true,
      minimum:
        freeShipping.minimum === 0 || freeShipping.minimum === '0'
          ? '0'
          : typeof freeShipping.minimum === 'string' || typeof freeShipping.minimum === 'number'
            ? String(freeShipping.minimum)
            : '',
    },
    fallback: {
      price:
        fallback.price === 0 || fallback.price === '0'
          ? '0'
          : typeof fallback.price === 'string' || typeof fallback.price === 'number'
            ? String(fallback.price)
            : '',
      eta: typeof fallback.eta === 'string' ? fallback.eta : '',
    },
    zones,
  };
}

export default function EnviosSection() {
  const [loading, setLoading] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [activeView, setActiveView] = useState('rates');
  const [form, setForm] = useState(() => normalizeEnvios({}));
  const [savedForm, setSavedForm] = useState(() => normalizeEnvios({}));
  const [revision, setRevision] = useState(null);
  const [metadata, setMetadata] = useState({ readiness: {}, store: {}, updatedAt: null, updatedBy: '' });
  const [providerState, setProviderState] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const [regionsByZone, setRegionsByZone] = useState({});
  const [regionsLoadingByZone, setRegionsLoadingByZone] = useState({});

  const [citiesByZone, setCitiesByZone] = useState({});
  const [citiesLoadingByZone, setCitiesLoadingByZone] = useState({});

  const applyResponse = useCallback((data) => {
    const nextForm = normalizeEnvios(data?.settings || {});
    setForm(nextForm);
    setSavedForm(nextForm);
    setRevision(Number(data?.revision || 0));
    setMetadata({
      readiness: data?.readiness || {},
      store: data?.store || {},
      updatedAt: data?.updatedAt || null,
      updatedBy: data?.updatedBy || '',
    });
    setFieldErrors({});
  }, []);

  const load = useCallback(async () => {
      try {
        setLoadingConfig(true);
        applyResponse(await fetchShippingRates());
        try {
          setProviderState(await getAdminShippingSettings());
        } catch {
          setProviderState(null);
        }
        setFeedback(null);
      } catch (err) {
        setFeedback({ type: 'error', text: err.userMessage || err.message });
      } finally {
        setLoadingConfig(false);
      }
  }, [applyResponse]);

  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );
  const providerSummary = useMemo(() => {
    if (!providerState?.settings) {
      return { tone: 'warning', label: 'Estado de entrega por consultar' };
    }
    const settings = providerState?.settings || {};
    const ready = providerState?.meta?.readiness || {};
    const production = settings.enviaMode === 'production';
    const enviaReady = production ? ready.canActivateProduction : ready.canActivateSandbox;
    if (settings.defaultProvider === 'envia' && enviaReady) {
      return { tone: 'success', label: `Envia ${production ? 'Producción' : 'Sandbox'} activo` };
    }
    if (settings.defaultProvider === 'envia') {
      return { tone: 'warning', label: 'Envia pendiente · Manual activo' };
    }
    return { tone: 'primary', label: 'Entrega manual activa' };
  }, [providerState]);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  useEffect(() => {
    let cancel = false;

    const loadCountries = async () => {
      try {
        setCountriesLoading(true);
        const res = await api.get('/api/geo/countries');
        if (cancel) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setCountries(list);
        const hydrateCountryCodes = (current) => ({
          ...current,
          zones: current.zones.map((zone) => {
            if (zone.countryCode || !zone.country) return zone;
            const legacy = String(zone.country).trim().toLowerCase();
            const match = list.find((entry) =>
              String(entry.name || '').trim().toLowerCase() === legacy
            );
            return match ? { ...zone, countryCode: match.code, country: match.name } : zone;
          }),
        });
        setForm(hydrateCountryCodes);
        setSavedForm(hydrateCountryCodes);
      } catch (error) {
        if (!cancel) {
          setCountries([]);
          setFeedback({
            type: 'error',
            text: 'No fue posible cargar el catálogo de países. Recarga antes de configurar zonas.',
          });
        }
      } finally {
        if (!cancel) setCountriesLoading(false);
      }
    };

    loadCountries();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const activeZones = form.zones || [];

    activeZones.forEach((zone) => {
      const zoneId = zone.id;
      const selectedCountry = countries.find((c) => c.code === zone.countryCode);

      if (!selectedCountry?.code) {
        setRegionsByZone((prev) => {
          const current = prev[zoneId];
          return Array.isArray(current) && current.length === 0
            ? prev
            : { ...prev, [zoneId]: [] };
        });
        setCitiesByZone((prev) => {
          const current = prev[zoneId];
          return Array.isArray(current) && current.length === 0
            ? prev
            : { ...prev, [zoneId]: [] };
        });
        return;
      }

      if (!regionsByZone[zoneId] && !regionsLoadingByZone[zoneId]) {
        setRegionsLoadingByZone((prev) => ({ ...prev, [zoneId]: true }));

        api
          .get('/api/geo/regions', { params: { country: selectedCountry.code } })
          .then((res) => {
            const list = Array.isArray(res.data) ? res.data : [];
            setRegionsByZone((prev) => ({
              ...prev,
              [zoneId]: list,
            }));
            if (!zone.departmentCode && zone.department) {
              const legacy = String(zone.department).trim().toLowerCase();
              const match = list.find((entry) =>
                String(entry.code || '').trim().toLowerCase() === legacy ||
                String(entry.name || '').trim().toLowerCase() === legacy
              );
              if (match) {
                setForm((prev) => ({
                  ...prev,
                  zones: prev.zones.map((entry) => entry.id === zoneId
                    ? { ...entry, departmentCode: match.code, department: match.name }
                    : entry),
                }));
                setSavedForm((prev) => ({
                  ...prev,
                  zones: prev.zones.map((entry) => entry.id === zoneId
                    ? { ...entry, departmentCode: match.code, department: match.name }
                    : entry),
                }));
              }
            }
          })
          .catch(() => {
            setRegionsByZone((prev) => ({ ...prev, [zoneId]: [] }));
            setFieldErrors((prev) => ({
              ...prev,
              [`zone.${zoneId}.departmentCode`]: 'No fue posible cargar los departamentos.',
            }));
          })
          .finally(() => {
            setRegionsLoadingByZone((prev) => ({ ...prev, [zoneId]: false }));
          });
      }
    });
  }, [form.zones, countries, regionsByZone, regionsLoadingByZone]);

  useEffect(() => {
    const activeZones = form.zones || [];

    activeZones.forEach((zone) => {
      const zoneId = zone.id;
      const selectedCountry = countries.find((c) => c.code === zone.countryCode);

      if (!selectedCountry?.code || !zone.departmentCode) {
        setCitiesByZone((prev) => {
          const current = prev[zoneId];
          return Array.isArray(current) && current.length === 0
            ? prev
            : { ...prev, [zoneId]: [] };
        });
        return;
      }

      const currentCities = citiesByZone[zoneId];
      const currentLoading = citiesLoadingByZone[zoneId];

      if (!currentCities && !currentLoading) {
        setCitiesLoadingByZone((prev) => ({ ...prev, [zoneId]: true }));

        api
          .get('/api/geo/cities', {
            params: {
              country: selectedCountry.code,
              region: zone.departmentCode,
              limit: 10000,
            },
          })
          .then((res) => {
            const list = Array.isArray(res.data) ? res.data : [];
            setCitiesByZone((prev) => ({
              ...prev,
              [zoneId]: list,
            }));
            if (!zone.cityCode && zone.city) {
              const legacy = String(zone.city).trim().toLowerCase();
              const match = list.find((entry) =>
                String(entry.code || '').trim().toLowerCase() === legacy ||
                String(entry.name || '').trim().toLowerCase() === legacy
              );
              if (match) {
                setForm((prev) => ({
                  ...prev,
                  zones: prev.zones.map((entry) => entry.id === zoneId
                    ? { ...entry, cityCode: match.code, city: match.name }
                    : entry),
                }));
                setSavedForm((prev) => ({
                  ...prev,
                  zones: prev.zones.map((entry) => entry.id === zoneId
                    ? { ...entry, cityCode: match.code, city: match.name }
                    : entry),
                }));
              }
            }
          })
          .catch(() => {
            setCitiesByZone((prev) => ({ ...prev, [zoneId]: [] }));
            setFieldErrors((prev) => ({
              ...prev,
              [`zone.${zoneId}.cityCode`]: 'No fue posible cargar los municipios.',
            }));
          })
          .finally(() => {
            setCitiesLoadingByZone((prev) => ({ ...prev, [zoneId]: false }));
          });
      }
    });
  }, [form.zones, countries, citiesByZone, citiesLoadingByZone]);

  const handleChange = (key, value) => {
    setFeedback(null);
    setFieldErrors({});
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNestedChange = (parentKey, key, value) => {
    setFeedback(null);
    setFieldErrors({});
    setForm((prev) => ({
      ...prev,
      [parentKey]: {
        ...(prev[parentKey] || {}),
        [key]: value,
      },
    }));
  };

  const handleZoneChange = (zoneId, key, value) => {
    setFeedback(null);
    setFieldErrors({});
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.map((zone) => {
        if (zone.id !== zoneId) return zone;

        if (key === 'countryCode') {
          const country = countries.find((entry) => entry.code === value);
          return {
            ...zone,
            countryCode: value,
            country: country?.name || '',
            departmentCode: '',
            department: '',
            cityCode: '',
            city: '',
          };
        }

        if (key === 'departmentCode') {
          const region = (regionsByZone[zoneId] || []).find((entry) => entry.code === value);
          return {
            ...zone,
            departmentCode: value,
            department: region?.name || '',
            cityCode: '',
            city: '',
          };
        }

        if (key === 'cityCode') {
          const city = (citiesByZone[zoneId] || []).find((entry) => entry.code === value);
          return { ...zone, cityCode: value, city: city?.name || '' };
        }

        return {
          ...zone,
          [key]: value,
        };
      }),
    }));

    if (key === 'countryCode') {
      setRegionsByZone((prev) => ({ ...prev, [zoneId]: undefined }));
      setCitiesByZone((prev) => ({ ...prev, [zoneId]: [] }));
    }

    if (key === 'departmentCode') {
      setCitiesByZone((prev) => ({ ...prev, [zoneId]: undefined }));
    }
  };

  const handleAddZone = () => {
    setFeedback(null);
    setForm((prev) => ({
      ...prev,
      zones: [...prev.zones, buildDefaultZone()],
    }));
  };

  const handleRemoveZone = (zoneId) => {
    setFeedback(null);
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.filter((zone) => zone.id !== zoneId),
    }));

    setRegionsByZone((prev) => {
      const next = { ...prev };
      delete next[zoneId];
      return next;
    });

    setCitiesByZone((prev) => {
      const next = { ...prev };
      delete next[zoneId];
      return next;
    });

    setRegionsLoadingByZone((prev) => {
      const next = { ...prev };
      delete next[zoneId];
      return next;
    });

    setCitiesLoadingByZone((prev) => {
      const next = { ...prev };
      delete next[zoneId];
      return next;
    });
  };

  const previewRules = useMemo(() => {
    if (!form.active) {
      return 'Los envíos están desactivados. En checkout no se cobrará envío.';
    }

    if (form.mode === 'fixed') {
      const price = Number(form.fixedPrice || 0);
      const freeEnabled = form.freeShipping.enabled;
      const minimum = Number(form.freeShipping.minimum || 0);

      if (freeEnabled && minimum > 0) {
        return `Envío fijo de $${price.toLocaleString('es-CO')} y gratis desde $${minimum.toLocaleString('es-CO')}.`;
      }

      return `Envío fijo de $${price.toLocaleString('es-CO')} para todos los pedidos.`;
    }

    if (form.mode === 'zones') {
      const count = form.zones.filter((zone) => zone.city.trim() || zone.department.trim()).length;
      const fallback = Number(form.fallback.price || 0);
      const freeEnabled = form.freeShipping.enabled;
      const minimum = Number(form.freeShipping.minimum || 0);

      if (freeEnabled && minimum > 0) {
        return `Envío por ciudad/zona (${count} reglas) con tarifa de respaldo de $${fallback.toLocaleString('es-CO')} y envío gratis desde $${minimum.toLocaleString('es-CO')}.`;
      }

      return `Envío por ciudad/zona (${count} reglas) con tarifa de respaldo de $${fallback.toLocaleString('es-CO')}.`;
    }

    return '';
  }, [form]);

  const buildPayload = () => ({
    active: form.active,
    mode: form.mode,
    fixedPrice: form.fixedPrice === '' ? null : Number(form.fixedPrice),
    estimatedTime: form.estimatedTime.trim(),
    freeShipping: {
      enabled: form.freeShipping.enabled,
      minimum: form.freeShipping.minimum === '' ? null : Number(form.freeShipping.minimum),
    },
    fallback: {
      price: form.fallback.price === '' ? null : Number(form.fallback.price),
      eta: form.fallback.eta.trim(),
    },
    zones: form.zones.map((zone) => ({
      id: zone.id,
      countryCode: zone.countryCode.trim().toUpperCase(),
      country: zone.country.trim(),
      departmentCode: zone.departmentCode.trim(),
      department: zone.department.trim(),
      cityCode: zone.cityCode.trim(),
      city: zone.city.trim(),
      price: zone.price === '' ? null : Number(zone.price),
      eta: zone.eta.trim(),
    })),
  });

  const validateForm = () => {
    const errors = {};
    if (form.active && form.mode === 'fixed' && !(Number(form.fixedPrice) > 0)) {
      errors.fixedPrice = 'Escribe una tarifa fija mayor que cero.';
    }
    if (form.freeShipping.enabled && !(Number(form.freeShipping.minimum) > 0)) {
      errors['freeShipping.minimum'] = 'Define una compra mínima mayor que cero.';
    }
    if (form.active && form.mode === 'zones') {
      if (!form.zones.length) errors.zones = 'Agrega al menos un destino.';
      if (!(Number(form.fallback.price) > 0)) {
        errors['fallback.price'] = 'La tarifa de respaldo debe ser mayor que cero.';
      }
    }
    const seen = new Set();
    form.zones.forEach((zone, index) => {
      if (!zone.countryCode) errors[`zones.${index}.countryCode`] = 'Selecciona el país.';
      if (!zone.departmentCode) errors[`zones.${index}.departmentCode`] = 'Selecciona el departamento.';
      if (!zone.cityCode) errors[`zones.${index}.cityCode`] = 'Selecciona el municipio.';
      if (!(Number(zone.price) > 0)) errors[`zones.${index}.price`] = 'Escribe una tarifa mayor que cero.';
      const key = `${zone.countryCode}|${zone.departmentCode}|${zone.cityCode}`;
      if (seen.has(key)) errors[`zones.${index}.cityCode`] = 'Este destino ya está configurado.';
      seen.add(key);
    });
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      setFeedback({ type: 'error', text: 'Revisa los campos marcados antes de guardar.' });
      return;
    }
    try {
      setLoading(true);
      const response = await saveShippingRates({ settings: buildPayload(), revision });
      applyResponse(response);
      setFeedback({ type: 'success', text: response.message });
    } catch (err) {
      setFieldErrors(Object.fromEntries((err.details || []).map((item) => [item.field, item.message])));
      setFeedback({
        type: 'error',
        text: err.code === 'SHIPPING_RATES_CONFLICT'
          ? 'Las tarifas cambiaron en otra sesión. Recarga antes de volver a guardar.'
          : err.userMessage || err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDiscard = () => {
    setForm(normalizeEnvios(savedForm));
    setFieldErrors({});
    setFeedback({ type: 'info', text: 'Se descartaron los cambios sin guardar.' });
  };

  const inputClass =
    'shipping-field w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition';

  return (
    <div className="shipping-center grid gap-4">
      <section className="shipping-glass-hero overflow-hidden rounded-[28px] border">
        <div className="px-5 py-5 md:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <p className="shipping-accent text-xs font-bold uppercase tracking-[0.18em]">
                Centro de envíos
              </p>
              <h2 className="mt-1 text-2xl font-black tracking-tight">
                Envíos de {metadata.store.name || 'la tienda'}
              </h2>
              <p className="shipping-muted mt-1 text-sm leading-6">
                Primero decide cuánto pagará el cliente. Después elige cómo se entregará el paquete.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
                <span className="shipping-status inline-flex rounded-full border px-2.5 py-1" data-tone={metadata.readiness.ratesReady ? 'success' : 'warning'}>
                  Tarifas {metadata.readiness.ratesReady ? 'listas' : 'pendientes'}
                </span>
                <span className="shipping-status inline-flex rounded-full border px-2.5 py-1" data-tone={metadata.readiness.originReady ? 'success' : 'warning'}>
                  Origen {metadata.readiness.originReady ? 'completo' : 'por completar en Tienda'}
                </span>
                <span className="shipping-status inline-flex rounded-full border px-2.5 py-1" data-tone="primary">Versión {revision ?? 0}</span>
                <span className="shipping-status inline-flex rounded-full border px-2.5 py-1" data-tone={providerSummary.tone}>
                  {providerSummary.label}
                </span>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[560px]">
              <button
                type="button"
                onClick={() => setActiveView('rates')}
                data-active={activeView === 'rates'}
                className="shipping-nav-option group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition"
              >
                <span className="shipping-step-number rounded-lg px-2 py-1 text-xs font-black">
                  01
                </span>
                <span>
                  <span className="block text-sm font-bold">Cobro en checkout</span>
                  <span className="shipping-muted block text-xs">
                    Tarifas, ciudades y envío gratis
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('carrier')}
                data-active={activeView === 'carrier'}
                className="shipping-nav-option group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition"
              >
                <span className="shipping-step-number rounded-lg px-2 py-1 text-xs font-black">
                  02
                </span>
                <span>
                  <span className="block text-sm font-bold">Entrega del paquete</span>
                  <span className="shipping-muted block text-xs">
                    Manual o automática con Envia
                  </span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          role="status"
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            feedback.type === 'success'
              ? 'shipping-alert-success'
              : feedback.type === 'error'
                ? 'shipping-alert-danger'
                : 'shipping-soft-surface'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{feedback.text}</span>
            {feedback.type === 'error' && (
              <button type="button" onClick={load} className="shipping-secondary-action rounded-lg border px-3 py-1.5 text-xs font-bold">
                Recargar
              </button>
            )}
          </div>
        </div>
      )}

      {activeView === 'rates' ? (
        <section className="shipping-surface rounded-[28px] border p-4 shadow-sm md:p-5">
          <div className="mb-5 flex flex-col gap-3 border-b border-gray-100 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-xl font-black">¿Cuánto cobrará la tienda?</h3>
              <p className="shipping-muted mt-1 text-sm">
                Estas reglas solo calculan el valor que verá el cliente en el checkout.
              </p>
            </div>
            <label className="shipping-page-surface flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3">
              <span>
                <span className="block text-sm font-bold text-gray-900">Cobrar envío</span>
                <span className="block text-xs text-gray-500">Desactívalo solo si todos los envíos serán gratis</span>
              </span>
              <input
                type="checkbox"
                checked={form.active}
                onChange={() => handleChange('active', !form.active)}
                className="h-5 w-5"
              />
            </label>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleChange('mode', 'fixed')}
                  data-active={form.mode === 'fixed'}
                  className="shipping-choice rounded-2xl border p-4 text-left transition"
                >
                  <span className="text-sm font-black">Una sola tarifa</span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    El mismo precio para todas las ciudades.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('mode', 'zones')}
                  data-active={form.mode === 'zones'}
                  className="shipping-choice rounded-2xl border p-4 text-left transition"
                >
                  <span className="text-sm font-black">Precio por ciudad</span>
                  <span className="mt-1 block text-xs leading-5 text-gray-500">
                    Define valores distintos según el destino.
                  </span>
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-bold text-gray-700">
                    Tiempo general estimado
                  </span>
                  <input
                    value={form.estimatedTime}
                    onChange={(e) => handleChange('estimatedTime', e.target.value)}
                    className={inputClass}
                    placeholder="Ej: 2 a 5 días hábiles"
                  />
                </label>

                {form.mode === 'fixed' && (
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-bold text-gray-700">
                      Tarifa fija general
                    </span>
                  <input
                    type="number"
                    min="1"
                    value={form.fixedPrice}
                      onChange={(e) => handleChange('fixedPrice', e.target.value)}
                      className={inputClass}
                    placeholder="Ej: 12000"
                    aria-invalid={Boolean(fieldErrors.fixedPrice)}
                  />
                  {fieldErrors.fixedPrice && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors.fixedPrice}</span>}
                  </label>
                )}
              </div>

              {form.mode === 'zones' && (
                <div className="shipping-page-surface mt-5 overflow-hidden rounded-2xl border">
                  <div className="shipping-surface flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black">Ciudades con precio especial</p>
                      <p className="text-xs text-gray-500">
                        {form.zones.length} {form.zones.length === 1 ? 'regla creada' : 'reglas creadas'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddZone}
                      className="shipping-primary-action rounded-xl border px-4 py-2 text-sm font-bold transition"
                    >
                      + Agregar ciudad
                    </button>
                  </div>

                  <div className="max-h-[520px] overflow-y-auto p-3">
                    {form.zones.length === 0 ? (
                      <div className="shipping-surface rounded-xl border border-dashed p-6 text-center">
                        <p className="text-sm font-bold text-gray-800">Aún no hay ciudades</p>
                        <p className="mt-1 text-xs text-gray-500">Agrega la primera y define su precio.</p>
                        {fieldErrors.zones && <p className="shipping-danger-text mt-2 text-xs font-semibold">{fieldErrors.zones}</p>}
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {form.zones.map((zone, index) => {
                          const selectedCountry = countries.find((country) => country.code === zone.countryCode);
                          const zoneRegions = Array.isArray(regionsByZone[zone.id])
                            ? regionsByZone[zone.id]
                            : [];
                          const zoneCities = Array.isArray(citiesByZone[zone.id])
                            ? citiesByZone[zone.id]
                            : [];

                          return (
                            <article key={zone.id} className="shipping-surface rounded-2xl border p-4 shadow-sm">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black text-gray-900">Destino {index + 1}</p>
                                  <p className="text-xs text-gray-500">{zone.city || zone.department || 'Ubicación sin completar'}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveZone(zone.id)}
                                  className="shipping-danger-text rounded-lg px-2.5 py-1.5 text-xs font-bold"
                                >
                                  Eliminar
                                </button>
                              </div>

                              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">País</span>
                                  <select
                                    value={zone.countryCode}
                                    onChange={(e) => handleZoneChange(zone.id, 'countryCode', e.target.value)}
                                    disabled={countriesLoading}
                                    className={inputClass}
                                  >
                                    <option value="">{countriesLoading ? 'Cargando...' : 'Selecciona país'}</option>
                                    {countries.map((country) => (
                                      <option key={country.code} value={country.code}>{country.name}</option>
                                    ))}
                                  </select>
                                  {fieldErrors[`zones.${index}.countryCode`] && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${index}.countryCode`]}</span>}
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Departamento / región</span>
                                  {selectedCountry?.code ? (
                                    <select
                                      value={zone.departmentCode}
                                      onChange={(e) => handleZoneChange(zone.id, 'departmentCode', e.target.value)}
                                      disabled={regionsLoadingByZone[zone.id]}
                                      className={inputClass}
                                    >
                                      <option value="">{regionsLoadingByZone[zone.id] ? 'Cargando...' : 'Selecciona departamento'}</option>
                                      {zoneRegions.map((region) => (
                                        <option key={region.code} value={region.code}>{region.name}</option>
                                      ))}
                                    </select>
                                  ) : <input value="" disabled className={inputClass} placeholder="Primero selecciona el país" />}
                                  {(fieldErrors[`zones.${index}.departmentCode`] || fieldErrors[`zone.${zone.id}.departmentCode`]) && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${index}.departmentCode`] || fieldErrors[`zone.${zone.id}.departmentCode`]}</span>}
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Ciudad</span>
                                  {selectedCountry?.code ? (
                                    <select
                                      value={zone.cityCode}
                                      onChange={(e) => handleZoneChange(zone.id, 'cityCode', e.target.value)}
                                      disabled={!zone.departmentCode || citiesLoadingByZone[zone.id]}
                                      className={inputClass}
                                    >
                                      <option value="">{!zone.departmentCode ? 'Primero el departamento' : citiesLoadingByZone[zone.id] ? 'Cargando...' : 'Selecciona municipio'}</option>
                                      {zoneCities.map((city) => (
                                        <option key={city.code || city.name} value={city.code}>{city.name}</option>
                                      ))}
                                    </select>
                                  ) : <input value="" disabled className={inputClass} placeholder="Primero selecciona el país" />}
                                  {(fieldErrors[`zones.${index}.cityCode`] || fieldErrors[`zone.${zone.id}.cityCode`]) && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${index}.cityCode`] || fieldErrors[`zone.${zone.id}.cityCode`]}</span>}
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Tarifa</span>
                                  <input
                                    type="number"
                                    min="1"
                                    value={zone.price}
                                    onChange={(e) => handleZoneChange(zone.id, 'price', e.target.value)}
                                    className={inputClass}
                                    placeholder="Ej: 12000"
                                  />
                                  {fieldErrors[`zones.${index}.price`] && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${index}.price`]}</span>}
                                </label>

                                <label className="block md:col-span-1 xl:col-span-2">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Tiempo de entrega</span>
                                  <input
                                    value={zone.eta}
                                    onChange={(e) => handleZoneChange(zone.id, 'eta', e.target.value)}
                                    className={inputClass}
                                    placeholder="Ej: 1 a 2 días hábiles"
                                  />
                                </label>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <aside className="grid content-start gap-3 xl:sticky xl:top-4">
              <div className="shipping-preview rounded-2xl p-4">
                <p className="shipping-accent text-xs font-bold uppercase tracking-[0.16em]">Así funcionará</p>
                <p className="mt-2 text-sm font-semibold leading-6">
                  {loadingConfig ? 'Cargando configuración...' : previewRules}
                </p>
              </div>

              {form.mode === 'zones' && (
                <div className="rounded-2xl border border-gray-200 p-4">
                  <p className="text-sm font-black text-gray-900">Si una ciudad no está en la lista</p>
                  <div className="mt-3 grid gap-3">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-gray-600">Tarifa de respaldo</span>
                      <input
                        type="number"
                        min="1"
                        value={form.fallback.price}
                        onChange={(e) => handleNestedChange('fallback', 'price', e.target.value)}
                        className={inputClass}
                        placeholder="Ej: 20000"
                        aria-invalid={Boolean(fieldErrors['fallback.price'])}
                      />
                      {fieldErrors['fallback.price'] && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors['fallback.price']}</span>}
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-gray-600">Tiempo de respaldo</span>
                      <input
                        value={form.fallback.eta}
                        onChange={(e) => handleNestedChange('fallback', 'eta', e.target.value)}
                        className={inputClass}
                        placeholder="Ej: 3 a 6 días hábiles"
                      />
                    </label>
                  </div>
                </div>
              )}

              <div className="shipping-surface rounded-2xl border p-4">
                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <span>
                    <span className="block text-sm font-black text-gray-900">Envío gratis</span>
                    <span className="mt-1 block text-xs leading-5 text-gray-500">Se aplicará al superar un valor mínimo.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.freeShipping.enabled}
                    onChange={() => handleNestedChange('freeShipping', 'enabled', !form.freeShipping.enabled)}
                    className="mt-0.5 h-5 w-5"
                  />
                </label>
                {form.freeShipping.enabled && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-bold text-gray-600">Compra mínima</span>
                    <input
                      type="number"
                      min="1"
                      value={form.freeShipping.minimum}
                      onChange={(e) => handleNestedChange('freeShipping', 'minimum', e.target.value)}
                      className={inputClass}
                      placeholder="Ej: 150000"
                      aria-invalid={Boolean(fieldErrors['freeShipping.minimum'])}
                    />
                    {fieldErrors['freeShipping.minimum'] && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors['freeShipping.minimum']}</span>}
                  </label>
                )}
              </div>

              <div className={`rounded-2xl border p-4 ${metadata.readiness.originReady ? 'shipping-alert-success' : 'shipping-alert-warning'}`}>
                <p className="text-sm font-black">Origen de despacho</p>
                <p className="mt-1 text-xs leading-5">
                  {metadata.readiness.originReady
                    ? `${metadata.store.city}, ${metadata.store.department} · configurado en Tienda.`
                    : 'Completa dirección, municipio y departamento en Configuración → Tienda.'}
                </p>
              </div>

              <div className="shipping-surface rounded-2xl border p-4">
                <p className="text-sm font-black">{dirty ? 'Tienes cambios sin guardar' : 'Información sincronizada'}</p>
                <p className="shipping-muted mt-1 text-xs">
                  Versión {revision ?? 0}{metadata.updatedBy ? ` · ${metadata.updatedBy}` : ''}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={!dirty || loading}
                    className="shipping-secondary-action rounded-xl border px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || loading || loadingConfig}
                    className="shipping-primary-action rounded-xl border px-3 py-2.5 text-sm font-black transition disabled:opacity-50"
                  >
                    {loading ? 'Guardando...' : 'Guardar tarifas'}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </section>
      ) : (
        <ShippingProvidersCard onStatusChange={setProviderState} />
      )}
    </div>
  );
}
