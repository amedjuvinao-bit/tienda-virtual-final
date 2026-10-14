import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SectionColorPicker from "./SectionColorPicker";
import { ColorField } from "./SectionsPanelUI";

afterEach(cleanup);

function EditableColor() {
  const [value, setValue] = useState("#d4af379f");
  return <SectionColorPicker label="Marco" value={value} onChange={setValue} />;
}

describe("paleta compacta de secciones", () => {
  it("conserva el color con transparencia y ofrece el espectro completo al abrirse", () => {
    render(<EditableColor />);
    const code = screen.getByRole("textbox", { name: "Marco: código hexadecimal" });
    expect(code).toHaveValue("#d4af379f");
    expect(screen.queryByRole("group", { name: "Gama frescos" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Paleta" }));
    expect(screen.getByRole("group", { name: "Gama frescos" })).toBeInTheDocument();
    const spectrum = screen.getByLabelText("Elegir Marco del espectro completo");
    expect(spectrum).toHaveValue("#d4af37");
    fireEvent.change(spectrum, { target: { value: "#2474ab" } });
    expect(code).toHaveValue("#2474ab");
    fireEvent.click(within(screen.getByRole("group", { name: "Gama frescos" })).getByRole("button", { name: "Usar color #0d9488" }));
    expect(code).toHaveValue("#0d9488");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("group", { name: "Gama frescos" })).not.toBeInTheDocument();
  });

  it("aplica la selección mediante el campo compartido sin perder el enlace al estado", () => {
    const onChange = vi.fn();
    render(<ColorField label="Texto" value="#ffffff" onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Texto: código hexadecimal" })).toHaveValue("#ffffff");
    fireEvent.click(screen.getByRole("button", { name: "Paleta" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar color #e11d48" }));
    expect(onChange).toHaveBeenCalledWith("#e11d48");
  });
});
