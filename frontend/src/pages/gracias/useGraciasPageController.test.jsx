import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { useGraciasPageController } from "./useGraciasPageController";
import { storeOrderPaymentAccess } from "../../utils/orderPaymentAccess";
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});
const orderId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const wrapper = ({ children }) => (
  <MemoryRouter initialEntries={[`/gracias?orderId=${orderId}`]}>
    {children}
  </MemoryRouter>
);
it("recupera la apariencia sin descartar el resumen protegido", async () => {
  storeOrderPaymentAccess({
    orderId,
    sessionId: "s",
    token: "t",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url) =>
      url.includes("/api/pages/")
        ? fail
          ? { ok: false, status: 503 }
          : {
              ok: true,
              json: async () => ({
                useHeader: false,
                useFooter: false,
                thanksPageConfig: {
                  titleText: "Mi título",
                  slider: { slides: [] },
                },
              }),
            }
        : {
            ok: true,
            json: async () => ({
              ok: true,
              orderNumber: "REAL",
              paymentStatus: "paid",
              total: 30000,
            }),
          },
    ),
  );
  const { result } = renderHook(useGraciasPageController, { wrapper });
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.configError).not.toBe(""));
  await waitFor(() => expect(result.current.viewModel.verified).toBe(true));
  expect(result.current.page.useHeader).toBe(false);
  expect(result.current.viewModel.total).toBe(30000);
  fail = false;
  act(() => result.current.retryConfig());
  await waitFor(() =>
    expect(result.current.thanksConfig.titleText).toBe("Mi título"),
  );
  expect(result.current.viewModel.orderNumber).toBe("REAL");
  expect(result.current.configError).toBe("");
});
it("cancela la configuración al salir", () => {
  let signal;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      signal = options.signal;
      return new Promise(() => {});
    }),
  );
  const { unmount } = renderHook(useGraciasPageController, { wrapper });
  expect(signal.aborted).toBe(false);
  unmount();
  expect(signal.aborted).toBe(true);
});
