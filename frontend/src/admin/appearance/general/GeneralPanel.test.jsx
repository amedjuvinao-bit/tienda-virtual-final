import React, { useState } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import GeneralPanel from "./GeneralPanel";
import WhatsAppButton from "../../../components/WhatsAppButton";
import ScrollButton from "../../../components/ScrollButton";
import GlobalPageLoader from "../../../components/GlobalPageLoader";

function Editor() {
  const [theme, setTheme] = useState({ global: {} });
  const setPath = (path, value) => {
    const [, tool, key] = path.split(".");
    setTheme((previous) => ({ global: { ...previous.global, [tool]: { ...previous.global[tool], [key]: value } } }));
  };
  return <GeneralPanel theme={theme} setPath={setPath} />;
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
    expect(screen.queryByRole("textbox", { name: "URL de imagen personalizada" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Usar imagen personalizada" }));
    expect(screen.getByRole("textbox", { name: "URL de imagen personalizada" })).toBeInTheDocument();
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

  it("usa el acabado de cristal en los tres componentes públicos", () => {
    const { container } = render(<>
      <WhatsAppButton config={{ phone: "573001234567" }} />
      <ScrollButton config={{ enabled: true }} />
      <GlobalPageLoader config={{ icon: "crown" }} visible />
    </>);
    expect(container.querySelector('a[aria-label="WhatsApp"]')).toHaveClass("storefront-liquid-icon");
    expect(container.querySelectorAll('button.storefront-liquid-icon')).toHaveLength(2);
    expect(container.querySelector("[aria-busy=true] .storefront-liquid-icon")).toBeInTheDocument();
  });

  it("mantiene visible el ícono elegido con todos los tipos de loader", () => {
    for (const type of ["spinner", "ring", "dual-ring", "dots", "bars", "pulse", "diamond", "orbit"]) {
      const { container, unmount } = render(<GlobalPageLoader config={{ type, icon: "crown" }} visible />);
      expect(container.querySelector("[aria-busy=true] .storefront-liquid-icon svg")).toBeInTheDocument();
      unmount();
    }
  });
});
