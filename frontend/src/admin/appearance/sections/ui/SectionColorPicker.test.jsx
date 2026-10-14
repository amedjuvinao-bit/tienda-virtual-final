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
  it("permite elegir cualquier tono, saturación y brillo sin perder la transparencia", () => {
    render(<EditableColor />);
    const code = screen.getByRole("textbox", { name: "Marco: código hexadecimal" });
    expect(code).toHaveValue("#d4af379f");
    expect(screen.queryByRole("group", { name: "Colores sugeridos" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Paleta" }));
    expect(screen.getByRole("group", { name: "Colores sugeridos" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider", { name: "Tono de Marco" }), { target: { value: "210" } });
    const area = screen.getByRole("group", { name: "Saturación y brillo de Marco" });
    area.getBoundingClientRect = () => ({ left: 10, top: 20, width: 200, height: 100 });
    fireEvent(area, new MouseEvent("pointerdown", { clientX: 210, clientY: 20, bubbles: true }));
    expect(code).toHaveValue("#007fff9f");
    fireEvent.click(within(screen.getByRole("group", { name: "Colores sugeridos" })).getByRole("button", { name: "Usar color #14b8a6" }));
    expect(code).toHaveValue("#14b8a69f");
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("group", { name: "Colores sugeridos" })).not.toBeInTheDocument();
  });

  it("aplica la selección mediante el campo compartido sin perder el enlace al estado", () => {
    const onChange = vi.fn();
    render(<ColorField label="Texto" value="#ffffff" onChange={onChange} />);
    expect(screen.getByRole("textbox", { name: "Texto: código hexadecimal" })).toHaveValue("#ffffff");
    fireEvent.click(screen.getByRole("button", { name: "Paleta" }));
    fireEvent.click(screen.getByRole("button", { name: "Usar color #f43f5e" }));
    expect(onChange).toHaveBeenCalledWith("#f43f5e");
  });

  it("cierra la paleta anterior al abrir otro campo", () => {
    render(<>
      <SectionColorPicker label="Texto" value="#ffffff" onChange={vi.fn()} />
      <SectionColorPicker label="Fondo" value="#000000" onChange={vi.fn()} />
    </>);
    fireEvent.click(screen.getByRole("button", { name: "Abrir paleta de Texto" }));
    expect(screen.getByRole("group", { name: "Saturación y brillo de Texto" })).toBeInTheDocument();
    const second = screen.getByRole("button", { name: "Abrir paleta de Fondo" });
    fireEvent.pointerDown(second);
    fireEvent.click(second);
    expect(screen.queryByRole("group", { name: "Saturación y brillo de Texto" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Saturación y brillo de Fondo" })).toBeInTheDocument();
  });
});
