import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ConsumerCaseForm from "./ConsumerCaseForm";
import { buildInformationConfig } from "../information-page/informationPageConfig";
import { storeOrderPaymentAccess } from "../../utils/orderPaymentAccess";
import api from "../../lib/api";
vi.mock("../../lib/api", () => ({ default: { post: vi.fn() } }));
const config = buildInformationConfig({});
const document = { version: "v1", types: { complaint: "Queja o reclamo" } };
const receipt = {
  reference: "PQR-TEST",
  status: "received",
  createdAt: "2026-10-27T15:00:00Z",
  subject: "Prueba",
  message: "Descripción completa de prueba",
  history: [],
};
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
});
it("recupera con código y conserva la misma nueva clave al reintentar una respuesta incierta", async () => {
  api.post
    .mockResolvedValueOnce({
      data: { message: "Si coincide recibirás un código" },
    })
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ data: receipt });
  render(<ConsumerCaseForm config={config} document={document} />);
  fireEvent.click(screen.getByRole("button", { name: "Recuperar acceso" }));
  fireEvent.change(screen.getByLabelText("Radicado a recuperar"), {
    target: { value: "PQR-TEST" },
  });
  fireEvent.change(screen.getByLabelText("Correo registrado"), {
    target: { value: "prueba@example.com" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Enviar código de recuperación" }),
  );
  fireEvent.change(await screen.findByLabelText("Código recibido por correo"), {
    target: { value: "123456" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Verificar código y recuperar acceso" }),
  );
  await screen.findByRole("alert");
  fireEvent.click(
    screen.getByRole("button", { name: "Verificar código y recuperar acceso" }),
  );
  await screen.findByText(
    "Acceso recuperado. La clave anterior dejó de funcionar.",
  );
  const first = api.post.mock.calls[1][1],
    retry = api.post.mock.calls[2][1];
  expect(first).toEqual(retry);
  expect(first.accessKey).toMatch(/^[a-f0-9]{64}$/);
  expect(screen.getByText(first.accessKey)).toBeInTheDocument();
  expect(sessionStorage.length).toBe(0);
  expect(localStorage.length).toBe(0);
  expect(
    screen.getByRole("button", { name: "Descargar constancia y clave" }),
  ).toBeInTheDocument();
});
it("vincula solo si conserva acceso seguro y nunca pone el token en la dirección", async () => {
  const orderId = "012345678901234567890123";
  storeOrderPaymentAccess({
    orderId,
    sessionId: "session-test",
    token: "signed-test",
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  window.history.replaceState({}, "", `/pqr?pedido=${orderId}`);
  api.post.mockResolvedValue({
    data: { ...receipt, orderLinked: true, orderNumber: "000123" },
  });
  render(<ConsumerCaseForm config={config} document={document} />);
  expect(
    screen.getByText(/Abriste esta solicitud desde una compra/),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Nombre"), {
    target: { value: "Cliente" },
  });
  fireEvent.change(screen.getByLabelText("Correo o teléfono de contacto"), {
    target: { value: "prueba@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Asunto"), {
    target: { value: "Prueba" },
  });
  fireEvent.change(screen.getByLabelText("Describe tu solicitud"), {
    target: { value: "Descripción completa" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Enviar y obtener radicado" })
      .closest("form"),
  );
  await screen.findByText("Solicitud vinculada a la compra #000123.");
  expect(api.post.mock.calls[0][1].orderId).toBe(orderId);
  expect(api.post.mock.calls[0][2].headers).toEqual({
    "X-Session-Id": "session-test",
    "X-Order-Access-Token": "signed-test",
  });
  expect(location.href).not.toContain("signed-test");
});
it("un id escrito en la dirección no concede acceso ni crea un vínculo", () => {
  window.history.replaceState({}, "", "/pqr?pedido=012345678901234567890123");
  render(<ConsumerCaseForm config={config} document={document} />);
  expect(
    screen.queryByText(/Abriste esta solicitud desde una compra/),
  ).not.toBeInTheDocument();
  expect(screen.getByLabelText("Número de pedido (opcional)")).toBeEnabled();
});
it("la vista previa permite explorar la recuperación sin enviar correos ni modificar accesos", () => {
  render(<ConsumerCaseForm config={config} document={document} preview />);
  fireEvent.click(screen.getByRole("button", { name: "Recuperar acceso" }));
  expect(
    screen.getByRole("button", { name: "Enviar código de recuperación" }),
  ).toBeDisabled();
  fireEvent.submit(
    screen
      .getByRole("button", { name: "Enviar código de recuperación" })
      .closest("form"),
  );
  expect(api.post).not.toHaveBeenCalled();
});
it("abre consulta desde el enlace público sin pedir nuevamente datos de radicación", () => {
  window.history.replaceState({}, "", "/pqr?vista=consulta");
  render(<ConsumerCaseForm config={config} document={document} />);
  expect(screen.getByLabelText("Radicado")).toBeVisible();
  expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
  expect(api.post).not.toHaveBeenCalled();
});
it("preselecciona solo tipos del servidor y no autoriza ni envía por abrir un enlace", () => {
  const types = {
    petition: "Petición",
    warranty: "Garantía legal",
    withdrawal: "Retracto",
  };
  window.history.replaceState({}, "", "/pqr?tipo=warranty");
  const view = render(
    <ConsumerCaseForm config={config} document={{ ...document, types }} />,
  );
  expect(screen.getByLabelText("Tipo de solicitud")).toHaveValue("warranty");
  expect(screen.getByRole("checkbox")).not.toBeChecked();
  expect(api.post).not.toHaveBeenCalled();
  view.unmount();
  window.history.replaceState({}, "", "/pqr?tipo=constructor");
  render(
    <ConsumerCaseForm config={config} document={{ ...document, types }} />,
  );
  expect(screen.getByLabelText("Tipo de solicitud")).toHaveValue("petition");
});
