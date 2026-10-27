import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ConsumerCasesPanel from "./ConsumerCasesPanel";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("abre la compra en Órdenes y publica la respuesta sin ejecutar un reembolso", async () => {
  api.get.mockResolvedValue({
    data: {
      cases: [
        {
          id: "case-1",
          reference: "PQR-1",
          revision: 3,
          status: "received",
          createdAt: "2026-10-27T15:00:00Z",
          subject: "Solicitud de prueba",
          name: "Cliente",
          contact: "prueba@example.com",
          orderNumber: "000123",
          message: "Descripción de prueba",
          history: [],
        },
      ],
      next: "",
    },
  });
  api.post.mockResolvedValue({ data: { ok: true } });
  render(<ConsumerCasesPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /PQR-1/ }));
  expect(
    screen.getByRole("link", { name: /Buscar la compra #000123/ }),
  ).toHaveAttribute("href", "/admin/ordenes?q=000123");
  fireEvent.change(screen.getByLabelText("Respuesta pública"), {
    target: { value: "Respuesta completa para el cliente" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Publicar respuesta en el radicado" }),
  );
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/api/consumer/admin/cases/case-1/replies",
      {
        revision: 3,
        status: "in_review",
        message: "Respuesta completa para el cliente",
      },
    ),
  );
  expect(api.post).toHaveBeenCalledTimes(1);
});
