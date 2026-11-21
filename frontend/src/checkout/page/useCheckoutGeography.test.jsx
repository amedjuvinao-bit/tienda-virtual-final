import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import useCheckoutState from "./useCheckoutState";
import useCheckoutGeography from "./useCheckoutGeography";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { get: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function useHarness() {
  const state = useCheckoutState();
  const selectedCountry = state.countries.find(
    (country) => country.name === state.customerCountry,
  );
  useCheckoutGeography({ state, selectedCountry });
  return state;
}
it("ofrece reintento si los países fallan y recupera el catálogo sin inventar datos", async () => {
  let fail = true;
  api.get.mockImplementation((url) =>
    url.endsWith("/countries") && fail
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({
          data: url.endsWith("/countries")
            ? [{ code: "CO", name: "Colombia" }]
            : [{ code: "47", name: "Magdalena" }],
        }),
  );
  const { result } = renderHook(useHarness);
  await waitFor(() =>
    expect(result.current.geographyError).toContain("países"),
  );
  expect(result.current.countries).toEqual([]);
  fail = false;
  act(() => result.current.setGeographyAttempt((value) => value + 1));
  await waitFor(() => expect(result.current.regions[0]?.code).toBe("47"));
  expect(result.current.geographyError).toBe("");
});
it("permite recuperar departamentos después de un fallo sin borrar la identidad del comprador", async () => {
  let fail = true;
  api.get.mockImplementation((url) =>
    url.endsWith("/regions") && fail
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({
          data: url.endsWith("/countries")
            ? [{ code: "CO", name: "Colombia" }]
            : [{ code: "47", name: "Magdalena" }],
        }),
  );
  const { result } = renderHook(useHarness);
  act(() => result.current.setCustomerName("Cliente"));
  await waitFor(() =>
    expect(result.current.geographyError).toContain("departamentos"),
  );
  fail = false;
  act(() => result.current.setGeographyAttempt((value) => value + 1));
  await waitFor(() => expect(result.current.regions[0]?.code).toBe("47"));
  expect(result.current.customerName).toBe("Cliente");
  expect(result.current.geographyError).toBe("");
});
