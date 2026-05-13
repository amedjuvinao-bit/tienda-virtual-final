// src/admin/configuracion/sections/EnviosSection.jsx
import React, { useEffect, useMemo, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import api from '../../../lib/api';
import { fetchSiteSettings, saveSiteSettings } from '../../../lib/siteSettingsApi';

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
        setRegionsByZone((prev) => ({ ...prev, [zoneId]: [] }));
        setCitiesByZone((prev) => ({ ...prev, [zoneId]: [] }));
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
        setCitiesByZone((prev) => ({ ...prev, [zoneId]: [] }));
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

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Configuración de envíos"
        description="Define cómo el sistema calculará el valor del envío en checkout según ciudad, tarifa base y mínimo para envío gratis."
      >
        <div className="grid gap-5">
          <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
            <div>
              <p className="font-semibold text-gray-800">Activar envíos</p>
              <p className="text-sm text-gray-500">
                Si lo desactivas, el checkout no cobrará envío.
              </p>
            </div>

            <input
              type="checkbox"
              checked={form.active}
              onChange={() => handleChange('active', !form.active)}
              className="h-5 w-5 accent-pink-500"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Modo de cálculo
              </span>

              <select
                value={form.mode}
                onChange={(e) => handleChange('mode', e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="fixed">Tarifa general fija</option>
                <option value="zones">Tarifa por ciudad / zona</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                Tiempo general estimado
              </span>

              <input
                value={form.estimatedTime}
                onChange={(e) => handleChange('estimatedTime', e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                placeholder="Ej: 2 a 5 días hábiles"
              />
            </label>
          </div>

          {form.mode === 'fixed' && (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">
                  Tarifa fija general
                </span>

                <input
                  type="number"
                  value={form.fixedPrice}
                  onChange={(e) => handleChange('fixedPrice', e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  placeholder="Ej: 12000"
                />
              </label>
            </div>
          )}

          {form.mode === 'zones' && (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-semibold text-gray-800">
                      Tarifas por ciudad / zona
                    </p>
                    <p className="text-sm text-gray-500">
                      Aquí defines cuánto cuesta enviar a cada ciudad. En checkout el cliente solo escoge su ciudad y el sistema calcula el valor.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddZone}
                    className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-medium text-white hover:bg-pink-600"
                  >
                    + Agregar ciudad
                  </button>
                </div>

                <div className="mt-4 grid gap-4">
                  {form.zones.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                      Todavía no has agregado ciudades. Crea al menos una tarifa específica para que checkout pueda reconocerla.
                    </div>
                  ) : (
                    form.zones.map((zone, index) => {
                      const selectedCountry = countries.find(
                        (c) =>
                          c.name?.toLowerCase() ===
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
                        <div
                          key={zone.id}
                          className="rounded-xl border border-gray-200 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-gray-800">
                              Ciudad / zona #{index + 1}
                            </p>

                            <button
                              type="button"
                              onClick={() => handleRemoveZone(zone.id)}
                              className="text-sm font-medium text-red-500 hover:text-red-600"
                            >
                              Eliminar
                            </button>
                          </div>

                          <div className="grid gap-4 md:grid-cols-2">
                            <label className="block">
                              <span className="mb-1 block text-sm font-medium text-gray-700">
                                País
                              </span>

                              <select
                                value={zone.country}
                                onChange={(e) =>
                                  handleZoneChange(zone.id, 'country', e.target.value)
                                }
                                disabled={countriesLoading}
                                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                              >
                                <option value="">
                                  {countriesLoading
                                    ? 'Cargando países...'
                                    : 'Selecciona país'}
                                </option>
                                {countries.map((country) => (
                                  <option key={country.code} value={country.name}>
                                    {country.name}
                                  </option>
                                ))}
                              </select>
                            </label>

                            {isColombia ? (
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">
                                  Departamento / región
                                </span>

                                <select
                                  value={zone.department}
                                  onChange={(e) =>
                                    handleZoneChange(
                                      zone.id,
                                      'department',
                                      e.target.value
                                    )
                                  }
                                  disabled={regionsLoadingByZone[zone.id]}
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                >
                                  <option value="">
                                    {regionsLoadingByZone[zone.id]
                                      ? 'Cargando departamentos...'
                                      : 'Selecciona departamento'}
                                  </option>
                                  {zoneRegions.map((region) => (
                                    <option key={region.code} value={region.code}>
                                      {region.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">
                                  Departamento / región
                                </span>

                                <input
                                  value={zone.department}
                                  onChange={(e) =>
                                    handleZoneChange(
                                      zone.id,
                                      'department',
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                  placeholder="Ej: Magdalena"
                                />
                              </label>
                            )}

                            {isColombia ? (
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">
                                  Ciudad
                                </span>

                                <select
                                  value={zone.city}
                                  onChange={(e) =>
                                    handleZoneChange(zone.id, 'city', e.target.value)
                                  }
                                  disabled={!zone.department || citiesLoadingByZone[zone.id]}
                                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                >
                                  <option value="">
                                    {!zone.department
                                      ? 'Selecciona un departamento primero'
                                      : citiesLoadingByZone[zone.id]
                                        ? 'Cargando ciudades...'
                                        : 'Selecciona ciudad'}
                                  </option>
                                  {zoneCities.map((city) => (
                                    <option key={city.name} value={city.name}>
                                      {city.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-gray-700">
                                  Ciudad
                                </span>

                                <input
                                  value={zone.city}
                                  onChange={(e) =>
                                    handleZoneChange(zone.id, 'city', e.target.value)
                                  }
                                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                  placeholder="Ej: Santa Marta"
                                />
                              </label>
                            )}

                            <label className="block">
                              <span className="mb-1 block text-sm font-medium text-gray-700">
                                Tarifa de envío
                              </span>

                              <input
                                type="number"
                                value={zone.price}
                                onChange={(e) =>
                                  handleZoneChange(zone.id, 'price', e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                placeholder="Ej: 12000"
                              />
                            </label>

                            <label className="block md:col-span-2">
                              <span className="mb-1 block text-sm font-medium text-gray-700">
                                Tiempo estimado para esta ciudad
                              </span>

                              <input
                                value={zone.eta}
                                onChange={(e) =>
                                  handleZoneChange(zone.id, 'eta', e.target.value)
                                }
                                className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                                placeholder="Ej: 1 a 2 días hábiles"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Tarifa de respaldo
                  </span>

                  <input
                    type="number"
                    value={form.fallback.price}
                    onChange={(e) =>
                      handleNestedChange('fallback', 'price', e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="Ej: 20000"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Tiempo de respaldo
                  </span>

                  <input
                    value={form.fallback.eta}
                    onChange={(e) =>
                      handleNestedChange('fallback', 'eta', e.target.value)
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="Ej: 3 a 6 días hábiles"
                  />
                </label>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-gray-200 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">
                  Regla de envío gratis
                </p>
                <p className="text-sm text-gray-500">
                  Si el pedido alcanza el mínimo configurado, el sistema ignora la tarifa fija o de ciudad y deja el envío en $0.
                </p>
              </div>

              <input
                type="checkbox"
                checked={form.freeShipping.enabled}
                onChange={() =>
                  handleNestedChange(
                    'freeShipping',
                    'enabled',
                    !form.freeShipping.enabled
                  )
                }
                className="h-5 w-5 accent-pink-500"
              />
            </div>

            {form.freeShipping.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-gray-700">
                    Compra mínima para envío gratis
                  </span>

                  <input
                    type="number"
                    value={form.freeShipping.minimum}
                    onChange={(e) =>
                      handleNestedChange(
                        'freeShipping',
                        'minimum',
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    placeholder="Ej: 150000"
                  />
                </label>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-pink-200 bg-pink-50/60 p-4">
            <p className="text-sm font-semibold text-pink-700">
              Vista lógica del sistema
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-700">
              {loadingConfig ? 'Cargando configuración...' : previewRules}
            </p>
          </div>

          <button
            onClick={handleSave}
            disabled={loading}
            className="w-fit rounded-xl bg-pink-500 px-4 py-2 text-white hover:bg-pink-600 disabled:opacity-60"
          >
            {loading ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </InfoCard>

      <EmptyHint
        title="Cómo funcionará en checkout"
        text="El cliente solo escogerá país, departamento y ciudad. El sistema buscará la tarifa de esa ciudad; si el pedido supera el mínimo gratis, el envío será $0. Si la ciudad no existe en la tabla, usará la tarifa de respaldo."
      />
    </div>
  );
}