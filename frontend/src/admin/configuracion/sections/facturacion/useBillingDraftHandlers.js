import {
  FACTUS_API_URLS,
  normalizeMode,
} from './billingConfiguration';

export default function useBillingDraftHandlers({
  billing,
  mode,
  setBilling,
  setConfigurationFinalized,
  setConnectionChanged,
  setConnectionFeedback,
  setCredentialStatus,
  setReadiness,
  setSaveFeedback,
}) {
  const markFormChanged = () => {
    setConfigurationFinalized(false);
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

  const handleTaxesChange = (nextTaxes) => {
    setBilling((previous) => ({
      ...previous,
      taxes: nextTaxes,
    }));
    markFormChanged();
  };

  const handleLegalTextsChange = (nextLegalTexts) => {
    setBilling((previous) => ({
      ...previous,
      legalTexts: nextLegalTexts,
    }));
    markFormChanged();
  };

  return {
    markFormChanged,
    handleFiscalInfoChange,
    handleProviderChange,
    handleDianModeChange,
    handleDianEnabledChange,
    handleClearCredentials,
    handleDianResolutionChange,
    handleTaxesChange,
    handleLegalTextsChange,
  };
}
