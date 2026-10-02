import React, { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import GeneralPanel from "./GeneralPanel";
import WhatsAppButton from "../../../components/WhatsAppButton";
import ScrollButton from "../../../components/ScrollButton";
import GlobalPageLoader from "../../../components/GlobalPageLoader";

function Editor({ onUpload = async () => "https://res.cloudinary.com/demo/image/upload/boton.webp" }) {
  const [theme, setTheme] = useState({ global: {} });
  const [uploading, setUploading] = useState(false);
  const setPath = (path, value) => {
    const [, tool, key] = path.split(".");
    setTheme((previous) => ({ global: { ...previous.global, [tool]: { ...previous.global[tool], [key]: value } } }));
  };
  return <GeneralPanel theme={theme} setPath={setPath} uploading={uploading} setUploading={setUploading} uploadToCloudinaryViaBackend={onUpload} />;
}

afterEach(cleanup);

describe("herramientas de Apariencia", () => {
  it("muestra los tres procesos y refleja el contacto de WhatsApp en la vista previa", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    expect(screen.getByRole("button", { name: /WhatsApp Contacto y botón flotante/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Navegación Subir y bajar/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Loader Pantalla de carga/ })).toBeInTheDocument();
    expect(screen.getByText("Añade un número para que el botón aparezca en la tienda.")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Número de WhatsApp" }), "573001234567");
    expect(screen.getByText("El botón abre el chat con el número configurado.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    expect(screen.queryByLabelText("Seleccionar imagen para Botón de WhatsApp")).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    expect(screen.getByLabelText("Seleccionar imagen para Botón de WhatsApp")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /URL de imagen/ })).not.toBeInTheDocument();
  });

  it("sube las imágenes de los tres procesos a Cloudinary y muestra el resultado", async () => {
    const user = userEvent.setup();
    const upload = vi.fn(async () => "https://res.cloudinary.com/demo/image/upload/boton.webp");
    const file = new File(["imagen"], "boton.png", { type: "image/png" });
    render(<Editor onUpload={upload} />);

    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Botón de WhatsApp"), file);
    expect(await screen.findByText(/Imagen subida.*Guardar cambios/)).toBeInTheDocument();
    expect(screen.getByAltText("Imagen de Botón de WhatsApp")).toHaveAttribute("src", "https://res.cloudinary.com/demo/image/upload/boton.webp");

    await user.click(screen.getByRole("button", { name: /Navegación Subir y bajar/ }));
    await user.click(screen.getByRole("button", { name: "Botón subir" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada en botón subir" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Botón subir"), file);
    expect(await screen.findByAltText("Imagen de Botón subir")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Botón bajar" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada en botón bajar" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Botón bajar"), file);
    expect(await screen.findByAltText("Imagen de Botón bajar")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Loader Pantalla de carga/ }));
    await user.click(screen.getByRole("checkbox", { name: "Añadir mi imagen transparente" }));
    await user.click(screen.getByRole("button", { name: "Identidad" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Imagen transparente del Loader"), file);
    expect(await screen.findByAltText("Imagen de Imagen transparente del Loader")).toBeInTheDocument();
    expect(upload).toHaveBeenCalledTimes(4);
    expect(upload).toHaveBeenCalledWith(file, "image");
  });

  it("mantiene la imagen anterior y avisa cuando Cloudinary falla", async () => {
    const user = userEvent.setup();
    const upload = vi.fn().mockRejectedValue(new Error("Cloudinary no disponible"));
    render(<Editor onUpload={upload} />);
    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Botón de WhatsApp"), new File(["x"], "boton.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Cloudinary no disponible");
    expect(screen.queryByAltText("Imagen de Botón de WhatsApp")).not.toBeInTheDocument();
  });

  it("rechaza archivos que no son imágenes antes de enviarlos", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const upload = vi.fn();
    render(<Editor onUpload={upload} />);
    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    await user.upload(screen.getByLabelText("Seleccionar imagen para Botón de WhatsApp"), new File(["x"], "archivo.txt", { type: "text/plain" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Elige una imagen PNG, JPG o WebP.");
    expect(upload).not.toHaveBeenCalled();
  });

  it("permite apagar navegación y elegir un ícono con el mismo acabado visual", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: /Navegación Subir y bajar/ }));
    await user.click(screen.getByRole("checkbox", { name: "Mostrar botones de navegación" }));
    expect(screen.getByText("La navegación está apagada en la tienda.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Loader Pantalla de carga/ }));
    await user.click(screen.getByRole("button", { name: "Identidad" }));
    const icons = screen.getByRole("group", { name: "Ícono visual del Loader" });
    expect(within(icons).getAllByRole("button")).toHaveLength(8);
    await user.click(within(icons).getByRole("button", { name: "Corona" }));
    expect(within(icons).getByRole("button", { name: "Corona" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Vista previa de la herramienta").querySelector(".appearance-general__preview-loader-icon")).toBeInTheDocument();
  });

  it("usa cristal en los botones y deja el icono del Loader sin parche", () => {
    const { container } = render(<>
      <WhatsAppButton config={{ phone: "573001234567" }} />
      <ScrollButton config={{ enabled: true }} />
      <GlobalPageLoader config={{ icon: "crown" }} visible />
    </>);
    const whatsappButton = container.querySelector('a[aria-label="WhatsApp"]');
    expect(whatsappButton).toHaveClass("storefront-liquid-icon");
    expect(whatsappButton).toHaveAttribute("href", "https://wa.me/573001234567");
    expect(whatsappButton).toHaveStyle({ position: "fixed", bottom: "24px", right: "24px" });
    expect(container.querySelector('a[aria-label="WhatsApp"] svg')).toBeInTheDocument();
    expect(container.querySelectorAll('button.storefront-liquid-icon')).toHaveLength(2);
    const loader = container.querySelector("[aria-busy=true]");
    expect(loader.style.background).toBe("transparent");
    expect(loader.querySelector(".storefront-loader-icon")).toBeInTheDocument();
    expect(loader.querySelector(".storefront-liquid-icon")).not.toBeInTheDocument();
  });

  it("deja solo la imagen transparente de WhatsApp y permite ampliarla desde el panel", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(screen.getByRole("button", { name: "Estilo" }));
    await user.click(screen.getByRole("checkbox", { name: "Mostrar fondo de cristal" }));
    const preview = screen.getByLabelText("Vista previa de la herramienta").querySelector(".appearance-general__preview-float");
    expect(preview).toHaveClass("appearance-general__preview-float--plain");
    expect(preview).not.toHaveClass("storefront-liquid-icon");
    expect(preview).toHaveStyle({ width: "90px", height: "90px" });
    await user.click(screen.getByRole("button", { name: "Imagen y animación" }));
    const size = screen.getByRole("spinbutton", { name: "Tamaño visible de la imagen (px)" });
    await user.clear(size);
    await user.type(size, "112");
    expect(preview).toHaveStyle({ width: "112px", height: "112px" });
    expect(screen.queryByRole("spinbutton", { name: "Tamaño del ícono interno (%)" })).not.toBeInTheDocument();
  });

  it("muestra la imagen de WhatsApp sin círculo ni borde y conserva el enlace", () => {
    const { container } = render(<WhatsAppButton config={{ phone: "573001234567", showBackground: false, useCustomImage: true,
      imageUrl: "https://res.cloudinary.com/demo/image/upload/boton.png", sizePx: 112, borderWidthPx: 8, shadow: "strong" }} />);
    const button = container.querySelector('a[aria-label="WhatsApp"]');
    expect(button).toHaveAttribute("href", "https://wa.me/573001234567");
    expect(button).toHaveClass("whatsapp-button--plain");
    expect(button).not.toHaveClass("storefront-liquid-icon");
    expect(button).toHaveStyle({ width: "112px", height: "112px", boxShadow: "none" });
    expect(button.style.border).toContain("0");
    expect(button.querySelector("img")).toHaveStyle({ width: "112px", height: "112px" });
  });

  it("permite editar el saludo visible en la vista previa, independiente del texto del chat", async () => {
    const user = userEvent.setup();
    render(<Editor />);
    const greeting = screen.getByRole("textbox", { name: "Saludo al pasar el cursor" });
    expect(greeting).toHaveValue("¡Hola! ¿En qué podemos ayudarte?");
    await user.clear(greeting);
    await user.type(greeting, "¡Hola! Te ayudamos a elegir tu look.");
    expect(screen.getByText("¡Hola! Te ayudamos a elegir tu look.")).toHaveClass("appearance-general__preview-greeting");
    expect(screen.getByRole("textbox", { name: "Mensaje predeterminado" })).toHaveValue("");
    await user.clear(greeting);
    expect(screen.queryByText("¡Hola! Te ayudamos a elegir tu look.")).not.toBeInTheDocument();
  });

  it("muestra el saludo junto al botón al pasar el cursor o enfocar y permite ocultarlo", () => {
    const { container, rerender } = render(<WhatsAppButton config={{ phone: "573001234567", greeting: "¡Hola! Escríbenos", message: "Quiero comprar" }} />);
    const button = screen.getByRole("link", { name: "WhatsApp" });
    const greeting = screen.getByRole("tooltip");
    expect(button).toHaveAttribute("aria-describedby", greeting.id);
    expect(greeting).toHaveTextContent("¡Hola! Escríbenos");
    expect(button.nextElementSibling).toBe(greeting);
    expect(button).toHaveAttribute("href", "https://wa.me/573001234567?text=Quiero%20comprar");
    rerender(<WhatsAppButton config={{ phone: "573001234567", greeting: "" }} />);
    expect(container.querySelector('[role="tooltip"]')).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "WhatsApp" })).not.toHaveAttribute("aria-describedby");
  });

  it("mantiene visible el ícono elegido con todos los tipos de loader", () => {
    for (const type of ["spinner", "ring", "dual-ring", "dots", "bars", "pulse", "diamond", "orbit"]) {
      const { container, unmount } = render(<GlobalPageLoader config={{ type, icon: "crown" }} visible />);
      expect(container.querySelector("[aria-busy=true] .storefront-loader-icon svg")).toBeInTheDocument();
      unmount();
    }
  });
});
