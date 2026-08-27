export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

  .co-page * { box-sizing: border-box; }

  .co-page {
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }

  .co-input {
    display: block;
    width: 100%;
    border: 1.5px solid var(--co-input-border);
    border-radius: var(--co-input-radius);
    padding: 0 14px;
    height: var(--co-input-h);
    background: var(--co-input-bg);
    color: var(--co-input-text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    transition: border-color 0.18s, box-shadow 0.18s;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
  }
  .co-input::placeholder { color: #b0b8c4; }
  .co-input:focus {
    border-color: var(--co-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--co-accent) 12%, transparent);
  }

  select.co-input {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239ca3af' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }

  .co-card {
    background: var(--co-card-bg);
    border: 1.5px solid var(--co-card-border);
    border-radius: var(--co-card-radius);
    padding: var(--co-card-padding);
    margin-bottom: 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    transition: box-shadow 0.2s;
  }
  .co-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }

  .co-card-title {
    font-family: 'DM Serif Display', serif;
    font-size: 18px;
    font-weight: 400;
    color: var(--co-text-primary);
    margin: 0 0 16px 0;
    letter-spacing: -0.01em;
  }

  .co-radio-option {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1.5px solid var(--co-card-border);
    border-radius: 10px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    color: var(--co-text-primary);
    transition: border-color 0.18s, background 0.18s;
  }
  .co-radio-option:has(input:checked) {
    border-color: var(--co-accent);
    background: color-mix(in srgb, var(--co-accent) 5%, transparent);
  }
  .co-radio-option input[type="radio"] {
    accent-color: var(--co-accent);
    width: 16px; height: 16px;
    cursor: pointer;
  }

  .co-btn-primary {
    width: 100%;
    padding: 15px 24px;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .co-btn-primary:not(:disabled):hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(236,72,153,0.28);
  }
  .co-btn-primary:not(:disabled):active { transform: translateY(0); }
  .co-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .co-summary-card {
    border-radius: var(--co-summary-radius);
    border: 1.5px solid var(--co-summary-border);
    background: var(--co-summary-bg);
    padding: 24px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.05);
  }

  .co-summary-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .co-summary-item:last-child { border-bottom: none; }

  .co-product-img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 10px;
    flex-shrink: 0;
    border: 1px solid #f3f4f6;
  }

  .co-qty-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #1f2937;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #fff;
  }

  .co-discount-row {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  .co-discount-row .co-input { flex: 1; }

  .co-btn-secondary {
    padding: 0 18px;
    height: var(--co-input-h);
    background: #f3f4f6;
    color: #374151;
    border: 1.5px solid #e5e7eb;
    border-radius: var(--co-input-radius);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .co-btn-secondary:hover { background: #e5e7eb; }

  .co-totals { margin-top: 20px; }
  .co-totals-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }
  .co-totals-divider {
    border: none;
    border-top: 1.5px solid #f3f4f6;
    margin: 10px 0;
  }
  .co-totals-total {
    font-size: 17px;
    font-weight: 600;
  }

  .co-shipping-box {
    background: linear-gradient(135deg, #fdf2f8 0%, #fff7ed 100%);
    border: 1.5px solid #fce7f3;
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .co-payment-redirect {
    background: #f9fafb;
    border: 1.5px dashed #e5e7eb;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: #6b7280;
    line-height: 1.6;
  }

  .co-payment-provider-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    border-radius: 999px;
    border: 1px solid #fbcfe8;
    background: #fdf2f8;
    color: #be185d;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 6px 12px;
  }

  .co-payment-icon {
    width: 64px;
    height: 44px;
    margin: 0 auto 12px;
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .co-policies {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 16px;
    margin-top: 20px;
    padding-bottom: 8px;
  }

  .co-policy-link {
    font-size: 11px;
    color: #ec4899;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    transition: color 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .co-policy-link:hover { color: #be185d; }

  .co-secure-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11px;
    color: #9ca3af;
    margin-top: 10px;
  }

  .co-error-banner {
    border: 1.5px solid #fca5a5;
    background: linear-gradient(135deg, #fff1f2, #fff5f7);
    border-radius: 12px;
    padding: 16px 20px;
    font-size: 13px;
    color: #9f1239;
  }
  .co-error-banner strong { display: block; margin-bottom: 8px; font-size: 14px; }
  .co-error-banner ul { margin: 0; padding-left: 18px; }
  .co-error-banner li { margin-bottom: 4px; }

  .co-field-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }

  .co-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .co-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .co-layout {
      grid-template-columns: 1fr 420px;
      gap: 40px;
      align-items: stretch;
    }
    .co-form-col { order: 1; }
    .co-summary-col {
      order: 2;
      min-height: 100%;
    }
  }

  @media (min-width: 1024px) {
    .co-summary-sticky {
      position: sticky;
      top: 120px;
      align-self: start;
    }
  }

  @media (min-width: 1024px) {
    .co-summary-col {
      border-left: 1.5px solid #f3f4f6;
      padding-left: 40px;
      align-self: start;
    }
  }

  .co-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .co-grid-2 { grid-template-columns: 1fr; }
  }

  .co-mt-3 { margin-top: 12px; }
  .co-mt-4 { margin-top: 16px; }
  .co-mt-5 { margin-top: 20px; }

  .co-newsletter {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #6b7280;
    margin-top: 10px;
    cursor: pointer;
    user-select: none;
  }
  .co-newsletter input[type="checkbox"] {
    accent-color: var(--co-accent);
    width: 15px; height: 15px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .co-step-indicator {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 28px;
    font-size: 12px;
    font-weight: 500;
  }
  .co-step {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #d1d5db;
  }
  .co-step.active { color: var(--co-accent); }
  .co-step.done { color: #374151; }
  .co-step-num {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }
  .co-step.active .co-step-num {
    background: var(--co-accent);
    border-color: var(--co-accent);
    color: #fff;
  }
  .co-step-sep {
    width: 28px;
    height: 1.5px;
    background: #e5e7eb;
    margin: 0 4px;
    flex-shrink: 0;
  }
  @media (max-width: 480px) {
    .co-step-sep { width: 14px; }
  }
`;
