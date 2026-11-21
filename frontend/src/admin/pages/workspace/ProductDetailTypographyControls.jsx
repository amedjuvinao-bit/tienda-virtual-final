import React from "react";
import EditorSection from "./EditorSection";
import { Input, Select } from "./ProductDetailEditorFields";
import { PRODUCT_DETAIL_FONT_OPTIONS } from "../../../components/product-detail/productDetailTypography";
export default function ProductDetailTypographyControls({ style, onChange }) {
  return (
    <div className="grid gap-5">
      {[
        { title: "Título del producto", key: "title", min: 20, max: 52 },
        { title: "Precio del producto", key: "price", min: 20, max: 48 },
      ].map(({ title, key, min, max }) => (
        <EditorSection
          key={key}
          title={title}
          text="Elige una fuente disponible o hereda la tipografía del sitio."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label={`Tipografía del ${key === "title" ? "título" : "precio"}`}
              value={style[`${key}FontFamily`]}
              onChange={(event) =>
                onChange({ [`${key}FontFamily`]: event.target.value })
              }
            >
              {PRODUCT_DETAIL_FONT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Input
              label={`Tamaño ${key === "title" ? "título" : "precio"} (px)`}
              type="number"
              min={min}
              max={max}
              value={style[`${key}SizePx`]}
              onChange={(event) => {
                const value = Number(event.target.value);
                onChange({
                  [`${key}SizePx`]: Math.max(min, Math.min(max, value)),
                });
              }}
            />
          </div>
        </EditorSection>
      ))}
    </div>
  );
}
