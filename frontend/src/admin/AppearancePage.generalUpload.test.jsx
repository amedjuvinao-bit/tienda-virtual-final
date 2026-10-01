import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppearancePage from "./AppearancePage";
import { fetchAppearanceSettings, saveSiteSettings } from "../lib/siteSettingsApi";
import api, { adminFetch } from "../lib/api";

vi.mock("../lib/siteSettingsApi", () => ({ fetchAppearanceSettings: vi.fn(), saveSiteSettings: vi.fn() }));
vi.mock("../lib/api", () => ({ default: { post: vi.fn() }, adminFetch: vi.fn() }));
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
    api.post.mockResolvedValue({ data: { url: "https://res.cloudinary.com/demo/image/upload/whatsapp.webp" } });
    adminFetch.mockResolvedValue({ ok: true, json: async () => [] });
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
    expect(api.post).toHaveBeenCalledWith('/api/uploads', expect.any(FormData));
    expect(api.post.mock.calls[0][1].get("image")).toBeInstanceOf(File);
    expect(adminFetch.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(saveSiteSettings).toHaveBeenCalledTimes(1));
    expect(saveSiteSettings.mock.calls[0][0].theme.global.whatsapp.imageUrl).toBe("https://res.cloudinary.com/demo/image/upload/whatsapp.webp");
    await waitFor(() => expect(screen.queryByText(/Imagen subida.*Guardar cambios/)).not.toBeInTheDocument());
  });

  it("muestra el error de sesión del backend y permite volver a subir", async () => {
    api.post.mockRejectedValueOnce({ userMessage: "La sesión venció. Inicia sesión de nuevo." });
    const user = userEvent.setup();
    render(<AppearancePage />);
    await screen.findByRole("heading", { name: "Herramientas de la tienda" });
    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    const input = screen.getByLabelText("Seleccionar imagen para Botón de WhatsApp");
    await user.upload(input, new File(["imagen"], "whatsapp.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("La sesión venció. Inicia sesión de nuevo.");

    await user.upload(input, new File(["imagen"], "whatsapp.png", { type: "image/png" }));
    expect(await screen.findByText(/Imagen subida.*Guardar cambios/)).toBeInTheDocument();
    expect(screen.queryByText("La sesión venció. Inicia sesión de nuevo.")).not.toBeInTheDocument();
  });
});
