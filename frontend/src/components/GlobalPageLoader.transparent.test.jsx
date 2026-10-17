import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import GlobalPageLoader from "./GlobalPageLoader";

afterEach(cleanup);

describe("Loader público transparente", () => {
  it("muestra un espiral con corazón sobre la tienda sin fondo, tarjeta ni vidrio detrás del icono", () => {
    const { container } = render(<GlobalPageLoader visible config={{
      type: "ring", icon: "heart", showText: false,
      backgroundColor: "#ffffff", overlayOpacity: 100, visualStyle: "soft", shape: "square", shadow: "strong",
    }} />);
    const layer = screen.getByRole("status", { name: "Cargando tienda" });
    expect(layer).toHaveStyle({ background: "transparent" });
    expect(layer.querySelector(".storefront-loader-icon svg")).toBeInTheDocument();
    expect(layer.querySelector(".storefront-liquid-icon")).not.toBeInTheDocument();
    expect(layer.querySelector(".storefront-loader-icon").style.background).toBe("");
    expect(container.querySelector("[aria-busy=true]")).toBe(layer);
  });

  it("mantiene transparente la composición cuando hay una imagen subida", () => {
    render(<GlobalPageLoader visible config={{ logoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png", showLogo: true, icon: "heart", showText: false }} />);
    const layer = screen.getByRole("status", { name: "Cargando tienda" });
    expect(layer).toHaveStyle({ background: "transparent" });
    expect(layer.querySelector("img")).toHaveAttribute("src", "https://res.cloudinary.com/demo/image/upload/logo.png");
    expect(layer.querySelector(".storefront-loader-icon svg")).toBeInTheDocument();
    expect(layer.querySelector(".storefront-liquid-icon")).not.toBeInTheDocument();
  });
});
