// src/admin/appearance/sections/info/infoSectionUI.jsx

import React, { useMemo, useState } from "react";
import { Field, Input, Toggle } from "../ui/UiComponents";
import { ColorField } from "../ui/SectionsPanelUI";
import {
  normalizeInfoSection,
  INFO_SECTION_ID,
  INFO_GRADIENT_OPTIONS,
  INFO_ICON_OPTIONS,
  INFO_FONT_OPTIONS,
  INFO_ANIMATION_OPTIONS,
  clampNumber,
  isInfoSection,
} from "./infoSectionHelpers";

function PanelCard({ title, subtitle, children, right }) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-neutral-100 bg-gradient-to-r from-white to-neutral-50">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          {subtitle ? <p className="text-xs text-neutral-500 mt-1">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className="text-sm font-semibold text-neutral-900 mt-1">{value}</div>
    </div>
  );
}

function SegmentedTabs({ value, onChange, items }) {
  return (
    <div className="inline-flex rounded-2xl border border-neutral-200 bg-white p-1 shadow-sm">
      {items.map((item) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={[
              "px-4 py-2 rounded-xl text-sm font-medium transition",
              active
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100",
            ].join(" ")}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function FontSelect({ value, onChange }) {
  return (
    <select
      className="w-full rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm bg-white"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {INFO_FONT_OPTIONS.map((font) => (
        <option key={font.label} value={font.value}>
          {font.label}
        </option>
      ))}
    </select>
  );
}

function SelectField({ value, onChange, options }) {
  return (
    <select
      className="w-full rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm bg-white"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TextAreaField({ value, onChange, rows = 4, placeholder = "" }) {
  return (
    <textarea
      rows={rows}
      className="w-full rounded-2xl border border-neutral-300 px-3 py-2.5 text-sm bg-white resize-y min-h-[120px]"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}

export default function InfoSectionUI({ theme, setPath, uploadToCloudinary, uploading }) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];

  const [activeTab, setActiveTab] = useState("general");
  const [openCardIndex, setOpenCardIndex] = useState(0);

  const selectedIndex = useMemo(() => {
    return sections.findIndex((section) => isInfoSection(section));
  }, [sections]);

  const safeSection = useMemo(() => {
    if (selectedIndex >= 0) {
      return normalizeInfoSection(sections[selectedIndex]);
    }
    return normalizeInfoSection(null);
  }, [sections, selectedIndex]);

  const config = safeSection.config;
  const cards = Array.isArray(config.cards) ? config.cards : [];

  function commitSection(nextSection) {
    const nextSections = [...sections];

    if (selectedIndex >= 0) {
      nextSections[selectedIndex] = normalizeInfoSection(nextSection);
    } else {
      nextSections.push(normalizeInfoSection(nextSection));
    }

    setPath?.("sections", nextSections);
  }

  function updateSection(partial) {
    commitSection({
      ...safeSection,
      ...partial,
    });
  }

  function updateConfig(field, value) {
    commitSection({
      ...safeSection,
      config: {
        ...config,
        [field]: value,
      },
    });
  }

  function updateCard(cardIndex, partial) {
    const nextCards = [...cards];
    nextCards[cardIndex] = {
      ...nextCards[cardIndex],
      ...partial,
    };

    commitSection({
      ...safeSection,
      config: {
        ...config,
        cards: nextCards,
      },
    });
  }

  async function handleIconUpload(cardIndex, file) {
    if (!file || !uploadToCloudinary) return;
    const url = await uploadToCloudinary(file);
    if (!url) return;

    updateCard(cardIndex, {
      iconType: "image",
      iconUrl: url,
    });
  }

  const currentCard = cards[openCardIndex] || cards[0];
  const selectedAnimationLabel =
    INFO_ANIMATION_OPTIONS.find((item) => item.value === config.entranceAnimation)?.label ||
    "Sin animación";

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-[linear-gradient(to_bottom,rgba(250,250,250,0.96),rgba(250,250,250,0.88),rgba(250,250,250,0))] backdrop-blur-sm">
        <div className="rounded-3xl border border-neutral-200 bg-white shadow-sm p-4">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Sección</div>
              <div className="text-lg font-semibold text-neutral-900 mt-1">
                Información
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Editando: <b>{safeSection.id || INFO_SECTION_ID}</b> · Los cambios se guardan en{" "}
                <code>theme.sections</code>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <SegmentedTabs
                value={activeTab}
                onChange={setActiveTab}
                items={[
                  { value: "general", label: "General" },
                  { value: "contenido", label: "Contenido" },
                  { value: "bloques", label: "Bloques" },
                ]}
              />

              <div className="flex items-center justify-between rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2 min-w-[140px]">
                <span className="text-sm font-medium text-neutral-700">Activa</span>
                <Toggle
                  checked={!!safeSection.enabled}
                  onChange={(val) => updateSection({ enabled: !!val })}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px,minmax(0,1fr)] gap-6 items-start">
        <div className="space-y-4 xl:sticky xl:top-28">
          <MiniStat label="Bloques" value={`${cards.length} configurados`} />
          <MiniStat label="Ancho" value={`${config.containerMaxWidth || 1200}px`} />
          <MiniStat label="Alto mínimo" value={`${config.containerMinHeight || 250}px`} />
          <MiniStat
            label="Degradado"
            value={
              INFO_GRADIENT_OPTIONS.find((g) => g.value === config.backgroundGradient)?.label ||
              "Sin degradado"
            }
          />
          <MiniStat label="Animación" value={selectedAnimationLabel} />

          <PanelCard
            title="Vista rápida"
            subtitle="Resumen visual del estado actual"
          >
            <div
              className="rounded-3xl border overflow-hidden"
              style={{
                borderColor: config.borderColor || "#ffffff",
                borderWidth: `${config.borderWidth || 4}px`,
                borderStyle: "solid",
                background:
                  config.backgroundGradient !== "none"
                    ? INFO_GRADIENT_OPTIONS.find((g) => g.value === config.backgroundGradient)?.css ||
                      config.backgroundColor
                    : config.backgroundColor,
                boxShadow: config.shadow ? "0 18px 40px rgba(0,0,0,0.10)" : "none",
              }}
            >
              <div className="px-4 py-5">
                <div
                  className="text-center mb-4"
                  style={{
                    color: config.titleColor,
                    fontSize: `${Math.min(Number(config.titleFontSize || 32), 28)}px`,
                    fontWeight: config.titleFontWeight || 700,
                    fontFamily: config.titleFontFamily || undefined,
                    lineHeight: 1.2,
                  }}
                >
                  {config.titleText || "Título"}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {cards.map((card, idx) => (
                    <div
                      key={card.id || idx}
                      className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-3"
                    >
                      <div
                        className="rounded-full flex items-center justify-center shrink-0"
                        style={{
                          width: 42,
                          height: 42,
                          background: card.iconBgColor || "#fbcfe8",
                        }}
                      >
                        <div
                          className="rounded-full"
                          style={{
                            width: Math.min(Number(card.iconSize || 32), 24),
                            height: Math.min(Number(card.iconSize || 32), 24),
                            background:
                              card.iconType === "image" && card.iconUrl
                                ? `url(${card.iconUrl}) center/contain no-repeat`
                                : "transparent",
                            color: card.iconColor || "#fff",
                            border:
                              card.iconType === "image" && card.iconUrl
                                ? "none"
                                : "2px solid currentColor",
                          }}
                        />
                      </div>
                      <div
                        className="text-xs line-clamp-2"
                        style={{
                          color: card.textColor || "#fff",
                          fontFamily: card.textFontFamily || undefined,
                        }}
                      >
                        {card.text || `Bloque ${idx + 1}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </PanelCard>
        </div>

        <div className="space-y-6">
          {activeTab === "general" ? (
            <>
              <PanelCard
                title="Contenedor"
                subtitle="Medidas, borde, sombra y estructura general"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <Field label="Ancho máximo (px)">
                    <Input
                      type="number"
                      value={config.containerMaxWidth}
                      onChange={(e) =>
                        updateConfig("containerMaxWidth", clampNumber(e.target.value, 600, 2000))
                      }
                    />
                  </Field>

                  <Field label="Alto mínimo (px)">
                    <Input
                      type="number"
                      value={config.containerMinHeight}
                      onChange={(e) =>
                        updateConfig("containerMinHeight", clampNumber(e.target.value, 100, 1000))
                      }
                    />
                  </Field>

                  <Field label="Padding vertical (px)">
                    <Input
                      type="number"
                      value={config.paddingY}
                      onChange={(e) =>
                        updateConfig("paddingY", clampNumber(e.target.value, 0, 200))
                      }
                    />
                  </Field>

                  <Field label="Padding horizontal (px)">
                    <Input
                      type="number"
                      value={config.paddingX}
                      onChange={(e) =>
                        updateConfig("paddingX", clampNumber(e.target.value, 0, 200))
                      }
                    />
                  </Field>

                  <Field label="Radio bordes (px)">
                    <Input
                      type="number"
                      value={config.borderRadius}
                      onChange={(e) =>
                        updateConfig("borderRadius", clampNumber(e.target.value, 0, 80))
                      }
                    />
                  </Field>

                  <Field label="Grosor borde (px)">
                    <Input
                      type="number"
                      value={config.borderWidth}
                      onChange={(e) =>
                        updateConfig("borderWidth", clampNumber(e.target.value, 0, 20))
                      }
                    />
                  </Field>

                  <Field label="Color borde">
                    <ColorField
                      value={config.borderColor}
                      onChange={(value) => updateConfig("borderColor", value)}
                    />
                  </Field>

                  <Field label="Sombra">
                    <div className="h-full min-h-[44px] rounded-2xl border border-neutral-200 bg-neutral-50 px-3 flex items-center justify-between">
                      <span className="text-sm text-neutral-700">Activar</span>
                      <Toggle
                        checked={!!config.shadow}
                        onChange={(val) => updateConfig("shadow", !!val)}
                      />
                    </div>
                  </Field>
                </div>
              </PanelCard>

              <PanelCard
                title="Fondo"
                subtitle="Color base y degradado predefinido"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Color de fondo">
                    <ColorField
                      value={config.backgroundColor}
                      onChange={(value) => updateConfig("backgroundColor", value)}
                    />
                  </Field>

                  <Field label="Degradado">
                    <SelectField
                      value={config.backgroundGradient}
                      onChange={(value) => updateConfig("backgroundGradient", value)}
                      options={INFO_GRADIENT_OPTIONS}
                    />
                  </Field>
                </div>

                <div className="mt-5">
                  <div className="text-xs font-medium text-neutral-600 mb-2">Preview de fondo</div>
                  <div
                    className="h-20 rounded-2xl border border-neutral-200"
                    style={{
                      background:
                        config.backgroundGradient !== "none"
                          ? INFO_GRADIENT_OPTIONS.find((g) => g.value === config.backgroundGradient)?.css ||
                            config.backgroundColor
                          : config.backgroundColor,
                    }}
                  />
                </div>
              </PanelCard>

              <PanelCard
                title="Animación de entrada"
                subtitle="Define cómo aparecerá la sección cuando cargue en la página pública"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Tipo de animación">
                    <SelectField
                      value={config.entranceAnimation || "none"}
                      onChange={(value) => updateConfig("entranceAnimation", value)}
                      options={INFO_ANIMATION_OPTIONS}
                    />
                  </Field>

                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 flex items-center">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-neutral-500">
                        Selección actual
                      </div>
                      <div className="text-sm font-semibold text-neutral-900 mt-1">
                        {selectedAnimationLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </PanelCard>
            </>
          ) : null}

          {activeTab === "contenido" ? (
            <>
              <PanelCard
                title="Título"
                subtitle="Texto principal y estilo tipográfico"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  <Field label="Texto del título">
                    <Input
                      value={config.titleText}
                      onChange={(e) => updateConfig("titleText", e.target.value)}
                    />
                  </Field>

                  <Field label="Color del título">
                    <ColorField
                      value={config.titleColor}
                      onChange={(value) => updateConfig("titleColor", value)}
                    />
                  </Field>

                  <Field label="Tamaño del título (px)">
                    <Input
                      type="number"
                      value={config.titleFontSize}
                      onChange={(e) =>
                        updateConfig("titleFontSize", clampNumber(e.target.value, 16, 80))
                      }
                    />
                  </Field>

                  <Field label="Peso del título">
                    <Input
                      type="number"
                      value={config.titleFontWeight}
                      onChange={(e) =>
                        updateConfig("titleFontWeight", clampNumber(e.target.value, 300, 900))
                      }
                    />
                  </Field>

                  <Field label="Fuente del título">
                    <FontSelect
                      value={config.titleFontFamily || ""}
                      onChange={(value) => updateConfig("titleFontFamily", value)}
                    />
                  </Field>
                </div>
              </PanelCard>

              <PanelCard
                title="Bloques rápidos"
                subtitle="Selecciona el bloque que quieres editar sin recorrer todo el formulario"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {cards.map((card, index) => {
                    const active = openCardIndex === index;
                    return (
                      <button
                        key={card.id || index}
                        type="button"
                        onClick={() => {
                          setOpenCardIndex(index);
                          setActiveTab("bloques");
                        }}
                        className={[
                          "text-left rounded-2xl border px-4 py-3 transition shadow-sm",
                          active
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white hover:border-neutral-400",
                        ].join(" ")}
                      >
                        <div className="text-xs uppercase tracking-wide opacity-70">Bloque</div>
                        <div className="text-sm font-semibold mt-1">{index + 1}</div>
                        <div className="text-xs mt-2 line-clamp-2 opacity-80">
                          {card.text || "Sin texto"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </PanelCard>
            </>
          ) : null}

          {activeTab === "bloques" ? (
            <>
              <PanelCard
                title="Editor de bloques"
                subtitle="Ahora solo ves un bloque a la vez para reducir scroll y hacerlo más intuitivo"
                right={
                  <div className="flex items-center gap-2">
                    {cards.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setOpenCardIndex(index)}
                        className={[
                          "h-9 w-9 rounded-xl border text-sm font-semibold transition",
                          openCardIndex === index
                            ? "bg-neutral-900 border-neutral-900 text-white"
                            : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400",
                        ].join(" ")}
                      >
                        {index + 1}
                      </button>
                    ))}
                  </div>
                }
              >
                {currentCard ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      <Field label="Tipo de ícono">
                        <SelectField
                          value={currentCard.iconType}
                          onChange={(value) => updateCard(openCardIndex, { iconType: value })}
                          options={[
                            { value: "lucide", label: "Ícono de sistema" },
                            { value: "image", label: "Imagen subida" },
                          ]}
                        />
                      </Field>

                      {currentCard.iconType === "lucide" ? (
                        <Field label="Ícono">
                          <SelectField
                            value={currentCard.icon}
                            onChange={(value) => updateCard(openCardIndex, { icon: value })}
                            options={INFO_ICON_OPTIONS}
                          />
                        </Field>
                      ) : (
                        <Field label="Imagen del ícono">
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Input
                                value={currentCard.iconUrl || ""}
                                onChange={(e) => updateCard(openCardIndex, { iconUrl: e.target.value })}
                                placeholder="https://..."
                              />
                              <label className="inline-flex items-center justify-center px-4 py-2.5 rounded-2xl bg-neutral-900 text-white text-sm font-medium cursor-pointer hover:bg-neutral-800 transition shrink-0">
                                <span>{uploading ? "Subiendo..." : "Subir imagen"}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploading}
                                  onChange={(e) =>
                                    handleIconUpload(openCardIndex, e.target.files?.[0] || null)
                                  }
                                />
                              </label>
                            </div>

                            {currentCard.iconUrl ? (
                              <div className="h-20 w-20 rounded-2xl border border-neutral-200 overflow-hidden bg-white flex items-center justify-center">
                                <img
                                  src={currentCard.iconUrl}
                                  alt={`Icono bloque ${openCardIndex + 1}`}
                                  className="max-h-full max-w-full object-contain"
                                />
                              </div>
                            ) : null}
                          </div>
                        </Field>
                      )}

                      <Field label="Tamaño ícono (px)">
                        <Input
                          type="number"
                          value={currentCard.iconSize}
                          onChange={(e) =>
                            updateCard(openCardIndex, {
                              iconSize: clampNumber(e.target.value, 16, 100),
                            })
                          }
                        />
                      </Field>

                      <Field label="Color ícono">
                        <ColorField
                          value={currentCard.iconColor}
                          onChange={(value) => updateCard(openCardIndex, { iconColor: value })}
                        />
                      </Field>

                      <Field label="Fondo circular ícono">
                        <ColorField
                          value={
                            typeof currentCard.iconBgColor === "string" && currentCard.iconBgColor
                              ? currentCard.iconBgColor
                              : "#fbcfe8"
                          }
                          onChange={(value) => updateCard(openCardIndex, { iconBgColor: value })}
                        />
                      </Field>

                      <Field label="Color texto">
                        <ColorField
                          value={currentCard.textColor}
                          onChange={(value) => updateCard(openCardIndex, { textColor: value })}
                        />
                      </Field>

                      <Field label="Tamaño texto (px)">
                        <Input
                          type="number"
                          value={currentCard.textFontSize}
                          onChange={(e) =>
                            updateCard(openCardIndex, {
                              textFontSize: clampNumber(e.target.value, 10, 40),
                            })
                          }
                        />
                      </Field>

                      <Field label="Fuente texto">
                        <FontSelect
                          value={currentCard.textFontFamily || ""}
                          onChange={(value) => updateCard(openCardIndex, { textFontFamily: value })}
                        />
                      </Field>
                    </div>

                    <Field label="Texto del bloque">
                      <TextAreaField
                        value={currentCard.text}
                        onChange={(value) => updateCard(openCardIndex, { text: value })}
                        rows={5}
                      />
                    </Field>
                  </div>
                ) : null}
              </PanelCard>

              <PanelCard
                title="Vista rápida del bloque actual"
                subtitle="Así puedes revisar color, tipografía y texto sin bajar más"
              >
                {currentCard ? (
                  <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-6">
                    <div className="flex flex-col items-center text-center">
                      <div
                        className="rounded-full flex items-center justify-center mb-4"
                        style={{
                          width: 74,
                          height: 74,
                          background: currentCard.iconBgColor || "#fbcfe8",
                        }}
                      >
                        {currentCard.iconType === "image" && currentCard.iconUrl ? (
                          <img
                            src={currentCard.iconUrl}
                            alt=""
                            className="object-contain"
                            style={{
                              width: `${currentCard.iconSize || 32}px`,
                              height: `${currentCard.iconSize || 32}px`,
                            }}
                          />
                        ) : (
                          <div
                            className="rounded-full"
                            style={{
                              width: `${currentCard.iconSize || 32}px`,
                              height: `${currentCard.iconSize || 32}px`,
                              border: `2px solid ${currentCard.iconColor || "#ffffff"}`,
                              color: currentCard.iconColor || "#ffffff",
                            }}
                          />
                        )}
                      </div>

                      <div
                        style={{
                          color: currentCard.textColor || "#111827",
                          fontSize: `${currentCard.textFontSize || 18}px`,
                          fontFamily: currentCard.textFontFamily || undefined,
                          lineHeight: 1.6,
                        }}
                      >
                        {currentCard.text || "Aquí verás el texto del bloque."}
                      </div>
                    </div>
                  </div>
                ) : null}
              </PanelCard>
            </>
          ) : null}

          <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-xs text-neutral-600">
            Esta sección guarda sobre <code>theme.sections</code> usando el identificador real{" "}
            <b>{INFO_SECTION_ID}</b>.
          </div>
        </div>
      </div>
    </div>
  );
}