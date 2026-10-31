import {
  act,
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
it("filtra las PQR de una compra y vincula una referencia solo tras verificar identidad", async () => {
  api.get.mockResolvedValue({
    data: {
      cases: [
        {
          id: "case-1",
          reference: "PQR-1",
          revision: 2,
          status: "received",
          subject: "Prueba",
          orderNumber: "000123",
          history: [],
        },
      ],
      next: "",
    },
  });
  api.post.mockResolvedValue({ data: { ok: true } });
  render(
    <ConsumerCasesPanel order={{ _id: "order-1", orderNumber: "000123" }} />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /PQR-1/ }));
  expect(api.get).toHaveBeenCalledWith("/api/consumer/admin/cases", {
    params: { before: "", orderId: "order-1" },
  });
  const form = screen
    .getByRole("button", { name: "Vincular solicitud a la compra" })
    .closest("form");
  fireEvent.click(
    screen.getByLabelText(
      "Verifiqué la identidad del solicitante y su relación con esta compra.",
    ),
  );
  fireEvent.submit(form);
  await waitFor(() =>
    expect(api.post).toHaveBeenCalledWith(
      "/api/consumer/admin/cases/case-1/order",
      { orderNumber: "000123", identityVerified: true, revision: 2 },
    ),
  );
});
it("actualiza al recuperar foco conservando la selección y no sustituye una respuesta en edición", async () => {
  const row = {
    id: "case-1",
    reference: "PQR-1",
    revision: 2,
    status: "received",
    subject: "Prueba",
    history: [],
  };
  api.get.mockResolvedValue({ data: { cases: [row], next: "" } });
  render(<ConsumerCasesPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /PQR-1/ }));
  fireEvent(window, new Event("focus"));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
  expect(screen.getByLabelText("Respuesta pública")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Respuesta pública"), {
    target: { value: "Respuesta que aún estoy escribiendo" },
  });
  fireEvent(window, new Event("focus"));
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText("Respuesta pública")).toHaveValue(
    "Respuesta que aún estoy escribiendo",
  );
});

it("no aplica una actualización iniciada antes de que el operador comience a escribir", async () => {
  const row = {
    id: "case-1",
    reference: "PQR-1",
    revision: 2,
    status: "received",
    subject: "Prueba",
    history: [],
  };
  let release;
  api.get
    .mockResolvedValueOnce({ data: { cases: [row], next: "" } })
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    )
    .mockResolvedValue({ data: { cases: [row], next: "" } });
  api.post.mockResolvedValue({ data: { ok: true } });
  render(<ConsumerCasesPanel />);
  fireEvent.click(await screen.findByRole("button", { name: /PQR-1/ }));
  fireEvent(window, new Event("focus"));
  fireEvent.change(screen.getByLabelText("Respuesta pública"), {
    target: { value: "Texto que el operador está escribiendo" },
  });
  await act(async () =>
    release({ data: { cases: [{ ...row, revision: 3 }], next: "" } }),
  );
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Publicar respuesta en el radicado" })
      .closest("form"),
  );
  await waitFor(() => expect(api.post.mock.calls[0][1].revision).toBe(2));
});
