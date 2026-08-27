// src/pages/CheckoutPage.jsx
import React from 'react';
import CheckoutPageView from '../checkout/page/CheckoutPageView';
import useCheckoutConfiguration from '../checkout/page/useCheckoutConfiguration';
import useCheckoutDerived from '../checkout/page/useCheckoutDerived';
import useCheckoutGeography from '../checkout/page/useCheckoutGeography';
import useCheckoutQuote from '../checkout/page/useCheckoutQuote';
import useCheckoutState from '../checkout/page/useCheckoutState';
import useCheckoutSubmission from '../checkout/page/useCheckoutSubmission';
import { useCart } from '../context/CartContext';

export default function CheckoutPage() {
  const state = useCheckoutState();
  const {
    cart,
    clearCart,
    ensureCartReady,
    renewCartAccess,
    validateCart,
  } = useCart();

  useCheckoutConfiguration(state);

  const derived = useCheckoutDerived({ state, cart });
  useCheckoutGeography({ state, selectedCountry: derived.selectedCountry });

  const quoteActions = useCheckoutQuote({
    state,
    derived,
    ensureCartReady,
  });
  const submissionActions = useCheckoutSubmission({
    state,
    derived,
    clearCart,
    ensureCartReady,
    renewCartAccess,
    validateCart,
  });

  return (
    <CheckoutPageView
      state={state}
      derived={derived}
      actions={{ ...quoteActions, ...submissionActions }}
    />
  );
}
