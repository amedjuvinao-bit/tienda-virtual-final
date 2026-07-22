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
import BillingProductionReadiness from './facturacion/BillingProductionReadiness';

const STEPS = [
  { id: 'fiscal', label: 'Datos fiscales' },
  { id: 'provider', label: 'Proveedor' },
  { id: 'control', label: 'Tipo de emisión' },
  { id: 'resolution', label: 'Resolución' },
  { id: 'taxes', label: 'Impuestos' },
  { id: 'legal', label: 'Textos legales' },
  { id: 'summary', label: 'Resumen' },
];

const FACTUS_API_URLS = {
  habilitacion: 'https://api-sandbox.factus.com.co',
  production: 'https://api.factus.com.co',
};

const EMPTY_BILLING = {
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
};

function normalizeMode(value) {
  const mode = String(value || '').trim().toLowerCase();

  if (['habilitation', 'habilitacion', 'sandbox', 'test'].includes(mode)) {
    return 'habilitacion';
  }
  if (mode === 'production') return 'production';
  return 'internal';
}

function getApiError(error, fallback) {
  const response = error?.response?.data || {};
  const details = Array.isArray(response.details) ? response.details : [];

  return {
    message: response.message || error?.message || fallback,
    details,
  };
}

export default function FacturacionSection() {
  const [billing, setBilling] = useState(EMPTY_BILLING);
  const [currentStep, setCurrentStep] = useState(0);
  const [credentialStatus, setCredentialStatus] = useState({});
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState(null);
  const [connectionChanged, setConnectionChanged] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  const applySettings = (data = {}) => {
    setCredentialStatus(data?._credentialStatus || {});
    setReadiness(data?._billingReadiness || null);

    if (!data?.billing) {
      setBilling(EMPTY_BILLING);
      return;
    }

    const loadedMode = normalizeMode(data.billing.dian?.mode);
    const loadedEnvironment = loadedMode === 'production' ? '1' : '2';
    const external = loadedMode !== 'internal';

    setBilling({
      fiscalInfo: data.billing.fiscalInfo || {},
      dianResolution: {
        ...(data.billing.dianResolution || {}),
        environment: loadedEnvironment,
      },
      dian: {
        ...(data.billing.dian || {}),
        enabled: external,
        mode: loadedMode,
        environment: loadedEnvironment,
      },
      electronicProvider: {
        ...(data.billing.electronicProvider || {}),
        provider: external ? 'factus' : 'mock',
        apiUrl: external ? FACTUS_API_URLS[loadedMode] : '',
      },
      legalTexts: data.billing.legalTexts || {},
      taxes: data.billing.taxes || {},
    });

    setConnectionFeedback(null);
    setConnectionChanged(false);
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const { data } = await api.get('/api/site-settings/admin');
      applySettings(data);
    } catch (error) {
      const parsed = getApiError(
        error,
        'No fue posible cargar la configuración de facturación.'
      );
      setLoadError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const mode = normalizeMode(billing.dian?.mode);
  const isDianActive = mode !== 'internal';
  const provider = isDianActive ? 'factus' : 'mock';

  const providerLabel = useMemo(
    () => (provider === 'factus' ? 'Factus' : 'Comprobante interno'),
    [provider]
  );

  const markConnectionChanged = () => {
    setConnectionChanged(true);
    setConnectionFeedback(null);
    setSaveFeedback(null);
  };

  const handleFiscalInfoChange = (nextFiscalInfo) => {
    const previousNit = String(billing.fiscalInfo?.nit || '').replace(/\D/g, '');
    const previousDv = String(billing.fiscalInfo?.dv || '').replace(/\D/g, '');
    const nextNit = String(nextFiscalInfo?.nit || '').replace(/\D/g, '');
    const nextDv = String(nextFiscalInfo?.dv || '').replace(/\D/g, '');

    setBilling((previous) => ({
      ...previous,
      fiscalInfo: nextFiscalInfo,
    }));

    if (previousNit !== nextNit || previousDv !== nextDv) {
      markConnectionChanged();
    }
  };

  const handleProviderChange = (nextProvider) => {
    setBilling((previous) => ({
      ...previous,
      electronicProvider: {
        ...nextProvider,
        provider: mode === 'internal' ? 'mock' : 'factus',
        apiUrl: mode === 'internal' ? '' : FACTUS_API_URLS[mode],
      },
    }));
    markConnectionChanged();
  };

  const handleDianModeChange = (nextModeValue) => {
    const nextMode = normalizeMode(nextModeValue);
    const nextEnvironment = nextMode === 'production' ? '1' : '2';
    const external = nextMode !== 'internal';

    setBilling((previous) => ({
      ...previous,
      dian: {
        ...(previous.dian || {}),
        enabled: external,
        mode: nextMode,
        environment: nextEnvironment,
      },
      dianResolution: {
        ...(previous.dianResolution || {}),
        environment: nextEnvironment,
      },
      electronicProvider: {
        ...(previous.electronicProvider || {}),
        provider: external ? 'factus' : 'mock',
        apiUrl: external ? FACTUS_API_URLS[nextMode] : '',
      },
    }));

    if (nextMode !== mode) markConnectionChanged();
  };

  const handleDianEnabledChange = (checked) => {
    if (!checked) {
      handleDianModeChange('internal');
      return;
    }

    handleDianModeChange(mode === 'internal' ? 'habilitacion' : mode);
  };

  const handleDianResolutionChange = (nextResolution) => {
    const environment = mode === 'production' ? '1' : '2';

    setBilling((previous) => ({
      ...previous,
      dianResolution: {
        ...nextResolution,
        environment,
      },
      dian: {
        ...(previous.dian || {}),
        environment,
      },
    }));
    setSaveFeedback(null);
  };

  const handleTestConnection = async () => {
    if (!isDianActive) return;

    try {
      setTestingConnection(true);
      setConnectionFeedback(null);
      setSaveFeedback(null);

      const { data } = await api.post('/api/dian-provider/test-provider', {
        billing: {
          ...billing,
          dian: {
            ...(billing.dian || {}),
            enabled: true,
            mode,
            environment: mode === 'production' ? '1' : '2',
          },
          electronicProvider: {
            ...(billing.electronicProvider || {}),
            provider: 'factus',
            apiUrl: FACTUS_API_URLS[mode],
          },
        },
      });

      const feedback = {
        status: data.status || 'success',
        message: data.message || 'Conexión verificada correctamente.',
        company: data.company || {},
        environment: data.environment || mode,
        verifiedAt: data.verifiedAt || new Date().toISOString(),
      };

      setConnectionFeedback(feedback);
      setConnectionChanged(false);
      if (data.readiness) setReadiness(data.readiness);
      setBilling((previous) => ({
        ...previous,
        electronicProvider: {
          ...(previous.electronicProvider || {}),
          provider: 'factus',
          apiUrl: FACTUS_API_URLS[mode],
          lastConnectionStatus: feedback.status,
          lastConnectionMessage: feedback.message,
          lastConnectionAt: feedback.verifiedAt,
          lastConnectionEnvironment: feedback.environment,
          lastConnectionCompany: feedback.company,
        },
      }));
    } catch (error) {
      const parsed = getApiError(
        error,
        'No fue posible verificar la conexión real con Factus.'
      );

      setConnectionFeedback({
        status: 'error',
        message: parsed.message,
        company: {},
        environment: mode,
        verifiedAt: new Date().toISOString(),
      });
      setConnectionChanged(true);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSave = async () => {
    if (mode === 'production' && connectionChanged) {
      setSaveFeedback({
        type: 'error',
        message:
          'Debes probar nuevamente la conexión real con Factus antes de guardar Producción.',
        details: [],
      });
      return;
    }

    try {
      setSaving(true);
      setSaveFeedback(null);

      const { data } = await api.put('/api/site-settings', {
        billing: {
          ...billing,
          dian: {
            ...(billing.dian || {}),
            enabled: mode !== 'internal',
            mode,
            environment: mode === 'production' ? '1' : '2',
          },
          electronicProvider: {
            ...(billing.electronicProvider || {}),
            provider: mode === 'internal' ? 'mock' : 'factus',
            apiUrl: mode === 'internal' ? '' : FACTUS_API_URLS[mode],
          },
        },
      });

      applySettings(data);
      setSaveFeedback({
        type: 'success',
        message: 'Configuración de facturación guardada correctamente.',
        details: [],
      });
    } catch (error) {
      const parsed = getApiError(
        error,
        'No fue posible guardar la configuración de facturación.'
      );
      setSaveFeedback({
        type: 'error',
        ...parsed,
      });
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => {
    setCurrentStep((previous) => Math.max(0, previous - 1));
  };

  const goNext = () => {
    setCurrentStep((previous) => Math.min(STEPS.length - 1, previous + 1));
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Cargando configuración...</div>;
  }

  if (loadError) {
    return (
      <InfoCard
        title="No se pudo cargar la configuración"
        description="El formulario permanece bloqueado para evitar sobrescribir datos fiscales con valores vacíos."
      >
        <div className="grid gap-3">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
          <button
            type="button"
            onClick={loadSettings}
            className="w-fit rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reintentar carga
          </button>
        </div>
      </InfoCard>
    );
  }

  const step = STEPS[currentStep];

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Asistente de facturación"
        description="Configura la facturación paso a paso para evitar mezclar datos fiscales, proveedor electrónico, DIAN, impuestos y textos legales."
      >
        <div className="grid gap-6">
          {saveFeedback ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                saveFeedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              <strong className="block">
                {saveFeedback.type === 'success'
                  ? 'Configuración guardada'
                  : 'No se guardó la configuración'}
              </strong>
              <p className="mt-1">{saveFeedback.message}</p>
              {saveFeedback.details?.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  {saveFeedback.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

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
                onChange={handleFiscalInfoChange}
              />
            )}

            {step.id === 'provider' && (
              <div className="grid gap-4">
                <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-gray-700">
                  Factus es el único proveedor externo habilitado. La prueba autentica las credenciales y confirma que la empresa vinculada coincida con el NIT fiscal configurado.
                </div>

                <ElectronicProviderBlock
                  value={billing.electronicProvider}
                  credentialStatus={credentialStatus}
                  mode={mode}
                  testing={testingConnection}
                  connectionFeedback={connectionFeedback}
                  connectionChanged={connectionChanged}
                  onTestConnection={handleTestConnection}
                  onChange={handleProviderChange}
                />
              </div>
            )}

            {step.id === 'control' && (
              <div className="grid gap-4">
                <div className="grid gap-4 rounded-2xl border border-pink-100 bg-pink-50/40 p-4 md:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={isDianActive}
                      onChange={(event) =>
                        handleDianEnabledChange(event.target.checked)
                      }
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
                      value={mode}
                      onChange={(event) =>
                        handleDianModeChange(event.target.value)
                      }
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
                    >
                      <option value="internal">Solo comprobante interno</option>
                      <option value="habilitacion">
                        Pruebas / habilitación
                      </option>
                      <option value="production">Producción</option>
                    </select>
                  </div>

                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-gray-700 md:col-span-2">
                    <strong className="mb-1 block text-gray-900">
                      Selección actual:
                    </strong>
                    {mode === 'internal'
                      ? 'Solo comprobantes internos: no se envía información a Factus.'
                      : mode === 'production'
                        ? 'Producción seleccionada. Solo se activará al guardar cuando el backend valide conexión, empresa, rangos, correo y credenciales.'
                        : `Habilitación seleccionada con proveedor: ${providerLabel}.`}
                  </div>
                </div>

                <BillingProductionReadiness
                  readiness={readiness}
                  connectionChanged={connectionChanged}
                />
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
                onChange={(nextTaxes) => {
                  setBilling((previous) => ({
                    ...previous,
                    taxes: nextTaxes,
                  }));
                  setSaveFeedback(null);
                }}
              />
            )}

            {step.id === 'legal' && (
              <LegalTextsBlock
                value={billing.legalTexts}
                onChange={(nextLegalTexts) => {
                  setBilling((previous) => ({
                    ...previous,
                    legalTexts: nextLegalTexts,
                  }));
                  setSaveFeedback(null);
                }}
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
                  {mode === 'internal'
                    ? 'Solo comprobante interno'
                    : mode === 'production'
                      ? 'Facturación electrónica en producción'
                      : 'Facturación electrónica en pruebas / habilitación'}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <strong className="block text-gray-900">Ambiente:</strong>
                  {mode === 'internal'
                    ? 'Interno'
                    : mode === 'production'
                      ? 'Producción'
                      : 'Pruebas / habilitación'}
                </div>

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <strong className="block text-gray-900">Resolución:</strong>
                  {billing.dianResolution?.resolutionNumber ||
                    'No configurada'}
                </div>

                <BillingProductionReadiness
                  readiness={readiness}
                  connectionChanged={connectionChanged}
                />
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
                disabled={saving || testingConnection}
                className="rounded-xl bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            )}
          </div>
        </div>
      </InfoCard>

      <EmptyHint
        title="Estado del módulo"
        text="La activación de producción permanece bloqueada hasta completar y verificar todos los requisitos técnicos y fiscales."
      />
    </div>
  );
}
