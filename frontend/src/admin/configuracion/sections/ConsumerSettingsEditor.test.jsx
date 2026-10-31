import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ConsumerSettingsEditor from "./ConsumerSettingsEditor";
import api from "../../../lib/api";
vi.mock("../../../lib/api", () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const seller = { legalName: "Razón social ya registrada", nit: "900123456-7" };
it("Privacidad reutiliza la identidad existente y solo guarda sus tres campos", async () => {
  const config = {
    revision: 2,
    privacyEffectiveDate: "2026-10-27",
    retention: "Criterio anterior",
    processors: "Proveedor registrado",
  };
  api.get.mockResolvedValue({ data: { config, document: { seller } } });
  api.put.mockImplementation(async (_path, body) => ({
    data: { config: { ...body.config, revision: 3 }, document: { seller } },
  }));
  render(<ConsumerSettingsEditor />);
  await screen.findByText("Razón social ya registrada");
  expect(screen.getByText(/900123456-7/)).toBeInTheDocument();
  expect(
    screen.queryByRole("textbox", { name: "NIT" }),
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText(/Máximo de días/)).not.toBeInTheDocument();
  fireEvent.change(
    screen.getByLabelText("¿Durante cuánto tiempo conservas los datos?"),
    { target: { value: "Criterio real actualizado" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar política de datos" }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith("/api/consumer/admin/settings", {
      config: { ...config, retention: "Criterio real actualizado" },
    }),
  );
  expect(
    screen.getByRole("link", { name: "Editar datos fiscales" }),
  ).toHaveAttribute("href", "/admin/facturacion/configuracion");
});
it("Envíos guarda plazo y países sin enviar tarifas, política de cambios ni privacidad", async () => {
  const config = {
    revision: 3,
    shippingCountries: "CO",
    deliveryDays: 5,
    pickupEnabled: false,
    pickupInstructions: "",
  };
  api.get.mockResolvedValue({ data: { config, document: { seller } } });
  api.put.mockImplementation(async (_path, body) => ({
    data: { config: { ...body.config, revision: 4 }, document: { seller } },
  }));
  render(
    <ConsumerSettingsEditor
      section="delivery"
      countries={[
        { code: "CO", name: "Colombia" },
        { code: "US", name: "Estados Unidos" },
      ]}
    />,
  );
  const days = await screen.findByLabelText(
    "Máximo de días calendario para entregar",
  );
  expect(
    screen.queryByLabelText(/¿Durante cuánto tiempo/),
  ).not.toBeInTheDocument();
  fireEvent.change(days, { target: { value: "8" } });
  fireEvent.change(
    screen.getByRole("combobox", { name: "Agregar país de envío" }),
    { target: { value: "US" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Guardar condiciones de entrega" }),
  );
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith(
      "/api/consumer/admin/delivery-settings",
      { config: { ...config, shippingCountries: "CO, US", deliveryDays: 8 } },
    ),
  );
  expect(api.get).toHaveBeenCalledWith(
    "/api/consumer/admin/delivery-settings",
    expect.anything(),
  );
});
