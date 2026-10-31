import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from "@testing-library/react";
import api from "../lib/api";
import { toast } from "react-toastify";
import { CartProvider, useCart } from "./CartContext";
vi.mock("../lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    defaults: { baseURL: "" },
  },
  setSessionId: vi.fn((value) =>
    value
      ? localStorage.setItem("session_id", value)
      : localStorage.removeItem("session_id"),
  ),
}));
vi.mock("react-toastify", () => ({
  toast: { info: vi.fn(), error: vi.fn(), warning: vi.fn(), success: vi.fn() },
}));
const item = {
  _id: "p1",
  title: "Producto",
  price: 100,
  quantity: 1,
  variantKey: "default__default",
};
function Harness() {
  const c = useCart();
  const [prepared, setPrepared] = React.useState(false);
  return (
    <>
      <button
        onClick={() => c.removeFromCart("p1", "", "", "default__default")}
      >
        Retirar
      </button>
      <output data-testid="prepared">{String(prepared)}</output>
      <button onClick={() => c.ensureCartReady().then(() => setPrepared(true))}>
        Preparar pago
      </button>
      <output data-testid="cart">{JSON.stringify(c)}</output>
      <button onClick={() => c.addToCart(item)}>Añadir</button>
      <button
        onClick={() => c.increaseQuantity("p1", "", "", "default__default")}
      >
        Aumentar
      </button>
    </>
  );
}
const snapshot = () => JSON.parse(screen.getByTestId("cart").textContent);
function seed() {
  localStorage.setItem("cart", JSON.stringify([item]));
  localStorage.setItem("session_id", "cart-test");
  sessionStorage.setItem("cart_access_token", "token");
}
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  api.get.mockResolvedValue({
    data: {
      items: [
        { ...item, productId: "p1", qty: 1, price: 120, purchasable: true },
      ],
      version: "2026-10-25T00:00:00.000Z",
    },
  });
  api.put.mockImplementation(async (_path, body) => ({
    data: { cart: { items: body.items }, version: "2026-10-25T00:00:01.000Z" },
  }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("actualiza precio al abrir y al volver a la ventana", async () => {
  seed();
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().cart[0].price).toBe(120));
  api.get.mockResolvedValue({
    data: {
      items: [{ ...item, price: 150 }],
      version: "2026-10-25T00:00:02.000Z",
    },
  });
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(snapshot().cart[0].price).toBe(150));
  expect(snapshot().loading).toBe(false);
});
it("revierte la adición y avisa si falla la creación inicial", async () => {
  api.post.mockRejectedValue(new Error("Sin conexión"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  fireEvent.click(screen.getByText("Añadir"));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(snapshot().cart).toEqual([]);
  expect(snapshot().loading).toBe(false);
  expect(snapshot().cartMessage).toContain("estado anterior");
});
it("restaura la cantidad anterior si falla obtener la versión inicial", async () => {
  seed();
  api.get.mockRejectedValue(new Error("Sin conexión"));
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().syncError).toBe(true));
  fireEvent.click(screen.getByText("Aumentar"));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(snapshot().cart[0].quantity).toBe(1);
  expect(snapshot().loading).toBe(false);
  expect(api.put).not.toHaveBeenCalled();
});
it("serializa la actualización inicial y una modificación sin sobrescribir el servidor", async () => {
  seed();
  let release;
  api.get.mockReturnValue(new Promise((resolve) => (release = resolve)));
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(api.get).toHaveBeenCalled());
  fireEvent.click(screen.getByText("Aumentar"));
  await act(async () =>
    release({
      data: {
        items: [{ ...item, quantity: 2, qty: 2 }],
        version: "2026-10-25T00:00:00.000Z",
      },
    }),
  );
  await waitFor(() => expect(snapshot().pendingOperations).toBe(0));
  expect(snapshot().cart[0].quantity).toBe(3);
  expect(api.put.mock.calls[0][1].items[0].qty).toBe(3);
});
it("restaura un carrito local sin credencial validándolo antes de crear la nueva sesión", async () => {
  localStorage.setItem("cart", JSON.stringify([item]));
  api.post.mockImplementation(async (path) =>
    path === "/api/cart/validate"
      ? {
          data: {
            items: [{ ...item, productId: "p1", qty: 0, quantity: 0 }],
            adjustments: [{ reason: "OUT_OF_STOCK" }],
          },
        }
      : {
          data: {
            sessionId: "restored",
            cartAccessToken: "safe-token",
            cart: { items: [] },
            version: "2026-10-25T00:00:00.000Z",
          },
        },
  );
  api.get.mockResolvedValue({
    data: { items: [], version: "2026-10-25T00:00:00.000Z" },
  });
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/api/cart", { items: [] }),
  );
  await waitFor(() => expect(snapshot().loading).toBe(false));
  expect(snapshot().cart).toEqual([]);
  expect(toast.info).toHaveBeenCalled();
});

it("espera la modificación pendiente antes de entregar el carrito al pago", async () => {
  seed();
  let release;
  api.put.mockImplementation(
    (_path, body) =>
      new Promise(
        (resolve) =>
          (release = () =>
            resolve({
              data: {
                cart: { items: body.items },
                version: "2026-10-25T00:00:01.000Z",
              },
            })),
      ),
  );
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().loading).toBe(false));
  fireEvent.click(screen.getByText("Aumentar"));
  await waitFor(() => expect(release).toBeDefined());
  fireEvent.click(screen.getByText("Preparar pago"));
  expect(screen.getByTestId("prepared")).toHaveTextContent("false");
  await act(async () => release());
  await waitFor(() =>
    expect(screen.getByTestId("prepared")).toHaveTextContent("true"),
  );
  expect(snapshot().cart[0].quantity).toBe(2);
});

const accessMissing = () =>
  Object.assign(new Error("Access unavailable"), {
    response: { status: 404, data: { error: "CART_ACCESS_NOT_FOUND" } },
  });
it("recupera todos los productos con precio actual cuando el acceso anterior devuelve 404", async () => {
  seed();
  api.get.mockRejectedValue(accessMissing());
  api.post.mockImplementation(async (path, body) =>
    path === "/api/cart/validate"
      ? {
          data: {
            items: body.items.map((row) => ({ ...row, price: 150 })),
            adjustments: [],
          },
        }
      : {
          data: {
            sessionId: "restored",
            cartAccessToken: "new-token",
            cart: { items: body.items },
            version: "2026-10-25T00:00:02.000Z",
          },
        },
  );
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/api/cart",
      expect.objectContaining({
        items: [
          expect.objectContaining({ productId: "p1", qty: 1, price: 150 }),
        ],
      }),
    ),
  );
  expect(snapshot().cart).toHaveLength(1);
  expect(snapshot().cart[0].price).toBe(150);
  expect(snapshot().syncError).toBe(false);
});
it("no vacía el carrito si falla reconstruir el acceso", async () => {
  seed();
  api.get.mockRejectedValue(accessMissing());
  api.post.mockRejectedValue(new Error("Sin conexión"));
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().loading).toBe(false));
  await waitFor(() => expect(snapshot().syncError).toBe(true));
  expect(snapshot().cart[0]).toMatchObject({ _id: "p1", quantity: 1 });
  expect(JSON.parse(localStorage.getItem("cart"))).toHaveLength(1);
});

function mockRecreation() {
  api.post.mockImplementation(async (path, body) =>
    path === "/api/cart/validate"
      ? {
          data: {
            items: body.items.map((row) => ({ ...row, price: 150 })),
            adjustments: [],
          },
        }
      : {
          data: {
            sessionId: "restored",
            cartAccessToken: "new-token",
            cart: { items: body.items },
            version: "2026-10-25T00:00:02.000Z",
          },
        },
  );
}
it("recupera una modificación pendiente una sola vez sin perder las otras filas", async () => {
  seed();
  localStorage.setItem(
    "cart",
    JSON.stringify([
      item,
      { ...item, _id: "p2", title: "Otro producto", quantity: 2 },
    ]),
  );
  api.get.mockResolvedValue({
    data: {
      items: [
        item,
        { ...item, _id: "p2", title: "Otro producto", quantity: 2 },
      ],
      version: "v1",
    },
  });
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().loading).toBe(false));
  await waitFor(() => expect(snapshot().cart).toHaveLength(2));
  api.put.mockRejectedValue(accessMissing());
  mockRecreation();
  fireEvent.click(screen.getByText("Aumentar"));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/api/cart", expect.anything()),
  );
  await waitFor(() => expect(snapshot().pendingOperations).toBe(0));
  expect(snapshot().cart.map((row) => [row._id, row.quantity])).toEqual([
    ["p1", 2],
    ["p2", 2],
  ]);
  expect(toast.error).not.toHaveBeenCalled();
  expect(
    api.post.mock.calls.filter(([path]) => path === "/api/cart"),
  ).toHaveLength(1);
});
it("conserva el respaldo confirmado de esta pestaña tras recargar aunque otra vacíe el almacenamiento compartido", async () => {
  seed();
  const view = render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().cart[0].price).toBe(120));
  view.unmount();
  localStorage.setItem("cart", "[]");
  localStorage.setItem("session_id", "other-tab");
  api.get.mockRejectedValue(new Error("Sin conexión"));
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().syncError).toBe(true));
  expect(snapshot().cart[0]).toMatchObject({
    _id: "p1",
    price: 120,
    quantity: 1,
  });
  expect(api.get.mock.lastCall[0]).toBe("/api/cart/cart-test");
});
it("rechaza una respuesta de validación incompleta sin crear ni vaciar el carrito", async () => {
  seed();
  api.get.mockRejectedValue(accessMissing());
  api.post.mockResolvedValue({ data: { ok: true } });
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().syncError).toBe(true));
  expect(snapshot().cart).toHaveLength(1);
  expect(
    api.post.mock.calls.every(([path]) => path === "/api/cart/validate"),
  ).toBe(true);
});
it("conserva productos y credenciales si falla crear el carrito después de validar", async () => {
  seed();
  api.get.mockRejectedValue(accessMissing());
  api.post.mockImplementation(async (path, body) => {
    if (path === "/api/cart/validate")
      return { data: { items: body.items, adjustments: [] } };
    throw new Error("Servidor reiniciando");
  });
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().syncError).toBe(true));
  expect(snapshot().cart[0]).toMatchObject({ _id: "p1", quantity: 1 });
  expect(JSON.parse(sessionStorage.getItem("cart_access"))).toEqual({
    sessionId: "cart-test",
    token: "token",
  });
});
it("retira el último artículo durante una pérdida de acceso sin enviar una validación vacía", async () => {
  seed();
  render(
    <CartProvider>
      <Harness />
    </CartProvider>,
  );
  await waitFor(() => expect(snapshot().cart[0].price).toBe(120));
  api.put.mockRejectedValue(accessMissing());
  mockRecreation();
  fireEvent.click(screen.getByText("Retirar"));
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith("/api/cart", { items: [] }),
  );
  await waitFor(() => expect(snapshot().pendingOperations).toBe(0));
  expect(snapshot().cart).toEqual([]);
  expect(
    api.post.mock.calls.some(([path]) => path === "/api/cart/validate"),
  ).toBe(false);
  expect(snapshot().syncError).toBe(false);
});
