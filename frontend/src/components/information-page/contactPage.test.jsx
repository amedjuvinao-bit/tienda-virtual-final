import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import InformationPageView from "./InformationPageView";
import {
  informationConfigForPage,
  normalizeInformationPage,
  validateInformationPage,
} from "./informationPageConfig";
import {
  buildContactConfig,
  contactCoordinates,
  contactEmbedUrl,
  resolveContact,
} from "./contactPageConfig";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
vi.mock("../Header", () => ({ default: () => null }));
vi.mock("../StorefrontFooter", () => ({ default: () => null }));
vi.mock("../WhatsAppButton", () => ({ default: () => null }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const store = {
  whatsapp: "+1 202 555 0123",
  email: "general@example.com",
  supportEmail: "support@example.com",
  address: "Dirección de prueba",
  city: "Ciudad",
  country: "CO",
  timezone: "America/Bogota",
  weeklySchedule: {
    days: [
      {
        day: "monday",
        enabled: true,
        intervals: [
          { open: "08:00", close: "12:00" },
          { open: "14:00", close: "18:00" },
        ],
      },
      { day: "sunday", enabled: false },
    ],
  },
};
function mount(contact = {}, settings = { store }, preview = false) {
  return render(
    <MemoryRouter>
      <StorefrontSettingsContext.Provider value={settings}>
        <InformationPageView
          page={{
            name: "Contacto",
            slug: "contacto",
            systemRole: "contact",
            pageType: "information",
            useHeader: false,
            useFooter: false,
            informationPageConfig: { contact },
          }}
          preview={preview}
        />
      </StorefrontSettingsContext.Provider>
    </MemoryRouter>,
  );
}
it("adopts Contacto without changing the diary or authored settings and preserves unknown fields", () => {
  const page = normalizeInformationPage({
    name: "Atención",
    slug: "contacto",
    systemRole: "contact",
    informationPageConfig: {
      extension: true,
      contact: { extension: { keep: true } },
      style: { cardRadiusPx: 0 },
      presentation: { borderWidth: 0, reflection: 0 },
    },
  });
  expect(page.systemRole).toBe("contact");
  expect(page.informationPageConfig).toMatchObject({
    layout: "contact",
    extension: true,
    contact: { extension: { keep: true } },
    style: { cardRadiusPx: 0 },
    presentation: { borderWidth: 0, reflection: 0 },
  });
  expect(
    informationConfigForPage({
      systemRole: "contact",
      informationPageConfig: {
        layout: "editorial",
        titleText: "Nuestro título",
      },
    }),
  ).toMatchObject({ layout: "editorial", titleText: "Nuestro título" });
  expect(informationConfigForPage({ systemRole: "about" }).layout).toBe(
    "memory-table",
  );
  expect(informationConfigForPage({ name: "Otra" }).layout).toBe("editorial");
});
it("uses store contacts, safe encoded messages and full location; custom empty fields do not fall back", () => {
  const data = resolveContact(
    { whatsappMessage: "Hola & consulta?", emailSubject: "Pedido & entrega" },
    { store },
  );
  expect(data.whatsapp).toBe(
    "https://wa.me/12025550123?text=Hola%20%26%20consulta%3F",
  );
  expect(data.email).toBe(
    "mailto:support@example.com?subject=Pedido%20%26%20entrega",
  );
  expect(new URL(data.directions).searchParams.get("destination")).toBe(
    "Dirección de prueba, Ciudad, Colombia",
  );
  expect(data.schedule[0].intervals).toHaveLength(2);
  expect(data.schedule[1].closed).toBe(true);
  expect(
    resolveContact(
      {},
      {
        store: {
          weeklySchedule: {
            days: [
              {
                day: "monday",
                enabled: true,
                intervals: [null, {}, { open: "25:00", close: "26:00" }],
              },
            ],
          },
        },
      },
    ).schedule[0].intervals,
  ).toEqual([]);
  expect(
    resolveContact(
      {
        whatsappSource: "custom",
        emailSource: "custom",
        locationSource: "custom",
        hoursSource: "custom",
      },
      { store },
    ),
  ).toMatchObject({
    whatsapp: "",
    email: "",
    directions: "",
    hours: "",
    schedule: [],
  });
  expect(
    resolveContact({}, { store: { city: "Ciudad", country: "CO" } }).directions,
  ).toBe("");
});
it("rejects unsafe channels and incomplete coordinates, handles zero and builds only the trusted map URL", () => {
  expect(
    resolveContact(
      {
        whatsappSource: "custom",
        whatsappPhone: "javascript:123456789",
        emailSource: "custom",
        email: "bad@example.com?bcc=other@example.com",
      },
      {},
    ).whatsapp,
  ).toBe("");
  expect(
    resolveContact(
      {
        emailSource: "custom",
        email: "bad@example.com\r\nBcc: other@example.com",
      },
      {},
    ).email,
  ).toBe("");
  expect(
    resolveContact({ emailSource: "custom", email: "a,b@example.com" }, {})
      .email,
  ).toBe("");
  expect(contactCoordinates("0", "0")).toEqual({ lat: 0, lon: 0 });
  expect(contactCoordinates("0", "")).toBeNull();
  expect(contactCoordinates("91", "10")).toBeNull();
  expect(new URL(contactEmbedUrl({ lat: 0, lon: 0 })).hostname).toBe(
    "www.openstreetmap.org",
  );
  const cfg = buildContactConfig({
    latitude: "1",
    longitude: "",
    extension: true,
  });
  expect(cfg.extension).toBe(true);
  expect(
    validateInformationPage({
      name: "Contacto",
      slug: "contacto",
      informationPageConfig: { layout: "contact", contact: cfg },
    }),
  ).toMatch(/ambas coordenadas/);
});
it("renders working conversation, email, map and direction destinations, and copies the configured address", async () => {
  const writeText = vi.fn().mockResolvedValue();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  mount({ showPhone: true, phone: "+12025550124" });
  expect(screen.getByRole("link", { name: /Teléfono/ })).toHaveAttribute(
    "href",
    "tel:+12025550124",
  );
  expect(
    screen.getByRole("link", { name: "Abrir conversación", exact: true }),
  ).toHaveAttribute("href", "https://wa.me/12025550123");
  expect(
    screen.getByRole("link", { name: /Correo electrónico/ }),
  ).toHaveAttribute("href", "mailto:support@example.com");
  expect(
    new URL(screen.getByRole("link", { name: "Cómo llegar" }).href).pathname,
  ).toBe("/maps/dir/");
  expect(
    screen.getByRole("link", { name: "Ver ubicación en el mapa" }),
  ).toHaveAttribute("target", "_blank");
  fireEvent.click(screen.getByRole("button", { name: "Copiar dirección" }));
  await screen.findByText("Dirección copiada");
  expect(writeText).toHaveBeenCalledWith(
    "Dirección de prueba, Ciudad, Colombia",
  );
  expect(document.querySelector("iframe")).toBeNull();
});
it("opens complete schedule and restores focus when the native dialog closes", async () => {
  mount();
  const button = screen.getByRole("button", { name: /Horario de atención/ });
  button.focus();
  fireEvent.click(button);
  const dialog = screen.getByRole("dialog");
  expect(
    within(dialog).getByText("08:00 – 12:00 / 14:00 – 18:00"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Cerrado")).toBeInTheDocument();
  expect(within(dialog).getByText(/America\/Bogota/)).toBeInTheDocument();
  fireEvent(dialog, new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(button).toHaveFocus();
  expect(document.body.style.overflow).toBe("");
});
it("loads an interactive map only on request with coordinates and never loads it in preview", () => {
  const state = mount({ latitude: "0", longitude: "0" });
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Explorar mapa" }));
  expect(document.querySelector("iframe").src).toContain(
    "www.openstreetmap.org/export/embed.html",
  );
  state.unmount();
  mount({ latitude: "0", longitude: "0" }, { store }, true);
  fireEvent.click(screen.getByRole("button", { name: "Explorar mapa" }));
  expect(document.querySelector("iframe")).toBeNull();
});
it("hides missing channels in public, isolates examples in preview and reports clipboard failures", async () => {
  const state = mount({}, {});
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.getByText(/Pronto encontrarás/)).toBeInTheDocument();
  state.unmount();
  const draft = buildContactConfig();
  mount(draft, {}, true);
  expect(screen.getByText(/datos de ejemplo/)).toBeInTheDocument();
  expect(draft.whatsappPhone).toBe("");
  fireEvent.click(screen.getByRole("button", { name: "Copiar dirección" }));
  await screen.findByText(/no se modifica el portapapeles/);
  cleanup();
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
  });
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Copiar dirección" }));
  await waitFor(() =>
    expect(screen.getByRole("status")).toHaveTextContent(/No se pudo copiar/),
  );
});
