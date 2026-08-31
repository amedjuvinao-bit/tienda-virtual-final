import React from 'react';
import CheckoutDianCustomerFields from '../dian/CheckoutDianCustomerFields';

export default function CheckoutFormActions({ state, derived, onPlaceOrder }) {
  const { checkoutConfig } = state;

  return (
    <>
      {checkoutConfig.showBillingSection && (
        <CheckoutDianCustomerFields
          value={derived.resolvedDianCustomer}
          onChange={(nextValue, changedFields) => {
            state.setDianCustomer((current) => ({
              ...current,
              ...(changedFields || nextValue),
            }));
          }}
          useSameAddress={state.sameAddress}
          onUseSameAddressChange={state.setSameAddress}
          countries={state.countries}
          countriesLoading={state.countriesLoading}
          regions={state.billingRegions}
          regionsLoading={state.billingRegionsLoading}
          cities={state.billingCities}
          citiesLoading={state.billingCitiesLoading}
          title={checkoutConfig.billingSectionTitle || 'Datos para facturación electrónica'}
          differentAddressLabel={checkoutConfig.billingToggleText}
        />
      )}

      {checkoutConfig.showConfirmButton && (
        <button
          className="co-btn-primary"
          style={{
            backgroundColor: checkoutConfig.style.confirmButtonBg,
            color: checkoutConfig.style.confirmButtonTextColor,
            borderRadius: `${checkoutConfig.style.confirmButtonRadiusPx}px`,
            marginTop: '8px',
          }}
          onClick={onPlaceOrder}
          disabled={
            state.isPlacing ||
            !derived.currentCart ||
            derived.currentCart.length === 0 ||
            derived.itemCount === 0 ||
            state.quoteLoading ||
            !derived.quotePricing ||
            derived.subtotal <= 0 ||
            derived.total <= 0 ||
            !derived.paymentCanProceed
          }
        >
          {state.isPlacing ? (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="25" strokeLinecap="round" />
              </svg>
              Procesando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13 5H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              {derived.appliedStoreCreditAmount >= derived.total
                ? 'Pagar con saldo a favor'
                : state.paymentsConfig.provider === 'manual'
                  ? 'Confirmar pedido'
                  : checkoutConfig.confirmButtonText}
            </>
          )}
        </button>
      )}

      {derived.disableReason && !state.isPlacing && (
        <p style={{ marginTop: '8px', fontSize: '12px', textAlign: 'center', color: '#ec4899' }}>
          {derived.disableReason}
        </p>
      )}

      {checkoutConfig.showPoliciesText && (
        <div className="co-secure-badge">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M6 1L2 2.5v4C2 8.5 3.8 10.5 6 11c2.2-.5 4-2.5 4-4.5v-4L6 1z" stroke="#9ca3af" strokeWidth="1.2" />
            <path d="M4 6l1.5 1.5L8 4.5" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          {checkoutConfig.policiesText}
        </div>
      )}

      <div className="co-policies">
        <button type="button" className="co-policy-link" onClick={() => state.setShowModal(true)}>Políticas de reembolso</button>
        <button type="button" className="co-policy-link" onClick={() => state.setShowEnvioModal(true)}>Política de Envío</button>
        <button type="button" className="co-policy-link" onClick={() => state.setShowPrivacidadModal(true)}>Privacidad</button>
        <button type="button" className="co-policy-link" onClick={() => state.setShowTerminosModal(true)}>Términos del servicio</button>
        <button type="button" className="co-policy-link" onClick={() => state.setShowContactoModal(true)}>Contacto</button>
      </div>
    </>
  );
}
