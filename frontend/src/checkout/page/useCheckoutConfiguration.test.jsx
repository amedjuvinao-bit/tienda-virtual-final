import { cleanup, renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import api from "../../lib/api";
import useCheckoutState from "./useCheckoutState";
import useCheckoutConfiguration from "./useCheckoutConfiguration";
vi.mock("../../lib/api", () => ({
  default: { get: vi.fn() },
  setSessionId: vi.fn(),
}));
const useHarness = () => {
  const state = useCheckoutState();
  useCheckoutConfiguration(state);
  return state;
};
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({
    data: {
      theme: { global: { payments: { provider: "manual", active: true } } },
    },
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("respeta el encabezado y footer del documento y conserva campos del editor", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        useHeader: false,
        useFooter: false,
        checkoutPageConfig: {
          titleText: "Tu pedido",
          style: { inputStyle: "pill" },
        },
      }),
    })),
  );
  const { result } = renderHook(useHarness);
  expect(result.current.checkoutConfigLoading).toBe(true);
  await waitFor(() => expect(result.current.checkoutConfigLoading).toBe(false));
  expect(result.current.checkoutConfig).toMatchObject({
    showHeader: false,
    showFooter: false,
    titleText: "Tu pedido",
    style: { inputStyle: "pill" },
  });
});
it("ofrece recuperación independiente cuando falla la apariencia o la configuración de pago", async () => {
  let fail = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      fail
        ? { ok: false, status: 503 }
        : {
            ok: true,
            json: async () => ({
              checkoutPageConfig: { titleText: "Recuperada" },
            }),
          },
    ),
  );
  api.get.mockRejectedValueOnce(new Error("offline"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { result } = renderHook(useHarness);
  await waitFor(() => expect(result.current.checkoutConfigError).not.toBe(""));
  expect(result.current.checkoutConfig.showHeader).toBe(false);
  expect(result.current.configurationError).not.toBe("");
  fail = false;
  act(() => result.current.setConfigurationAttempt((value) => value + 1));
  await waitFor(() =>
    expect(result.current.checkoutConfig.titleText).toBe("Recuperada"),
  );
  expect(result.current.configurationError).toBe("");
  expect(result.current.paymentsConfig.provider).toBe("manual");
});
it("cancela las solicitudes de apariencia y pagos al salir", () => {
  let cmsSignal;
  vi.stubGlobal(
    "fetch",
    vi.fn((_url, options) => {
      cmsSignal = options.signal;
      return new Promise(() => {});
    }),
  );
  api.get.mockReturnValue(new Promise(() => {}));
  const { unmount } = renderHook(useHarness);
  const siteSignal = api.get.mock.calls[0][1].signal;
  unmount();
  expect(cmsSignal.aborted).toBe(true);
  expect(siteSignal.aborted).toBe(true);
});
