import React from "react";
import EditorSection from "./EditorSection";
import { Input, Select, ColorInput, Toggle } from "./ProductDetailEditorFields";
import { cartEditorFields } from "./cartEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
const captions = {
  colors: "Colores del carrito",
  dimensions: "Medidas y formas",
  header: "Encabezado del carrito",
  texts: "Textos y navegación",
  visibility: "Elementos visibles",
  settings: "Configuración de la página",
};
export default function CartAppearanceControls({
  form,
  onChange,
  topic,
  onUploadingChange,
  saving,
}) {
  const config = form.cartPageConfig;
  const patch = (scope, key, value) =>
    onChange((current) =>
      scope === "form"
        ? {
            ...current,
            [key]: value,
            ...(["useHeader", "useFooter"].includes(key)
              ? {
                  cartPageConfig: {
                    ...current.cartPageConfig,
                    [key === "useHeader" ? "showHeader" : "showFooter"]: value,
                  },
                }
              : {}),
          }
        : {
            ...current,
            cartPageConfig:
              scope === "config"
                ? {
                    ...current.cartPageConfig,
                    [key]: value,
                    ...(key === "titleImage" && value
                      ? { titleMode: "image" }
                      : {}),
                  }
                : {
                    ...current.cartPageConfig,
                    [scope]: { ...current.cartPageConfig[scope], [key]: value },
                  },
          },
    );
  const field = (f) => {
    const value =
      f.scope === "form"
        ? form[f.key]
        : f.scope === "config"
          ? config[f.key]
          : config[f.scope][f.key];
    const change = (value) => patch(f.scope, f.key, value);
    if (f.type === "toggle")
      return (
        <Toggle
          key={`${f.scope}-${f.key}`}
          label={f.label}
          checked={value}
          onChange={change}
        />
      );
    if (f.type === "color")
      return (
        <ColorInput
          key={`${f.scope}-${f.key}`}
          label={f.label}
          value={value}
          onChange={(event) => change(event.target.value)}
        />
      );
    if (f.type === "select")
      return (
        <Select
          key={`${f.scope}-${f.key}`}
          label={f.label}
          value={value}
          onChange={(event) => change(event.target.value)}
        >
          {f.options.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </Select>
      );
    return (
      <Input
        key={`${f.scope}-${f.key}`}
        label={f.label}
        value={value}
        type={f.type}
        min={f.min}
        max={f.max}
        disabled={f.scope === "form" && ["name", "slug"].includes(f.key)}
        onChange={(event) =>
          change(
            f.type === "number" && event.target.value !== ""
              ? Number(event.target.value)
              : event.target.value,
          )
        }
      />
    );
  };
  const upload = (label, key, scope = "config") => (
    <AdminImageUploadField
      label={label}
      value={scope === "config" ? config[key] : config[scope][key]}
      disabled={saving}
      onChange={(url) => patch(scope, key, url)}
      onBusyChange={(busy) => onUploadingChange(key, busy)}
    />
  );
  if (topic === "background")
    return (
      <>
        <EditorSection
          title="Fondo de la página"
          text="Continúa el fondo de Inicio o carga imágenes propias para escritorio y móvil."
        >
          <Select
            label="Origen del fondo"
            value={config.presentation.backgroundMode}
            onChange={(event) =>
              patch("presentation", "backgroundMode", event.target.value)
            }
          >
            <option value="continuity">Fondo continuo de Inicio</option>
            <option value="custom">Fondo propio</option>
          </Select>
          {config.presentation.backgroundMode === "custom" && (
            <div className="mt-4 grid gap-4">
              {upload("Imagen de fondo", "backgroundImage", "presentation")}
              {upload(
                "Imagen de fondo móvil",
                "mobileBackgroundImage",
                "presentation",
              )}
            </div>
          )}
        </EditorSection>
        <EditorSection
          title="Material de cristal"
          text="El brillo sigue el borde y conserva el fondo visible en el centro."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["glassOpacity", "Opacidad del cristal", 0, 0.8, 0.01],
              ["glassBlur", "Desenfoque del cristal", 0, 24, 1],
              ["borderWidth", "Grosor del borde", 0, 4, 0.25],
              ["reflection", "Intensidad del brillo", 0, 1, 0.05],
            ].map(([key, label, min, max, step]) => (
              <Input
                key={key}
                label={label}
                type="number"
                min={min}
                max={max}
                step={step}
                value={config.presentation[key]}
                onChange={(event) =>
                  patch(
                    "presentation",
                    key,
                    event.target.value === "" ? "" : Number(event.target.value),
                  )
                }
              />
            ))}
          </div>
        </EditorSection>
      </>
    );
  let groups;
  if (topic === "drawer")
    groups = [
      "Fondo del modal",
      "Panel lateral",
      "Elementos internos",
      "Imágenes y tamaños",
    ].map((section) => [
      section,
      cartEditorFields.filter(
        (f) => f.group === topic && f.section === section,
      ),
    ]);
  else if (topic === "colors")
    groups = [
      [
        "Superficie y texto",
        cartEditorFields.filter(
          (f) =>
            f.group === topic &&
            [
              "pageBg",
              "cardBg",
              "cardBorderColor",
              "textPrimaryColor",
              "textSecondaryColor",
              "accentColor",
              "titleTextColor",
            ].includes(f.key),
        ),
      ],
      [
        "Compra y cantidades",
        cartEditorFields.filter(
          (f) => f.group === topic && /quantity|checkout|subtotal/i.test(f.key),
        ),
      ],
      [
        "Rutas y etiquetas",
        cartEditorFields.filter(
          (f) => f.group === topic && /breadcrumb|table/i.test(f.key),
        ),
      ],
    ];
  else
    groups = [
      [captions[topic], cartEditorFields.filter((f) => f.group === topic)],
    ];
  return (
    <>
      {groups.map(([title, fields]) => (
        <EditorSection title={title} key={title}>
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(field)}</div>
          {topic === "header" && (
            <div className="mt-4">
              {upload("Imagen del título", "titleImage")}
            </div>
          )}
        </EditorSection>
      ))}
    </>
  );
}
