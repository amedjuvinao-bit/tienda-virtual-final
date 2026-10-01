import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppearancePage from "./AppearancePage";
import { fetchAppearanceSettings, saveSiteSettings } from "../lib/siteSettingsApi";
import { adminFetch } from "../lib/api";

vi.mock("../lib/siteSettingsApi", () => ({ fetchAppearanceSettings: vi.fn(), saveSiteSettings: vi.fn() }));
vi.mock("../lib/api", () => ({ adminFetch: vi.fn() }));
vi.mock("../theme/applyTheme", () => ({ applyTheme: vi.fn() }));
vi.mock("./security/useAdminPermissions", () => ({ default: () => ({ can: () => true }) }));
vi.mock("./appearance/header/HeaderPanel", () => ({ default: () => null }));
vi.mock("./appearance/banner/BannerPanel", () => ({ default: () => null }));
vi.mock("./appearance/sections/SectionsPanel", () => ({ default: () => null }));
vi.mock("./appearance/footer/FooterPanel", () => ({ default: () => null }));

describe("carga de imagen en Apariencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchAppearanceSettings.mockResolvedValue({ theme: {}, menus: { header: [], footer: [], social: [] }, appearanceRevision: 7 });
    saveSiteSettings.mockResolvedValue({ theme: {}, menus: { header: [], footer: [], social: [] }, appearanceRevision: 8 });
    adminFetch.mockImplementation(async (url, options) => options?.method === "POST"
      ? { ok: true, json: async () => ({ url: "https://res.cloudinary.com/demo/image/upload/whatsapp.webp" }) }
      : { ok: true, json: async () => [] });
  });
  afterEach(cleanup);

  it("sube el archivo al backend y guarda la URL devuelta sin pedir al usuario que la copie", async () => {
    const user = userEvent.setup();
    render(<AppearancePage />);
    await screen.findByRole("heading", { name: "Herramientas de la tienda" });
    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Botón de WhatsApp"), new File(["imagen"], "whatsapp.png", { type: "image/png" }));
    expect(await screen.findByText(/Imagen subida.*Guardar cambios/)).toBeInTheDocument();
    const uploadCall = adminFetch.mock.calls.find(([, options]) => options?.method === "POST");
    expect(uploadCall[0]).toContain("/api/uploads");
    expect(uploadCall[1].body.get("image")).toBeInstanceOf(File);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.global.whatsapp.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/whatsapp.webp");
    await waitFor(() => expect(screen.queryByText(/Imagen subida.*Guardar cambios/)).not.toBeInTheDocument());
  });
});
