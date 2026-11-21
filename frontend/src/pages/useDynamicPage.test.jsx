import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import useDynamicPage from "./useDynamicPage";
afterEach(() => vi.unstubAllGlobals());
it("distinguishes a missing page from a retryable connection failure", async () => {
  let status = 503;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      status,
      ok: status === 200,
      json: async () => ({ name: "Nosotros" }),
    })),
  );
  const { result } = renderHook(() => useDynamicPage("nosotros"));
  await waitFor(() => expect(result.current.error).toBeTruthy());
  expect(result.current.notFound).not.toBe(true);
  status = 200;
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.page?.name).toBe("Nosotros"));
  status = 404;
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.notFound).toBe(true));
});
it("aborts a previous slug and ignores its late response", async () => {
  const pending = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (url, options) =>
        new Promise((resolve) =>
          pending.push({ url, signal: options.signal, resolve }),
        ),
    ),
  );
  const { result, rerender } = renderHook(({ slug }) => useDynamicPage(slug), {
    initialProps: { slug: "anterior" },
  });
  rerender({ slug: "nuevo" });
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () =>
    pending[1].resolve({ ok: true, json: async () => ({ name: "Nuevo" }) }),
  );
  await act(async () =>
    pending[0].resolve({ ok: true, json: async () => ({ name: "Anterior" }) }),
  );
  expect(result.current.page.name).toBe("Nuevo");
});
