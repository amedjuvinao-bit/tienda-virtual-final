import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InformationPageView from "../information-page/InformationPageView";
import {
  informationConfigForPage,
  normalizeInformationPage,
  validateInformationPage,
} from "../information-page/informationPageConfig";
import { buildShippingConfig } from "./shippingPageConfig";
import useConsumerInformation from "../consumer/useConsumerInformation";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
vi.mock("../consumer/useConsumerInformation", () => ({ default: vi.fn() }));
vi.mock("../Header", () => ({ default: () => null }));
vi.mock("../StorefrontFooter", () => ({ default: () => null }));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
const page = {
  name: "Envíos y entregas",
  slug: "envios",
  systemRole: "consumer-shipping",
  pageType: "information",
  useHeader: false,
  useFooter: false,
  informationPageConfig: {},
};
const data = {
  seller: {
    legalName: "Negocio configurado",
    nit: "800123456-2",
    notificationAddress: "Dirección configurada",
    email: "negocio@example.com",
    phone: "3001234567",
  },
  version: "v1",
  pickupEnabled: false,
  sections: [
    {
      id: "envios",
      title: "Envíos y entregas",
      body: "Compromiso real configurado de entrega y devolución.",
    },
  ],
  authorityUrl: "https://www.sic.gov.co/",
};
const retry = vi.fn();
beforeEach(() =>
  useConsumerInformation.mockReturnValue({ data, error: "", retry }),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
function mount(raw = {}, preview = false) {
  return render(
    <MemoryRouter>
      <StorefrontSettingsContext.Provider
        value={{ theme: { colors: { background: "#eac1c9" } } }}
      >
        <InformationPageView
          page={{ ...page, informationPageConfig: raw }}
          preview={preview}
        />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
}
it("adopta el diseño aprobado conservando colores, extensiones y textos propios", () => {
  const seed = informationConfigForPage({
    ...page,
    informationPageConfig: {
      layout: "editorial",
      titleText: "Envíos y entregas",
      titleFontSizePx: 40,
      eyebrowText: "Tu compra, con confianza",
      subtitleText: "Información clara para comprar y recibir atención.",
      extension: { keep: true },
      style: { accentColor: "#123456" },
      presentation: { borderWidth: 0.5, reflection: 0 },
    },
  });
  expect(seed).toMatchObject({
    titleFontSizePx: 64,
    eyebrowText: "Información de tu compra",
    extension: { keep: true },
    style: { accentColor: "#123456" },
    presentation: { borderWidth: 0.5, reflection: 0 },
  });
  const own = informationConfigForPage({
    ...page,
    informationPageConfig: {
      titleText: "Mi entrega",
      subtitleText: "Mi descripción",
      titleFontSizePx: 34,
      shipping: { steps: [], heroArtwork: "", extension: "propia" },
    },
  });
  expect(own).toMatchObject({
    titleText: "Mi entrega",
    subtitleText: "Mi descripción",
    titleFontSizePx: 34,
    shipping: { steps: [], heroArtwork: "", extension: "propia" },
  });
  expect(
    normalizeInformationPage({
      name: "Otra",
      slug: "otra",
      informationPageConfig: {},
    }).informationPageConfig.shipping,
  ).toBeUndefined();
});
it("respeta pasos vacíos, identifica enlaces peligrosos y bloquea pasos visibles incompletos", () => {
  expect(buildShippingConfig({ steps: [] })).toMatchObject({ steps: [] });
  expect(
    buildShippingConfig({
      contactHref: "javascript:alert(1)",
      claimsHref: "/admin/ordenes",
    }),
  ).toMatchObject({ contactHref: "", claimsHref: "" });
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: {
        shipping: { steps: [{ title: "Paso incompleto", enabled: true }] },
      },
    }),
  ).toMatch(/Completa/);
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: { shipping: { contactHref: "/admin" } },
    }),
  ).toMatch(/destinos/);
  const steps = buildShippingConfig({
    steps: [
      { id: "same", title: "A", body: "B" },
      { id: "same", title: "C", body: "D" },
    ],
  }).steps;
  expect(new Set(steps.map((s) => s.id)).size).toBe(2);
});
it("muestra el proceso, abre ayuda y conserva condiciones reales sin inventar precios o seguimiento", () => {
  mount();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Envíos y entregas",
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(4);
  expect(
    screen.getByRole("link", { name: "Contactar tienda" }),
  ).toHaveAttribute("href", "/contacto");
  expect(
    screen.getByRole("link", { name: "Peticiones y reclamos" }),
  ).toHaveAttribute("href", "/pqr");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  const conditions = document.querySelector(".shipping-conditions");
  expect(conditions).not.toHaveAttribute("open");
  fireEvent.click(
    screen.getByText("Condiciones completas de entrega y datos del vendedor"),
  );
  expect(conditions).toHaveAttribute("open");
  expect(
    screen.getByText("Compromiso real configurado de entrega y devolución."),
  ).toBeVisible();
  expect(
    screen.getByText("Negocio configurado · NIT 800123456-2"),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Descargar esta información" }),
  ).toBeEnabled();
  expect(
    screen.getByText(/guardamos las condiciones que aceptaste/),
  ).toBeVisible();
  expect(screen.getByText(data.version)).not.toBeVisible();
  fireEvent.click(screen.getByText("Ver referencia del documento"));
  expect(screen.getByText(data.version)).toBeVisible();
});
it("publica recogida solo cuando está habilitada y utiliza las instrucciones del servidor", () => {
  const view = mount();
  expect(screen.queryByText("Recogida del pedido")).not.toBeInTheDocument();
  view.unmount();
  useConsumerInformation.mockReturnValue({
    data: {
      ...data,
      pickupEnabled: true,
      pickupInstructions: "Instrucciones reales guardadas en Envíos",
    },
    error: "",
    retry,
  });
  mount();
  expect(
    screen.getByText("Instrucciones reales guardadas en Envíos"),
  ).toBeInTheDocument();
});
it("las imágenes fallidas desaparecen o recuperan el icono y los controles de vista previa no navegan", () => {
  mount({}, true);
  fireEvent.error(document.querySelector(".shipping-hero__art"));
  expect(document.querySelector(".shipping-hero")).toHaveAttribute(
    "data-artwork",
    "false",
  );
  fireEvent.error(document.querySelector(".shipping-location-art img"));
  expect(document.querySelector(".shipping-location-art img")).toBeNull();
  expect(
    document.querySelector(".shipping-location-art svg"),
  ).toBeInTheDocument();
  expect(
    fireEvent.click(screen.getByRole("link", { name: "Contactar tienda" })),
  ).toBe(false);
  fireEvent.click(
    screen.getByText("Condiciones completas de entrega y datos del vendedor"),
  );
  expect(
    screen.getByRole("button", { name: "Descargar esta información" }),
  ).toBeDisabled();
});
it("informa un fallo de carga visible y permite reintentar sin mostrar datos de ejemplo", () => {
  useConsumerInformation.mockReturnValue({
    data: null,
    error: "No pudimos cargar la información.",
    retry,
  });
  mount();
  expect(screen.getByRole("alert")).toHaveTextContent(
    "No pudimos cargar la información.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(screen.queryByText("Negocio configurado")).not.toBeInTheDocument();
});
