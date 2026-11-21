import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import CheckoutPageView from "./CheckoutPageView";
import useCheckoutState from "./useCheckoutState";
import useCheckoutDerived from "./useCheckoutDerived";
import { buildSafeCheckoutPageConfig } from "./checkoutPageConfig";
import { checkoutQuoteKey } from "./checkoutQuoteModel";
vi.mock("../../components/Header", () => ({
  default: () => <div data-testid="header" />,
}));
vi.mock("../../components/StorefrontFooter", () => ({
  default: () => <div data-testid="footer" />,
}));
vi.mock("../../components/WhatsAppButton", () => ({ default: () => null }));
afterEach(cleanup);
let latest;
const physical = [
  {
    productId: "p",
    title: "Producto",
    price: 90000,
    quantity: 1,
    requiresShipping: true,
  },
];
const digital = [
  { ...physical[0], productType: "digital", requiresShipping: false },
];
function Harness({
  config = {},
  cart = physical,
  quoteError = "",
  quoteLoading = false,
  provider = "manual",
  pickupEnabled = true,
}) {
  const form = useCheckoutState();
  const state = {
    ...form,
    checkoutConfig: buildSafeCheckoutPageConfig({
      showHeader: false,
      showFooter: false,
      ...config,
    }),
    checkoutConfigLoading: false,
    shippingConfigLoading: false,
    paymentsConfigLoading: false,
    paymentsConfig: { provider, active: true, currency: "COP" },
    countries: [{ code: "CO", name: "Colombia" }],
    regions: [{ code: "47", name: "Magdalena" }],
    citiesList: [{ code: "47001", name: "Santa Marta" }],
    quoteError,
    quoteLoading,
  };
  const key = checkoutQuoteKey(state, {
    currentCart: cart,
    selectedCountry: state.countries[0],
  });
  state.checkoutQuote = {
    consumerOffer: { pickupEnabled },
    _checkoutKey: key,
    pricing: {
      subtotal: 90000,
      shipping: 7000,
      shippingDiscount: 3000,
      originalShipping: 10000,
      total: 97000,
    },
  };
  const derived = useCheckoutDerived({ state, cart });
  latest = { state, derived };
  return (
    <CheckoutPageView
      state={state}
      derived={derived}
      actions={{
        handlePlaceOrder: vi.fn(),
        handleApplyCoupon: vi.fn(),
        retryCheckoutQuote: vi.fn(),
      }}
      preview
    />
  );
}
const mount = (props) =>
  render(
    <MemoryRouter>
      <Harness {...props} />
    </MemoryRouter>,
  );
it("mantiene disponibles los campos necesarios aunque se oculten los títulos de contacto y entrega", () => {
  mount({
    config: {
      showContactSection: false,
      showDeliverySection: false,
      showBillingSection: false,
    },
  });
  expect(screen.getByRole("link", { name: "Contacto", exact: true })).toHaveAttribute("href", "/contacto");
  expect(screen.getByRole("link", { name: "Contacto", exact: true })).toHaveAttribute("target", "_blank");
  expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  expect(screen.getByLabelText("Apellidos")).toBeInTheDocument();
  expect(screen.getByLabelText("Teléfono")).toBeInTheDocument();
  expect(screen.getByLabelText("Dirección")).toBeInTheDocument();
  expect(
    document.querySelector(".co-card > .polished-glass-rim"),
  ).toBeInTheDocument();
  expect(
    document.querySelector(".co-btn-primary > .polished-glass-rim"),
  ).toBeInTheDocument();
});
it("expone dirección fiscal y teléfono en una compra digital y evita vincularlos a un envío inexistente", async () => {
  mount({ cart: digital });
  await waitFor(() => expect(latest.state.sameAddress).toBe(false));
  expect(
    screen.getByLabelText("Dirección para facturación"),
  ).toBeInTheDocument();
  expect(
    screen.queryByText("Usar la misma dirección de envío"),
  ).not.toBeInTheDocument();
  expect(screen.getAllByLabelText("Teléfono").length).toBe(2);
});
it("muestra envío original y descuento coherentes con el total verificado y respeta el color del total", () => {
  mount({ config: { style: { totalValueColor: "#123456" } } });
  const row = screen
    .getByText("Envío", { exact: true })
    .closest(".co-totals-row");
  expect(row).toHaveTextContent("$10.000");
  expect(
    screen.getByText("Descuento de envío").closest(".co-totals-row"),
  ).toHaveTextContent("-$3.000");
  expect(screen.getByText("COP $97.000")).toHaveStyle({ color: "#123456" });
});
it("muestra recuperación y configura campos, resumen e imagen de título sin dejar una columna vacía", () => {
  mount({
    quoteError: "No pudimos verificar",
    config: {
      titleMode: "image",
      titleImage: "/title.png",
      showOrderSummary: false,
    },
  });
  expect(
    screen.getByRole("button", { name: "Reintentar total" }),
  ).toBeInTheDocument();
  expect(document.querySelector(".co-layout")).toHaveAttribute(
    "data-summary",
    "false",
  );
  fireEvent.error(screen.getByAltText("Título checkout"));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Finalizar compra",
  );
});
it("desvincula facturación al elegir retiro", async () => {
  mount();
  fireEvent.click(screen.getByRole("radio", { name: "Retiro en tienda" }));
  await waitFor(() => expect(latest.state.sameAddress).toBe(false));
  expect(
    screen.queryByLabelText("Dirección", { exact: true }),
  ).not.toBeInTheDocument();
});

it("bloquea una pasarela que todavía no tiene flujo de pago disponible", () => {
  mount({ provider: "bold" });
  expect(latest.derived.paymentCanProceed).toBe(false);
  expect(screen.getByRole("button", { name: "Pagar ahora" })).toBeDisabled();
  expect(
    screen.getByText(
      "Este método de pago aún no está disponible en la tienda.",
    ),
  ).toBeInTheDocument();
});

it("no ofrece retiro si la tienda no lo ha habilitado", () => { mount({ pickupEnabled: false }); expect(screen.queryByRole("radio", { name: "Retiro en tienda" })).not.toBeInTheDocument(); });
