import React from 'react';
import { BILLING_STEPS } from '../billingConfiguration';
import {
  billingMessageStyle,
  billingPrimaryButtonStyle,
  billingSecondaryButtonStyle,
} from '../billingTheme';

export default function BillingWizardNavigation({ controller }) {
  const {
    configurationFinalized,
    currentStep,
    goNext,
    goPrev,
    handleFinish,
    saving,
    testingConnection,
  } = controller;

  return (
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
        {currentStep < BILLING_STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={saving || testingConnection}
            className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            style={billingPrimaryButtonStyle}
          >
            {saving ? 'Validando y guardando...' : 'Siguiente'}
          </button>
        ) : (
          <>
            {configurationFinalized ? (
              <div
                role="status"
                aria-live="polite"
                className="max-w-xl rounded-xl border px-4 py-3 text-sm"
                style={billingMessageStyle('success')}
              >
                <strong className="block">
                  Configuración finalizada correctamente.
                </strong>
                <span>Todos los datos fueron validados y guardados.</span>
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleFinish}
              disabled={saving || testingConnection}
              className="rounded-xl border px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              style={billingPrimaryButtonStyle}
            >
              {saving
                ? 'Validando y guardando...'
                : configurationFinalized
                  ? 'Configuración finalizada ✓'
                  : 'Finalizar configuración'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
