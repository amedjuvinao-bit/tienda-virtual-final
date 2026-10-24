import React, { useId, useState } from "react";
import CatalogPresentationControls, {
  TopicTabs,
} from "./CatalogPresentationControls";
import { catalogAppearanceFields } from "./catalogAppearanceFields";
import { CATALOG_APPEARANCE_SECTIONS } from "./catalogAppearanceSections";
import "./catalogAppearance.css";

function SettingField({ field, value, onChange }) {
  const id = useId();
  const { key, label, type, min, max, step, options } = field;
  const change = (event) => {
    const raw = event.target.value;
    onChange({
      [key]:
        type === "boolean"
          ? event.target.checked
          : type === "number" && raw !== ""
            ? Math.max(min, Math.min(max, Number(raw)))
            : raw,
    });
  };
  return (
    <div
      className={`catalog-appearance-field${type === "boolean" ? " catalog-appearance-field--toggle" : ""}`}
    >
      <label htmlFor={id}>{label}</label>
      {type === "boolean" ? (
        <input
          id={id}
          type="checkbox"
          checked={!!value[key]}
          onChange={change}
        />
      ) : type === "select" ? (
        <select id={id} value={value[key] ?? ""} onChange={change}>
          {options.map(([key, title]) => (
            <option key={key} value={key}>
              {title}
            </option>
          ))}
        </select>
      ) : type === "color" ? (
        <div className="catalog-appearance-color">
          <input
            type="color"
            aria-label={`Elegir ${label.toLowerCase()}`}
            value={
              /^#[\da-f]{6}$/i.test(value[key] || "") ? value[key] : "#ffffff"
            }
            onChange={change}
          />
          <input
            id={id}
            value={value[key] ?? ""}
            onChange={change}
            spellCheck={false}
          />
        </div>
      ) : type === "text" ? (
        <textarea id={id} value={value[key] ?? ""} onChange={change} rows={2} />
      ) : (
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={step}
          value={value[key] ?? ""}
          onChange={change}
        />
      )}
    </div>
  );
}

export default function CatalogAppearancePanel({
  section,
  config,
  onChange,
  content,
  onApplyPreset,
  onRestore,
  onUploadingChange,
}) {
  const definition = CATALOG_APPEARANCE_SECTIONS[section],
    id = useId();
  const [selected, setSelected] = useState(definition.tabs[0].id);
  const active = definition.tabs.some((tab) => tab.id === selected)
    ? selected
    : definition.tabs[0].id;
  return (
    <section
      className="catalog-appearance-panel"
      aria-labelledby={`${id}-title`}
    >
      <header className="catalog-appearance-heading">
        <h2 id={`${id}-title`}>{definition.title}</h2>
        <p>{definition.description}</p>
      </header>
      {definition.tabs.length > 1 && (
        <TopicTabs
          items={definition.tabs}
          selected={active}
          onSelect={setSelected}
          id={id}
          label={`Apartados de ${definition.title.toLowerCase()}`}
        />
      )}
      {definition.tabs.map((tab) => (
        <div
          key={tab.id}
          id={`${id}-panel-${tab.id}`}
          role={definition.tabs.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={
            definition.tabs.length > 1 ? `${id}-tab-${tab.id}` : undefined
          }
          hidden={active !== tab.id}
        >
          {tab.content && (
            <div className="catalog-appearance-content">{content}</div>
          )}
          {tab.blocks?.map((block, index) =>
            block.kind === "presets" ? (
              <div key="presets" className="catalog-appearance-presets">
                <p>
                  Estos estilos cambian varios ajustes del diseño. Revisa el
                  resultado en la vista previa antes de guardar.
                </p>
                <CatalogPresentationControls
                  value={config.presentation}
                  onChange={(patch) => onChange("presentation", patch)}
                  fieldKeys={[]}
                  showPalette
                />
                <fieldset className="catalog-appearance-group">
                  <legend>Estilo de Inicio</legend>
                  <p>
                    Coordina los bordes y la presentación del catálogo con el
                    estilo de Inicio.
                  </p>
                  <button type="button" onClick={onApplyPreset}>
                    Aplicar bordes de Inicio
                  </button>
                </fieldset>
                {config.visualBackup && (
                  <fieldset className="catalog-appearance-group">
                    <legend>Personalización anterior</legend>
                    <p>
                      Recupera el diseño guardado antes de aplicar el estilo
                      predefinido.
                    </p>
                    <button type="button" onClick={onRestore}>
                      Recuperar personalización anterior
                    </button>
                  </fieldset>
                )}
              </div>
            ) : (
              <fieldset
                className="catalog-appearance-group"
                key={block.title || index}
              >
                <legend>{block.title}</legend>
                {block.scope === "presentation" ? (
                  <CatalogPresentationControls
                    value={config.presentation}
                    onChange={(patch) => onChange("presentation", patch)}
                    fieldKeys={block.keys}
                    showBackgroundImage={block.backgroundImage}
                    onUploadingChange={
                      block.backgroundImage ? onUploadingChange : undefined
                    }
                  />
                ) : (
                  <div className="catalog-appearance-fields">
                    {block.keys
                      .map((key) =>
                        catalogAppearanceFields.get(`${block.scope}.${key}`),
                      )
                      .filter(
                        (field) =>
                          field &&
                          (field.key !== "imageRadiusPx" ||
                            config.presentation.layout !== "glass-grid"),
                      )
                      .map((field) => (
                        <SettingField
                          key={field.key}
                          field={field}
                          value={
                            block.scope === "catalog"
                              ? config
                              : config[block.scope]
                          }
                          onChange={(patch) => onChange(block.scope, patch)}
                        />
                      ))}
                  </div>
                )}
              </fieldset>
            ),
          )}
        </div>
      ))}
    </section>
  );
}
