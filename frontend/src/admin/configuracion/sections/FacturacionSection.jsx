// src/admin/configuracion/sections/FacturacionSection.jsx
import React, { useEffect, useMemo, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import api from '../../../lib/api';

import FiscalInfoBlock from './facturacion/FiscalInfoBlock';
import LegalTextsBlock from './facturacion/LegalTextsBlock';
import DianResolutionBlock from './facturacion/DianResolutionBlock';
import TaxConfigBlock from './facturacion/TaxConfigBlock';
import ElectronicProviderBlock from './facturacion/ElectronicProviderBlock';

const STEPS = [
  { id: 'fiscal', label: 'Datos fiscales' },
  { id: 'provider', label: 'Proveedor' },
  { id: 'control', label: 'Tipo de emisión' },
  { id: 'resolution', label: 'Resolución' },
  { id: 'taxes', label: 'Impuestos' },
  { id: 'legal', label: 'Textos legales' },
  { id: 'summary', label: 'Resumen' },
];

export default function FacturacionSection() {
  const [billing, setBilling] = useState({
    fiscalInfo: {},
    dianResolution: {},
    dian: {
      enabled: false,
      mode: 'internal',
      environment: '2',
    },
    electronicProvider: {
      provider: 'mock',
    },
    legalTexts: {},
    taxes: {},
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [credentialStatus, setCredentialStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get('/api/site-settings/admin');

        setCredentialStatus(data?._credentialStatus || {});

        if (data?.billing) {
          const loadedMode = data.billing.dian?.mode || 'internal';

          const loadedEnvironment =
            data.billing.dian?.environment ||
            data.billing.dianResolution?.environment ||
            (loadedMode === 'production' ? '1' : '2');

          setBilling({
            fiscalInfo: data.billing.fiscalInfo || {},
            dianResolution: {
              ...(data.billing.dianResolution || {}),
              environment: loadedEnvironment,
            },
            dian: {
              enabled:
                data.billing.dian?.enabled === true &&
                loadedMode !== 'internal',
              mode: loadedMode,
              environment: loadedEnvironment,
            },
            electronicProvider: data.billing.electronicProvider || {
              provider: 'mock',
            },
            legalTexts: data.billing.legalTexts || {},
            taxes: data.billing.taxes || {},
          });
        }
      } catch (error) {
        console.error('Error cargando configuración de facturación:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);

      const { data } = await api.put('/api/site-settings', {
        billing,
      });

      setCredentialStatus(data?._credentialStatus || {});

      alert('Configuración de facturación guardada correctamente');
    } catch (error) {
      console.error('Error guardando facturación:', error);
      alert('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  const isDianActive =
    billing.dian?.enabled === true &&
    (billing.dian?.mode || 'internal') !== 'internal';

  const provider = billing.electronicProvider?.provider || 'mock';

  const providerLabel = useMemo(() => {
    const labels = {
      mock: 'Modo pruebas interno',
      dian: 'DIAN directa',
      factus: 'Factus',
      carvajal: 'Carvajal',
      siigo: 'Siigo',
      alegra: 'Alegra',
    };

    return labels[provider] || 'No configurado';
  }, [provider]);

  const handleDianEnabledChange = (checked) => {
    setBilling((prev) => {
      const nextMode = checked ? prev.dian?.mode || 'habilitation' : 'internal';

      const normalizedMode =
        checked && nextMode === 'internal' ? 'habilitation' : nextMode;

      const nextEnvironment = normalizedMode === 'production' ? '1' : '2';

      return {
        ...prev,
        dian: {
          ...(prev.dian || {}),
          enabled: checked,
          mode: normalizedMode,
          environment: nextEnvironment,
        },
        dianResolution: {
          ...(prev.dianResolution || {}),
          environment: nextEnvironment,
        },
      };
    });
  };

  const handleDianModeChange = (mode) => {
    setBilling((prev) => {
      const nextEnvironment = mode === 'production' ? '1' : '2';

      return {
        ...prev,
        dian: {
          ...(prev.dian || {}),
          mode,
          enabled: mode !== 'internal',
          environment: nextEnvironment,
        },
        dianResolution: {
          ...(prev.dianResolution || {}),
          environment: nextEnvironment,
        },
      };
    });
  };

  const handleDianResolutionChange = (val) => {
    setBilling((prev) => ({
      ...prev,
      dianResolution: val,
      dian: {
        ...(prev.dian || {}),
        environment: val?.environment || prev.dian?.environment || '2',
      },
    }));
  };

  const goPrev = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const goNext = () => {
    setCurrentStep((prev) => Math.min(STEPS.length - 1, prev + 1));
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando...</div>;
  }

  const step = STEPS[currentStep];

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Asistente de facturación"
        description="Configura la facturación paso a paso para evitar mezclar datos fiscales, proveedor electrónico, DIAN, impuestos y textos legales."
      >
        <div className="grid gap-6">
          <div className="rounded-2xl border border-pink-100 bg-pink-50/40 p-4">
            <div className="mb-4 flex flex-wrap gap-2">
              {STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                    index === currentStep
                      ? 'bg-pink-500 text-white shadow-sm'
                      : index < currentStep
                        ? 'bg-white text-pink-600 ring-1 ring-pink-200'
                        : 'bg-white text-gray-500 ring-1 ring-gray-200'
                  }`}
                >
                  {index + 1}. {item.label}
                </button>
              ))}
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-pink-500 transition-all"
                style={{
                  width: `${((currentStep + 1) / STEPS.length) * 100}%`,
                }}
              />
            </div>
          </div>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-pink-500">
                Paso {currentStep + 1} de {STEPS.length}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-gray-900">
                {step.label}
              </h3>
            </div>

            {step.id === 'fiscal' && (
              <FiscalInfoBlock
                value={billing.fiscalInfo}
                onChange={(val) =>
                  setBilling((prev) => ({ ...prev, fiscalInfo: val }))
                }
              />
            )}

            {step.id === 'provider' && (
              <div className="grid gap-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-gray-700">
                  Primero escoge quién emitirá la factura electrónica. DIAN es la
                  entidad tributaria; Factus, Siigo, Carvajal o Alegra son
                  plataformas proveedoras.
                </div>

                <ElectronicProviderBlock
                  value={billing.electronicProvider}
                  credentialStatus={credentialStatus}
                  onChange={(val) =>
                    setBilling((prev) => ({
                      ...prev,
                      electronicProvider: val,
                    }))
                  }
                />
              </div>
            )}

            {step.id === 'control' && (
              <div className="grid gap-4 rounded-2xl border border-pink-100 bg-pink-50/40 p-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={isDianActive}
                    onChange={(e) => handleDianEnabledChange(e.target.checked)}
                    className="h-4 w-4"
                  />

                  <span className="text-sm text-gray-700">
                    Activar facturación electrónica
                  </span>
                </label>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Ambiente de emisión
                  </label>

                  <select
                    value={billing.dian?.mode || 'internal'}
                    onChange={(e) => handleDianModeChange(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                  >
                    <option value="internal">Solo comprobante interno</option>
                    <option value="habilitation">
                      Pruebas / habilitación
                    </option>
                    <option value="production">Producción</option>
                  </select>
                </div>

                <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-gray-700 md:col-span-2">
                  <strong className="mb-1 block text-gray-900">
                    Estado actual:
                  </strong>

                  {(billing.dian?.mode || 'internal') === 'internal'
                    ? 'Solo comprobantes internos: no se envía a DIAN ni a proveedor electrónico.'
                    : billing.dian?.mode === 'production'
                      ? `Producción activa con proveedor: ${providerLabel}.`
                      : `Modo pruebas / habilitación con proveedor: ${providerLabel}.`}
                </div>
              </div>
            )}

            {step.id === 'resolution' &&
              (isDianActive ? (
                <DianResolutionBlock
                  value={billing.dianResolution}
                  credentialStatus={credentialStatus}
                  onChange={handleDianResolutionChange}
                />
              ) : (
                <EmptyHint
                  title="Resolución no requerida en modo interno"
                  text="Activa la facturación electrónica en el paso anterior para configurar resolución, ambiente, CUFE, XML y numeración."
                />
              ))}

            {step.id === 'taxes' && (
              <TaxConfigBlock
                value={billing.taxes}
                onChange={(val) =>
                  setBilling((prev) => ({
                    ...prev,
                    taxes: val,
                  }))
                }
              />
            )}

            {step.id === 'legal' && (
              <LegalTextsBlock
                value={billing.legalTexts}
                onChange={(val) =>
                  setBilling((prev) => ({
                    ...prev,
                    legalTexts: val,
                  }))
                }
              />
            )}

            {step.id === 'summary' && (
              <div className="grid gap-3 text-sm text-gray-700">
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <strong className="block text-gray-900">Proveedor:</strong>
                  {providerLabel}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <strong className="block text-gray-900">
                    Tipo de emisión:
                  </strong>
                  {(billing.dian?.mode || 'internal') === 'internal'
                    ? 'Solo comprobante interno'
                    : billing.dian?.mode === 'production'
                      ? 'Facturación electrónica en producción'
                      : 'Facturación electrónica en pruebas / habilitación'}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <strong className="block text-gray-900">Ambiente:</strong>
                  {billing.dian?.environment === '1'
                    ? 'Producción'
                    : 'Pruebas / habilitación'}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <strong className="block text-gray-900">Resolución:</strong>
                  {billing.dianResolution?.resolutionNumber ||
                    'No configurada'}
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="mt-2 rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            )}
          </section>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentStep === 0}
              className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>

            {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-600"
              >
                Siguiente
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            )}
          </div>
        </div>
      </InfoCard>

      <EmptyHint
        title="Estado del módulo"
        text="Esta configuración ahora funciona como asistente paso a paso para separar datos fiscales, proveedor electrónico, emisión, resolución, impuestos y textos legales."
      />
    </div>
  );
}
