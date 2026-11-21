import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import useThanksVerification from "./useThanksVerification";
import { storeOrderPaymentAccess } from "../../utils/orderPaymentAccess";
beforeEach(() => sessionStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
});
const access = (orderId) =>
  storeOrderPaymentAccess({
    orderId,
    sessionId: "signed-session",
    token: "secret-token",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
it("no consulta órdenes ni acepta éxito sin acceso firmado", async () => {
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() =>
    useThanksVerification({
      orderId: "fake",
      transactionId: "fake",
      hasResponse: true,
    }),
  );
  await waitFor(() =>
    expect(result.current.thanksAccessError).toContain("mismo navegador"),
  );
  expect(fetch).not.toHaveBeenCalled();
  expect(result.current.thanksOrderData).toBeNull();
});
it("envía credenciales por cabecera y permite reintentar una caída de red", async () => {
  access("order");
  let fail = true;
  const fetch = vi.fn(async () =>
    fail
      ? { ok: false, status: 503 }
      : { ok: true, json: async () => ({ ok: true, orderNumber: "REAL" }) },
  );
  vi.stubGlobal("fetch", fetch);
  const { result } = renderHook(() =>
    useThanksVerification({
      orderId: "order",
      transactionId: "",
      hasResponse: true,
    }),
  );
  expect(result.current.verificationLoading).toBe(true);
  await waitFor(() =>
    expect(result.current.thanksAccessError).toContain("conexión"),
  );
  const [url, options] = fetch.mock.calls[0];
  expect(url).not.toContain("secret-token");
  expect(options.headers["X-Order-Access-Token"]).toBe("secret-token");
  fail = false;
  act(() => result.current.retryVerification());
  await waitFor(() =>
    expect(result.current.thanksOrderData?.orderNumber).toBe("REAL"),
  );
  expect(result.current.thanksAccessError).toBe("");
});
it("cancela la consulta anterior al cambiar de pedido y descarta respuestas viejas", async () => {
  access("one");
  let release, oldSignal;
  vi.stubGlobal(
    "fetch",
    vi.fn((url, options) => {
      if (url.includes("/one/")) {
        oldSignal = options.signal;
        return new Promise(
          (resolve) =>
            (release = () =>
              resolve({
                ok: true,
                json: async () => ({ ok: true, orderNumber: "OLD" }),
              })),
        );
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ ok: true, orderNumber: "NEW" }),
      });
    }),
  );
  const { result, rerender } = renderHook(
    ({ id }) =>
      useThanksVerification({
        orderId: id,
        transactionId: "",
        hasResponse: true,
      }),
    { initialProps: { id: "one" } },
  );
  access("two");
  rerender({ id: "two" });
  expect(result.current.thanksOrderData).toBeNull();
  expect(oldSignal.aborted).toBe(true);
  await waitFor(() =>
    expect(result.current.thanksOrderData?.orderNumber).toBe("NEW"),
  );
  await act(async () => release());
  expect(result.current.thanksOrderData.orderNumber).toBe("NEW");
});
