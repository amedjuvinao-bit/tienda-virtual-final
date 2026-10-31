import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CartPageView from "./CartPageView";
import CartDrawer from "./CartDrawer";
vi.mock("../Header", () => ({
  default: () => <header>Encabezado público</header>,
}));
vi.mock("../FooterSection", () => ({
  default: () => <footer>Pie público</footer>,
}));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
vi.mock("../PolishedGlassRim", () => ({
  default: () => <span data-testid="glass-rim" />,
}));
const item = {
  _id: "p1",
  title: "Producto",
  price: 80000,
  quantity: 2,
  variantKey: "v2-custom",
  variantAttributes: [
    { key: "capacidad", label: "Capacidad", value: "128 GB" },
  ],
};
const mount = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);
afterEach(() => cleanup());
it.each(["page", "drawer"])(
  "separa borde, número, signos y fondo de cantidad en %s",
  (mode) => {
    const colors = {
      quantityButtonBg: "#ead1df",
      quantityBorderColor: "#d4af37",
      quantityIconColor: "#ff6699",
    };
    const page = {
      cartPageConfig: {
        style: { ...colors, quantityTextColor: "#cc3366" },
        modal: { ...colors, quantityButtonTextColor: "#cc3366" },
      },
    };
    const { container } = mount(
      mode === "drawer" ? (
        <CartDrawer isOpen preview page={page} cartState={{ cart: [item] }} />
      ) : (
        <CartPageView page={page} cartState={{ cart: [item] }} />
      ),
    );
    const selector = container.querySelector(".cart-quantity");
    expect(selector).toHaveStyle({ borderColor: "#d4af37", color: "#cc3366" });
    expect(selector.style.getPropertyValue("--cart-qty-icon")).toBe("#ff6699");
    expect(
      container
        .querySelector(mode === "drawer" ? ".cart-drawer" : ".cart-storefront")
        .style.getPropertyValue("--cart-qty-bg"),
    ).toBe("#ead1df");
  },
);
it("respeta visibilidad del encabezado y pie y usa la misma variante para las acciones", () => {
  const increaseQuantity = vi.fn();
  mount(
    <CartPageView
      page={{
        useHeader: false,
        useFooter: false,
        cartPageConfig: { titleMode: "text", titleText: "Mi carrito" },
      }}
      cartState={{ cart: [item], increaseQuantity }}
    />,
  );
  expect(screen.queryByText("Encabezado público")).not.toBeInTheDocument();
  expect(screen.queryByText("Pie público")).not.toBeInTheDocument();
  expect(screen.getByText(/Capacidad: 128 GB/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Aumentar cantidad de Producto" }),
  );
  expect(increaseQuantity).toHaveBeenCalledWith(
    "p1",
    undefined,
    undefined,
    "v2-custom",
  );
  expect(
    screen.getByRole("link", { name: /Finalizar compra/ }),
  ).toHaveAttribute("href", "/checkout");
  expect(screen.getAllByText("$160.000")).toHaveLength(2);
});
it("bloquea checkout durante sincronización y con stock inválido", () => {
  const view = mount(
    <CartPageView cartState={{ cart: [item], loading: true }} />,
  );
  expect(
    screen.queryByRole("link", { name: /Finalizar compra/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Finalizar compra/ }),
  ).toBeDisabled();
  view.rerender(
    <MemoryRouter>
      <CartPageView
        cartState={{
          cart: [
            {
              ...item,
              purchasable: false,
              validationMessage: "Sin existencias",
            },
          ],
        }}
      />
    </MemoryRouter>,
  );
  expect(screen.getByText("Sin existencias")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Finalizar compra/ }),
  ).toBeDisabled();
});
it("muestra la ruta configurable y un título de respaldo si la imagen falla", () => {
  mount(
    <CartPageView
      page={{
        cartPageConfig: {
          titleMode: "image",
          titleImage: "/bad.png",
          titleText: "Tu selección",
          continueShoppingPath: "/#categorias",
        },
      }}
      cartState={{ cart: [] }}
    />,
  );
  fireEvent.error(screen.getByAltText("Título carrito"));
  expect(
    screen.getByRole("heading", { name: "Tu selección" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Seguir comprando" }),
  ).toHaveAttribute("href", "/#categorias");
});
it("el diálogo captura foco, aísla el fondo y lo devuelve al cerrar", () => {
  const opener = document.createElement("button");
  opener.textContent = "Origen";
  document.body.appendChild(opener);
  opener.focus();
  const close = vi.fn();
  const view = mount(
    <CartDrawer isOpen onClose={close} cartState={{ cart: [item] }} />,
  );
  expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  expect(screen.getByRole("button", { name: "Cerrar carrito" })).toHaveFocus();
  expect(opener.inert).toBe(true);
  fireEvent.keyDown(document, { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  view.rerender(
    <MemoryRouter>
      <CartDrawer isOpen={false} />
    </MemoryRouter>,
  );
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(opener.inert).toBeFalsy();
  opener.remove();
});
it("no permite finalizar un carrito vacío desde el lateral", () => {
  mount(<CartDrawer isOpen cartState={{ cart: [] }} />);
  expect(
    screen.queryByRole("link", { name: /Finalizar compra/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: /Finalizar compra/ }),
  ).toBeDisabled();
});
