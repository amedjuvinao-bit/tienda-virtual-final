import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ConsumerAssistedRecovery from "./ConsumerAssistedRecovery";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { post: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("conserva la misma solicitud al reintentar y solo muestra la nueva clave tras confirmación", async () => {
  api.post
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ data: { reference: "PQR-1", revision: 4 } });
  const updated = vi.fn();
  render(
    <ConsumerAssistedRecovery
      item={{ id: "case-1", reference: "PQR-1", revision: 3 }}
      onRecovered={updated}
    />,
  );
  fireEvent.click(screen.getByText("Asistir a un cliente que perdió su clave"));
  fireEvent.change(screen.getByLabelText("Cómo verificaste la identidad"), {
    target: { value: "Verificación por contacto previamente registrado" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Generar nueva clave para el cliente" })
      .closest("form"),
  );
  await screen.findByRole("alert");
  expect(
    screen.queryByRole("button", { name: "Descargar acceso para el cliente" }),
  ).not.toBeInTheDocument();
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Generar nueva clave para el cliente" })
      .closest("form"),
  );
  await screen.findByRole("button", {
    name: "Descargar acceso para el cliente",
  });
  expect(api.post.mock.calls[0][1]).toEqual(api.post.mock.calls[1][1]);
  expect(api.post.mock.calls[0][1].identityVerified).toBe(true);
  expect(updated).toHaveBeenCalledWith(4);
});
