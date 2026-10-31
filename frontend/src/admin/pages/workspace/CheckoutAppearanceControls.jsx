import React from "react";
import EditorSection from "./EditorSection";
import { Input, Select, ColorInput, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import { checkoutEditorSections } from "./checkoutEditorFields";
export default function CheckoutAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const config = form.checkoutPageConfig;
  const patch = (scope, key, value) =>
    onChange((current) => {
      if (scope === "form")
        return {
          ...current,
          [key]: value,
          ...(["useHeader", "useFooter"].includes(key)
            ? {
                checkoutPageConfig: {
                  ...current.checkoutPageConfig,
                  [key === "useHeader" ? "showHeader" : "showFooter"]: value,
                },
              }
            : {}),
        };
      const cfg = current.checkoutPageConfig;
      return {
        ...current,
        checkoutPageConfig: ["presentation", "style", "slider"].includes(scope)
          ? { ...cfg, [scope]: { ...cfg[scope], [key]: value } }
          : {
              ...cfg,
              [key]: value,
              ...(key === "titleImage" && value ? { titleMode: "image" } : {}),
            },
      };
    });
  const render = (f) => {
    if (f.customOnly && config.presentation.backgroundMode !== "custom")
      return null;
    const scope = f.scope || "config",
      value =
        scope === "form"
          ? form[f.key]
          : ["presentation", "style", "slider"].includes(scope)
            ? config[scope][f.key]
            : config[f.key];
    const change = (value) => patch(scope, f.key, value),
      key = scope + "-" + f.key;
    if (f.type === "image")
      return (
        <div key={key} className="sm:col-span-2">
          <AdminImageUploadField
            label={f.label}
            value={value}
            disabled={saving}
            onChange={change}
            onBusyChange={(busy) => onUploadingChange(key, busy)}
          />
        </div>
      );
    if (f.type === "color")
      return (
        <ColorInput
          key={key}
          label={f.label}
          value={value}
          onChange={(event) => change(event.target.value)}
        />
      );
    if (f.type === "toggle")
      return (
        <Toggle key={key} label={f.label} checked={value} onChange={change} />
      );
    if (f.type === "select")
      return (
        <Select
          key={key}
          label={f.label}
          value={value}
          onChange={(event) => change(event.target.value)}
        >
          {f.options.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      );
    if (f.type === "textarea")
      return (
        <label key={key} className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            {f.label}
          </span>
          <textarea
            aria-label={f.label}
            rows={4}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800"
            value={value}
            onChange={(event) => change(event.target.value)}
          />
        </label>
      );
    return (
      <Input
        key={key}
        label={f.label}
        type={f.type === "number" ? "number" : "text"}
        min={f.min}
        max={f.max}
        step={f.step}
        value={value}
        readOnly={f.type === "readonly"}
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
  return (
    <>
      {(checkoutEditorSections[topic] || []).map(([title, fields]) => (
        <EditorSection
          key={title}
          title={title}
          text={
            topic === "settings"
              ? "Al desactivar el diseño personalizado se usa la presentación básica. Los precios, descuentos, envío y disponibilidad siempre se verifican con el servidor."
              : topic === "content"
                ? "Personaliza el encabezado y la navegación de la compra."
                : topic === "visibility"
                  ? "Los campos necesarios para crear el pedido permanecen disponibles, aunque ocultes los títulos de contacto o entrega."
                  : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(render)}</div>
        </EditorSection>
      ))}
    </>
  );
}
