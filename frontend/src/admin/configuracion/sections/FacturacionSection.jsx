// src/admin/configuracion/sections/FacturacionSection.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import InfoCard from '../components/InfoCard';
import EmptyHint from '../components/EmptyHint';
import api from '../../../lib/api';

import FiscalInfoBlock from './facturacion/FiscalInfoBlock';
import LegalTextsBlock from './facturacion/LegalTextsBlock';
import DianResolutionBlock from './facturacion/DianResolutionBlock';
import TaxConfigBlock from './facturacion/TaxConfigBlock';
import ElectronicProviderBlock from './facturacion/ElectronicProviderBlock';
import BillingProductionReadiness from './facturacion/BillingProductionReadiness';
import {
  billingDangerButtonStyle,
  billingFieldStyle,
  billingMessageStyle,
  billingPanelStyle,
  billingPrimaryButtonStyle,
  billingSecondaryButtonStyle,
  billingSoftPanelStyle,
} from './facturacion/billingTheme';

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

function normalizePersistedLegalText(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 2000);
}

function legalTextsWerePersisted(requested = {}, persisted = {}) {
  return (
    normalizePersistedLegalText(requested.invoiceLegalText) ===
      normalizePersistedLegalText(persisted.invoiceLegalText) &&
    normalizePersistedLegalText(requested.internalReceiptNote) ===
      normalizePersistedLegalText(persisted.internalReceiptNote)
  );
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
  const [billingRevision, setBillingRevision] = useState(0);
  const savedBillingSnapshotRef = useRef(JSON.stringify(EMPTY_BILLING));
  const [history, setHistory] = useState([]);
  const [historyMeta, setHistoryMeta] = useState({
    updatedAt: null,
    updatedBy: '',
  });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState('');

  const applySettings = (data = {}) => {
    setCredentialStatus(data?._credentialStatus || {});
    setReadiness(data?._billingReadiness || null);

    if (!data?.billing) {
      savedBillingSnapshotRef.current = JSON.stringify(EMPTY_BILLING);
      setBilling(EMPTY_BILLING);
      setBillingRevision(Number(data?._billingRevision || 0));
      return;
    }

    const loadedMode = normalizeMode(data.billing.dian?.mode);
    const loadedEnvironment = loadedMode === 'production' ? '1' : '2';
    const external = loadedMode !== 'internal';

    const nextBilling = {
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
    };

    savedBillingSnapshotRef.current = JSON.stringify(nextBilling);
    setBilling(nextBilling);
    setBillingRevision(Number(data?._billingRevision || 0));

    setConnectionFeedback(null);
    setConnectionChanged(false);
  };

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const { data } = await api.get('/api/site-settings/billing-history');
      setHistory(Array.isArray(data?.versions) ? data.versions : []);
      setHistoryMeta({
        updatedAt: data?.updatedAt || null,
        updatedBy: data?.updatedBy || '',
      });
      setRestoreCandidate('');
    } catch {
      setHistory([]);
      setHistoryMeta({ updatedAt: null, updatedBy: '' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      setLoading(true);
      setLoadError('');
      const { data } = await api.get('/api/site-settings/admin');
      applySettings(data);
      await loadHistory();
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
  const hasUnsavedChanges =
    JSON.stringify(billing) !== savedBillingSnapshotRef.current;

  useEffect(() => {
    const warnUnsavedChanges = (event) => {
      if (!hasUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnUnsavedChanges);
    return () => window.removeEventListener('beforeunload', warnUnsavedChanges);
  }, [hasUnsavedChanges]);

  const markFormChanged = () => {
    setSaveFeedback(null);
  };

  const markConnectionChanged = () => {
    markFormChanged();
    setConnectionChanged(true);
    setConnectionFeedback(null);
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
    markFormChanged();

    if (previousNit !== nextNit || previousDv !== nextDv) {
      setConnectionChanged(true);
      setConnectionFeedback(null);
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

    if (nextMode !== mode) {
      markConnectionChanged();
    } else {
      markFormChanged();
    }
  };

  const handleDianEnabledChange = (checked) => {
    if (!checked) {
      handleDianModeChange('internal');
      return;
    }
    handleDianModeChange(mode === 'internal' ? 'habilitacion' : mode);
  };

  const handleClearCredentials = () => {
    setBilling((previous) => ({
      ...previous,
      dian: {
        ...(previous.dian || {}),
        enabled: false,
        mode: 'internal',
        environment: '2',
      },
      dianResolution: {
        ...(previous.dianResolution || {}),
        environment: '2',
        numberingRangeId: 0,
        creditNoteNumberingRangeId: 0,
        technicalKey: '',
      },
      electronicProvider: {
        provider: 'mock',
        apiUrl: '',
        clientId: '',
        clientSecret: '',
        username: '',
        password: '',
        numberingRangeId: 0,
        creditNoteNumberingRangeId: 0,
        clearCredentials: true,
      },
    }));
    setCredentialStatus({});
    setReadiness(null);
    setConnectionFeedback(null);
    setConnectionChanged(true);
    setSaveFeedback({
      type: 'warning',
      message:
        'Las credenciales se eliminarán cuando guardes. Factus quedó desactivado en este borrador.',
      details: [],
    });
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
    markFormChanged();
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
      const requestedBilling = {
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
      };

      await api.put('/api/site-settings', {
        billingRevision,
        billing: requestedBilling,
      });

      const { data: persistedSettings } = await api.get(
        `/api/site-settings/admin?refresh=${Date.now()}`
      );

      if (
        !legalTextsWerePersisted(
          requestedBilling.legalTexts,
          persistedSettings?.billing?.legalTexts
        )
      ) {
        throw new Error(
          'El servidor respondió al guardado, pero no confirmó los textos legales. Los cambios siguen pendientes.'
        );
      }

      applySettings(persistedSettings);
      await loadHistory();
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
      setSaveFeedback({ type: 'error', ...parsed });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = async (version) => {
    const historyId = String(version?.id || '');
    if (!historyId) return;
    if (restoreCandidate !== historyId) {
      setRestoreCandidate(historyId);
      setSaveFeedback({
        type: 'warning',
        message: `Pulsa nuevamente “Restaurar” para confirmar la versión ${version.revision}. Una configuración histórica de Producción volverá en Habilitación y deberá verificarse otra vez.`,
        details: [],
      });
      return;
    }

    try {
      setSaving(true);
      setSaveFeedback(null);
      const { data } = await api.post(
        `/api/site-settings/billing-history/${encodeURIComponent(historyId)}/restore`,
        { billingRevision }
      );
      applySettings(data);
      await loadHistory();
      setSaveFeedback({
        type: 'success',
        message:
          'Versión restaurada de forma segura. Revisa los datos antes de volver a activar Producción.',
        details: [],
      });
    } catch (error) {
      const parsed = getApiError(
        error,
        'No fue posible restaurar la versión seleccionada.'
      );
      setSaveFeedback({ type: 'error', ...parsed });
    } finally {
      setSaving(false);
    }
  };

  const handleProductionActivated = async (settings) => {
    applySettings(settings);
    await loadHistory();
    setSaveFeedback({
      type: 'success',
      message:
        'Factus quedó validado y activado en Producción con los rangos oficiales seleccionados.',
      details: [],
    });
  };

  const handleNumberingRangesSaved = (settings) => {
    applySettings(settings);
    setSaveFeedback(null);
  };

  const goPrev = () => {
    setCurrentStep((previous) => Math.max(0, previous - 1));
  };

  const goNext = () => {
    setCurrentStep((previous) => Math.min(STEPS.length - 1, previous + 1));
  };

  if (loading) {
    return (
      <div
        className="text-sm"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        Cargando configuración...
      </div>
    );
  }

  if (loadError) {
    return (
      <InfoCard
        title="No se pudo cargar la configuración"
        description="El formulario permanece bloqueado para evitar sobrescribir datos fiscales con valores vacíos."
      >
        <div className="grid gap-3">
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={billingMessageStyle('error')}
          >
            {loadError}
          </div>
          <button
            type="button"
            onClick={loadSettings}
            className="w-fit rounded-xl border px-4 py-2 text-sm font-semibold"
            style={billingSecondaryButtonStyle}
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
              className="rounded-xl border px-4 py-3 text-sm"
              style={billingMessageStyle(saveFeedback.type)}
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

          <div
            className="rounded-2xl border p-4"
            style={billingSoftPanelStyle}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {STEPS.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrentStep(index)}
                  className="rounded-full border px-3 py-2 text-xs font-semibold transition"
                  style={
                    index === currentStep
                      ? billingPrimaryButtonStyle
                      : index < currentStep
                        ? {
                            ...billingSecondaryButtonStyle,
                            color: 'var(--admin-primary)',
                          }
                        : billingSecondaryButtonStyle
                  }
                >
                  {index + 1}. {item.label}
                </button>
              ))}
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: 'var(--admin-card-bg)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${((currentStep + 1) / STEPS.length) * 100}%`,
                  background: 'var(--admin-primary)',
                }}
              />
            </div>
          </div>

          <section
            className="rounded-2xl border p-5"
            style={billingPanelStyle}
          >
            <div className="mb-5">
              <p
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: 'var(--admin-primary)' }}
              >
                Paso {currentStep + 1} de {STEPS.length}
              </p>
              <h3
                className="mt-1 text-lg font-semibold"
                style={{ color: 'var(--admin-card-text)' }}
              >
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
                <div
                  className="rounded-xl border px-4 py-3 text-sm"
                  style={billingMessageStyle('info')}
                >
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
                  onClearCredentials={handleClearCredentials}
                  onChange={handleProviderChange}
                />
              </div>
            )}

            {step.id === 'control' && (
              <div className="grid gap-4">
                <div
                  className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2"
                  style={billingSoftPanelStyle}
                >
                  <label
                    className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                    style={billingPanelStyle}
                  >
                    <input
                      type="checkbox"
                      checked={isDianActive}
                      onChange={(event) =>
                        handleDianEnabledChange(event.target.checked)
                      }
                      className="h-4 w-4"
                    />
                    <span
                      className="text-sm"
                      style={{ color: 'var(--admin-card-text)' }}
                    >
                      Activar facturación electrónica
                    </span>
                  </label>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      style={{ color: 'var(--admin-card-text)' }}
                    >
                      Ambiente de emisión
                    </label>
                    <select
                      value={mode}
                      onChange={(event) =>
                        handleDianModeChange(event.target.value)
                      }
                      className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2"
                      style={billingFieldStyle}
                    >
                      <option value="internal">Solo comprobante interno</option>
                      <option value="habilitacion">
                        Pruebas / habilitación
                      </option>
                      <option value="production">Producción</option>
                    </select>
                  </div>
                  <div
                    className="rounded-xl border px-4 py-3 text-sm md:col-span-2"
                    style={billingMessageStyle('warning')}
                  >
                    <strong className="mb-1 block">
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
                  billing={billing}
                  credentialStatus={credentialStatus}
                  onChange={handleDianResolutionChange}
                  onSaved={handleNumberingRangesSaved}
                  onActivated={handleProductionActivated}
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
                  markFormChanged();
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
                  markFormChanged();
                }}
              />
            )}

            {step.id === 'summary' && (
              <div
                className="grid gap-3 text-sm"
                style={{ color: 'var(--admin-card-text)' }}
              >
                <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
                  <strong className="block">Proveedor:</strong>
                  {providerLabel}
                </div>
                <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
                  <strong className="block">
                    Tipo de emisión:
                  </strong>
                  {mode === 'internal'
                    ? 'Solo comprobante interno'
                    : mode === 'production'
                      ? 'Facturación electrónica en producción'
                      : 'Facturación electrónica en pruebas / habilitación'}
                </div>
                <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
                  <strong className="block">Ambiente:</strong>
                  {mode === 'internal'
                    ? 'Interno'
                    : mode === 'production'
                      ? 'Producción'
                      : 'Pruebas / habilitación'}
                </div>
                <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
                  <strong className="block">Resolución:</strong>
                  {billing.dianResolution?.resolutionNumber || 'No configurada'}
                </div>
                <BillingProductionReadiness
                  readiness={readiness}
                  connectionChanged={connectionChanged}
                />
                <div
                  className="rounded-xl border p-4"
                  style={billingPanelStyle}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <strong className="block">Historial protegido</strong>
                      <span
                        className="text-xs"
                        style={{ color: 'var(--admin-card-muted-text)' }}
                      >
                        Revisión actual {billingRevision}. Se conservan hasta 25
                        versiones cifradas.
                      </span>
                      {historyMeta.updatedAt ? (
                        <span
                          className="mt-1 block text-xs"
                          style={{ color: 'var(--admin-card-muted-text)' }}
                        >
                          Último cambio:{' '}
                          {new Date(historyMeta.updatedAt).toLocaleString(
                            'es-CO'
                          )}
                          {historyMeta.updatedBy
                            ? ` · ${historyMeta.updatedBy}`
                            : ''}
                        </span>
                      ) : null}
                    </div>
                    {historyLoading ? (
                      <span
                        className="text-xs"
                        style={{ color: 'var(--admin-card-muted-text)' }}
                      >
                        Cargando...
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 grid gap-2">
                    {history.slice(0, 5).map((version) => (
                      <div
                        key={version.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
                        style={billingSoftPanelStyle}
                      >
                        <div className="min-w-0">
                          <p className="font-semibold">
                            Revisión {version.revision} · {version.mode}
                          </p>
                          <p
                            className="text-xs"
                            style={{ color: 'var(--admin-card-muted-text)' }}
                          >
                            {version.changedBy || 'sistema'}
                            {version.changedAt
                              ? ` · ${new Date(version.changedAt).toLocaleString('es-CO')}`
                              : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRestoreVersion(version)}
                          disabled={saving}
                          className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                          style={
                            restoreCandidate === version.id
                              ? billingDangerButtonStyle
                              : billingSecondaryButtonStyle
                          }
                        >
                          {restoreCandidate === version.id
                            ? 'Confirmar restauración'
                            : 'Restaurar'}
                        </button>
                      </div>
                    ))}
                    {!historyLoading && history.length === 0 ? (
                      <p
                        className="text-xs"
                        style={{ color: 'var(--admin-card-muted-text)' }}
                      >
                        El historial aparecerá después del primer cambio
                        guardado.
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </section>

          {hasUnsavedChanges ? (
            <div
              className="rounded-xl border px-4 py-3 text-sm"
              style={billingMessageStyle('warning')}
            >
              Tienes cambios sin guardar.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentStep === 0}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
              style={billingSecondaryButtonStyle}
            >
              Anterior
            </button>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving || testingConnection || !hasUnsavedChanges
                }
                className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                style={billingPrimaryButtonStyle}
              >
                {saving
                  ? 'Guardando...'
                  : currentStep < STEPS.length - 1
                    ? 'Guardar cambios'
                    : 'Guardar configuración'}
              </button>
              {currentStep < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-xl border px-5 py-2.5 text-sm font-semibold"
                style={billingSecondaryButtonStyle}
              >
                Siguiente
              </button>
              ) : null}
            </div>
          </div>
        </div>
      </InfoCard>

      <EmptyHint
        title={
          readiness?.readyForProduction
            ? 'Configuración verificada'
            : 'Producción protegida'
        }
        text={
          readiness?.readyForProduction
            ? 'La cuenta, la empresa, los rangos y el correo cumplen los requisitos de producción.'
            : 'La emisión productiva permanece bloqueada hasta completar y verificar todos los requisitos técnicos y fiscales.'
        }
      />
    </div>
  );
}
