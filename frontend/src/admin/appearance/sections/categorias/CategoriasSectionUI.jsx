// src/admin/appearance/sections/categorias/CategoriasSectionUI.jsx
import React, { useMemo, useState } from "react";
import { Button, Field, Input } from "../ui/UiComponents";
import {
  ColorField,
  RangeNumberField,
  ToggleChip,
} from "../ui/SectionsPanelUI";
import {
  CATEGORIAS_SECTION_DEFAULTS,
  normalizeCategoriasSection,
} from "./categoriasSectionHelpers";

function getCategoriasSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "categorias" || type === "categorias";
  });

  return normalizeCategoriasSection(found || CATEGORIAS_SECTION_DEFAULTS);
}

function updateSectionInTheme(theme, nextSection) {
  const draft = structuredClone(theme || {});
  if (!Array.isArray(draft.sections)) draft.sections = [];

  const idx = draft.sections.findIndex((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "categorias" || type === "categorias";
  });

  if (idx >= 0) {
    draft.sections[idx] = normalizeCategoriasSection(nextSection);
  } else {
    draft.sections.push(normalizeCategoriasSection(nextSection));
  }

  return draft;
}

function getArrowPreview(style) {
  if (style === "minimal") return "›";
  if (style === "glass") return "→";
  if (style === "outline") return "⟶";
  return "❯";
}

function getArrowClasses(style) {
  if (style === "glass") {
    return "backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.14)]";
  }

  if (style === "outline") {
    return "shadow-none";
  }

  if (style === "minimal") {
    return "shadow-[0_8px_20px_rgba(0,0,0,0.08)]";
  }

  return "shadow-[0_14px_32px_rgba(0,0,0,0.14)]";
}

function getButtonAnimationClass(animation) {
  if (animation === "pulse") return "animate-pulse";
  if (animation === "soft-float") return "animate-[floatY_3.2s_ease-in-out_infinite]";
  if (animation === "hover-bounce") return "hover:-translate-y-1";
  return "";
}

function clampPercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function getButtonRadius(style) {
  if ((style?.buttonShape || "rounded") === "pill") return 999;
  if (style?.buttonShape === "square") return 0;
  return Number(style?.buttonRadiusPx) || 12;
}

const OVERLAY_PRESETS = {
  darkSoft: {
    label: "Oscuro suave",
    start: "rgba(0,0,0,0.34)",
    middle: "rgba(0,0,0,0.14)",
    end: "rgba(0,0,0,0.28)",
  },
  rosySoft: {
    label: "Rosado suave",
    start: "rgba(120,20,60,0.16)",
    middle: "rgba(255,120,170,0.10)",
    end: "rgba(90,40,70,0.14)",
  },
  goldSoft: {
    label: "Dorado suave",
    start: "rgba(120,90,20,0.14)",
    middle: "rgba(255,220,120,0.08)",
    end: "rgba(90,70,25,0.12)",
  },
  clearSoft: {
    label: "Muy sutil",
    start: "rgba(0,0,0,0.10)",
    middle: "rgba(0,0,0,0.04)",
    end: "rgba(0,0,0,0.08)",
  },
};

function detectOverlayPreset(style) {
  const start = String(style?.heroOverlayStart || "").trim();
  const middle = String(style?.heroOverlayMiddle || "").trim();
  const end = String(style?.heroOverlayEnd || "").trim();

  const found = Object.entries(OVERLAY_PRESETS).find(([, preset]) => {
    return (
      preset.start === start &&
      preset.middle === middle &&
      preset.end === end
    );
  });

  return found?.[0] || "darkSoft";
}

export default function CategoriasSectionUI({
  theme,
  setPath,
  uploadToCloudinary,
}) {
  const section = useMemo(() => getCategoriasSectionFromTheme(theme), [theme]);
  const [tab, setTab] = useState("contenido");

  const config = section?.config || CATEGORIAS_SECTION_DEFAULTS.config;
  const style = section?.style || CATEGORIAS_SECTION_DEFAULTS.style;

  const setCategoriasSection = (nextSection) => {
    const safe = normalizeCategoriasSection(nextSection);
    const nextTheme = updateSectionInTheme(theme, safe);
    setPath("sections", nextTheme.sections);
  };

  const patchConfig = (patch) => {
    setCategoriasSection({
      ...section,
      config: {
        ...config,
        ...patch,
      },
    });
  };

  const patchStyle = (patch) => {
    setCategoriasSection({
      ...section,
      style: {
        ...style,
        ...patch,
      },
    });
  };

  const applyOverlayPreset = (presetKey) => {
    const preset = OVERLAY_PRESETS[presetKey] || OVERLAY_PRESETS.darkSoft;
    patchStyle({
      heroOverlayStart: preset.start,
      heroOverlayMiddle: preset.middle,
      heroOverlayEnd: preset.end,
    });
  };

  const patchSlides = (nextSlides) => {
    patchConfig({ slides: nextSlides });
  };

  const patchSlide = (index, patch) => {
    const nextSlides = [...(config.slides || [])];
    nextSlides[index] = {
      ...nextSlides[index],
      ...patch,
    };
    patchSlides(nextSlides);
  };

  const removeSlide = (index) => {
    const nextSlides = [...(config.slides || [])];
    nextSlides.splice(index, 1);
    patchSlides(nextSlides);
  };

  const addSlide = () => {
    const nextSlides = [...(config.slides || [])];
    nextSlides.push({
      id: `cat_${Date.now()}`,
      image: "",
      title: "Nueva categoría",
      subtitle: "",
      review: "",
      badge: "",
      buttonImg: "",
      buttonText: "Ver más",
      href: "/",
      enabled: true,
    });
    patchSlides(nextSlides);
  };

  const resetCategoriasDesign = () => {
    setCategoriasSection({
      ...section,
      style: structuredClone(CATEGORIAS_SECTION_DEFAULTS.style || {}),
    });
  };

  const enabledSlides = (config.slides || []).filter((slide) => slide.enabled !== false);
  const previewActiveSlide = enabledSlides[0] || null;
  const previewThumbs = enabledSlides.slice(1, 4);

  const previewHeroWidthPx = Number(style.heroWidthPx) || Number(style.sectionMaxWidthPx) || 1280;
  const previewHeroHeightPx = Number(style.heroHeightPx) || 470;
  const previewTitleMaxWidthPx = Number(style.titleMaxWidthPx) || 560;
  const previewHeroRadiusPx = Number(style.heroRadiusPx ?? style.cardRadiusPx) || 24;
  const previewHeroBorderPx = Number(style.heroBorderPx ?? style.cardBorderPx) || 0;
  const previewHeroBorderColor = style.heroBorderColor || style.cardBorderColor || "#f9a8d4";
  const previewHeroOverlayStart = style.heroOverlayStart || "rgba(0,0,0,0.34)";
  const previewHeroOverlayMiddle = style.heroOverlayMiddle || "rgba(0,0,0,0.14)";
  const previewHeroOverlayEnd = style.heroOverlayEnd || "rgba(0,0,0,0.28)";
  const previewHeroImagePosX = clampPercent(style.heroImagePosXPercent, 50);
  const previewHeroImagePosY = clampPercent(style.heroImagePosYPercent, 50);
  const previewHeroImageScale = Number(style.heroImageScale) || 1.02;
  const previewContentPosX = clampPercent(style.heroContentPosXPercent, 8);
  const previewContentPosY = clampPercent(style.heroContentPosYPercent, 10);
  const previewThumbsPosX = clampPercent(style.thumbsPosXPercent, 68);
  const previewThumbsPosY = clampPercent(style.thumbsPosYPercent, 50);
  const previewThumbWidthPx = Number(style.thumbWidthPx) || 140;
  const previewThumbHeightPx = Number(style.thumbHeightPx) || 190;
  const previewThumbGapPx = Number(style.thumbGapPx) || 14;
  const previewThumbTiltDeg = Number(style.thumbTiltDeg) || 8;
  const previewReviewEnabled = style.showReview !== false;
  const previewButtonAnimation = style.buttonAnimation || "none";
  const previewButtonClass = getButtonAnimationClass(previewButtonAnimation);
  const previewButtonRadius = getButtonRadius(style);
  const activeOverlayPreset = detectOverlayPreset(style);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
      <style>{`
        @keyframes floatY {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      `}</style>

      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-extrabold text-neutral-900">
                Editor de sección Categorías
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                Configura el hero slider, miniaturas, flechas, textos, reseñas y estilos visuales.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                kind={tab === "contenido" ? "primary" : "ghost"}
                onClick={() => setTab("contenido")}
              >
                Contenido
              </Button>

              <Button
                type="button"
                kind={tab === "estilos" ? "primary" : "ghost"}
                onClick={() => setTab("estilos")}
              >
                Estilos
              </Button>

              <Button
                type="button"
                kind="ghost"
                onClick={resetCategoriasDesign}
                title="Restaurar solo el diseño original"
              >
                Reset
              </Button>
            </div>
          </div>
        </div>

        {tab === "contenido" && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
              <div className="text-sm font-extrabold text-neutral-900">
                Datos principales
              </div>

              <Field label="Activa esta sección">
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    active={section.enabled !== false}
                    onClick={() => setCategoriasSection({ ...section, enabled: true })}
                  >
                    Activa
                  </ToggleChip>
                  <ToggleChip
                    active={section.enabled === false}
                    onClick={() => setCategoriasSection({ ...section, enabled: false })}
                  >
                    Desactivada
                  </ToggleChip>
                </div>
              </Field>

              <Field label="Imagen del título">
                <div className="space-y-3">
                  <Input
                    value={config.titleImage || ""}
                    onChange={(e) => patchConfig({ titleImage: e.target.value })}
                    placeholder="/SeccionCategoria/TituloCate.png o https://..."
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer shadow-sm hover:bg-neutral-800 transition">
                      <span className="mr-1">Subir título</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !uploadToCloudinary) return;
                          try {
                            const url = await uploadToCloudinary(file);
                            if (url) patchConfig({ titleImage: url });
                          } catch (err) {
                            console.error("Error subiendo título de Categorías:", err);
                          }
                        }}
                      />
                    </label>

                    {config.titleImage ? (
                      <div className="w-40 h-20 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                        <img
                          src={config.titleImage}
                          alt="Preview título categorías"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </Field>

              <Field label="Texto del título (respaldo)">
                <Input
                  value={config.titleText || ""}
                  onChange={(e) => patchConfig({ titleText: e.target.value })}
                  placeholder="Categorías"
                />
              </Field>

              <Field label="Texto alternativo del título">
                <Input
                  value={config.titleAlt || ""}
                  onChange={(e) => patchConfig({ titleAlt: e.target.value })}
                  placeholder="Título de categorías"
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-extrabold text-neutral-900">
                  Slides / hero items
                </div>

                <Button type="button" onClick={addSlide}>
                  Agregar slide
                </Button>
              </div>

              {(config.slides || []).length === 0 ? (
                <div className="text-xs text-neutral-500">
                  Aún no hay slides configurados.
                </div>
              ) : null}

              {(config.slides || []).map((slide, index) => (
                <div
                  key={slide.id || index}
                  className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-900">
                      Slide {index + 1}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ToggleChip
                        active={slide.enabled !== false}
                        onClick={() => patchSlide(index, { enabled: true })}
                      >
                        Activo
                      </ToggleChip>
                      <ToggleChip
                        active={slide.enabled === false}
                        onClick={() => patchSlide(index, { enabled: false })}
                      >
                        Oculto
                      </ToggleChip>
                      <Button
                        type="button"
                        kind="ghost"
                        onClick={() => removeSlide(index)}
                        title="Eliminar slide"
                      >
                        Eliminar
                      </Button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <Field label="Imagen principal de fondo">
                      <div className="space-y-3">
                        <Input
                          value={slide.image || ""}
                          onChange={(e) => patchSlide(index, { image: e.target.value })}
                          placeholder="/SeccionCategoria/imagen.jpg o https://..."
                        />

                        <div className="flex flex-wrap items-center gap-3">
                          <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer shadow-sm hover:bg-neutral-800 transition">
                            <span className="mr-1">Subir imagen</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !uploadToCloudinary) return;
                                try {
                                  const url = await uploadToCloudinary(file);
                                  if (url) patchSlide(index, { image: url });
                                } catch (err) {
                                  console.error("Error subiendo imagen slide:", err);
                                }
                              }}
                            />
                          </label>

                          {slide.image ? (
                            <div className="w-24 h-28 rounded-lg overflow-hidden border border-neutral-200 bg-white">
                              <img
                                src={slide.image}
                                alt={`Slide ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Field>

                    <Field label="Imagen del botón">
                      <div className="space-y-3">
                        <Input
                          value={slide.buttonImg || ""}
                          onChange={(e) => patchSlide(index, { buttonImg: e.target.value })}
                          placeholder="/SeccionCategoria/boton.png o https://..."
                        />

                        <div className="flex flex-wrap items-center gap-3">
                          <label className="inline-flex items-center px-3 py-2 rounded-xl bg-neutral-900 text-white text-xs font-medium cursor-pointer shadow-sm hover:bg-neutral-800 transition">
                            <span className="mr-1">Subir botón</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !uploadToCloudinary) return;
                                try {
                                  const url = await uploadToCloudinary(file);
                                  if (url) patchSlide(index, { buttonImg: url });
                                } catch (err) {
                                  console.error("Error subiendo botón slide:", err);
                                }
                              }}
                            />
                          </label>

                          {slide.buttonImg ? (
                            <div className="w-28 h-16 rounded-lg overflow-hidden border border-neutral-200 bg-white">
                              <img
                                src={slide.buttonImg}
                                alt={`Botón slide ${index + 1}`}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Field>

                    <Field label="Título del slide">
                      <Input
                        value={slide.title || ""}
                        onChange={(e) => patchSlide(index, { title: e.target.value })}
                        placeholder="Complementos"
                      />
                    </Field>

                    <Field label="Subtítulo del slide">
                      <Input
                        value={slide.subtitle || ""}
                        onChange={(e) => patchSlide(index, { subtitle: e.target.value })}
                        placeholder="Opcional"
                      />
                    </Field>

                    <Field label="Reseña / descripción breve">
                      <Input
                        value={slide.review || ""}
                        onChange={(e) => patchSlide(index, { review: e.target.value })}
                        placeholder="Una reseña corta para mostrar sobre el hero"
                      />
                    </Field>

                    <Field label="Badge / etiqueta corta">
                      <Input
                        value={slide.badge || ""}
                        onChange={(e) => patchSlide(index, { badge: e.target.value })}
                        placeholder="Nuevo / Destacado / Colección"
                      />
                    </Field>

                    <Field label="Texto del botón (respaldo)">
                      <Input
                        value={slide.buttonText || ""}
                        onChange={(e) => patchSlide(index, { buttonText: e.target.value })}
                        placeholder="Ver más"
                      />
                    </Field>

                    <Field label="Link del slide">
                      <Input
                        value={slide.href || ""}
                        onChange={(e) => patchSlide(index, { href: e.target.value })}
                        placeholder="/categoria/ejemplo"
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === "estilos" && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Layout general
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Ancho máximo de la sección"
                  min={480}
                  max={1800}
                  step={1}
                  value={style.sectionMaxWidthPx}
                  onChange={(v) => patchStyle({ sectionMaxWidthPx: v })}
                />

                <RangeNumberField
                  label="Padding horizontal"
                  min={0}
                  max={80}
                  step={1}
                  value={style.sectionPaddingXPx}
                  onChange={(v) => patchStyle({ sectionPaddingXPx: v })}
                />

                <RangeNumberField
                  label="Padding superior"
                  min={0}
                  max={200}
                  step={1}
                  value={style.sectionPaddingTopPx}
                  onChange={(v) => patchStyle({ sectionPaddingTopPx: v })}
                />

                <RangeNumberField
                  label="Padding inferior"
                  min={0}
                  max={160}
                  step={1}
                  value={style.sectionPaddingBottomPx}
                  onChange={(v) => patchStyle({ sectionPaddingBottomPx: v })}
                />

                <RangeNumberField
                  label="Ancho máximo del título"
                  min={160}
                  max={1200}
                  step={1}
                  value={style.titleMaxWidthPx}
                  onChange={(v) => patchStyle({ titleMaxWidthPx: v })}
                />

                <RangeNumberField
                  label="Margen inferior del título"
                  min={0}
                  max={80}
                  step={1}
                  value={style.titleMarginBottomPx}
                  onChange={(v) => patchStyle({ titleMarginBottomPx: v })}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Hero principal
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Ancho del slider"
                  min={320}
                  max={1800}
                  step={1}
                  value={style.heroWidthPx ?? style.sectionMaxWidthPx ?? 1280}
                  onChange={(v) => patchStyle({ heroWidthPx: v })}
                />

                <RangeNumberField
                  label="Alto del slider"
                  min={280}
                  max={900}
                  step={1}
                  value={style.heroHeightPx ?? 470}
                  onChange={(v) => patchStyle({ heroHeightPx: v })}
                />

                <RangeNumberField
                  label="Posición X foto principal"
                  min={0}
                  max={100}
                  step={1}
                  value={style.heroImagePosXPercent ?? 50}
                  onChange={(v) => patchStyle({ heroImagePosXPercent: v })}
                />

                <RangeNumberField
                  label="Posición Y foto principal"
                  min={0}
                  max={100}
                  step={1}
                  value={style.heroImagePosYPercent ?? 50}
                  onChange={(v) => patchStyle({ heroImagePosYPercent: v })}
                />

                <RangeNumberField
                  label="Zoom foto principal"
                  min={1}
                  max={2}
                  step={0.01}
                  value={style.heroImageScale ?? 1.02}
                  onChange={(v) => patchStyle({ heroImageScale: v })}
                />

                <RangeNumberField
                  label="Radio del hero"
                  min={0}
                  max={50}
                  step={1}
                  value={style.heroRadiusPx ?? style.cardRadiusPx}
                  onChange={(v) => patchStyle({ heroRadiusPx: v })}
                />

                <RangeNumberField
                  label="Borde del hero"
                  min={0}
                  max={10}
                  step={1}
                  value={style.heroBorderPx ?? style.cardBorderPx}
                  onChange={(v) => patchStyle({ heroBorderPx: v })}
                />

                <ColorField
                  label="Color borde hero"
                  value={style.heroBorderColor || style.cardBorderColor}
                  onChange={(v) => patchStyle({ heroBorderColor: v })}
                />

                <Field label="Estilo de overlay seguro">
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(OVERLAY_PRESETS).map(([key, preset]) => (
                      <ToggleChip
                        key={key}
                        active={activeOverlayPreset === key}
                        onClick={() => applyOverlayPreset(key)}
                      >
                        {preset.label}
                      </ToggleChip>
                    ))}
                  </div>
                </Field>

                <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  El overlay ya no se edita con colores libres para evitar que tape la imagen principal.
                </div>

                <RangeNumberField
                  label="Posición X contenido"
                  min={0}
                  max={100}
                  step={1}
                  value={style.heroContentPosXPercent ?? 8}
                  onChange={(v) => patchStyle({ heroContentPosXPercent: v })}
                />

                <RangeNumberField
                  label="Posición Y contenido"
                  min={0}
                  max={100}
                  step={1}
                  value={style.heroContentPosYPercent ?? 10}
                  onChange={(v) => patchStyle({ heroContentPosYPercent: v })}
                />

                <Field label="Mostrar reseña">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.showReview !== false}
                      onClick={() => patchStyle({ showReview: true })}
                    >
                      Sí
                    </ToggleChip>
                    <ToggleChip
                      active={style.showReview === false}
                      onClick={() => patchStyle({ showReview: false })}
                    >
                      No
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Mostrar badge">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.showBadge !== false}
                      onClick={() => patchStyle({ showBadge: true })}
                    >
                      Sí
                    </ToggleChip>
                    <ToggleChip
                      active={style.showBadge === false}
                      onClick={() => patchStyle({ showBadge: false })}
                    >
                      No
                    </ToggleChip>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Miniaturas flotantes
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Posición X miniaturas"
                  min={0}
                  max={100}
                  step={1}
                  value={style.thumbsPosXPercent ?? 68}
                  onChange={(v) => patchStyle({ thumbsPosXPercent: v })}
                />

                <RangeNumberField
                  label="Posición Y miniaturas"
                  min={0}
                  max={100}
                  step={1}
                  value={style.thumbsPosYPercent ?? 50}
                  onChange={(v) => patchStyle({ thumbsPosYPercent: v })}
                />

                <RangeNumberField
                  label="Ancho miniatura"
                  min={70}
                  max={260}
                  step={1}
                  value={style.thumbWidthPx ?? 140}
                  onChange={(v) => patchStyle({ thumbWidthPx: v })}
                />

                <RangeNumberField
                  label="Alto miniatura"
                  min={100}
                  max={320}
                  step={1}
                  value={style.thumbHeightPx ?? 190}
                  onChange={(v) => patchStyle({ thumbHeightPx: v })}
                />

                <RangeNumberField
                  label="Separación miniaturas"
                  min={0}
                  max={40}
                  step={1}
                  value={style.thumbGapPx ?? 14}
                  onChange={(v) => patchStyle({ thumbGapPx: v })}
                />

                <RangeNumberField
                  label="Inclinación miniaturas"
                  min={0}
                  max={25}
                  step={1}
                  value={style.thumbTiltDeg ?? 8}
                  onChange={(v) => patchStyle({ thumbTiltDeg: v })}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Slider general
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Slides escritorio"
                  min={1}
                  max={6}
                  step={1}
                  value={style.sliderPerViewDesktop}
                  onChange={(v) => patchStyle({ sliderPerViewDesktop: v })}
                />

                <RangeNumberField
                  label="Slides tablet"
                  min={1}
                  max={5}
                  step={1}
                  value={style.sliderPerViewTablet}
                  onChange={(v) => patchStyle({ sliderPerViewTablet: v })}
                />

                <RangeNumberField
                  label="Slides móvil"
                  min={1}
                  max={3}
                  step={1}
                  value={style.sliderPerViewMobile}
                  onChange={(v) => patchStyle({ sliderPerViewMobile: v })}
                />

                <RangeNumberField
                  label="Espaciado entre slides"
                  min={0}
                  max={40}
                  step={1}
                  value={style.sliderSpacingPx}
                  onChange={(v) => patchStyle({ sliderSpacingPx: v })}
                />

                <RangeNumberField
                  label="Autoplay (ms)"
                  min={1000}
                  max={10000}
                  step={100}
                  value={style.autoplayMs}
                  onChange={(v) => patchStyle({ autoplayMs: v })}
                />

                <Field label="Estilo del slider">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.sliderStyle === "classic"}
                      onClick={() => patchStyle({ sliderStyle: "classic" })}
                    >
                      Classic
                    </ToggleChip>
                    <ToggleChip
                      active={style.sliderStyle === "coverflow-soft"}
                      onClick={() => patchStyle({ sliderStyle: "coverflow-soft" })}
                    >
                      Coverflow
                    </ToggleChip>
                    <ToggleChip
                      active={style.sliderStyle === "spotlight"}
                      onClick={() => patchStyle({ sliderStyle: "spotlight" })}
                    >
                      Spotlight
                    </ToggleChip>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Tarjetas / imágenes
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Radio de tarjetas"
                  min={0}
                  max={40}
                  step={1}
                  value={style.cardRadiusPx}
                  onChange={(v) => patchStyle({ cardRadiusPx: v })}
                />

                <RangeNumberField
                  label="Grosor del borde"
                  min={0}
                  max={8}
                  step={1}
                  value={style.cardBorderPx}
                  onChange={(v) => patchStyle({ cardBorderPx: v })}
                />

                <ColorField
                  label="Color borde"
                  value={style.cardBorderColor}
                  onChange={(v) => patchStyle({ cardBorderColor: v })}
                />

                <ColorField
                  label="Fondo degradado inicio"
                  value={style.cardBgFrom}
                  onChange={(v) => patchStyle({ cardBgFrom: v })}
                />

                <ColorField
                  label="Fondo degradado fin"
                  value={style.cardBgTo}
                  onChange={(v) => patchStyle({ cardBgTo: v })}
                />

                <Field label="Sombra de tarjetas">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.cardShadow}
                      onClick={() => patchStyle({ cardShadow: true })}
                    >
                      Con sombra
                    </ToggleChip>
                    <ToggleChip
                      active={!style.cardShadow}
                      onClick={() => patchStyle({ cardShadow: false })}
                    >
                      Sin sombra
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Proporción de imagen">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.imageAspectRatio === "3/4"}
                      onClick={() => patchStyle({ imageAspectRatio: "3/4" })}
                    >
                      3/4
                    </ToggleChip>
                    <ToggleChip
                      active={style.imageAspectRatio === "4/5"}
                      onClick={() => patchStyle({ imageAspectRatio: "4/5" })}
                    >
                      4/5
                    </ToggleChip>
                    <ToggleChip
                      active={style.imageAspectRatio === "1/1"}
                      onClick={() => patchStyle({ imageAspectRatio: "1/1" })}
                    >
                      1/1
                    </ToggleChip>
                    <ToggleChip
                      active={style.imageAspectRatio === "16/9"}
                      onClick={() => patchStyle({ imageAspectRatio: "16/9" })}
                    >
                      16/9
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Ajuste de imagen">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.imageObjectFit === "cover"}
                      onClick={() => patchStyle({ imageObjectFit: "cover" })}
                    >
                      Cover
                    </ToggleChip>
                    <ToggleChip
                      active={style.imageObjectFit === "contain"}
                      onClick={() => patchStyle({ imageObjectFit: "contain" })}
                    >
                      Contain
                    </ToggleChip>
                    <ToggleChip
                      active={style.imageObjectFit === "fill"}
                      onClick={() => patchStyle({ imageObjectFit: "fill" })}
                    >
                      Fill
                    </ToggleChip>
                  </div>
                </Field>

                <RangeNumberField
                  label="Escala hover"
                  min={1}
                  max={1.15}
                  step={0.01}
                  value={style.cardHoverScale}
                  onChange={(v) => patchStyle({ cardHoverScale: v })}
                />

                <RangeNumberField
                  label="Escala tarjeta activa"
                  min={1}
                  max={1.2}
                  step={0.01}
                  value={style.activeCardScale}
                  onChange={(v) => patchStyle({ activeCardScale: v })}
                />

                <RangeNumberField
                  label="Opacidad tarjetas inactivas"
                  min={0.3}
                  max={1}
                  step={0.01}
                  value={style.inactiveCardOpacity}
                  onChange={(v) => patchStyle({ inactiveCardOpacity: v })}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Botón e indicadores
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <ColorField
                  label="Fondo overlay botón"
                  value={style.buttonOverlayBg}
                  onChange={(v) => patchStyle({ buttonOverlayBg: v })}
                />

                <ColorField
                  label="Fondo overlay hover"
                  value={style.buttonOverlayHoverBg}
                  onChange={(v) => patchStyle({ buttonOverlayHoverBg: v })}
                />

                <ColorField
                  label="Color letra botón"
                  value={style.buttonTextColor}
                  onChange={(v) => patchStyle({ buttonTextColor: v })}
                />

                <ColorField
                  label="Color letra hover"
                  value={style.buttonTextHoverColor}
                  onChange={(v) => patchStyle({ buttonTextHoverColor: v })}
                />

                <RangeNumberField
                  label="Tamaño letra botón"
                  min={10}
                  max={32}
                  step={1}
                  value={style.buttonFontSizePx}
                  onChange={(v) => patchStyle({ buttonFontSizePx: v })}
                />

                <Field label="Grosor letra botón">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={String(style.buttonFontWeight) === "400"}
                      onClick={() => patchStyle({ buttonFontWeight: "400" })}
                    >
                      400
                    </ToggleChip>
                    <ToggleChip
                      active={String(style.buttonFontWeight) === "500"}
                      onClick={() => patchStyle({ buttonFontWeight: "500" })}
                    >
                      500
                    </ToggleChip>
                    <ToggleChip
                      active={String(style.buttonFontWeight) === "600"}
                      onClick={() => patchStyle({ buttonFontWeight: "600" })}
                    >
                      600
                    </ToggleChip>
                    <ToggleChip
                      active={String(style.buttonFontWeight) === "700"}
                      onClick={() => patchStyle({ buttonFontWeight: "700" })}
                    >
                      700
                    </ToggleChip>
                    <ToggleChip
                      active={String(style.buttonFontWeight) === "800"}
                      onClick={() => patchStyle({ buttonFontWeight: "800" })}
                    >
                      800
                    </ToggleChip>
                  </div>
                </Field>

                <RangeNumberField
                  label="Redondeado botón"
                  min={0}
                  max={999}
                  step={1}
                  value={style.buttonRadiusPx}
                  onChange={(v) => patchStyle({ buttonRadiusPx: v })}
                />

                <Field label="Forma geométrica del botón">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={(style.buttonShape || "rounded") === "rounded"}
                      onClick={() => patchStyle({ buttonShape: "rounded" })}
                    >
                      Redondeado
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonShape === "pill"}
                      onClick={() => patchStyle({ buttonShape: "pill" })}
                    >
                      Píldora
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonShape === "square"}
                      onClick={() => patchStyle({ buttonShape: "square" })}
                    >
                      Cuadrado
                    </ToggleChip>
                  </div>
                </Field>

                <RangeNumberField
                  label="Padding vertical overlay"
                  min={0}
                  max={40}
                  step={1}
                  value={style.buttonOverlayPaddingYPx}
                  onChange={(v) => patchStyle({ buttonOverlayPaddingYPx: v })}
                />

                <RangeNumberField
                  label="Ancho botón imagen desktop"
                  min={60}
                  max={360}
                  step={1}
                  value={style.buttonImageWidthPx}
                  onChange={(v) => patchStyle({ buttonImageWidthPx: v })}
                />

                <RangeNumberField
                  label="Ancho botón imagen móvil"
                  min={50}
                  max={240}
                  step={1}
                  value={style.buttonImageWidthMobilePx}
                  onChange={(v) => patchStyle({ buttonImageWidthMobilePx: v })}
                />

                <Field label="Animación del botón">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={(style.buttonAnimation || "none") === "none"}
                      onClick={() => patchStyle({ buttonAnimation: "none" })}
                    >
                      Sin animación
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonAnimation === "pulse"}
                      onClick={() => patchStyle({ buttonAnimation: "pulse" })}
                    >
                      Pulse
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonAnimation === "soft-float"}
                      onClick={() => patchStyle({ buttonAnimation: "soft-float" })}
                    >
                      Flotar
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonAnimation === "hover-bounce"}
                      onClick={() => patchStyle({ buttonAnimation: "hover-bounce" })}
                    >
                      Hover
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Mostrar flechas">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.showArrows}
                      onClick={() => patchStyle({ showArrows: true })}
                    >
                      Sí
                    </ToggleChip>
                    <ToggleChip
                      active={!style.showArrows}
                      onClick={() => patchStyle({ showArrows: false })}
                    >
                      No
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Estilo de flechas">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.arrowStyle === "luxury"}
                      onClick={() => patchStyle({ arrowStyle: "luxury" })}
                    >
                      Luxury
                    </ToggleChip>
                    <ToggleChip
                      active={style.arrowStyle === "minimal"}
                      onClick={() => patchStyle({ arrowStyle: "minimal" })}
                    >
                      Minimal
                    </ToggleChip>
                    <ToggleChip
                      active={style.arrowStyle === "glass"}
                      onClick={() => patchStyle({ arrowStyle: "glass" })}
                    >
                      Glass
                    </ToggleChip>
                    <ToggleChip
                      active={style.arrowStyle === "outline"}
                      onClick={() => patchStyle({ arrowStyle: "outline" })}
                    >
                      Outline
                    </ToggleChip>
                  </div>
                </Field>

                <ColorField
                  label="Fondo flechas"
                  value={style.arrowBg}
                  onChange={(v) => patchStyle({ arrowBg: v })}
                />

                <ColorField
                  label="Color flechas"
                  value={style.arrowColor}
                  onChange={(v) => patchStyle({ arrowColor: v })}
                />

                <ColorField
                  label="Borde flechas"
                  value={style.arrowBorderColor}
                  onChange={(v) => patchStyle({ arrowBorderColor: v })}
                />

                <RangeNumberField
                  label="Tamaño flechas"
                  min={28}
                  max={72}
                  step={1}
                  value={style.arrowSizePx}
                  onChange={(v) => patchStyle({ arrowSizePx: v })}
                />

                <Field label="Mostrar dots">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.showDots}
                      onClick={() => patchStyle({ showDots: true })}
                    >
                      Sí
                    </ToggleChip>
                    <ToggleChip
                      active={!style.showDots}
                      onClick={() => patchStyle({ showDots: false })}
                    >
                      No
                    </ToggleChip>
                  </div>
                </Field>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sticky top-4">
          <div className="text-base font-extrabold text-neutral-900 mb-3">
            Vista previa Categorías
          </div>

          <div
            className="mx-auto"
            style={{
              maxWidth: style.sectionMaxWidthPx,
              paddingTop: style.sectionPaddingTopPx,
              paddingBottom: style.sectionPaddingBottomPx,
              paddingLeft: style.sectionPaddingXPx,
              paddingRight: style.sectionPaddingXPx,
            }}
          >
            <div
              className="mb-4 px-1"
              style={{
                marginBottom: style.titleMarginBottomPx,
              }}
            >
              {config.titleImage ? (
                <img
                  src={config.titleImage}
                  alt={config.titleAlt || "Título de categorías"}
                  className="mx-auto h-auto"
                  style={{
                    width: "100%",
                    maxWidth: previewTitleMaxWidthPx,
                  }}
                  draggable={false}
                />
              ) : (
                <div className="text-center font-semibold text-neutral-900">
                  {config.titleText || "Categorías"}
                </div>
              )}
            </div>

            <div
              className="relative mx-auto"
              style={{
                width: "100%",
                maxWidth: previewHeroWidthPx,
              }}
            >
              <div
                className="relative overflow-hidden"
                style={{
                  height: previewHeroHeightPx,
                  borderRadius: previewHeroRadiusPx,
                  borderWidth: previewHeroBorderPx,
                  borderStyle: "solid",
                  borderColor: previewHeroBorderColor,
                  background: `linear-gradient(135deg, ${style.cardBgFrom}, ${style.cardBgTo})`,
                  boxShadow: style.cardShadow
                    ? "0 26px 58px rgba(0,0,0,0.16)"
                    : "none",
                }}
              >
                {previewActiveSlide?.image ? (
                  <img
                    src={previewActiveSlide.image}
                    alt={previewActiveSlide.title || "Slide activo"}
                    className="absolute inset-0 w-full h-full"
                    style={{
                      objectFit: style.imageObjectFit,
                      objectPosition: `${previewHeroImagePosX}% ${previewHeroImagePosY}%`,
                      transform: `scale(${previewHeroImageScale})`,
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
                    Sin imagen principal
                  </div>
                )}

                <div
                  className="absolute inset-0"
                  style={{
                    background: `linear-gradient(90deg, ${previewHeroOverlayStart} 0%, ${previewHeroOverlayMiddle} 45%, ${previewHeroOverlayEnd} 100%)`,
                  }}
                />

                <div
                  className="absolute z-10"
                  style={{
                    left: `${previewContentPosX}%`,
                    top: `${previewContentPosY}%`,
                    transform: "translate(0, 0)",
                    width: "36%",
                    minWidth: "200px",
                    maxWidth: "360px",
                  }}
                >
                  {style.showBadge !== false && previewActiveSlide?.badge ? (
                    <div className="inline-flex mb-3 rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                      {previewActiveSlide.badge}
                    </div>
                  ) : null}

                  {previewActiveSlide?.title ? (
                    <div className="text-white text-xl font-extrabold leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
                      {previewActiveSlide.title}
                    </div>
                  ) : null}

                  {previewActiveSlide?.subtitle ? (
                    <div className="mt-2 text-sm text-white/85">
                      {previewActiveSlide.subtitle}
                    </div>
                  ) : null}

                  {previewReviewEnabled && previewActiveSlide?.review ? (
                    <div className="mt-3 text-xs text-white/80 leading-relaxed">
                      {previewActiveSlide.review}
                    </div>
                  ) : null}

                  <div className="mt-4">
                    <div
                      className={[
                        "inline-flex items-center justify-center overflow-hidden transition-all duration-300",
                        previewButtonClass,
                      ].join(" ")}
                      style={{
                        background: style.buttonOverlayHoverBg || style.buttonOverlayBg,
                        paddingTop: style.buttonOverlayPaddingYPx,
                        paddingBottom: style.buttonOverlayPaddingYPx,
                        paddingLeft: 14,
                        paddingRight: 14,
                        borderRadius: previewButtonRadius,
                      }}
                    >
                      {previewActiveSlide?.buttonImg ? (
                        <img
                          src={previewActiveSlide.buttonImg}
                          alt={previewActiveSlide.buttonText || "Botón"}
                          className="h-auto"
                          style={{
                            width: style.buttonImageWidthPx,
                            maxWidth: "100%",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            color: style.buttonTextColor,
                            fontSize: style.buttonFontSizePx,
                            fontWeight: style.buttonFontWeight,
                          }}
                        >
                          {previewActiveSlide?.buttonText || "Ver más"}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="absolute z-10 hidden md:flex"
                  style={{
                    left: `${previewThumbsPosX}%`,
                    top: `${previewThumbsPosY}%`,
                    transform: "translate(-50%, -50%)",
                    gap: previewThumbGapPx,
                    alignItems: "center",
                  }}
                >
                  {previewThumbs.map((slide, idx) => {
                    const rotate = idx === 0 ? -previewThumbTiltDeg : idx === 1 ? 0 : previewThumbTiltDeg;
                    const shiftY = idx === 1 ? 0 : 14;
                    const width = idx === 1 ? previewThumbWidthPx : Math.max(previewThumbWidthPx - 16, 70);
                    const height = idx === 1 ? previewThumbHeightPx : Math.max(previewThumbHeightPx - 20, 100);

                    return (
                      <div
                        key={slide.id || idx}
                        className="relative overflow-hidden rounded-2xl border border-white/25 bg-white/10"
                        style={{
                          width,
                          height,
                          transform: `translateY(${shiftY}px) rotate(${rotate}deg)`,
                          boxShadow: "0 18px 38px rgba(0,0,0,0.22)",
                          backdropFilter: "blur(2px)",
                        }}
                      >
                        {slide.image ? (
                          <img
                            src={slide.image}
                            alt={slide.title || `Miniatura ${idx + 1}`}
                            className="w-full h-full"
                            style={{
                              objectFit: style.imageObjectFit,
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-white/80">
                            Miniatura
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black/10" />
                      </div>
                    );
                  })}
                </div>
              </div>

              {style.showArrows ? (
                <>
                  <div
                    className={[
                      "absolute left-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full border",
                      getArrowClasses(style.arrowStyle),
                    ].join(" ")}
                    style={{
                      width: style.arrowSizePx,
                      height: style.arrowSizePx,
                      background: style.arrowBg,
                      color: style.arrowColor,
                      borderColor: style.arrowBorderColor,
                    }}
                  >
                    {getArrowPreview(style.arrowStyle)}
                  </div>

                  <div
                    className={[
                      "absolute right-0 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full border",
                      getArrowClasses(style.arrowStyle),
                    ].join(" ")}
                    style={{
                      width: style.arrowSizePx,
                      height: style.arrowSizePx,
                      background: style.arrowBg,
                      color: style.arrowColor,
                      borderColor: style.arrowBorderColor,
                    }}
                  >
                    {getArrowPreview(style.arrowStyle)}
                  </div>
                </>
              ) : null}
            </div>

            {style.showDots ? (
              <div className="flex justify-center gap-2 mt-4">
                {enabledSlides.slice(0, 5).map((_, dot) => (
                  <span
                    key={dot}
                    className="inline-block rounded-full transition-all duration-300"
                    style={{
                      width: dot === 0 ? 22 : 8,
                      height: 8,
                      background: dot === 0 ? "#111827" : "#d1d5db",
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Esta vista previa usa overlays seguros para no tapar la imagen principal.
          </div>
        </div>
      </div>
    </div>
  );
}