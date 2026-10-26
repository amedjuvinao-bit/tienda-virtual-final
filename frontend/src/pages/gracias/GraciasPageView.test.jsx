import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import GraciasPageView from "./GraciasPageView";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import { buildSafeThanksPageConfig } from "./thanksPageConfig";
import {
  buildThanksPageViewModel,
  buildThanksPageSlides,
  getThanksPagePresentationStyle,
} from "./thanksPageViewModel";
vi.mock("../../components/Header", () => ({
  default: () => <div data-testid="header" />,
}));
vi.mock("../../components/StorefrontFooter", () => ({
  default: ({ preview }) => <div data-testid="footer" data-preview={preview} />,
}));
vi.mock("../../components/WhatsAppButton", () => ({
  default: () => <div data-testid="whatsapp" />,
}));
afterEach(cleanup);
function setup(raw = {}, data = {}, extra = {}) {
  const config = buildSafeThanksPageConfig(raw),
    onContinue = vi.fn(),
    retry = vi.fn();
  const model = buildThanksPageViewModel({
    thanksConfig: config,
    thanksOrderData: data.order || null,
    paymentResponse: { exists: !!data.error },
    thanksAccessError: data.error || "",
    verificationLoading: !!data.loading,
    wompiTxData: data.transaction || null,
  });
  render(
    <MemoryRouter>
      <StorefrontSettingsContext.Provider
        value={{ theme: { global: { backgroundColor: "#123456" } } }}
      >
        <GraciasPageView
          thanksConfig={config}
          viewModel={model}
          slides={buildThanksPageSlides(config)}
          currentSlide={0}
          setCurrentSlide={vi.fn()}
          setPaused={vi.fn()}
          presentationStyle={getThanksPagePresentationStyle(config.style)}
          continueShopping={onContinue}
          thanksAccessError={data.error || ""}
          retryVerification={retry}
          {...extra}
        />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
  return { onContinue, retry, model };
}
const order = {
  ok: true,
  orderId: "real",
  orderNumber: "ORD-5",
  customerName: "Cliente",
  total: 90000,
  shipping: 0,
  paymentStatus: "paid",
  paymentProvider: "wompi",
};
it("muestra etiquetas y mensaje configurados con datos protegidos y cristal", () => {
  const { onContinue } = setup(
    {
      summaryTitle: "Mi resumen",
      mainMessage: "Ya recibimos el pago",
      continueButtonText: "Explorar",
      showVisualPanel: false,
    },
    { order },
  );
  expect(screen.getByText("Mi resumen")).toBeInTheDocument();
  expect(screen.getByText("Ya recibimos el pago")).toBeInTheDocument();
  expect(
    document.querySelector(".gp-panel.cart-glass > .polished-glass-rim"),
  ).toBeInTheDocument();
  expect(document.querySelector(".gp-visual")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Explorar" }));
  expect(onContinue).toHaveBeenCalledOnce();
});
it("no declara éxito ni muestra importes al entrar sin pedido", () => {
  const { model } = setup({ entryMessage: "Continúa explorando" });
  expect(model.verified).toBe(false);
  expect(model.paymentMeta.showSuccessCheck).toBe(false);
  expect(screen.getByText("Continúa explorando")).toBeInTheDocument();
  expect(screen.queryByText("Pago aprobado")).not.toBeInTheDocument();
  expect(document.querySelector(".gp-summary-rows")).not.toBeInTheDocument();
});
it("permite reintentar una verificación fallida", () => {
  const { retry } = setup({}, { error: "No se pudo verificar" });
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo verificar");
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar verificación" }),
  );
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText("Pago aprobado")).not.toBeInTheDocument();
});
it("no inventa envío gratis si solo se consultó una transacción", () => {
  setup(
    {},
    {
      transaction: {
        ok: true,
        orderNumber: "A",
        paymentStatus: "APPROVED",
        amountInCents: 100000,
      },
    },
  );
  expect(screen.queryByText("Gratis")).not.toBeInTheDocument();
});
it("respeta visibilidad y recupera imágenes rotas", () => {
  setup(
    {
      titleMode: "image",
      titleImage: "/title.png",
      titleText: "Título recuperado",
      entryTitleText: "Título recuperado",
      designVersion: 2,
      showVisualPanel: true,
      showWhatsAppButton: false,
      slider: {
        slides: [
          { id: "a", image: "/a.png", alt: "Imagen A" },
          { id: "b", image: "/b.png", alt: "Imagen B" },
        ],
      },
    },
    {},
    { page: { useHeader: false, useFooter: false } },
  );
  expect(screen.queryByTestId("header")).not.toBeInTheDocument();
  expect(screen.queryByTestId("footer")).not.toBeInTheDocument();
  expect(screen.queryByTestId("whatsapp")).not.toBeInTheDocument();
  fireEvent.error(screen.getByAltText("Agradecimiento"));
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Título recuperado",
  );
  fireEvent.error(screen.getByAltText("Imagen A"));
  expect(document.querySelector(".gp-visual-emblem")).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Imagen siguiente" }),
  ).toBeInTheDocument();
});

it("centra el resumen pendiente sin declarar preparación ni entrega completadas", () => {
  const { retry } = setup(
    {},
    { order: { ...order, itemCount: 3, paymentStatus: "pending" } },
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Gracias por tu pedido",
  );
  expect(screen.getByText("Pago pendiente")).toBeInTheDocument();
  expect(document.querySelector(".gp-visual")).not.toBeInTheDocument();
  expect(document.querySelectorAll(".gp-order-fact")).toHaveLength(3);
  expect(document.querySelectorAll('[data-stage="future"]')).toHaveLength(2);
  expect(
    document.querySelector('[data-stage="confirmed"]'),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Actualizar estado" }));
  expect(retry).toHaveBeenCalledOnce();
});
it("conserva un total protegido de cero y permite desplegar el desglose", () => {
  setup({}, { order: { ...order, total: 0, subtotal: 12000 } });
  expect(
    document.querySelector(".gp-order-fact:last-child dd").textContent,
  ).toMatch(/\$\s*0(?:,00)?$/);
  expect(screen.getByText("Ver detalle del pedido")).toBeInTheDocument();
  expect(
    document.querySelector('[data-stage="confirmed"]'),
  ).toBeInTheDocument();
  expect(document.querySelectorAll('[data-stage="future"]')).toHaveLength(2);
});
it("respeta la visibilidad de los próximos pasos y de los datos compactos", () => {
  setup(
    {
      showNextSteps: false,
      showOrderNumber: false,
      showItemCount: false,
      showTotal: false,
    },
    { order },
  );
  expect(document.querySelector(".gp-next-steps")).not.toBeInTheDocument();
  expect(document.querySelector(".gp-order-facts")).not.toBeInTheDocument();
});
