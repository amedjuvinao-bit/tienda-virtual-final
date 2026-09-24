import React from 'react';
import { BILLING_STEPS } from '../billingConfiguration';
import {
  billingPrimaryButtonStyle,
  billingSecondaryButtonStyle,
  billingSoftPanelStyle,
} from '../billingTheme';

export default function BillingWizardProgress({
  currentStep,
  onStepChange,
}) {
  return (
    <div
      className="billing-wizard-progress rounded-2xl border p-4"
      style={billingSoftPanelStyle}
    >
      <div className="billing-wizard-progress__steps mb-4 flex flex-wrap gap-2">
        {BILLING_STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onStepChange(index)}
            aria-label={`${index + 1}. ${item.label}`}
            aria-current={index === currentStep ? 'step' : undefined}
            title={`${index + 1}. ${item.label}`}
            className="billing-wizard-progress__step rounded-full border px-3 py-2 text-xs font-semibold transition"
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
            <span className="billing-wizard-progress__label--desktop">
              {index + 1}. {item.label}
            </span>
            <span
              className="billing-wizard-progress__label--mobile"
              aria-hidden="true"
            >
              {index + 1}
            </span>
          </button>
        ))}
      </div>
      <div
        className="billing-wizard-progress__bar h-2 overflow-hidden rounded-full"
        style={{ background: 'var(--admin-card-bg)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${((currentStep + 1) / BILLING_STEPS.length) * 100}%`,
            background: 'var(--admin-primary)',
          }}
        />
      </div>
    </div>
  );
}
