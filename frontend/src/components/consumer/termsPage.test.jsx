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
import { TERMS_TOPICS } from "./termsPageConfig";
import useConsumerInformation from "./useConsumerInformation";
import { downloadText } from "./ConsumerReceipt";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
vi.mock("./useConsumerInformation", () => ({ default: vi.fn() }));
vi.mock("./ConsumerReceipt", async (original) => ({
  ...(await original()),
  downloadText: vi.fn(),
}));
vi.mock("../Header", () => ({ default: () => null }));
vi.mock("../StorefrontFooter", () => ({ default: () => null }));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
const page = {
  name: "Condiciones de compra",
  slug: "terminos",
  systemRole: "consumer-terms",
  pageType: "information",
  useHeader: false,
  useFooter: false,
};
const data = {
  version: "referencia-exacta",
  seller: {
    legalName: "Negocio de prueba",
    nit: "900123456-7",
    email: "tienda@example.com",
  },
  authorityUrl: "https://www.sic.gov.co/",
  sections: Object.entries(TERMS_TOPICS).map(([id, title]) => ({
    id,
    title,
    body: `Contenido completo del servidor: ${id}.`,
  })),
};
const retry = vi.fn();
beforeEach(() => {
  useConsumerInformation.mockReturnValue({ data, error: "", retry });
  Element.prototype.scrollIntoView = vi.fn();
});
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
it("adopta solo la semilla conocida y mantiene personalizaciones, extensiones, imágenes vacías y roles ajenos", () => {
  expect(
    informationConfigForPage({
      ...page,
      informationPageConfig: {
        eyebrowText: "Tu compra, con confianza",
        subtitleText: "Información clara para comprar y recibir atención.",
        titleFontSizePx: 40,
        extension: true,
      },
    }),
  ).toMatchObject({
    eyebrowText: "Información para tu compra",
    titleFontSizePx: 60,
    extension: true,
  });
  expect(
    informationConfigForPage({
      ...page,
      informationPageConfig: {
        titleText: "Condiciones propias",
        subtitleText: "Propio",
        titleFontSizePx: 30,
        termsPage: {
          heroArtwork: "",
          extension: { keep: true },
          topics: { garantia: { label: "Servicio posventa", extra: true } },
        },
        style: { accentColor: "#123456" },
      },
    }),
  ).toMatchObject({
    titleText: "Condiciones propias",
    subtitleText: "Propio",
    titleFontSizePx: 30,
    termsPage: {
      heroArtwork: "",
      extension: { keep: true },
      topics: { garantia: { label: "Servicio posventa", extra: true } },
    },
    style: { accentColor: "#123456" },
  });
  expect(
    normalizeInformationPage({ name: "Otra", slug: "otra" })
      .informationPageConfig.termsPage,
  ).toBeUndefined();
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: { termsPage: { helpHref: "javascript:alert(1)" } },
    }),
  ).toMatch(/destino/);
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: {
        termsPage: { topics: { envios: { label: " " } } },
      },
    }),
  ).toMatch(/nombre/);
});
it("el índice abre el contenido conectado y conserva todas las condiciones en la descarga aun con apartados cerrados", async () => {
  mount();
  expect(screen.getByText(data.sections[0].body)).toBeVisible();
  expect(screen.getByText(data.sections[4].body)).not.toBeVisible();
  fireEvent.click(screen.getByRole("link", { name: /05 Reversión del pago/ }));
  await waitFor(() =>
    expect(screen.getByText(data.sections[4].body)).toBeVisible(),
  );
  expect(window.location.hash).toBe("#condiciones-reversion");
  expect(
    screen.getByRole("link", { name: /05 Reversión del pago/ }),
  ).toHaveAttribute("aria-current", "location");
  fireEvent.click(
    screen.getByRole("button", { name: "Descargar condiciones" }),
  );
  const [filename, text] = downloadText.mock.calls[0];
  expect(filename).toBe("terminos.txt");
  expect(text).toContain(data.version);
  expect(text).toContain(data.seller.legalName);
  for (const section of data.sections) expect(text).toContain(section.body);
  expect(screen.getByText(data.version)).not.toBeVisible();
});
it("abre enlaces directos después de cargar y atiende el historial sin perder el documento", async () => {
  window.history.replaceState({}, "", "/terminos#condiciones-garantia");
  mount();
  expect(screen.getByText(data.sections[3].body)).toBeVisible();
  window.history.replaceState({}, "", "/terminos#condiciones-envios");
  fireEvent(window, new PopStateEvent("popstate"));
  await waitFor(() =>
    expect(screen.getByText(data.sections[1].body)).toBeVisible(),
  );
  expect(
    screen.getByRole("link", { name: /02 Envíos y entregas/ }),
  ).toHaveAttribute("aria-current", "location");
});
it("ocultar el índice conserva descarga, identidad del vendedor y acceso a las condiciones", () => {
  mount({ showNavigation: false });
  expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "Descargar condiciones" }),
  ).toBeEnabled();
  fireEvent.click(screen.getByText("Datos del vendedor y canales de contacto"));
  expect(screen.getByText(/Negocio de prueba/)).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Superintendencia/ }),
  ).toHaveAttribute("href", data.authorityUrl);
});
it("vista previa permite explorar pero bloquea descargas, cambios de URL y enlaces externos", () => {
  mount({}, true);
  expect(
    screen.getByRole("button", { name: "Descargar condiciones" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("button", { name: /03 Derecho de retracto/ }),
  );
  expect(screen.getByText(data.sections[2].body)).toBeVisible();
  expect(window.location.hash).toBe("");
  expect(
    fireEvent.click(
      screen.getByRole("link", { name: /Peticiones y reclamos/ }),
    ),
  ).toBe(false);
  expect(downloadText).not.toHaveBeenCalled();
});
it("un fallo de carga no muestra datos viejos como vigentes y permite reintentar", () => {
  useConsumerInformation.mockReturnValue({
    data,
    error: "No pudimos cargar la información.",
    retry,
  });
  mount();
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar");
  expect(
    screen.queryByRole("button", { name: "Descargar condiciones" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledOnce();
});
