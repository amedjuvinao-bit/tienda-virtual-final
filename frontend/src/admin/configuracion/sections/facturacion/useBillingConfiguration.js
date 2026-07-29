import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../lib/api';
import {
  EMPTY_BILLING,
  FACTUS_API_URLS,
  getApiError,
  normalizeMode,
} from './billingConfiguration';
import { billingStepWasPersisted } from './billingConfigurationValidation';
import useBillingDraftHandlers from './useBillingDraftHandlers';
import useBillingWizardNavigation from './useBillingWizardNavigation';

export default function useBillingConfiguration() {
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
  const [configurationFinalized, setConfigurationFinalized] = useState(false);
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
    setConfigurationFinalized(false);
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

  const {
    markFormChanged,
    handleFiscalInfoChange,
    handleProviderChange,
    handleDianModeChange,
    handleDianEnabledChange,
    handleClearCredentials,
    handleDianResolutionChange,
    handleTaxesChange,
    handleLegalTextsChange,
  } = useBillingDraftHandlers({
    billing,
    mode,
    setBilling,
    setConfigurationFinalized,
    setConnectionChanged,
    setConnectionFeedback,
    setCredentialStatus,
    setReadiness,
    setSaveFeedback,
  });

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

  const persistBilling = async (
    stepId,
    successMessage = 'La etapa fue validada y guardada correctamente.'
  ) => {
    if (mode === 'production' && connectionChanged) {
      setSaveFeedback({
        type: 'error',
        message:
          'Debes probar nuevamente la conexión real con Factus antes de guardar Producción.',
        details: [],
      });
      return false;
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

      if (!billingStepWasPersisted(stepId, requestedBilling, persistedSettings)) {
        throw new Error(
          'El servidor respondió al guardado, pero no confirmó los datos de esta etapa. Los cambios siguen pendientes.'
        );
      }

      applySettings(persistedSettings);
      await loadHistory();
      setSaveFeedback({
        type: 'success',
        message: successMessage,
        details: [],
      });
      return true;
    } catch (error) {
      const parsed = getApiError(
        error,
        'No fue posible guardar la configuración de facturación.'
      );
      setSaveFeedback({ type: 'error', ...parsed });
      return false;
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

  const { step, finalStepResults, goPrev, goNext, handleFinish } =
    useBillingWizardNavigation({
      billing,
      connectionChanged,
      credentialStatus,
      currentStep,
      hasUnsavedChanges,
      mode,
      persistBilling,
      setConfigurationFinalized,
      setCurrentStep,
      setSaveFeedback,
    });

  return {
    billing,
    setBilling,
    currentStep,
    setCurrentStep,
    credentialStatus,
    readiness,
    loading,
    loadError,
    saving,
    testingConnection,
    connectionFeedback,
    connectionChanged,
    saveFeedback,
    configurationFinalized,
    billingRevision,
    history,
    historyMeta,
    historyLoading,
    restoreCandidate,
    mode,
    isDianActive,
    providerLabel,
    hasUnsavedChanges,
    step,
    finalStepResults,
    loadSettings,
    markFormChanged,
    handleFiscalInfoChange,
    handleProviderChange,
    handleDianModeChange,
    handleDianEnabledChange,
    handleClearCredentials,
    handleDianResolutionChange,
    handleTaxesChange,
    handleLegalTextsChange,
    handleTestConnection,
    handleRestoreVersion,
    handleProductionActivated,
    handleNumberingRangesSaved,
    goPrev,
    goNext,
    handleFinish,
  };
}
