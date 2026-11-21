import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InformationPageView from "../information-page/InformationPageView";
import {
  informationConfigForPage,
  normalizeInformationPage,
  validateInformationPage,
} from "../information-page/informationPageConfig";
import { buildReturnsGuide } from "./returnsGuideConfig";
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
  name: "Retracto, garantía y devoluciones",
  slug: "cambios-y-devoluciones",
  pageType: "information",
  systemRole: "consumer-returns",
  useHeader: false,
  useFooter: false,
};
const data = {
  version: "referencia-exacta",
  seller: {
    legalName: "Vendedor configurado",
    nit: "900123456-7",
    notificationAddress: "Dirección de prueba",
    email: "prueba@example.com",
    phone: "3001234567",
  },
  authorityUrl: "https://www.sic.gov.co/",
  sections: [
    {
      id: "garantia",
      title: "Garantía y cambios comerciales",
      body: "Política comercial real de Órdenes y garantía legal.",
    },
    {
      id: "retracto",
      title: "Retracto",
      body: "Derecho real de retracto del servidor.",
    },
    {
      id: "reversion",
      title: "Reversión",
      body: "Derecho real de reversión del servidor.",
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
});
function mount(config = {}, preview = false) {
  return render(
    <MemoryRouter>
      <StorefrontSettingsContext.Provider
        value={{ theme: { colors: { background: "#efc3c9" } } }}
      >
        <InformationPageView
          page={{ ...page, informationPageConfig: config }}
          preview={preview}
        />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
}
it("adopta solo la semilla anterior y conserva títulos propios, extensiones y materiales", () => {
  const seed = informationConfigForPage({
    ...page,
    informationPageConfig: {
      titleText: page.name,
      titleFontSizePx: 40,
      subtitleText: "Información clara para comprar y recibir atención.",
      eyebrowText: "Tu compra, con confianza",
      extension: { keep: true },
      style: { accentColor: "#123456" },
      presentation: { borderWidth: 0.5 },
    },
  });
  expect(seed).toMatchObject({
    titleText: "Cambios y devoluciones",
    titleFontSizePx: 64,
    eyebrowText: "Después de tu compra",
    extension: { keep: true },
    style: { accentColor: "#123456" },
    presentation: { borderWidth: 0.5 },
  });
  const own = informationConfigForPage({
    ...page,
    informationPageConfig: {
      titleText: "Mi política",
      subtitleText: "Texto propio",
      titleFontSizePx: 36,
      returnsGuide: {
        heroArtwork: "",
        extension: true,
        choices: [],
        steps: [],
      },
    },
  });
  expect(own).toMatchObject({
    titleText: "Mi política",
    subtitleText: "Texto propio",
    titleFontSizePx: 36,
    returnsGuide: { heroArtwork: "", extension: true, choices: [], steps: [] },
  });
  expect(
    normalizeInformationPage({
      name: "Otra",
      slug: "otra",
      informationPageConfig: {},
    }).informationPageConfig.returnsGuide,
  ).toBeUndefined();
});
it("rechaza destinos peligrosos y opciones visibles incompletas antes de guardar", () => {
  expect(
    buildReturnsGuide({
      claimsHref: "javascript:alert(1)",
      trackHref: "/admin/ordenes",
    }),
  ).toMatchObject({ claimsHref: "", trackHref: "" });
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: {
        returnsGuide: { choices: [{ id: "change", title: "" }] },
      },
    }),
  ).toMatch(/Completa/);
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: {
        returnsGuide: { choices: [{ id: "change", requestHref: "/admin" }] },
      },
    }),
  ).toMatch(/destinos/);
});
it("las tres opciones muestran sus condiciones reales y conducen al tipo de solicitud apropiado", () => {
  mount();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
    "Cambios y devoluciones",
  );
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
  const options = [
    [
      "Ver opciones",
      "Política comercial real de Órdenes y garantía legal.",
      "petition",
    ],
    [
      "Solicitar ayuda",
      "Política comercial real de Órdenes y garantía legal.",
      "warranty",
    ],
    [
      "Ver mis derechos",
      "Derecho real de retracto del servidor.",
      "withdrawal",
    ],
  ];
  for (const [label, body, type] of options) {
    const button = screen.getByRole("button", { name: label, exact: true });
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    const panel = document.querySelector(".returns-guide__choice-details");
    expect(within(panel).getByText(body)).toBeVisible();
    expect(
      within(panel).getByRole("link", {
        name: "Iniciar solicitud de atención",
      }),
    ).toHaveAttribute("href", "/pqr?tipo=" + type);
    fireEvent.click(screen.getByRole("button", { name: "Cerrar información" }));
    expect(button).toHaveFocus();
    expect(panel).not.toBeVisible();
  }
  expect(
    screen.getByRole("link", { name: "Consultar solicitud" }),
  ).toHaveAttribute("href", "/pqr?vista=consulta");
});
it("las condiciones completas y su descarga siguen disponibles aunque se oculten las tarjetas y la ayuda", () => {
  mount({
    returnsGuide: {
      showChoices: false,
      showJourney: false,
      showSupport: false,
    },
  });
  fireEvent.click(
    screen.getByText("Condiciones completas y derechos del consumidor"),
  );
  expect(
    screen.getByText("Vendedor configurado · NIT 900123456-7"),
  ).toBeVisible();
  for (const section of data.sections)
    expect(screen.getByText(section.body)).toBeVisible();
  fireEvent.click(
    screen.getByRole("button", { name: "Descargar esta información" }),
  );
  const [file, text] = downloadText.mock.calls[0];
  expect(file).toBe(page.slug + ".txt");
  expect(text).toContain(data.version);
  for (const section of data.sections) expect(text).toContain(section.body);
  expect(
    screen.getByRole("link", { name: /Superintendencia/ }),
  ).toHaveAttribute("href", data.authorityUrl);
});
it("la vista previa permite explorar el diseño pero bloquea navegación y descarga", () => {
  mount({}, true);
  fireEvent.click(
    screen.getByRole("button", { name: "Solicitar ayuda", exact: true }),
  );
  expect(
    fireEvent.click(
      screen.getByRole("link", { name: "Iniciar solicitud de atención" }),
    ),
  ).toBe(false);
  expect(
    fireEvent.click(screen.getByRole("link", { name: "Consultar solicitud" })),
  ).toBe(false);
  fireEvent.click(
    screen.getByText("Condiciones completas y derechos del consumidor"),
  );
  expect(
    screen.getByRole("button", { name: "Descargar esta información" }),
  ).toBeDisabled();
  expect(downloadText).not.toHaveBeenCalled();
});
it("recupera errores sin inventar condiciones y reacomoda la cabecera si falla la imagen", () => {
  useConsumerInformation.mockReturnValue({
    data: null,
    error: "Fallo controlado",
    retry,
  });
  mount();
  fireEvent.error(document.querySelector(".returns-guide__art"));
  expect(document.querySelector(".returns-guide__hero")).toHaveAttribute(
    "data-artwork",
    "false",
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Ver opciones", exact: true }),
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Fallo controlado");
  expect(screen.queryByText(data.sections[0].body)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledOnce();
});
