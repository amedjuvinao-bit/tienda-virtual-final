import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import useCheckoutState from "./useCheckoutState";
import useCheckoutDerived from "./useCheckoutDerived";
import useCheckoutQuote from "./useCheckoutQuote";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { post: vi.fn() } }));
const cart = [
  {
    productId: "p",
    title: "Producto",
    quantity: 1,
    price: 90000,
    requiresShipping: true,
  },
];
const access = async () => ({ sessionId: "cart-signed", token: "cart-token" });
function useHarness() {
  const form = useCheckoutState();
  const state = {
    ...form,
    paymentsConfig: { provider: "manual", active: true, currency: "COP" },
    paymentsConfigLoading: false,
    shippingConfigLoading: false,
    countries: [{ code: "CO", name: "Colombia" }],
  };
  const derived = useCheckoutDerived({ state, cart });
  const actions = useCheckoutQuote({ state, derived, ensureCartReady: access });
  return { state, derived, actions };
}
const quote = {
  pricing: {
    subtotal: 90000,
    shipping: 7000,
    originalShipping: 10000,
    shippingDiscount: 3000,
    total: 97000,
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  api.post.mockResolvedValue({ data: quote });
});
afterEach(cleanup);
it("invalida el total inmediatamente al cambiar datos y descarta una respuesta anterior", async () => {
  let release;
  api.post.mockImplementationOnce(
    () => new Promise((resolve) => (release = resolve)),
  );
  const { result } = renderHook(useHarness);
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  const signal = api.post.mock.calls[0][2].signal;
  act(() => result.current.state.setCustomerId("12345"));
  expect(result.current.derived.quotePricing).toBeNull();
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(result.current.derived.quotePricing?.total).toBe(97000),
  );
  await act(async () => release({ data: { pricing: { total: 1 } } }));
  expect(result.current.derived.total).toBe(97000);
  expect(api.post.mock.calls[1][1].customerDocument).toBe("12345");
});
it("una caída de red elimina el total anterior y permite reintentar sin pagar con cifras obsoletas", async () => {
  const { result } = renderHook(useHarness);
  await waitFor(() =>
    expect(result.current.derived.quotePricing?.total).toBe(97000),
  );
  expect(result.current.derived.finalShipping).toBe(7000);
  expect(result.current.derived.shippingBeforeDiscount).toBe(10000);
  api.post.mockRejectedValueOnce(new Error("offline"));
  act(() => result.current.state.setCustomerCity("Otra ciudad"));
  await waitFor(() => expect(result.current.state.quoteError).not.toBe(""));
  expect(result.current.derived.quotePricing).toBeNull();
  act(() => result.current.actions.retryCheckoutQuote());
  await waitFor(() =>
    expect(result.current.derived.quotePricing?.total).toBe(97000),
  );
  expect(result.current.state.quoteError).toBe("");
});
it("no aplica un saldo obtenido para una identidad que cambió durante la consulta", async () => {
  let release;
  api.post.mockImplementation((url) =>
    url.includes("store-credit")
      ? new Promise((resolve) => (release = resolve))
      : Promise.resolve({ data: quote }),
  );
  const { result } = renderHook(useHarness);
  act(() => {
    result.current.state.setCustomerId("123456");
    result.current.state.setCustomerEmailOrPhone("cliente@example.com");
  });
  let request;
  act(() => {
    request = result.current.actions.handlePreviewStoreCredit();
  });
  await waitFor(() => expect(release).toBeTypeOf("function"));
  act(() => result.current.state.setCustomerId("654321"));
  await act(async () => {
    release({
      data: {
        eligible: true,
        balance: 50000,
        accessToken: "old-identity-credit",
      },
    });
    await request;
  });
  expect(result.current.state.storeCreditPreview.eligible).toBe(false);
  expect(result.current.state.useStoreCredit).toBe(false);
});
