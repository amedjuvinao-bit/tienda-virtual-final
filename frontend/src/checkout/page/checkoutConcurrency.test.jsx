import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import useCheckoutSubmission from "./useCheckoutSubmission";
import { buildSafeCheckoutPageConfig } from "./checkoutPageConfig";
vi.mock("../../lib/api", () => ({
  default: { post: vi.fn() },
  setSessionId: vi.fn(),
}));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("un doble clic en el mismo turno solo inicia una validación y creación", async () => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  let reject;
  const ensureCartReady = vi.fn(
    () => new Promise((_resolve, failure) => (reject = failure)),
  );
  const state = {
    acceptedTerms: "offer-1", authorizedPrivacy: "offer-1",
    checkoutConfig: {
      ...buildSafeCheckoutPageConfig({}),
      showBillingSection: false,
    },
    paymentsConfig: { provider: "manual" },
    customerName: "Cliente",
    customerLastname: "Prueba",
    customerEmailOrPhone: "cliente@example.com",
    customerId: "123456",
    deliveryType: "retiro",
    setIsPlacing: vi.fn(),
    setErrors: vi.fn(),
  };
  const derived = {
    consumerOffer: { fingerprint: "offer-1", ready: true },
    currentCart: [{ _id: "p", quantity: 1 }],
    itemCount: 1,
    paymentCanProceed: true,
    quotePricing: { total: 10000 },
    subtotal: 10000,
    total: 10000,
    resolvedDianCustomer: { email: "cliente@example.com" },
  };
  const { result } = renderHook(
    () => useCheckoutSubmission({ state, derived, ensureCartReady }),
    { wrapper: ({ children }) => <MemoryRouter>{children}</MemoryRouter> },
  );
  let first, second;
  act(() => {
    first = result.current.handlePlaceOrder();
    second = result.current.handlePlaceOrder();
  });
  expect(ensureCartReady).toHaveBeenCalledOnce();
  await act(async () => {
    reject(new Error("offline"));
    await Promise.all([first, second]);
  });
  expect(state.setErrors).toHaveBeenCalledWith([
    "No pudimos validar tu carrito en este momento. Intenta nuevamente.",
  ]);
});
