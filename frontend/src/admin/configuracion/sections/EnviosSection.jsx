// src/admin/configuracion/sections/EnviosSection.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../../../lib/api';
import { fetchSiteSettings, saveSiteSettings } from '../../../lib/siteSettingsApi';
import ShippingProvidersCard from './envios/ShippingProvidersCard';
import './envios/ShippingCenter.css';

function buildDefaultZone() {
  return {
    id: `zone_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    country: 'Colombia',
    department: '',
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
    country:
      typeof raw.country === 'string' && raw.country.trim()
        ? raw.country
        : 'Colombia',
    department: typeof raw.department === 'string' ? raw.department : '',
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

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);

  const [regionsByZone, setRegionsByZone] = useState({});
  const [regionsLoadingByZone, setRegionsLoadingByZone] = useState({});

  const [citiesByZone, setCitiesByZone] = useState({});
  const [citiesLoadingByZone, setCitiesLoadingByZone] = useState({});

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      try {
        setLoadingConfig(true);
        const data = await fetchSiteSettings();
        if (cancel) return;

        const envios = data?.theme?.global?.envios || {};
        setForm(normalizeEnvios(envios));
      } catch (err) {
        console.error('Error cargando envíos', err);
      } finally {
        if (!cancel) setLoadingConfig(false);
      }
    };

    load();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    let cancel = false;

    const loadCountries = async () => {
      try {
        setCountriesLoading(true);
        const res = await api.get('/api/geo/countries');
        if (cancel) return;
        setCountries(Array.isArray(res.data) ? res.data : []);
      } catch (error) {
        if (!cancel) {
          console.error('Error cargando países:', error);
          setCountries([]);
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
      const selectedCountry = countries.find(
        (c) => c.name?.toLowerCase() === String(zone.country || '').toLowerCase()
      );

      if (selectedCountry?.code !== 'CO') {
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
          .get('/api/geo/regions', { params: { country: 'CO' } })
          .then((res) => {
            setRegionsByZone((prev) => ({
              ...prev,
              [zoneId]: Array.isArray(res.data) ? res.data : [],
            }));
          })
          .catch((error) => {
            console.error('Error cargando departamentos:', error);
            setRegionsByZone((prev) => ({ ...prev, [zoneId]: [] }));
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
      const selectedCountry = countries.find(
        (c) => c.name?.toLowerCase() === String(zone.country || '').toLowerCase()
      );

      if (selectedCountry?.code !== 'CO' || !zone.department) {
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
              country: 'CO',
              region: zone.department,
              limit: 10000,
            },
          })
          .then((res) => {
            setCitiesByZone((prev) => ({
              ...prev,
              [zoneId]: Array.isArray(res.data) ? res.data : [],
            }));
          })
          .catch((error) => {
            console.error('Error cargando ciudades:', error);
            setCitiesByZone((prev) => ({ ...prev, [zoneId]: [] }));
          })
          .finally(() => {
            setCitiesLoadingByZone((prev) => ({ ...prev, [zoneId]: false }));
          });
      }
    });
  }, [form.zones, countries, citiesByZone, citiesLoadingByZone]);

  const handleChange = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleNestedChange = (parentKey, key, value) => {
    setForm((prev) => ({
      ...prev,
      [parentKey]: {
        ...(prev[parentKey] || {}),
        [key]: value,
      },
    }));
  };

  const handleZoneChange = (zoneId, key, value) => {
    setForm((prev) => ({
      ...prev,
      zones: prev.zones.map((zone) => {
        if (zone.id !== zoneId) return zone;

        if (key === 'country') {
          return {
            ...zone,
            country: value,
            department: '',
            city: '',
          };
        }

        if (key === 'department') {
          return {
            ...zone,
            department: value,
            city: '',
          };
        }

        return {
          ...zone,
          [key]: value,
        };
      }),
    }));

    if (key === 'country') {
      setRegionsByZone((prev) => ({ ...prev, [zoneId]: undefined }));
      setCitiesByZone((prev) => ({ ...prev, [zoneId]: [] }));
    }

    if (key === 'department') {
      setCitiesByZone((prev) => ({ ...prev, [zoneId]: undefined }));
    }
  };

  const handleAddZone = () => {
    setForm((prev) => ({
      ...prev,
      zones: [...prev.zones, buildDefaultZone()],
    }));
  };

  const handleRemoveZone = (zoneId) => {
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

  const handleSave = async () => {
    try {
      setLoading(true);

      const data = await fetchSiteSettings();

      const cleanedZones = form.zones
        .map((zone) => ({
          id: zone.id,
          country: zone.country.trim() || 'Colombia',
          department: zone.department.trim(),
          city: zone.city.trim(),
          price: zone.price === '' ? '' : Number(zone.price),
          eta: zone.eta.trim(),
        }))
        .filter((zone) => zone.city || zone.department);

      const payloadEnvios = {
        active: form.active,
        mode: form.mode,
        fixedPrice: form.fixedPrice === '' ? '' : Number(form.fixedPrice),
        estimatedTime: form.estimatedTime.trim(),
        freeShipping: {
          enabled: form.freeShipping.enabled,
          minimum:
            form.freeShipping.minimum === ''
              ? ''
              : Number(form.freeShipping.minimum),
        },
        fallback: {
          price: form.fallback.price === '' ? '' : Number(form.fallback.price),
          eta: form.fallback.eta.trim(),
        },
        zones: cleanedZones,
      };

      const updated = {
        ...data,
        theme: {
          ...data.theme,
          global: {
            ...data.theme?.global,
            envios: payloadEnvios,
          },
        },
      };

      await saveSiteSettings(updated);

      alert('✅ Configuración de envíos guardada');
    } catch (err) {
      console.error(err);
      alert('❌ Error guardando envíos');
    } finally {
      setLoading(false);
    }
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
                Configura el envío sin mezclar procesos
              </h2>
              <p className="shipping-muted mt-1 text-sm leading-6">
                Primero decide cuánto pagará el cliente. Después elige cómo se entregará el paquete.
              </p>
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
                      value={form.fixedPrice}
                      onChange={(e) => handleChange('fixedPrice', e.target.value)}
                      className={inputClass}
                      placeholder="Ej: 12000"
                    />
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
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {form.zones.map((zone, index) => {
                          const selectedCountry = countries.find(
                            (country) =>
                              country.name?.toLowerCase() ===
                              String(zone.country || '').toLowerCase()
                          );
                          const isColombia = selectedCountry?.code === 'CO';
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
                                    value={zone.country}
                                    onChange={(e) => handleZoneChange(zone.id, 'country', e.target.value)}
                                    disabled={countriesLoading}
                                    className={inputClass}
                                  >
                                    <option value="">{countriesLoading ? 'Cargando...' : 'Selecciona país'}</option>
                                    {countries.map((country) => (
                                      <option key={country.code} value={country.name}>{country.name}</option>
                                    ))}
                                  </select>
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Departamento / región</span>
                                  {isColombia ? (
                                    <select
                                      value={zone.department}
                                      onChange={(e) => handleZoneChange(zone.id, 'department', e.target.value)}
                                      disabled={regionsLoadingByZone[zone.id]}
                                      className={inputClass}
                                    >
                                      <option value="">{regionsLoadingByZone[zone.id] ? 'Cargando...' : 'Selecciona departamento'}</option>
                                      {zoneRegions.map((region) => (
                                        <option key={region.code} value={region.code}>{region.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      value={zone.department}
                                      onChange={(e) => handleZoneChange(zone.id, 'department', e.target.value)}
                                      className={inputClass}
                                      placeholder="Ej: Magdalena"
                                    />
                                  )}
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Ciudad</span>
                                  {isColombia ? (
                                    <select
                                      value={zone.city}
                                      onChange={(e) => handleZoneChange(zone.id, 'city', e.target.value)}
                                      disabled={!zone.department || citiesLoadingByZone[zone.id]}
                                      className={inputClass}
                                    >
                                      <option value="">{!zone.department ? 'Primero el departamento' : citiesLoadingByZone[zone.id] ? 'Cargando...' : 'Selecciona ciudad'}</option>
                                      {zoneCities.map((city) => (
                                        <option key={city.name} value={city.name}>{city.name}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      value={zone.city}
                                      onChange={(e) => handleZoneChange(zone.id, 'city', e.target.value)}
                                      className={inputClass}
                                      placeholder="Ej: Santa Marta"
                                    />
                                  )}
                                </label>

                                <label className="block">
                                  <span className="mb-1 block text-xs font-bold text-gray-600">Tarifa</span>
                                  <input
                                    type="number"
                                    value={zone.price}
                                    onChange={(e) => handleZoneChange(zone.id, 'price', e.target.value)}
                                    className={inputClass}
                                    placeholder="Ej: 12000"
                                  />
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
                        value={form.fallback.price}
                        onChange={(e) => handleNestedChange('fallback', 'price', e.target.value)}
                        className={inputClass}
                        placeholder="Ej: 20000"
                      />
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
                      value={form.freeShipping.minimum}
                      onChange={(e) => handleNestedChange('freeShipping', 'minimum', e.target.value)}
                      className={inputClass}
                      placeholder="Ej: 150000"
                    />
                  </label>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="shipping-primary-action w-full rounded-2xl border px-5 py-3 text-sm font-black transition disabled:opacity-60"
              >
                {loading ? 'Guardando...' : 'Guardar tarifas'}
              </button>
            </aside>
          </div>
        </section>
      ) : (
        <ShippingProvidersCard />
      )}
    </div>
  );
}
