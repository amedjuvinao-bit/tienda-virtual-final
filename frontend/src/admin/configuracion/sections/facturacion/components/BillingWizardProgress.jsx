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
    <div className="rounded-2xl border p-4" style={billingSoftPanelStyle}>
      <div className="mb-4 flex flex-wrap gap-2">
        {BILLING_STEPS.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onStepChange(index)}
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
            width: `${((currentStep + 1) / BILLING_STEPS.length) * 100}%`,
            background: 'var(--admin-primary)',
          }}
        />
      </div>
    </div>
  );
}
