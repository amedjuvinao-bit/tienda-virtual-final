import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import CheckoutFormActions from "../../checkout/page/CheckoutFormActions";
import { buildSafeCheckoutPageConfig } from "../../checkout/page/checkoutPageConfig";
import { buildInformationConfig } from "../information-page/informationPageConfig";
import ConsumerCaseForm from "./ConsumerCaseForm";
import { contractText } from "./ConsumerReceipt";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { post: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const offer = {
  ready: true,
  fingerprint: "f1",
  currency: "COP",
  version: "v1",
  seller: {
    legalName: "Vendedor de prueba",
    nit: "900123456-7",
    notificationAddress: "Dirección de prueba",
    email: "prueba@example.com",
    phone: "3001234567",
  },
  delivery: { text: "Entrega máxima de prueba" },
  pricing: {
    subtotal: 50000,
    shipping: 10000,
    taxAmount: 0,
    totalDiscount: 0,
    total: 60000,
  },
  items: [{ title: "Producto de prueba", quantity: 1, price: 50000 }],
  policies: [
    { title: "Condiciones de prueba", body: "Contenido aceptado de prueba" },
  ],
};
function CheckoutHarness() {
  const [acceptedTerms, setAcceptedTerms] = useState(""),
    [authorizedPrivacy, setAuthorizedPrivacy] = useState(""),
    [current, setCurrent] = useState(offer);
  const state = {
    acceptedTerms,
    setAcceptedTerms,
    authorizedPrivacy,
    setAuthorizedPrivacy,
    checkoutConfig: buildSafeCheckoutPageConfig({
      showBillingSection: false,
      showOrderSummary: false,
    }),
    paymentsConfig: { provider: "manual" },
  };
  const derived = {
    consumerOffer: current,
    quotePricing: {},
    currentCart: [{}],
    subtotal: 50000,
    total: 60000,
    itemCount: 1,
    paymentCanProceed: true,
  };
  return (
    <>
      <CheckoutFormActions
        state={state}
        derived={derived}
        onPlaceOrder={() => {}}
      />
      <button onClick={() => setCurrent({ ...offer, fingerprint: "f2" })}>
        Cambiar condiciones
      </button>
    </>
  );
}
it("exige decisiones independientes y las invalida al cambiar la oferta", () => {
  render(<CheckoutHarness />);
  const confirm = screen.getByRole("button", { name: "Confirmar pedido" });
  const [terms, privacy] = screen.getAllByRole("checkbox");
  expect(confirm).toBeDisabled();
  fireEvent.click(terms);
  expect(confirm).toBeDisabled();
  fireEvent.click(privacy);
  expect(confirm).toBeEnabled();
  expect(screen.getByText(/Subtotal.*50/)).toBeInTheDocument();
  fireEvent.click(screen.getByText("Cambiar condiciones"));
  expect(terms).not.toBeChecked();
  expect(privacy).not.toBeChecked();
  expect(confirm).toBeDisabled();
  expect(
    screen.getByRole("link", { name: "Condiciones de compra", exact: true }),
  ).toHaveAttribute("target", "_blank");
});
it("la constancia contiene productos, impuestos, envío, plazo, vendedor y versión aceptados", () => {
  const text = contractText(
    { ...offer, acceptedAt: "2026-10-27T15:00:00Z", paymentMethod: "manual" },
    "000123",
  );
  for (const value of [
    "000123",
    "900123456-7",
    "Entrega máxima de prueba",
    "Contenido aceptado de prueba",
    "v1",
    "Impuestos",
    "Envío",
    "manual",
  ])
    expect(text).toContain(value);
});
const config = buildInformationConfig({});
const policy = {
  version: "privacy-1",
  types: { withdrawal: "Retracto", warranty: "Garantía legal" },
};
function fillForm() {
  fireEvent.change(screen.getByLabelText("Nombre"), {
    target: { value: "Cliente de prueba" },
  });
  fireEvent.change(screen.getByLabelText("Correo o teléfono de contacto"), {
    target: { value: "prueba@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Asunto"), {
    target: { value: "Solicitud de prueba" },
  });
  fireEvent.change(screen.getByLabelText("Describe tu solicitud"), {
    target: { value: "Descripción completa de la solicitud de prueba" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}
it("reintenta una radicación incierta con la misma clave sin exigir pedido", async () => {
  api.post.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({
    data: {
      reference: "PQR-TEST",
      type: "withdrawal",
      subject: "Solicitud de prueba",
      createdAt: "2026-10-27T15:00:00Z",
      status: "received",
      history: [],
    },
  });
  render(<ConsumerCaseForm config={config} document={policy} />);
  fillForm();
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar y obtener radicado" }),
  );
  await screen.findByRole("button", { name: "Reintentar la misma solicitud" });
  expect(screen.getByLabelText("Asunto")).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Reintentar la misma solicitud" }),
  );
  await screen.findByText("Radicado PQR-TEST");
  const first = api.post.mock.calls[0][1],
    second = api.post.mock.calls[1][1];
  expect(first.accessKey).toMatch(/^[a-f0-9]{64}$/);
  expect(first).toEqual(second);
  expect(first.privacyVersion).toBe("privacy-1");
  expect(first.orderNumber).toBe("");
  expect(
    screen.getByRole("button", { name: "Descargar constancia y clave" }),
  ).toBeEnabled();
});
it("consulta por POST y muestra solo las respuestas del radicado autorizado", async () => {
  api.post.mockResolvedValue({
    data: {
      reference: "PQR-TEST",
      subject: "Solicitud de prueba",
      status: "answered",
      createdAt: "2026-10-27T15:00:00Z",
      history: [
        {
          at: "2026-10-27T16:00:00Z",
          status: "answered",
          message: "Respuesta pública de prueba",
        },
      ],
    },
  });
  render(<ConsumerCaseForm config={config} document={policy} />);
  fireEvent.click(screen.getByRole("button", { name: "Consultar solicitud" }));
  fireEvent.change(screen.getByLabelText("Radicado"), {
    target: { value: "PQR-TEST" },
  });
  fireEvent.change(screen.getByLabelText("Clave privada de seguimiento"), {
    target: { value: "a".repeat(64) },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Consultar estado y respuesta" }),
  );
  await screen.findByText("Respuesta pública de prueba");
  expect(api.post).toHaveBeenCalledWith("/api/consumer/cases/track", {
    reference: "PQR-TEST",
    accessKey: "a".repeat(64),
  });
  expect(window.location.search).not.toContain("accessKey");
  expect(document.querySelector('a[href*="accessKey"]')).toBeNull();
});
it("la vista previa no radica ni consulta solicitudes", () => {
  render(<ConsumerCaseForm config={config} document={policy} preview />);
  expect(
    screen.getByRole("button", { name: "Enviar y obtener radicado" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Consultar solicitud" }));
  expect(
    screen.getByRole("button", { name: "Consultar estado y respuesta" }),
  ).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
});
