import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import InformationPageView from "../information-page/InformationPageView";
import {
  informationConfigForPage,
  normalizeInformationPage,
  validateInformationPage,
} from "../information-page/informationPageConfig";
import { privacyPolicySections } from "./privacyPolicySections";
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
  name: "Datos personales",
  slug: "privacidad",
  systemRole: "consumer-privacy",
  pageType: "information",
  useHeader: false,
  useFooter: false,
};
const privacySections = [
  {
    id: "datos",
    title: "Datos y finalidades",
    paragraphs: [
      "Finalidades reales del servidor.",
      "Responsable real identificado.",
    ],
    note: "Advertencia real de seguridad.",
  },
  {
    id: "autorizacion",
    title: "Autorización y comunicaciones",
    paragraphs: ["Autorización opcional real."],
  },
  {
    id: "conservacion",
    title: "Conservación y proveedores",
    paragraphs: [
      "Conservación publicada y proveedores reales.",
      "Vigencia de prueba.",
    ],
  },
  {
    id: "consultas",
    title: "Consultas y reclamos",
    paragraphs: ["Derechos y plazos reales del servidor."],
  },
];
const body = privacySections
  .flatMap((section) => [
    ...section.paragraphs,
    ...(section.note ? [section.note] : []),
  ])
  .join(" ");
const data = {
  version: "version-original",
  seller: {
    legalName: "Negocio de prueba",
    nit: "900123456-7",
    email: "prueba@example.com",
  },
  sections: [
    { id: "privacidad", title: "Tratamiento de datos personales", body },
  ],
  privacySections,
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
it("adopta solo la introducción de la semilla conocida y conserva configuraciones propias y campos extendidos", () => {
  expect(
    informationConfigForPage({
      ...page,
      informationPageConfig: {
        titleText: "Datos personales",
        eyebrowText: "Tu compra, con confianza",
        subtitleText: "Información clara para comprar y recibir atención.",
        titleFontSizePx: 40,
        extension: true,
      },
    }),
  ).toMatchObject({
    titleText: "Privacidad y datos personales",
    eyebrowText: "Información y atención",
    titleFontSizePx: 58,
    extension: true,
  });
  expect(
    informationConfigForPage({
      ...page,
      informationPageConfig: {
        titleText: "Privacidad propia",
        subtitleText: "Propio",
        style: { accentColor: "#123456" },
        privacyPage: {
          heroArtwork: "",
          summaries: [],
          rights: [],
          extension: true,
          topics: { datos: { label: "Información", extra: true } },
        },
      },
    }),
  ).toMatchObject({
    titleText: "Privacidad propia",
    subtitleText: "Propio",
    style: { accentColor: "#123456" },
    privacyPage: {
      heroArtwork: "",
      summaries: [],
      rights: [],
      extension: true,
      topics: { datos: { label: "Información", extra: true } },
    },
  });
  expect(
    normalizeInformationPage({ name: "Otra", slug: "otra" })
      .informationPageConfig.privacyPage,
  ).toBeUndefined();
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: { privacyPage: { rightsHref: "/admin" } },
    }),
  ).toMatch(/destinos/);
  expect(
    validateInformationPage({
      ...page,
      informationPageConfig: {
        privacyPage: { summaries: [{ title: "", body: "" }] },
      },
    }),
  ).toMatch(/Completa/);
});
it("los temas siempre cubren el documento completo y la respuesta anterior se muestra sin inventar un desglose", () => {
  expect(privacyPolicySections(data)).toEqual(privacySections);
  const before = structuredClone(data);
  expect(
    privacyPolicySections({ ...data, privacySections: undefined }),
  ).toEqual([
    { id: "privacidad", title: data.sections[0].title, paragraphs: [body] },
  ]);
  expect(
    privacyPolicySections({
      ...data,
      privacySections: privacySections.slice(0, 3),
    }),
  ).toHaveLength(1);
  expect(
    privacyPolicySections({
      ...data,
      privacySections: privacySections.map((section, i) =>
        i === 2
          ? { ...section, paragraphs: ["Texto cambiado fuera de la política."] }
          : section,
      ),
    }),
  ).toHaveLength(1);
  expect(
    privacyPolicySections({
      ...data,
      sections: [
        { ...data.sections[0], body: body + " Regla adicional del servidor." },
      ],
    }),
  ).toHaveLength(1);
  expect(data).toEqual(before);
});
it("muestra temas reales y descarga el documento íntegro con identidad y versión aunque haya secciones cerradas", () => {
  mount();
  expect(screen.getByText(privacySections[0].paragraphs[0])).toBeVisible();
  expect(screen.getByText(privacySections[2].paragraphs[0])).not.toBeVisible();
  fireEvent.click(
    screen.getByRole("heading", {
      name: "Conservación y proveedores",
      exact: true,
    }),
  );
  expect(screen.getByText(privacySections[2].paragraphs[0])).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Descargar política" }));
  const [file, text] = downloadText.mock.calls[0];
  expect(file).toBe("privacidad.txt");
  expect(text).toContain(body);
  expect(text).toContain(data.version);
  expect(text).toContain(data.seller.legalName);
  expect(screen.getByText(data.version)).not.toBeVisible();
  expect(
    screen.queryByText(/guardamos las condiciones que aceptaste/),
  ).not.toBeInTheDocument();
});
it("conecta los derechos con el tipo existente de PQR sin preautorizar ni crear solicitudes", () => {
  mount();
  expect(
    screen.getByRole("link", { name: "Ejercer mis derechos" }),
  ).toHaveAttribute("href", "/pqr?tipo=privacy_query");
  expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Responsable y canales de contacto"));
  expect(screen.getByText(/Negocio de prueba/)).toBeVisible();
  expect(
    screen.getByRole("link", { name: /Superintendencia/ }),
  ).toHaveAttribute("href", data.authorityUrl);
});
it("ocultar la guía y el resumen conserva la política, la descarga y el acceso a derechos", () => {
  mount({ privacyPage: { showRights: false, showSummary: false } });
  expect(
    screen.queryByRole("heading", { name: "Conoce tus derechos" }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Ejercer mis derechos" }),
  ).toBeVisible();
  expect(
    screen.getByRole("button", { name: "Descargar política" }),
  ).toBeEnabled();
  expect(screen.getByText(privacySections[0].paragraphs[0])).toBeVisible();
});
it("la vista previa permite abrir temas y bloquea navegación y descarga", () => {
  mount({}, true);
  expect(
    screen.getByRole("button", { name: "Descargar política" }),
  ).toBeDisabled();
  expect(
    fireEvent.click(screen.getByRole("link", { name: "Ejercer mis derechos" })),
  ).toBe(false);
  expect(
    fireEvent.click(screen.getByRole("link", { name: "Contactar tienda" })),
  ).toBe(false);
  fireEvent.click(
    screen.getByRole("heading", {
      name: "Autorización y comunicaciones",
      exact: true,
    }),
  );
  expect(screen.getByText(privacySections[1].paragraphs[0])).toBeVisible();
  expect(downloadText).not.toHaveBeenCalled();
});
it("recupera errores de carga sin ofrecer información vieja como vigente", () => {
  useConsumerInformation.mockReturnValue({
    data,
    error: "No pudimos cargar.",
    retry,
  });
  mount();
  expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar.");
  expect(
    screen.queryByRole("button", { name: "Descargar política" }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
  expect(retry).toHaveBeenCalledOnce();
});
