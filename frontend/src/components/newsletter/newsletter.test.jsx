import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import api from "../../lib/api";
import NewsletterForm from "./NewsletterForm";
import FooterSection from "../FooterSection";
import CheckoutContactSection from "../../checkout/page/CheckoutContactSection";
import useCheckoutState from "../../checkout/page/useCheckoutState";

const policy = {
  ready: true,
  version: "policy-1",
  text: "Autorizo las novedades por correo de mi negocio. Puedo retirar mi autorización.",
  seller: {
    legalName: "Mi negocio",
    email: "ayuda@example.com",
    phone: "3001234567",
    notificationAddress: "Calle 1",
  },
};
let get, post;
beforeEach(() => {
  get = vi.spyOn(api, "get").mockResolvedValue({ data: { policy } });
  post = vi
    .spyOn(api, "post")
    .mockResolvedValue({
      data: { ok: true, message: "Revisa tu correo para obtener el código." },
    });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const email = (value) =>
  fireEvent.change(
    screen.getByRole("textbox", { name: "Correo electrónico" }),
    { target: { value } },
  );
async function authorize() {
  const choice = await screen.findByRole("checkbox");
  expect(choice).not.toBeChecked();
  fireEvent.click(choice);
}
const submit = () => fireEvent.submit(screen.getByRole("form"));
describe("suscripción y retiro verificables", () => {
  it.each(["editorial", "classic"])(
    "utiliza el mismo formulario funcional y autorización en footer %s",
    async (layout) => {
      render(
        <FooterSection
          theme={{ footer: { layout, buttonText: "Suscribirme" } }}
        />,
      );
      await authorize();
      email(" PERSONA@EXAMPLE.COM ");
      submit();
      await screen.findByLabelText("Código de confirmación");
      expect(post).toHaveBeenCalledWith("/api/newsletter/subscribe", {
        email: "persona@example.com",
        consent: true,
        version: "policy-1",
      });
      expect(
        screen.queryByText("Suscripción confirmada"),
      ).not.toBeInTheDocument();
    },
  );
  it("no envía solicitudes sin la decisión expresa y conserva el enlace a privacidad", async () => {
    render(<NewsletterForm />);
    await screen.findByRole("checkbox");
    email("persona@example.com");
    submit();
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("autoriza");
    expect(
      screen.getByRole("link", { name: "Datos personales" }),
    ).toHaveAttribute("href", "/privacidad");
  });
  it("confirma con código y solo muestra éxito después de que el servidor lo registra", async () => {
    render(<NewsletterForm />);
    await authorize();
    email("persona@example.com");
    submit();
    const code = await screen.findByLabelText("Código de confirmación");
    fireEvent.change(code, { target: { value: "123456" } });
    post.mockResolvedValueOnce({
      data: { ok: true, status: "granted", message: "Suscripción confirmada." },
    });
    submit();
    expect(await screen.findByText("Suscripción confirmada.")).toBeVisible();
    expect(post).toHaveBeenLastCalledWith("/api/newsletter/confirm", {
      email: "persona@example.com",
      code: "123456",
      intent: "subscribe",
    });
    expect(
      screen.queryByLabelText("Código de confirmación"),
    ).not.toBeInTheDocument();
  });
  it("el retiro funciona sin conceder permisos ni cargar política de suscripción", async () => {
    render(<NewsletterForm initialMode="withdraw" />);
    email("persona@example.com");
    submit();
    const code = await screen.findByLabelText("Código de confirmación");
    expect(get).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith("/api/newsletter/request-withdrawal", {
      email: "persona@example.com",
    });
    fireEvent.change(code, { target: { value: "654321" } });
    post.mockResolvedValueOnce({
      data: { ok: true, status: "withdrawn", message: "Retiro confirmado." },
    });
    submit();
    expect(await screen.findByText("Retiro confirmado.")).toBeVisible();
    expect(post).toHaveBeenLastCalledWith("/api/newsletter/confirm", {
      email: "persona@example.com",
      code: "654321",
      intent: "withdraw",
    });
  });
  it("permite confirmar el código iniciado durante una compra desde Datos personales", async () => {
    render(<NewsletterForm management initialMode="withdraw" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar suscripción pendiente" }),
    );
    email("persona@example.com");
    fireEvent.change(screen.getByLabelText("Código de confirmación"), {
      target: { value: "123456" },
    });
    submit();
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/newsletter/confirm", {
        email: "persona@example.com",
        code: "123456",
        intent: "subscribe",
      }),
    );
  });
  it("un código inválido conserva el contacto y permite reintentar", async () => {
    render(<NewsletterForm initialMode="withdraw" />);
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar un código" }),
    );
    email("persona@example.com");
    fireEvent.change(screen.getByLabelText("Código de confirmación"), {
      target: { value: "000000" },
    });
    post.mockRejectedValueOnce({
      response: {
        data: { error: "NEWSLETTER_CODE_INVALID", message: "Código vencido." },
      },
    });
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Código vencido",
    );
    expect(
      screen.getByRole("textbox", { name: "Correo electrónico" }),
    ).toHaveValue("persona@example.com");
  });
  it("un cambio de política desmarca la autorización y exige volver a revisarla", async () => {
    render(<NewsletterForm />);
    await authorize();
    email("persona@example.com");
    get.mockResolvedValueOnce({
      data: {
        policy: {
          ...policy,
          version: "policy-2",
          text: "Nueva información de autorización.",
        },
      },
    });
    post.mockRejectedValueOnce({
      response: {
        data: {
          error: "NEWSLETTER_POLICY_CHANGED",
          message: "Revisa la información nueva.",
        },
      },
    });
    submit();
    expect(
      await screen.findByText("Nueva información de autorización."),
    ).toBeVisible();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Suscribirme" })).toBeDisabled();
  });
  it("la falta de información de la tienda bloquea la suscripción y conserva el retiro", async () => {
    get.mockResolvedValue({ data: { policy: { ...policy, ready: false } } });
    render(<NewsletterForm />);
    expect(
      await screen.findByText(/complete su información de privacidad/),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Suscribirme" })).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Dejar de recibir novedades" }),
    );
    expect(screen.getByRole("button", { name: "Enviar código" })).toBeEnabled();
  });
  it("la vista previa no carga datos ni envía correos", async () => {
    render(<NewsletterForm preview />);
    email("demo@example.com");
    submit();
    expect(await screen.findByRole("status")).toHaveTextContent("Vista previa");
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
  it("cambiar de operación no conserva una autorización marcada", async () => {
    render(<NewsletterForm />);
    await authorize();
    fireEvent.click(
      screen.getByRole("button", { name: "Dejar de recibir novedades" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Quiero suscribirme" }));
    expect(await screen.findByRole("checkbox")).not.toBeChecked();
  });
  it("Checkout obtiene la autorización opcional sin activarla ni enviar correo al marcarla", async () => {
    function Checkout() {
      const state = useCheckoutState();
      return <CheckoutContactSection state={state} />;
    }
    render(<Checkout />);
    const choice = await screen.findByRole("checkbox");
    expect(choice).not.toBeChecked();
    fireEvent.click(choice);
    expect(choice).toBeChecked();
    expect(post).not.toHaveBeenCalled();
  });
});
