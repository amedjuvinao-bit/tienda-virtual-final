import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import InformationPageView from "./InformationPageView";
import {
  informationConfigForPage,
  normalizeInformationPage,
  validateInformationPage,
} from "./informationPageConfig";
import {
  buildHelpConfig,
  searchHelpTopics,
  validateHelpConfig,
  visibleHelpTopics,
} from "./helpPageConfig";
vi.mock("../Header", () => ({ default: () => null }));
vi.mock("../StorefrontFooter", () => ({ default: () => null }));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
afterEach(cleanup);
function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.search}</output>;
}
function mount(help = {}, route = "/preguntas-frecuentes", preview = false) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Location />
      <InformationPageView
        page={{
          name: "Centro de ayuda",
          slug: "preguntas-frecuentes",
          systemRole: "help",
          pageType: "information",
          useHeader: false,
          useFooter: false,
          informationPageConfig: { help },
        }}
        preview={preview}
      />
    </MemoryRouter>,
  );
}
it("publishes the complete coherent starter, preserves explicit empty content, extensions and material zeros", () => {
  const page = normalizeInformationPage({
    name: "Ayuda",
    slug: "preguntas-frecuentes",
    systemRole: "help",
    informationPageConfig: {
      help: { extension: { keep: true } },
      style: { cardRadiusPx: 0 },
      presentation: { borderWidth: 0, reflection: 0 },
    },
  });
  const help = page.informationPageConfig.help;
  expect(help.categories.map((c) => c.title)).toEqual([
    "Pedidos",
    "Pagos",
    "Envíos",
    "Cambios",
  ]);
  expect(help.categories.flatMap((c) => c.questions)).toHaveLength(14);
  expect(validateHelpConfig(help)).toBe("");
  expect(help.extension).toEqual({ keep: true });
  expect(page.systemRole).toBe("help");
  expect(page.informationPageConfig).toMatchObject({
    style: { cardRadiusPx: 0 },
    presentation: { borderWidth: 0, reflection: 0 },
  });
  expect(
    informationConfigForPage({
      systemRole: "help",
      informationPageConfig: { help: { categories: [] } },
    }).help.categories,
  ).toEqual([]);
  expect(informationConfigForPage({ name: "Otra" }).help.categories).toEqual(
    [],
  );
  const allowed = new Set([
    "/#categorias",
    "/carrito",
    "/favoritos",
    "/contacto",
  ]);
  for (const q of help.categories.flatMap((c) => c.questions)) {
    expect(allowed.has(q.actionHref)).toBe(true);
    expect(q.answer).not.toMatch(
      /30 días|24 horas|gratis|garantizado|ejemplo|configuraci[oó]n|panel/i,
    );
  }
});
it("normalizes unique stable identities and searches questions, answers and topics without accents or case", () => {
  const config = buildHelpConfig({
    categories: [
      {
        id: "x",
        title: "Envíos",
        questions: [
          {
            id: "same",
            question: "Consulta",
            answer: "Dirección de entrega",
            extension: true,
          },
          {
            id: "same",
            question: "Oculta",
            answer: "Palabra secreta",
            enabled: false,
          },
        ],
      },
      { id: "x", title: "Otra", questions: [] },
    ],
  });
  expect(new Set(config.categories.map((c) => c.id)).size).toBe(2);
  expect(new Set(config.categories[0].questions.map((q) => q.id)).size).toBe(2);
  expect(config.categories[0].questions[0].extension).toBe(true);
  const visible = visibleHelpTopics(config);
  expect(searchHelpTopics(visible, "ENVIO DIRECCION")).toHaveLength(1);
  expect(searchHelpTopics(visible, "secreta")).toHaveLength(0);
});
it("opens and closes answers, changes topic, searches across topics and clears with input focus", () => {
  mount();
  const first = screen.getByRole("button", {
    name: "¿Cómo realizo una compra?",
    exact: true,
  });
  expect(first).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(first);
  expect(first).toHaveAttribute("aria-expanded", "false");
  fireEvent.click(screen.getByRole("button", { name: "Pagos", exact: true }));
  expect(
    screen.getByRole("button", { name: "¿Qué medios de pago puedo utilizar?" }),
  ).toHaveAttribute("aria-expanded", "true");
  const input = screen.getByRole("searchbox", {
    name: "Buscar en el centro de ayuda",
  });
  fireEvent.change(input, { target: { value: "DIRECCIÓN ENTREGA" } });
  expect(
    screen.getByRole("heading", { name: "Resultados de búsqueda" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", { name: "¿Dónde veo el costo del envío?" }),
  ).toBeInTheDocument();
  expect(screen.getByTestId("location")).toHaveTextContent("q=DIRECCI");
  fireEvent.click(
    screen.getByRole("button", { name: "Limpiar búsqueda", exact: true }),
  );
  expect(input).toHaveValue("");
  expect(input).toHaveFocus();
  expect(
    screen.getByRole("heading", { name: "Sobre tus pagos" }),
  ).toBeInTheDocument();
});
it("restores a direct question link, keeps unrelated parameters and does not expose hidden answers", () => {
  const config = buildHelpConfig({}, { starter: true });
  config.categories[1].questions[0].enabled = false;
  mount(config, "/ayuda?origen=pie&pregunta=pago-pendiente");
  expect(
    screen.getByRole("heading", { name: "Sobre tus pagos" }),
  ).toBeInTheDocument();
  const button = screen.getByRole("button", {
    name: "¿Qué significa que mi pago está pendiente?",
  });
  expect(button).toHaveAttribute("aria-expanded", "true");
  fireEvent.click(button);
  expect(screen.getByTestId("location")).toHaveTextContent("origen=pie");
  expect(
    screen.queryByRole("button", {
      name: "¿Qué medios de pago puedo utilizar?",
    }),
  ).toBeNull();
});
it("shows safe functional actions and blocks navigation only inside the preview", () => {
  mount({}, "/preguntas-frecuentes", true);
  const catalog = screen.getByRole("link", { name: "Explorar catálogo" });
  expect(catalog).toHaveAttribute("href", "/#categorias");
  expect(fireEvent.click(catalog)).toBe(false);
  expect(
    screen.getByRole("link", { name: "Contactar al equipo", exact: true }),
  ).toHaveAttribute("href", "/contacto");
  expect(document.querySelector(".contact-whatsapp__badge")).toBeNull();
});
it("validates public answers and destinations while allowing hidden drafts and plain text", () => {
  const config = buildHelpConfig({}, { starter: true });
  config.categories[0].questions[0].answer = "";
  expect(validateHelpConfig(config)).toMatch(/pregunta y respuesta/);
  config.categories[0].questions[0].enabled = false;
  expect(validateHelpConfig(config)).toBe("");
  config.categories[0].questions[1].actionHref = "/admin/ordenes";
  expect(
    validateInformationPage({
      name: "Ayuda",
      slug: "ayuda",
      informationPageConfig: { layout: "help", help: config },
    }),
  ).toMatch(/enlace público seguro/);
  cleanup();
  mount({
    categories: [
      {
        title: "Información",
        questions: [
          {
            question: "¿Texto seguro?",
            answer: "<script>no ejecutar</script>",
          },
        ],
      },
    ],
  });
  expect(screen.getByText("<script>no ejecutar</script>")).toBeInTheDocument();
  expect(document.querySelector("script")).toBeNull();
});
it("provides meaningful no-results and empty states without restoring deleted starter answers", () => {
  const state = mount();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "sincoincidencias" },
  });
  expect(screen.getByText("No encontramos esa respuesta")).toBeInTheDocument();
  expect(
    within(screen.getByRole("search")).getByRole("button", {
      name: "Limpiar búsqueda",
    }),
  ).toBeInTheDocument();
  state.unmount();
  mount({ categories: [] });
  expect(
    screen.getByText(
      "Puedes comunicarte con nuestro equipo para resolver tus preguntas.",
    ),
  ).toBeInTheDocument();
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.queryByText("¿Cómo realizo una compra?")).toBeNull();
});
