import React from "react";
import EditorSection from "./EditorSection";
import { Input, Select, Toggle } from "./ProductDetailEditorFields";
const favoriteIcons = [
  ["heart", "Corazón"],
  ["star", "Estrella"],
  ["sparkles", "Destello"],
];
const cartIcons = [
  ["shopping-bag", "Bolsa"],
  ["shopping-cart", "Carrito clásico"],
  ["bag-heart", "Bolsa con corazón"],
];
const animations = [
  ["none", "Sin animación"],
  ["fade-up", "Aparecer hacia arriba"],
  ["fade-right", "Aparecer desde izquierda"],
  ["fade-left", "Aparecer desde derecha"],
  ["zoom-in", "Zoom de entrada"],
];
const options = (list) =>
  list.map(([value, label]) => (
    <option value={value} key={value}>
      {label}
    </option>
  ));
export default function ProductDetailPurchaseControls({ config, onChange }) {
  const toggle = (key, label) => (
    <Toggle
      label={label}
      checked={config[key]}
      onChange={(value) => onChange({ [key]: value })}
    />
  );
  return (
    <div className="grid gap-5">
      <EditorSection
        title="Precio y opciones del producto"
        text="El precio, los atributos y el stock se administran desde Productos. Aquí eliges qué mostrar."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {toggle("showPrice", "Mostrar precio")}
          {toggle("showOriginalPrice", "Mostrar precio original")}
          {toggle("showSizes", "Mostrar tamaños")}
          {toggle("showColors", "Mostrar colores")}
          {toggle("showQuantity", "Mostrar cantidad")}
        </div>
        <div className="mt-4">
          <Select
            label="Animación de entrada del contenido"
            value={config.contentAnimation}
            onChange={(event) =>
              onChange({ contentAnimation: event.target.value })
            }
          >
            {options(animations)}
          </Select>
        </div>
      </EditorSection>
      <EditorSection
        title="Botón de compra"
        text="Configura el botón para productos disponibles. Cuando no hay stock, se muestra el estado Agotado."
      >
        {toggle("showAddToCart", "Mostrar botón de compra")}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Input
            label="Texto del botón de compra"
            value={config.addToCartText}
            onChange={(event) =>
              onChange({ addToCartText: event.target.value })
            }
          />
          <Select
            label="Icono del botón de compra"
            value={config.addToCartIconName}
            onChange={(event) =>
              onChange({ addToCartIconName: event.target.value })
            }
          >
            {options(cartIcons)}
          </Select>
        </div>
      </EditorSection>
      <EditorSection
        title="Favoritos"
        text="Visibilidad e icono del favorito. Sus colores se ajustan en Colores y botones."
      >
        {toggle("showFavoriteButton", "Mostrar botón favorito")}
        <div className="mt-4">
          <Select
            label="Icono de favorito"
            value={config.favoriteIconName}
            onChange={(event) =>
              onChange({ favoriteIconName: event.target.value })
            }
          >
            {options(favoriteIcons)}
          </Select>
        </div>
      </EditorSection>
      <EditorSection
        title="Recogida en tienda"
        text="Textos y visibilidad de la información de recogida."
      >
        {toggle("showPickupBlock", "Mostrar bloque de recogida")}
        <div className="mt-4 grid gap-4">
          <Input
            label="Título recogida"
            value={config.pickupTitle}
            onChange={(event) => onChange({ pickupTitle: event.target.value })}
          />
          <Input
            label="Texto secundario"
            value={config.pickupText}
            onChange={(event) => onChange({ pickupText: event.target.value })}
          />
          <Input
            label="Texto del enlace de recogida"
            value={config.pickupLinkText}
            onChange={(event) =>
              onChange({ pickupLinkText: event.target.value })
            }
          />
        </div>
      </EditorSection>
    </div>
  );
}
