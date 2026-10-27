import CheckoutConsumerAcceptance from "../../components/consumer/CheckoutConsumerAcceptance";
import { CheckoutButton } from "./CheckoutMaterial";
import React from "react";
import CheckoutDianCustomerFields from "../dian/CheckoutDianCustomerFields";

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
          allowSameAddress={
            derived.cartRequiresShipping && state.deliveryType === "envio"
          }
          useSameAddress={state.sameAddress}
          onUseSameAddressChange={state.setSameAddress}
          countries={state.countries}
          countriesLoading={state.countriesLoading}
          regions={state.billingRegions}
          regionsLoading={state.billingRegionsLoading}
          cities={state.billingCities}
          citiesLoading={state.billingCitiesLoading}
          title={
            checkoutConfig.billingSectionTitle ||
            "Datos para facturación electrónica"
          }
          differentAddressLabel={checkoutConfig.billingToggleText}
        />
      )}

      <CheckoutConsumerAcceptance state={state} derived={derived} />

      {checkoutConfig.showConfirmButton && (
        <CheckoutButton
          className="co-btn-primary"
          style={{
            color: checkoutConfig.style.confirmButtonTextColor,

            marginTop: "8px",
          }}
          onClick={onPlaceOrder}
          disabled={
            !derived.consumerOffer?.ready ||
            state.acceptedTerms !== derived.consumerOffer?.fingerprint ||
            state.authorizedPrivacy !== derived.consumerOffer?.fingerprint ||
            state.isPlacing ||
            state.cartLoading ||
            !derived.currentCart ||
            derived.currentCart.length === 0 ||
            derived.itemCount === 0 ||
            state.quoteLoading ||
            !derived.quotePricing ||
            derived.subtotal <= 0 ||
            derived.total <= 0 ||
            !!state.geographyError ||
            !derived.paymentCanProceed
          }
        >
          {state.isPlacing ? (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                style={{ animation: "spin 1s linear infinite" }}
              >
                <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="25"
                  strokeLinecap="round"
                />
              </svg>
              Procesando...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M13 5H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M5 5V4a3 3 0 016 0v1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              {derived.appliedStoreCreditAmount >= derived.total
                ? "Pagar con saldo a favor"
                : state.paymentsConfig.provider === "manual"
                  ? "Confirmar pedido"
                  : checkoutConfig.confirmButtonText}
            </>
          )}
        </CheckoutButton>
      )}

      {derived.disableReason && !state.isPlacing && (
        <p
          style={{
            marginTop: "8px",
            fontSize: "12px",
            textAlign: "center",
            color: checkoutConfig.style.accentColor,
          }}
        >
          {derived.disableReason}
        </p>
      )}

      {checkoutConfig.showPoliciesText && (
        <div className="co-secure-badge">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1L2 2.5v4C2 8.5 3.8 10.5 6 11c2.2-.5 4-2.5 4-4.5v-4L6 1z"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M4 6l1.5 1.5L8 4.5"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          {checkoutConfig.policiesText}
        </div>
      )}

      <nav className="co-policies" aria-label="Condiciones de compra">
        {[["cambios-y-devoluciones", "Retracto, garantía y devoluciones"], ["envios", "Envíos y entregas"], ["privacidad", "Datos personales"], ["terminos", "Condiciones de compra"], ["pqr", "Peticiones y reclamos"], ["contacto", "Contacto"]].map(([slug, label]) => <a className="co-policy-link" key={slug} href={`/${slug}`} target="_blank" rel="noopener noreferrer">{label}</a>)}
      </nav>
    </>
  );
}
