import React from "react";
import EditorSection from "./EditorSection";
import { Input, Select, ColorInput, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import { serviceEditorSections } from "./serviceEditorFields";
import { SERVICE_PAGE_DEFINITIONS } from "../../../components/service-pages/servicePageConfig";
export default function ServiceAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
  configKey: customKey,
  sections: customSections,
  settingsHelp,
}) {
  const configKey = customKey || SERVICE_PAGE_DEFINITIONS[form.pageType].key;
  const config = form[configKey];
  const sections = customSections || serviceEditorSections(form.pageType);
  const patch = (scope, key, value) =>
    onChange((current) => {
      if (scope === "form")
        return {
          ...current,
          [key]: value,
          ...(["useHeader", "useFooter"].includes(key)
            ? {
                [configKey]: {
                  ...current[configKey],
                  [key === "useHeader" ? "showHeader" : "showFooter"]: value,
                },
              }
            : {}),
        };
      const cfg = current[configKey];
      return {
        ...current,
        [configKey]: ["presentation", "style"].includes(scope)
          ? { ...cfg, [scope]: { ...cfg[scope], [key]: value } }
          : {
              ...cfg,
              [key]: value,
              ...(key === "titleImage" && value ? { titleMode: "image" } : {}),
            },
      };
    });
  const render = (f) => {
    if (f.scope === "form" && f.key === "enabled" && String(form.systemRole || "").startsWith("consumer-")) return <p key="consumer-publication" className="text-sm">La información para el consumidor permanece publicada para conservar el acceso a sus condiciones y reclamos.</p>;
    if (f.customOnly && config.presentation.backgroundMode !== "custom")
      return null;
    const scope = f.scope || "config",
      value =
        scope === "form"
          ? form[f.key]
          : scope === "presentation"
            ? config.presentation[f.key]
            : scope === "style"
              ? config.style[f.key]
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
      {form.pageType === "returns-page" && topic === "settings" && (
        <p className="text-sm text-gray-600">
          La política de devoluciones se administra en{" "}
          <a className="underline" href="/admin/ordenes">
            Pedidos → Devoluciones → Política
          </a>
          . Este editor configura su presentación, sin cambiar los permisos ni
          los plazos.
        </p>
      )}
      {(sections[topic] || []).map(([title, fields]) => (
        <EditorSection
          key={title}
          title={title}
          text={
            topic === "settings"
              ? settingsHelp || "Desactivar el diseño personalizado recupera la apariencia predeterminada. La búsqueda y el acceso seguro a devoluciones siguen funcionando. Las políticas, estados y autorizaciones se gestionan en Pedidos."
              : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(render)}</div>
        </EditorSection>
      ))}
    </>
  );
}
