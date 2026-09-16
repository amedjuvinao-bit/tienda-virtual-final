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
  const [zoneEditor, setZoneEditor] = useState(null);

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
    if (!zoneEditor) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') handleCancelZoneEditor();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [zoneEditor]);

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
    const nextZone = buildDefaultZone();
    setFeedback(null);
    setForm((prev) => ({
      ...prev,
      zones: [...prev.zones, nextZone],
    }));
    setZoneEditor({ zoneId: nextZone.id, initialZone: null });
  };

  const handleEditZone = (zone) => {
    setZoneEditor({ zoneId: zone.id, initialZone: { ...zone } });
  };

  const handleCancelZoneEditor = () => {
    if (!zoneEditor) return;
    setForm((prev) => ({
      ...prev,
      zones: zoneEditor.initialZone
        ? prev.zones.map((zone) => zone.id === zoneEditor.zoneId
          ? { ...zoneEditor.initialZone }
          : zone)
        : prev.zones.filter((zone) => zone.id !== zoneEditor.zoneId),
    }));
    setFieldErrors({});
    setZoneEditor(null);
  };

  const handleConfirmZoneEditor = () => {
    const index = form.zones.findIndex((zone) => zone.id === zoneEditor?.zoneId);
    if (index < 0) return;
    const zone = form.zones[index];
    const errors = {};
    if (!zone.countryCode) errors[`zones.${index}.countryCode`] = 'Selecciona el país.';
    if (!zone.departmentCode) errors[`zones.${index}.departmentCode`] = 'Selecciona el departamento.';
    if (!zone.cityCode) errors[`zones.${index}.cityCode`] = 'Selecciona el municipio.';
    if (!(Number(zone.price) > 0)) errors[`zones.${index}.price`] = 'Escribe una tarifa mayor que cero.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setZoneEditor(null);
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
    if (zoneEditor?.zoneId === zoneId) setZoneEditor(null);
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
  const editedZoneIndex = form.zones.findIndex((zone) => zone.id === zoneEditor?.zoneId);
  const editedZone = editedZoneIndex >= 0 ? form.zones[editedZoneIndex] : null;
  const editedCountry = editedZone
    ? countries.find((country) => country.code === editedZone.countryCode)
    : null;
  const editedRegions = editedZone && Array.isArray(regionsByZone[editedZone.id])
    ? regionsByZone[editedZone.id]
    : [];
  const editedCities = editedZone && Array.isArray(citiesByZone[editedZone.id])
    ? citiesByZone[editedZone.id]
    : [];

  return (
    <div className="shipping-center grid gap-4">
      <section className="shipping-glass-hero rounded-2xl border px-3 py-3 md:px-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-black tracking-tight">
                Envíos de {metadata.store.name || 'la tienda'}
              </h2>
              <span className="shipping-status inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold" data-tone={metadata.readiness.ratesReady ? 'success' : 'warning'}>
                Tarifas {metadata.readiness.ratesReady ? 'listas' : 'pendientes'}
              </span>
              <span className="shipping-status inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold" data-tone={providerSummary.tone}>
                {providerSummary.label}
              </span>
            </div>
            <p className="shipping-muted mt-0.5 text-xs">
              Configura el cobro al cliente y la entrega del pedido en dos pasos.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:w-[500px]">
              <button
                type="button"
                onClick={() => setActiveView('rates')}
                data-active={activeView === 'rates'}
                className="shipping-nav-option group flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition"
              >
                <span className="shipping-step-number rounded-md px-2 py-1 text-xs font-black">
                  01
                </span>
                <span>
                  <span className="block text-sm font-bold">Cobro en checkout</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('carrier')}
                data-active={activeView === 'carrier'}
                className="shipping-nav-option group flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition"
              >
                <span className="shipping-step-number rounded-md px-2 py-1 text-xs font-black">
                  02
                </span>
                <span>
                  <span className="block text-sm font-bold">Entrega del paquete</span>
                </span>
              </button>
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
        <section className="shipping-surface rounded-2xl border p-3 shadow-sm md:p-4">
          <div className="mb-3 flex flex-col gap-2 border-b border-gray-100 pb-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-black">¿Cuánto cobrará la tienda?</h3>
              <p className="shipping-muted mt-0.5 text-xs">
                Define la tarifa que verá el cliente antes de pagar.
              </p>
            </div>
            <label className="shipping-page-surface flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2">
              <span>
                <span className="block text-sm font-bold text-gray-900">Cobrar envío</span>
                <span className="block text-[11px] text-gray-500">Desactiva solo si siempre será gratis</span>
              </span>
              <input
                type="checkbox"
                checked={form.active}
                onChange={() => handleChange('active', !form.active)}
                className="h-5 w-5"
              />
            </label>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="min-w-0">
              <div className="shipping-page-surface grid gap-2 rounded-xl border p-1.5 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => handleChange('mode', 'fixed')}
                  data-active={form.mode === 'fixed'}
                  className="shipping-choice rounded-lg border px-3 py-2 text-left transition"
                >
                  <span className="text-sm font-black">Una sola tarifa</span>
                  <span className="ml-2 text-xs text-gray-500">
                    Mismo precio nacional
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleChange('mode', 'zones')}
                  data-active={form.mode === 'zones'}
                  className="shipping-choice rounded-lg border px-3 py-2 text-left transition"
                >
                  <span className="text-sm font-black">Precio por ciudad</span>
                  <span className="ml-2 text-xs text-gray-500">
                    Valores según destino
                  </span>
                </button>
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold text-gray-700">
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
                    <span className="mb-1 block text-xs font-bold text-gray-700">
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

              <div className="shipping-page-surface mt-3 grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)] md:items-center">
                <div>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.freeShipping.enabled}
                      onChange={() => handleNestedChange('freeShipping', 'enabled', !form.freeShipping.enabled)}
                      className="h-4 w-4"
                      aria-label="Envío gratis"
                    />
                    <span className="text-sm font-black text-gray-900">Envío gratis desde un monto mínimo</span>
                  </label>
                  <p className="shipping-muted mt-0.5 pl-6 text-[11px]">Se aplica automáticamente cuando el pedido alcanza el valor definido.</p>
                </div>
                {form.freeShipping.enabled ? (
                  <label className="block">
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
                ) : (
                  <span className="shipping-muted text-xs font-semibold md:text-right">No se aplicará envío gratis</span>
                )}
              </div>

              {form.mode === 'zones' && (
                <>
                  <div className="shipping-page-surface mt-3 grid gap-3 rounded-xl border p-3 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-gray-600">Tarifa para otras ciudades</span>
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
                      <span className="mb-1 block text-xs font-bold text-gray-600">Tiempo para otras ciudades</span>
                      <input
                        value={form.fallback.eta}
                        onChange={(e) => handleNestedChange('fallback', 'eta', e.target.value)}
                        className={inputClass}
                        placeholder="Ej: 3 a 6 días hábiles"
                      />
                    </label>
                    <p className="shipping-muted text-[11px] md:col-span-2">Si una ciudad no está en la lista, se usarán estos valores de respaldo.</p>
                  </div>

                <div className="shipping-page-surface mt-3 overflow-hidden rounded-xl border">
                  <div className="shipping-surface flex flex-col gap-2 border-b px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black">Ciudades con precio especial</p>
                      <p className="text-[11px] text-gray-500">
                        {form.zones.length} {form.zones.length === 1 ? 'regla creada' : 'reglas creadas'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddZone}
                      className="shipping-primary-action rounded-lg border px-3 py-1.5 text-xs font-bold transition"
                    >
                      + Agregar ciudad
                    </button>
                  </div>

                  <div>
                    {form.zones.length === 0 ? (
                      <div className="m-3 rounded-xl border border-dashed p-4 text-center">
                        <p className="text-sm font-bold text-gray-800">Aún no hay ciudades</p>
                        <p className="mt-1 text-xs text-gray-500">Agrega la primera y define su precio.</p>
                        {fieldErrors.zones && <p className="shipping-danger-text mt-2 text-xs font-semibold">{fieldErrors.zones}</p>}
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        <div className="shipping-zone-header hidden px-3 py-2 text-[10px] font-black uppercase tracking-wide text-gray-500 md:grid">
                          <span>Destino</span><span>Tarifa</span><span>Entrega</span><span className="text-right">Acciones</span>
                        </div>
                        {form.zones.map((zone, index) => (
                          <article key={zone.id} className="shipping-zone-row grid items-center gap-2 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-gray-900">{zone.city || `Destino ${index + 1}`}</p>
                              <p className="truncate text-[11px] text-gray-500">{[zone.department, zone.country].filter(Boolean).join(', ') || 'Ubicación sin completar'}</p>
                            </div>
                            <div>
                              <span className="md:hidden text-[10px] font-bold uppercase text-gray-500">Tarifa · </span>
                              <span className="text-sm font-bold">{Number(zone.price) > 0 ? `$${Number(zone.price).toLocaleString('es-CO')}` : 'Pendiente'}</span>
                            </div>
                            <div className="min-w-0">
                              <span className="md:hidden text-[10px] font-bold uppercase text-gray-500">Entrega · </span>
                              <span className="truncate text-xs text-gray-600">{zone.eta || form.estimatedTime || 'Sin definir'}</span>
                            </div>
                            <div className="flex justify-end gap-1.5">
                              <button type="button" onClick={() => handleEditZone(zone)} className="shipping-secondary-action rounded-lg border px-2.5 py-1.5 text-xs font-bold">
                                Editar
                              </button>
                              <button type="button" onClick={() => handleRemoveZone(zone.id)} className="shipping-danger-text rounded-lg px-2 py-1.5 text-xs font-bold">
                                Eliminar
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                </>
              )}
            </div>

            <aside className="grid content-start gap-3 xl:sticky xl:top-3">
              <div className="shipping-preview rounded-xl p-3">
                <p className="shipping-accent text-xs font-bold uppercase tracking-[0.16em]">Así funcionará</p>
                <p className="mt-1.5 text-sm font-semibold leading-5">
                  {loadingConfig ? 'Cargando configuración...' : previewRules}
                </p>
              </div>

              <div className={`rounded-xl border p-3 ${metadata.readiness.originReady ? 'shipping-alert-success' : 'shipping-alert-warning'}`}>
                <p className="text-sm font-black">Origen de despacho</p>
                <p className="mt-1 text-xs leading-4">
                  {metadata.readiness.originReady
                    ? `${metadata.store.city}, ${metadata.store.department} · configurado en Tienda.`
                    : 'Completa dirección, municipio y departamento en Configuración → Tienda.'}
                </p>
              </div>

              <div className="shipping-surface rounded-xl border p-3">
                <p className="text-sm font-black">{dirty ? 'Tienes cambios sin guardar' : 'Información sincronizada'}</p>
                <p className="shipping-muted mt-1 text-xs">
                  Versión {revision ?? 0}{metadata.updatedBy ? ` · ${metadata.updatedBy}` : ''}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleDiscard}
                    disabled={!dirty || loading}
                    className="shipping-secondary-action rounded-lg border px-3 py-2 text-sm font-bold disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || loading || loadingConfig}
                    className="shipping-primary-action rounded-lg border px-3 py-2 text-sm font-black transition disabled:opacity-50"
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

      {editedZone && (
        <div
          className="shipping-modal-backdrop fixed inset-0 z-[80] flex items-center justify-center p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) handleCancelZoneEditor();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="shipping-zone-dialog-title"
            className="shipping-surface w-full max-w-2xl overflow-hidden rounded-2xl border shadow-2xl"
          >
            <header className="shipping-soft-surface flex items-start justify-between gap-4 border-b px-4 py-3">
              <div>
                <p className="shipping-accent text-[11px] font-black uppercase tracking-[0.16em]">Tarifa especial</p>
                <h4 id="shipping-zone-dialog-title" className="mt-0.5 text-lg font-black">
                  Destino {editedZoneIndex + 1}
                </h4>
                <p className="shipping-muted text-xs">Selecciona la ubicación y define cuánto cobrará la tienda.</p>
              </div>
              <button
                type="button"
                onClick={handleCancelZoneEditor}
                aria-label="Cerrar editor de destino"
                className="shipping-secondary-action rounded-lg border px-2.5 py-1.5 text-sm font-black"
              >
                ×
              </button>
            </header>

            <div className="grid gap-3 p-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">País</span>
                <select
                  value={editedZone.countryCode}
                  onChange={(e) => handleZoneChange(editedZone.id, 'countryCode', e.target.value)}
                  disabled={countriesLoading}
                  className={inputClass}
                >
                  <option value="">{countriesLoading ? 'Cargando...' : 'Selecciona país'}</option>
                  {countries.map((country) => (
                    <option key={country.code} value={country.code}>{country.name}</option>
                  ))}
                </select>
                {fieldErrors[`zones.${editedZoneIndex}.countryCode`] && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${editedZoneIndex}.countryCode`]}</span>}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">Departamento / región</span>
                {editedCountry?.code ? (
                  <select
                    value={editedZone.departmentCode}
                    onChange={(e) => handleZoneChange(editedZone.id, 'departmentCode', e.target.value)}
                    disabled={regionsLoadingByZone[editedZone.id]}
                    className={inputClass}
                  >
                    <option value="">{regionsLoadingByZone[editedZone.id] ? 'Cargando...' : 'Selecciona departamento'}</option>
                    {editedRegions.map((region) => (
                      <option key={region.code} value={region.code}>{region.name}</option>
                    ))}
                  </select>
                ) : <input value="" disabled className={inputClass} placeholder="Primero selecciona el país" />}
                {(fieldErrors[`zones.${editedZoneIndex}.departmentCode`] || fieldErrors[`zone.${editedZone.id}.departmentCode`]) && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${editedZoneIndex}.departmentCode`] || fieldErrors[`zone.${editedZone.id}.departmentCode`]}</span>}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">Ciudad</span>
                {editedCountry?.code ? (
                  <select
                    value={editedZone.cityCode}
                    onChange={(e) => handleZoneChange(editedZone.id, 'cityCode', e.target.value)}
                    disabled={!editedZone.departmentCode || citiesLoadingByZone[editedZone.id]}
                    className={inputClass}
                  >
                    <option value="">{!editedZone.departmentCode ? 'Primero el departamento' : citiesLoadingByZone[editedZone.id] ? 'Cargando...' : 'Selecciona municipio'}</option>
                    {editedCities.map((city) => (
                      <option key={city.code || city.name} value={city.code}>{city.name}</option>
                    ))}
                  </select>
                ) : <input value="" disabled className={inputClass} placeholder="Primero selecciona el país" />}
                {(fieldErrors[`zones.${editedZoneIndex}.cityCode`] || fieldErrors[`zone.${editedZone.id}.cityCode`]) && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${editedZoneIndex}.cityCode`] || fieldErrors[`zone.${editedZone.id}.cityCode`]}</span>}
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-bold text-gray-600">Tarifa</span>
                <input
                  type="number"
                  min="1"
                  value={editedZone.price}
                  onChange={(e) => handleZoneChange(editedZone.id, 'price', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: 12000"
                />
                {fieldErrors[`zones.${editedZoneIndex}.price`] && <span className="shipping-danger-text mt-1 block text-xs font-semibold">{fieldErrors[`zones.${editedZoneIndex}.price`]}</span>}
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs font-bold text-gray-600">Tiempo de entrega</span>
                <input
                  value={editedZone.eta}
                  onChange={(e) => handleZoneChange(editedZone.id, 'eta', e.target.value)}
                  className={inputClass}
                  placeholder="Ej: 1 a 2 días hábiles"
                />
              </label>
            </div>

            <footer className="shipping-page-surface flex justify-end gap-2 border-t px-4 py-3">
              <button type="button" onClick={handleCancelZoneEditor} className="shipping-secondary-action rounded-lg border px-4 py-2 text-sm font-bold">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmZoneEditor} className="shipping-primary-action rounded-lg border px-4 py-2 text-sm font-black">
                Usar este destino
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
