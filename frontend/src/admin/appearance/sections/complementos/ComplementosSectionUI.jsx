// src/admin/appearance/sections/complementos/ComplementosSectionUI.jsx
import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  ChevronsRight,
  MoveRight,
  Sparkles,
} from "lucide-react";
import { Button, Field, Input } from "../ui/UiComponents";
import {
  ColorField,
  RangeNumberField,
  ToggleChip,
} from "../ui/SectionsPanelUI";
import {
  COMPLEMENTOS_SECTION_DEFAULTS,
  normalizeComplementosSection,
} from "./complementosSectionHelpers";

function getComplementosSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "complementos" || type === "complementos";
  });

  return normalizeComplementosSection(found || COMPLEMENTOS_SECTION_DEFAULTS);
}

function updateSectionInTheme(theme, nextSection) {
  const draft = structuredClone(theme || {});
  if (!Array.isArray(draft.sections)) draft.sections = [];

  const idx = draft.sections.findIndex((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "complementos" || type === "complementos";
  });

  if (idx >= 0) {
    draft.sections[idx] = normalizeComplementosSection(nextSection);
  } else {
    draft.sections.push(normalizeComplementosSection(nextSection));
  }

  return draft;
}

function getButtonAnimationPreviewStyle(animation) {
  if (animation === "pulse") {
    return { animation: "pulse 1.8s ease-in-out infinite" };
  }

  if (animation === "soft-float") {
    return { animation: "floatY 3.2s ease-in-out infinite" };
  }

  return {};
}

function renderArrowPreview(styleName) {
  switch (styleName) {
    case "none":
      return null;

    case "chevron-right":
      return <ChevronRight className="w-4 h-4 shrink-0" />;

    case "double-chevron":
      return <ChevronsRight className="w-4 h-4 shrink-0" />;

    case "long-arrow":
      return <MoveRight className="w-4 h-4 shrink-0" />;

    case "spark-arrow":
      return (
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <ArrowRight className="w-4 h-4 shrink-0" />
        </span>
      );

    case "minimal-line":
      return <span className="text-[1em] leading-none">⟶</span>;

    case "arrow-right":
    default:
      return <ArrowRight className="w-4 h-4 shrink-0" />;
  }
}

export default function ComplementosSectionUI({
  theme,
  setPath,
  uploadToCloudinary,
}) {
  const section = useMemo(() => getComplementosSectionFromTheme(theme), [theme]);
  const [tab, setTab] = useState("contenido");
  const [previewHover, setPreviewHover] = useState(false);

  const config = section?.config || COMPLEMENTOS_SECTION_DEFAULTS.config;
  const style = section?.style || COMPLEMENTOS_SECTION_DEFAULTS.style;

  const setComplementosSection = (nextSection) => {
    const safe = normalizeComplementosSection(nextSection);
    const nextTheme = updateSectionInTheme(theme, safe);
    setPath("sections", nextTheme.sections);
  };

  const patchConfig = (patch) => {
    setComplementosSection({
      ...section,
      config: {
        ...config,
        ...patch,
      },
    });
  };

  const patchStyle = (patch) => {
    setComplementosSection({
      ...section,
      style: {
        ...style,
        ...patch,
      },
    });
  };

  const resetComplementosDesign = () => {
    setComplementosSection({
      ...section,
      style: structuredClone(COMPLEMENTOS_SECTION_DEFAULTS.style || {}),
    });
  };

  const previewButtonStyle = {
    left: `${style.buttonPosXPercent}%`,
    top: `${style.buttonPosYPercent}%`,
    background: previewHover ? style.buttonHoverBg : style.buttonBg,
    color: previewHover ? style.buttonHoverTextColor : style.buttonTextColor,
    borderRadius: style.buttonRadiusPx,
    boxShadow: (() => {
      if (previewHover && style.buttonHoverShadow) {
        return "0 14px 30px rgba(0,0,0,0.20)";
      }
      return style.buttonShadow ? "0 10px 24px rgba(0,0,0,0.16)" : "none";
    })(),
    fontSize: style.buttonFontSizePx,
    fontWeight: style.buttonFontWeight,
    paddingLeft: style.buttonPx,
    paddingRight: style.buttonPx,
    paddingTop: style.buttonPy,
    paddingBottom: style.buttonPy,
    gap: style.buttonGapPx,
    backdropFilter: "blur(4px)",
    transform: previewHover
      ? `translate(-50%, -50%) scale(${style.buttonHoverScale})`
      : "translate(-50%, -50%) scale(1)",
    transition:
      "transform 220ms ease, background 220ms ease, color 220ms ease, box-shadow 220ms ease",
    ...getButtonAnimationPreviewStyle(style.buttonAnimation),
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
      <style>{`
        @keyframes floatY {
          0% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
          100% { transform: translate(-50%, -50%) translateY(0px); }
        }
      `}</style>

      <div className="space-y-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-extrabold text-neutral-900">
                Editor de sección Complementos
              </div>
              <div className="text-sm text-neutral-500 mt-1">
                Configura imagen, botón, link, posición y estilos visuales del banner.
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
                onClick={resetComplementosDesign}
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
                    onClick={() => setComplementosSection({ ...section, enabled: true })}
                  >
                    Activa
                  </ToggleChip>
                  <ToggleChip
                    active={section.enabled === false}
                    onClick={() => setComplementosSection({ ...section, enabled: false })}
                  >
                    Desactivada
                  </ToggleChip>
                </div>
              </Field>

              <Field
                label="Imagen principal"
                hint="Puedes usar una imagen subida o una ruta pública."
              >
                <div className="space-y-3">
                  <Input
                    value={config.imageSrc || ""}
                    onChange={(e) => patchConfig({ imageSrc: e.target.value })}
                    placeholder="/ImgComplementos/ComplementosBanner.png o https://..."
                  />

                  <div className="text-xs text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-xl px-3 py-2">
                    {config.recommendedImageNote ||
                      "Tamaño recomendado: 1600 x 500 px. Usa una imagen horizontal tipo banner."}
                  </div>

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
                            if (url) patchConfig({ imageSrc: url });
                          } catch (err) {
                            console.error("Error subiendo imagen de Complementos:", err);
                          }
                        }}
                      />
                    </label>

                    {config.imageSrc ? (
                      <div className="w-32 h-20 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                        <img
                          src={config.imageSrc}
                          alt="Preview Complementos"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </Field>

              <Field label="Texto de ayuda para la imagen">
                <Input
                  value={config.recommendedImageNote || ""}
                  onChange={(e) =>
                    patchConfig({ recommendedImageNote: e.target.value })
                  }
                  placeholder="Tamaño recomendado: 1600 x 500 px. Usa una imagen horizontal tipo banner."
                />
              </Field>

              <Field label="Texto alternativo de la imagen">
                <Input
                  value={config.imageAlt || ""}
                  onChange={(e) => patchConfig({ imageAlt: e.target.value })}
                  placeholder="Complementos"
                />
              </Field>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
              <div className="text-sm font-extrabold text-neutral-900">
                Botón
              </div>

              <Field label="Mostrar botón">
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    active={config.buttonEnabled !== false}
                    onClick={() => patchConfig({ buttonEnabled: true })}
                  >
                    Visible
                  </ToggleChip>
                  <ToggleChip
                    active={config.buttonEnabled === false}
                    onClick={() => patchConfig({ buttonEnabled: false })}
                  >
                    Oculto
                  </ToggleChip>
                </div>
              </Field>

              <Field label="Texto del botón">
                <Input
                  value={config.buttonText || ""}
                  onChange={(e) => patchConfig({ buttonText: e.target.value })}
                  placeholder="Conócelos"
                />
              </Field>

              <Field label="Link del botón">
                <Input
                  value={config.linkHref || ""}
                  onChange={(e) => patchConfig({ linkHref: e.target.value })}
                  placeholder="/complementos"
                />
              </Field>
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
                  label="Margen superior"
                  min={0}
                  max={200}
                  step={1}
                  value={style.sectionMarginTopPx}
                  onChange={(v) => patchStyle({ sectionMarginTopPx: v })}
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
                  label="Ancho máximo del bloque"
                  min={320}
                  max={1800}
                  step={1}
                  value={style.contentMaxWidthPx}
                  onChange={(v) => patchStyle({ contentMaxWidthPx: v })}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Imagen principal
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Ancho de imagen (%)"
                  min={20}
                  max={100}
                  step={1}
                  value={style.imageWidthPercent}
                  onChange={(v) => patchStyle({ imageWidthPercent: v })}
                />

                <RangeNumberField
                  label="Alto de imagen (px)"
                  min={120}
                  max={800}
                  step={1}
                  value={style.imageHeightPx}
                  onChange={(v) => patchStyle({ imageHeightPx: v })}
                />

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
                  label="Radio de bordes"
                  min={0}
                  max={48}
                  step={1}
                  value={style.imageRadiusPx}
                  onChange={(v) => patchStyle({ imageRadiusPx: v })}
                />

                <RangeNumberField
                  label="Grosor del borde"
                  min={0}
                  max={16}
                  step={1}
                  value={style.imageBorderPx}
                  onChange={(v) => patchStyle({ imageBorderPx: v })}
                />

                <ColorField
                  label="Color del borde"
                  value={style.imageBorderColor}
                  onChange={(v) => patchStyle({ imageBorderColor: v })}
                />

                <RangeNumberField
                  label="Grosor del ring"
                  min={0}
                  max={16}
                  step={1}
                  value={style.ringWidthPx}
                  onChange={(v) => patchStyle({ ringWidthPx: v })}
                />

                <ColorField
                  label="Color del ring"
                  value={style.ringColor}
                  onChange={(v) => patchStyle({ ringColor: v })}
                />

                <Field label="Sombra">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.imageShadow}
                      onClick={() => patchStyle({ imageShadow: true })}
                    >
                      Con sombra
                    </ToggleChip>
                    <ToggleChip
                      active={!style.imageShadow}
                      onClick={() => patchStyle({ imageShadow: false })}
                    >
                      Sin sombra
                    </ToggleChip>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Posición y estilo del botón
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Posición X (%)"
                  min={0}
                  max={100}
                  step={1}
                  value={style.buttonPosXPercent}
                  onChange={(v) => patchStyle({ buttonPosXPercent: v })}
                />

                <RangeNumberField
                  label="Posición Y (%)"
                  min={0}
                  max={100}
                  step={1}
                  value={style.buttonPosYPercent}
                  onChange={(v) => patchStyle({ buttonPosYPercent: v })}
                />

                <ColorField
                  label="Fondo botón"
                  value={style.buttonBg}
                  onChange={(v) => patchStyle({ buttonBg: v })}
                />

                <ColorField
                  label="Texto botón"
                  value={style.buttonTextColor}
                  onChange={(v) => patchStyle({ buttonTextColor: v })}
                />

                <RangeNumberField
                  label="Radio botón"
                  min={0}
                  max={32}
                  step={1}
                  value={style.buttonRadiusPx}
                  onChange={(v) => patchStyle({ buttonRadiusPx: v })}
                />

                <Field label="Sombra botón">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.buttonShadow}
                      onClick={() => patchStyle({ buttonShadow: true })}
                    >
                      Con sombra
                    </ToggleChip>
                    <ToggleChip
                      active={!style.buttonShadow}
                      onClick={() => patchStyle({ buttonShadow: false })}
                    >
                      Sin sombra
                    </ToggleChip>
                  </div>
                </Field>

                <RangeNumberField
                  label="Tamaño texto botón"
                  min={10}
                  max={32}
                  step={1}
                  value={style.buttonFontSizePx}
                  onChange={(v) => patchStyle({ buttonFontSizePx: v })}
                />

                <RangeNumberField
                  label="Peso texto botón"
                  min={100}
                  max={900}
                  step={100}
                  value={style.buttonFontWeight}
                  onChange={(v) => patchStyle({ buttonFontWeight: v })}
                />

                <RangeNumberField
                  label="Padding horizontal botón"
                  min={8}
                  max={48}
                  step={1}
                  value={style.buttonPx}
                  onChange={(v) => patchStyle({ buttonPx: v })}
                />

                <RangeNumberField
                  label="Padding vertical botón"
                  min={6}
                  max={32}
                  step={1}
                  value={style.buttonPy}
                  onChange={(v) => patchStyle({ buttonPy: v })}
                />

                <RangeNumberField
                  label="Separación icono"
                  min={0}
                  max={24}
                  step={1}
                  value={style.buttonGapPx}
                  onChange={(v) => patchStyle({ buttonGapPx: v })}
                />

                <ColorField
                  label="Fondo botón hover"
                  value={style.buttonHoverBg}
                  onChange={(v) => patchStyle({ buttonHoverBg: v })}
                />

                <ColorField
                  label="Texto botón hover"
                  value={style.buttonHoverTextColor}
                  onChange={(v) => patchStyle({ buttonHoverTextColor: v })}
                />

                <RangeNumberField
                  label="Escala hover"
                  min={1}
                  max={1.3}
                  step={0.01}
                  value={style.buttonHoverScale}
                  onChange={(v) => patchStyle({ buttonHoverScale: v })}
                />

                <Field label="Sombra hover">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.buttonHoverShadow}
                      onClick={() => patchStyle({ buttonHoverShadow: true })}
                    >
                      Activa
                    </ToggleChip>
                    <ToggleChip
                      active={!style.buttonHoverShadow}
                      onClick={() => patchStyle({ buttonHoverShadow: false })}
                    >
                      Inactiva
                    </ToggleChip>
                  </div>
                </Field>
              </div>

              <div className="mt-4 space-y-4">
                <Field label="Animación del botón">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.buttonAnimation === "none"}
                      onClick={() => patchStyle({ buttonAnimation: "none" })}
                    >
                      Sin animación
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonAnimation === "soft-float"}
                      onClick={() => patchStyle({ buttonAnimation: "soft-float" })}
                    >
                      Flotación suave
                    </ToggleChip>
                    <ToggleChip
                      active={style.buttonAnimation === "pulse"}
                      onClick={() => patchStyle({ buttonAnimation: "pulse" })}
                    >
                      Pulse
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Estilo de flecha">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={style.buttonArrowStyle === "none"}
                      onClick={() => patchStyle({ buttonArrowStyle: "none" })}
                    >
                      Sin flecha
                    </ToggleChip>

                    <ToggleChip
                      active={style.buttonArrowStyle === "arrow-right"}
                      onClick={() => patchStyle({ buttonArrowStyle: "arrow-right" })}
                    >
                      Clásica
                    </ToggleChip>

                    <ToggleChip
                      active={style.buttonArrowStyle === "long-arrow"}
                      onClick={() => patchStyle({ buttonArrowStyle: "long-arrow" })}
                    >
                      Larga
                    </ToggleChip>

                    <ToggleChip
                      active={style.buttonArrowStyle === "chevron-right"}
                      onClick={() => patchStyle({ buttonArrowStyle: "chevron-right" })}
                    >
                      Chevron
                    </ToggleChip>

                    <ToggleChip
                      active={style.buttonArrowStyle === "double-chevron"}
                      onClick={() => patchStyle({ buttonArrowStyle: "double-chevron" })}
                    >
                      Doble
                    </ToggleChip>

                    <ToggleChip
                      active={style.buttonArrowStyle === "spark-arrow"}
                      onClick={() => patchStyle({ buttonArrowStyle: "spark-arrow" })}
                    >
                      Elegante
                    </ToggleChip>

                    <ToggleChip
                      active={style.buttonArrowStyle === "minimal-line"}
                      onClick={() => patchStyle({ buttonArrowStyle: "minimal-line" })}
                    >
                      Minimal
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
            Vista previa Complementos
          </div>

          <div className="mb-3 text-xs text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-xl px-3 py-2">
            {config.recommendedImageNote ||
              "Tamaño recomendado: 1600 x 500 px. Usa una imagen horizontal tipo banner."}
          </div>

          <div
            className="mx-auto"
            style={{
              marginTop: style.sectionMarginTopPx,
              paddingLeft: style.sectionPaddingXPx,
              paddingRight: style.sectionPaddingXPx,
              maxWidth: style.contentMaxWidthPx,
            }}
          >
            <div className="relative">
              <img
                src={config.imageSrc}
                alt={config.imageAlt || "Complementos"}
                className="block mx-auto"
                style={{
                  width: `${style.imageWidthPercent}%`,
                  height: `${style.imageHeightPx}px`,
                  objectFit: style.imageObjectFit,
                  borderRadius: style.imageRadiusPx,
                  borderWidth: style.imageBorderPx,
                  borderStyle: "solid",
                  borderColor: style.imageBorderColor,
                  boxShadow: style.imageShadow ? "0 25px 50px rgba(0,0,0,0.18)" : "none",
                  outline: `${style.ringWidthPx}px solid ${style.ringColor}`,
                  outlineOffset: "0px",
                }}
              />

              {config.buttonEnabled ? (
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 inline-flex items-center uppercase"
                  style={previewButtonStyle}
                  onMouseEnter={() => setPreviewHover(true)}
                  onMouseLeave={() => setPreviewHover(false)}
                >
                  <span>{config.buttonText || "Conócelos"}</span>
                  {renderArrowPreview(style.buttonArrowStyle)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Esta vista previa es referencial. Pasa el mouse sobre el botón para ver el hover.
          </div>
        </div>
      </div>
    </div>
  );
}