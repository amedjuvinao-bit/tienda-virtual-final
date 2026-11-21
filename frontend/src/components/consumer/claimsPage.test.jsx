import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InformationPageView from "../information-page/InformationPageView";
import {
  informationConfigForPage,
  normalizeInformationPage,
  validateInformationPage,
} from "../information-page/informationPageConfig";
import { buildClaimsPage } from "./claimsPageConfig";
import useConsumerInformation from "./useConsumerInformation";
import api from "../../lib/api";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
vi.mock("./useConsumerInformation", () => ({ default: vi.fn() }));
vi.mock("../../lib/api", () => ({ default: { post: vi.fn() } }));
vi.mock("../Header", () => ({ default: () => null }));
vi.mock("../StorefrontFooter", () => ({ default: () => null }));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
const page = {
  name: "Peticiones y reclamos",
  slug: "pqr",
  systemRole: "consumer-claims",
  pageType: "information",
  useHeader: false,
  useFooter: false,
};
const data = {
  version: "version-original",
  seller: {
    legalName: "Negocio de prueba",
    nit: "900123456-7",
    email: "negocio@example.com",
  },
  authorityUrl: "https://www.sic.gov.co/",
  types: { petition: "Petición", warranty: "Garantía legal" },
  sections: [
    {
      id: "privacidad",
      title: "Datos personales",
      body: "Política real del servidor.",
    },
  ],
};
const retry = vi.fn();
beforeEach(() =>
  useConsumerInformation.mockReturnValue({ data, error: "", retry }),
);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/");
});
function mount(config = {}, preview = false) {
  return render(
    <MemoryRouter>
      <StorefrontSettingsContext.Provider
        value={{ theme: { colors: { background: "#eac1c9" } } }}
      >
        <InformationPageView
          page={{ ...page, informationPageConfig: config }}
          preview={preview}
        />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
}
function fill() {
  for (const [label, value] of [
    ["Nombre", "Cliente de prueba"],
    ["Correo o teléfono de contacto", "prueba@example.com"],
    ["Asunto", "Solicitud de prueba"],
    ["Describe tu solicitud", "Descripción válida de mi solicitud."],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
it("adopta la semilla aprobada y conserva textos propios, imágenes vacías, extensiones y colores de campos", () => {
  const c = informationConfigForPage({
    ...page,
    informationPageConfig: {
      titleText: page.name,
      subtitleText: "Información clara para comprar y recibir atención.",
      eyebrowText: "Tu compra, con confianza",
      titleFontSizePx: 40,
      extension: true,
      style: { inputBorderColor: "#123456" },
    },
  });
  expect(c).toMatchObject({
    eyebrowText: "Atención al cliente",
    titleFontSizePx: 60,
    extension: true,
    style: { inputBorderColor: "#123456" },
  });
  expect(
    informationConfigForPage({
      ...page,
      informationPageConfig: {
        subtitleText: "Propio",
        titleFontSizePx: 30,
        claimsPage: { heroArtwork: "", steps: [], extension: "keep" },
      },
    }),
  ).toMatchObject({
    subtitleText: "Propio",
    titleFontSizePx: 30,
    claimsPage: { heroArtwork: "", steps: [], extension: "keep" },
  });
  expect(
    normalizeInformationPage({
      name: "Otra",
      slug: "otra",
      informationPageConfig: {},
    }).informationPageConfig.claimsPage,
  ).toBeUndefined();
  expect(
    informationConfigForPage({
      name: "Otra",
      informationPageConfig: { style: { inputBg: "rgba(1,2,3,.2)" } },
    }).style.inputBg,
  ).toBe("rgba(1,2,3,.2)");
  expect(
    buildClaimsPage({ contactHref: "javascript:alert(1)" }).contactHref,
  ).toBe("");
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: { claimsPage: { contactHref: "/admin" } },
    }),
  ).toMatch(/destino/);
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: {
        claimsPage: { fields: { name: { label: "" } } },
      },
    }),
  ).toMatch(/etiqueta/);
});
it("los datos opcionales se envían completos y la autorización sigue siendo expresa y versionada", async () => {
  api.post.mockResolvedValue({
    data: {
      reference: "PQR-TEST",
      createdAt: "2026-10-29T00:00:00Z",
      status: "received",
      subject: "Prueba",
      history: [],
    },
  });
  mount();
  fill();
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar y obtener radicado" }),
  );
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText("Datos opcionales"));
  fireEvent.change(
    screen.getByLabelText("Correo para constancia y recuperación (opcional)"),
    { target: { value: "recuperacion@example.com" } },
  );
  fireEvent.change(
    screen.getByLabelText(
      "Si solicitas devolución, ¿qué medio de pago prefieres? (opcional)",
    ),
    { target: { value: "Transferencia" } },
  );
  fireEvent.click(screen.getByText("Datos opcionales"));
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar y obtener radicado" }),
  );
  await screen.findByText("Radicado PQR-TEST");
  expect(api.post.mock.calls[0][1]).toMatchObject({
    privacyAuthorized: true,
    privacyVersion: data.version,
    recoveryEmail: "recuperacion@example.com",
    preferredRefundMethod: "Transferencia",
  });
  expect(api.post.mock.calls[0][1].accessKey).toMatch(/^[a-f0-9]{64}$/);
});
it("cambiar la política obliga a autorizar nuevamente antes de reintentar", async () => {
  api.post.mockRejectedValue({
    response: {
      status: 409,
      data: {
        error: "CONSUMER_POLICY_CHANGED",
        message: "La política cambió.",
      },
    },
  });
  mount();
  fill();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar y obtener radicado" }),
  );
  await screen.findByText("La política cambió.");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(screen.getByLabelText("Nombre")).toBeEnabled();
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar y obtener radicado" }),
  );
  await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
});
it("la consulta enlazada, recuperación y vista previa conservan sus bloqueos y no realizan operaciones", () => {
  window.history.replaceState({}, "", "/pqr?vista=consulta");
  mount({}, true);
  expect(screen.getByLabelText("Radicado")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Consultar estado y respuesta" }),
  ).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Recuperar acceso" }));
  expect(screen.getByLabelText("Correo registrado")).toBeDisabled();
  expect(
    screen.getByRole("button", { name: "Enviar código de recuperación" }),
  ).toBeDisabled();
  expect(
    fireEvent.click(
      screen.getByRole("link", { name: "contacta con la tienda" }),
    ),
  ).toBe(false);
  expect(
    fireEvent.click(screen.getByRole("link", { name: "Contactar tienda" })),
  ).toBe(false);
  expect(api.post).not.toHaveBeenCalled();
});
it("mantiene identidad, política y descarga con la guía oculta y recupera la información tras un fallo", () => {
  const view = mount({ claimsPage: { showGuide: false } });
  expect(
    screen.queryByRole("heading", { name: "Tu solicitud, paso a paso" }),
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByText("Datos del vendedor y atención al consumidor"),
  );
  expect(screen.getByText("Política real del servidor.")).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Descargar esta información" }),
  ).toBeEnabled();
  view.unmount();
  useConsumerInformation.mockReturnValue({
    data: null,
    error: "Fallo de prueba",
    retry,
  });
  mount();
  expect(screen.getByRole("alert")).toHaveTextContent("Fallo de prueba");
  expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledOnce();
});
