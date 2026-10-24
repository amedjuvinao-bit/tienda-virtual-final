import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminFetch } from "./api";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("adminFetch con sesión HttpOnly y API en otro puerto", () => {
  it.each(["GET", "POST", "PUT", "DELETE"])(
    "envía la cookie en %s sin recuperar tokens del almacenamiento",
    async (method) => {
      localStorage.setItem("admin_token", "legacy-token-must-stay-private");
      const response = await adminFetch("http://localhost:5000/api/pages", {
        method,
        ...(method === "POST" || method === "PUT"
          ? {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: "Primera comunión" }),
            }
          : {}),
      });
      const [, options] = fetch.mock.calls[0];
      expect(options.credentials).toBe("include");
      expect(options.method).toBe(method);
      expect(JSON.stringify(fetch.mock.calls)).not.toContain("legacy-token");
      expect(response).toBe(await fetch.mock.results[0].value);
      if (method === "POST" || method === "PUT") {
        expect(JSON.parse(options.body)).toEqual({ name: "Primera comunión" });
        expect(options.headers).toEqual({ "Content-Type": "application/json" });
      }
    },
  );

  it("conserva FormData sin imponer Content-Type para las subidas autenticadas", async () => {
    const body = new FormData();
    body.append(
      "file",
      new File(["image"], "producto.png", { type: "image/png" }),
    );
    await adminFetch("http://localhost:5000/api/uploads", {
      method: "POST",
      body,
    });
    expect(fetch).toHaveBeenCalledWith("http://localhost:5000/api/uploads", {
      method: "POST",
      body,
      credentials: "include",
    });
  });

  it("permite respetar una política de credenciales explícita sin cambiar la señal de cancelación", async () => {
    const controller = new AbortController();
    await adminFetch("/api/pages", {
      credentials: "omit",
      signal: controller.signal,
    });
    expect(fetch).toHaveBeenCalledWith("/api/pages", {
      credentials: "omit",
      signal: controller.signal,
    });
  });
});
