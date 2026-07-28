import { BILLING_STEPS } from './billingConfiguration';
import { getBillingStepErrors } from './billingConfigurationValidation';

export default function useBillingWizardNavigation({
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
}) {
  const validationContext = {
    billing,
    mode,
    credentialStatus,
    connectionChanged,
  };

  const validateCurrentStep = () => {
    const step = BILLING_STEPS[currentStep];
    const errors = getBillingStepErrors(step.id, validationContext);

    if (errors.length) {
      setSaveFeedback({
        type: 'error',
        message: `Revisa el paso ${currentStep + 1}: ${step.label}.`,
        details: errors,
      });
      return false;
    }

    return true;
  };

  const goPrev = () => {
    setCurrentStep((previous) => Math.max(0, previous - 1));
  };

  const goNext = async () => {
    if (!validateCurrentStep()) return;

    const step = BILLING_STEPS[currentStep];
    const persisted = hasUnsavedChanges
      ? await persistBilling(
          step.id,
          `${step.label} fue validado y guardado correctamente.`
        )
      : true;

    if (!persisted) return;

    if (!hasUnsavedChanges) setSaveFeedback(null);
    setCurrentStep((previous) =>
      Math.min(BILLING_STEPS.length - 1, previous + 1)
    );
  };

  const handleFinish = async () => {
    const stepResults = BILLING_STEPS.slice(0, -1).map((item, index) => ({
      ...item,
      index,
      errors: getBillingStepErrors(item.id, validationContext),
    }));
    const invalidSteps = stepResults.filter((item) => item.errors.length > 0);

    if (invalidSteps.length) {
      setSaveFeedback({
        type: 'error',
        message:
          'La revisión final encontró información pendiente. Corrige las etapas indicadas antes de finalizar.',
        details: invalidSteps.flatMap((item) =>
          item.errors.map(
            (error) => `Paso ${item.index + 1} · ${item.label}: ${error}`
          )
        ),
      });
      return;
    }

    const persisted = hasUnsavedChanges
      ? await persistBilling(
          'summary',
          'La configuración completa fue validada y guardada correctamente.'
        )
      : true;

    if (!persisted) return;

    setSaveFeedback({
      type: 'success',
      message:
        'Revisión final completada. La configuración de facturación quedó guardada.',
      details: [],
    });
    setConfigurationFinalized(true);
  };

  const step = BILLING_STEPS[currentStep];
  const finalStepResults = BILLING_STEPS.slice(0, -1).map((item, index) => ({
    ...item,
    index,
    errors: getBillingStepErrors(item.id, validationContext),
  }));

  return {
    step,
    finalStepResults,
    goPrev,
    goNext,
    handleFinish,
  };
}
