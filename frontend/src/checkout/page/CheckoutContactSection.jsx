import React from 'react';

export default function CheckoutContactSection({ state }) {
  const { checkoutConfig } = state;

  if (!checkoutConfig.showContactSection) return null;

  return (
    <div className="co-card">
      <h2 className="co-card-title">{checkoutConfig.contactSectionTitle}</h2>

      <label className="co-field-label">{checkoutConfig.emailLabelText}</label>
      <input
        type="text"
        className="co-input"
        placeholder="tu@email.com o +57 300..."
        value={state.customerEmailOrPhone}
        onChange={(event) => state.setCustomerEmailOrPhone(event.target.value)}
        autoComplete="email"
        name="contact"
      />

      {checkoutConfig.showNewsletterCheckbox && (
        <label className="co-newsletter">
          <input
            type="checkbox"
            checked={state.wantsNewsletter}
            onChange={(event) => state.setWantsNewsletter(event.target.checked)}
          />
          {checkoutConfig.newsletterText}
        </label>
      )}

      <div className="co-mt-4">
        <label className="co-field-label">{checkoutConfig.documentLabelText}</label>
        <input
          type="text"
          className="co-input"
          placeholder="12345678"
          value={state.customerId}
          onChange={(event) => state.setCustomerId(event.target.value)}
          autoComplete="off"
          name="customerId"
        />
      </div>

      <div className="co-grid-2 co-mt-4">
        <div>
          <label className="co-field-label">{checkoutConfig.nameLabelText}</label>
          <input
            type="text"
            className="co-input"
            placeholder="María"
            value={state.customerName}
            onChange={(event) => state.setCustomerName(event.target.value)}
            autoComplete="given-name"
            name="firstName"
          />
        </div>
        <div>
          <label className="co-field-label">Apellidos</label>
          <input
            type="text"
            className="co-input"
            placeholder="García"
            value={state.customerLastname}
            onChange={(event) => state.setCustomerLastname(event.target.value)}
            autoComplete="family-name"
            name="lastName"
          />
        </div>
      </div>
    </div>
  );
}
