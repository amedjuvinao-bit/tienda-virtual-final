export const billingFieldClass =
  'w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60';

export const billingFieldStyle = {
  background: 'var(--admin-input-bg, var(--admin-card-bg))',
  borderColor: 'var(--admin-input-border, var(--admin-card-border))',
  color: 'var(--admin-input-text, var(--admin-card-text))',
  '--tw-ring-color': 'var(--admin-input-focus, var(--admin-primary))',
};

export const billingPanelStyle = {
  background: 'var(--admin-card-bg)',
  borderColor: 'var(--admin-card-border)',
  color: 'var(--admin-card-text)',
};

export const billingSoftPanelStyle = {
  background: 'var(--admin-primary-soft-bg, var(--admin-card-bg))',
  borderColor: 'var(--admin-primary-soft-border, var(--admin-card-border))',
  color: 'var(--admin-card-text)',
};

export const billingPrimaryButtonStyle = {
  background: 'var(--admin-button-bg, var(--admin-primary))',
  borderColor: 'var(--admin-button-bg, var(--admin-primary))',
  color: 'var(--admin-button-text, var(--admin-primary-text, #fff))',
};

export const billingSecondaryButtonStyle = {
  background: 'var(--admin-button-soft-bg, var(--admin-card-bg))',
  borderColor: 'var(--admin-button-soft-border, var(--admin-card-border))',
  color: 'var(--admin-button-soft-text, var(--admin-card-text))',
};

export const billingDangerButtonStyle = {
  background: 'var(--admin-danger-soft-bg, var(--admin-card-bg))',
  borderColor: 'var(--admin-danger-border, var(--admin-card-border))',
  color: 'var(--admin-danger-text, var(--admin-card-text))',
};

export function billingMessageStyle(tone = 'info') {
  if (tone === 'success') {
    return {
      background: 'var(--admin-success-soft-bg, var(--admin-card-bg))',
      borderColor: 'var(--admin-success-border, var(--admin-card-border))',
      color: 'var(--admin-success-text, var(--admin-card-text))',
    };
  }

  if (tone === 'warning') {
    return {
      background: 'var(--admin-warning-soft-bg, var(--admin-card-bg))',
      borderColor: 'var(--admin-warning-border, var(--admin-card-border))',
      color: 'var(--admin-warning-text, var(--admin-card-text))',
    };
  }

  if (tone === 'error') {
    return {
      background: 'var(--admin-danger-soft-bg, var(--admin-card-bg))',
      borderColor: 'var(--admin-danger-border, var(--admin-card-border))',
      color: 'var(--admin-danger-text, var(--admin-card-text))',
    };
  }

  return {
    background: 'var(--admin-primary-soft-bg, var(--admin-card-bg))',
    borderColor: 'var(--admin-primary-soft-border, var(--admin-card-border))',
    color: 'var(--admin-primary-soft-text, var(--admin-primary))',
  };
}
