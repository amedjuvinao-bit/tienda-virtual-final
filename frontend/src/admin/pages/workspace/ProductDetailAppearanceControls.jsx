import React from "react";
import EditorSection from "./EditorSection";
import { applyContinuousProductDetailPreset } from "../../../components/product-detail/productDetailPresentation";
const Field = ({ label, children }) => {
  const id = React.useId();
  return (
    <label className="block min-w-0" htmlFor={id}>
      <span className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </span>
      {React.cloneElement(children, { id, "aria-label": label })}
    </label>
  );
};
const inputClass =
  "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800";
export default function ProductDetailAppearanceControls({ config, onChange }) {
  const presentation = config.presentation;
  const update = (patch) =>
    onChange({ ...config, presentation: { ...presentation, ...patch } });
  const style = (patch) =>
    onChange({ ...config, style: { ...config.style, ...patch } });
  const number = (key, label, min, max, step = 1) => (
    <Field label={label}>
      <input
        className={inputClass}
        type="number"
        min={min}
        max={max}
        step={step}
        value={presentation[key]}
        onChange={(event) => update({ [key]: Number(event.target.value) })}
      />
    </Field>
  );
  const text = (key, label) => (
    <Field label={label}>
      <input
        className={inputClass}
        value={presentation[key]}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </Field>
  );
  const toggle = (key, label) => (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-3 py-3 text-sm">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={presentation[key]}
        onChange={(event) => update({ [key]: event.target.checked })}
      />
    </label>
  );
  return (
    <div className="grid gap-5">
      <EditorSection
        title="Fondo y composición"
        text="Marco continuo con el mismo fondo de Inicio y el catálogo. Puedes usar una imagen propia."
      >
        <div className="mb-5 rounded-xl border border-pink-200 p-4">
          <p className="mb-3 text-sm text-gray-600">
            Recupera la paleta y las proporciones del diseño aprobado. Conserva
            los textos y las opciones de compra.
          </p>
          <button
            type="button"
            className="pages-button"
            onClick={() => onChange(applyContinuousProductDetailPreset(config))}
          >
            Aplicar diseño aprobado
          </button>
        </div>
        <Field label="Origen del fondo">
          <select
            className={inputClass}
            value={presentation.backgroundMode}
            onChange={(event) => update({ backgroundMode: event.target.value })}
          >
            <option value="continuity">Heredar fondo continuo de Inicio</option>
            <option value="custom">Fondo propio</option>
          </select>
        </Field>
        {presentation.backgroundMode === "custom" && (
          <div className="mt-4 grid gap-4">
            {text("backgroundImage", "Imagen de fondo (enlace)")}
            {text("mobileBackgroundImage", "Imagen de fondo móvil (opcional)")}
            <Field label="Color de fondo">
              <input
                className={inputClass}
                type="color"
                value={config.style.pageBg}
                onChange={(event) => style({ pageBg: event.target.value })}
              />
            </Field>
          </div>
        )}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {number("maxWidth", "Ancho de la página (px)", 960, 1760, 20)}
          {number("galleryPercent", "Espacio de la galería (%)", 40, 62)}
        </div>
      </EditorSection>
      <EditorSection
        title="Textura y borde del cristal"
        text="El reflejo sigue el perímetro. La transparencia y el desenfoque afectan la superficie interior."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Color del cristal">
            <input
              className={inputClass}
              type="color"
              value={config.style.cardBg}
              onChange={(event) => style({ cardBg: event.target.value })}
            />
          </Field>
          <Field label="Color del reflejo">
            <input
              className={inputClass}
              type="color"
              value={config.style.borderColor}
              onChange={(event) => style({ borderColor: event.target.value })}
            />
          </Field>
          {number("glassOpacity", "Intensidad del color (0–0,8)", 0, 0.8, 0.01)}
          {number("glassBlur", "Desenfoque del cristal (px)", 0, 24)}
          {number("reflection", "Brillo del borde (0–1)", 0, 1, 0.05)}
          <Field label="Grosor del borde (px)">
            <input
              className={inputClass}
              type="number"
              min="0"
              max="4"
              step="0.25"
              value={config.style.borderWidthPx}
              onChange={(event) =>
                style({ borderWidthPx: Number(event.target.value) })
              }
            />
          </Field>
          <Field label="Radio del marco (px)">
            <input
              className={inputClass}
              type="number"
              min="8"
              max="40"
              value={config.style.radiusPx}
              onChange={(event) =>
                style({ radiusPx: Number(event.target.value) })
              }
            />
          </Field>
        </div>
      </EditorSection>
      <EditorSection
        title="Pestañas y navegación"
        text="Ajusta los nombres de las pestañas y el enlace para volver a tu catálogo."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {toggle("showDescription", "Mostrar descripción")}
          {toggle("showRatingSummary", "Mostrar resumen de valoraciones")}
          {text("descriptionLabel", "Nombre de la pestaña descripción")}
          {text("deliveryLabel", "Nombre de la pestaña entrega")}
          {text("deliverySummary", "Información de entrega por defecto")}
          {text("reviewsLabel", "Nombre de la pestaña reseñas")}
          {text("catalogLabel", "Texto del enlace al catálogo")}
          {text("catalogPath", "Dirección del catálogo")}
        </div>
      </EditorSection>
      <EditorSection
        title="Productos relacionados"
        text="Se muestran productos publicados de la misma categoría. Si no hay resultados, el bloque se oculta."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {toggle("showRelated", "Mostrar productos relacionados")}
          {text("relatedTitle", "Título de productos relacionados")}
          {number("relatedCount", "Cantidad de productos relacionados", 2, 6)}
        </div>
      </EditorSection>
    </div>
  );
}
