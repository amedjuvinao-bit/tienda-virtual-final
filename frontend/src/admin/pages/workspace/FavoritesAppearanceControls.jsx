import React from "react";
import EditorSection from "./EditorSection";
import { Input, Select, ColorInput, Toggle } from "./ProductDetailEditorFields";
import AdminImageUploadField from "../../media/AdminImageUploadField";
import { favoriteEditorSections } from "./favoriteEditorFields";
export default function FavoritesAppearanceControls({
  form,
  onChange,
  topic,
  saving,
  onUploadingChange,
}) {
  const config = form.favoritesPageConfig;
  const patch = (scope, key, value) =>
    onChange((current) =>
      scope === "form"
        ? {
            ...current,
            [key]: value,
            ...(["useHeader", "useFooter"].includes(key)
              ? {
                  favoritesPageConfig: {
                    ...current.favoritesPageConfig,
                    content: {
                      ...current.favoritesPageConfig.content,
                      [key === "useHeader" ? "showHeader" : "showFooter"]:
                        value,
                    },
                  },
                }
              : {}),
          }
        : {
            ...current,
            favoritesPageConfig: {
              ...current.favoritesPageConfig,
              [scope]: {
                ...current.favoritesPageConfig[scope],
                [key]: value,
                ...(key === "titleImage" && value
                  ? { titleMode: "image" }
                  : {}),
              },
            },
          },
    );
  const field = (f) => {
    if (f.customOnly && config.presentation.backgroundMode !== "custom")
      return null;
    const value = f.scope === "form" ? form[f.key] : config[f.scope][f.key];
    const change = (value) => patch(f.scope, f.key, value);
    const key = `${f.scope}-${f.key}`;
    if (f.type === "image")
      return (
        <div className="sm:col-span-2" key={key}>
          <AdminImageUploadField
            label={f.label}
            value={value}
            disabled={saving}
            onChange={change}
            onBusyChange={(busy) => onUploadingChange(f.key, busy)}
          />
        </div>
      );
    if (f.type === "toggle")
      return (
        <Toggle key={key} label={f.label} checked={value} onChange={change} />
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
      {(favoriteEditorSections[topic] || []).map(([title, fields]) => (
        <EditorSection key={title} title={title}>
          <div className="grid gap-4 sm:grid-cols-2">{fields.map(field)}</div>
        </EditorSection>
      ))}
    </>
  );
}
