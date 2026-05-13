// src/admin/appearance/sections/look/LookSectionUI.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Button, Field, Input } from "../ui/UiComponents";
import {
  ColorField,
  CardImageMover,
  TextStyleFields,
  RangeNumberField,
  ToggleChip,
} from "../ui/SectionsPanelUI";
import LookProductPicker from "./LookProductPicker";
import {
  LOOK_MAX_PRODUCTS,
  LOOK_SECTION_DEFAULTS,
  normalizeLookSection,
} from "./lookSectionHelpers";

function getLookSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "look" || type === "look";
  });

  return normalizeLookSection(found || LOOK_SECTION_DEFAULTS);
}

function updateSectionInTheme(theme, nextSection) {
  const draft = structuredClone(theme || {});
  if (!Array.isArray(draft.sections)) draft.sections = [];

  const idx = draft.sections.findIndex((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "look" || type === "look";
  });

  if (idx >= 0) {
    draft.sections[idx] = normalizeLookSection(nextSection);
  } else {
    draft.sections.push(normalizeLookSection(nextSection));
  }

  return draft;
}

function moneyCOP(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "$0";
  return `$${Math.round(n).toLocaleString("es-CO")}`;
}

function buildPreviewTextStyle(style, prefix, fallback = {}) {
  const fontFamily =
    typeof style?.[`${prefix}FontFamily`] === "string" && style[`${prefix}FontFamily`].trim()
      ? style[`${prefix}FontFamily`].trim()
      : fallback.fontFamily || "inherit";

  const color =
    typeof style?.[`${prefix}Color`] === "string" && style[`${prefix}Color`].trim()
      ? style[`${prefix}Color`].trim()
      : fallback.color || "inherit";

  const sizePx = Number(style?.[`${prefix}SizePx`] ?? fallback.fontSize ?? 14);
  const weight = Number(style?.[`${prefix}Weight`] ?? fallback.fontWeight ?? 400);

  return {
    fontFamily,
    color,
    fontSize: Number.isFinite(sizePx) ? sizePx : 14,
    fontWeight: Number.isFinite(weight) ? weight : 400,
    fontStyle: style?.[`${prefix}Italic`] ? "italic" : "normal",
    textDecoration: style?.[`${prefix}Underline`] ? "underline" : "none",
  };
}

export default function LookSectionUI({
  theme,
  setPath,
  uploadToCloudinary,
}) {
  const section = useMemo(() => getLookSectionFromTheme(theme), [theme]);
  const [tab, setTab] = useState("contenido");

  const style = section?.style || LOOK_SECTION_DEFAULTS.style;
  const config = section?.config || LOOK_SECTION_DEFAULTS.config;

  const selectedItems = Array.isArray(config.products) ? config.products : [];
  const selectedProductId = String(config.selectedProductId || "").trim();

  const selectedPreviewItem = useMemo(() => {
    if (!selectedItems.length) return null;

    return (
      selectedItems.find((p) => String(p?.productId || "").trim() === selectedProductId) ||
      selectedItems[0] ||
      null
    );
  }, [selectedItems, selectedProductId]);

  const safeThumbHeightPx = useMemo(() => {
    const n = Number(style?.thumbHeightPx);
    if (!Number.isFinite(n)) return 240;
    return Math.min(360, Math.max(160, n));
  }, [style?.thumbHeightPx]);

  const safeThumbCardMaxWidthPx = useMemo(() => {
    const n = Number(style?.thumbCardMaxWidthPx);
    if (!Number.isFinite(n)) return 220;
    return Math.min(320, Math.max(140, n));
  }, [style?.thumbCardMaxWidthPx]);

  const safeMobileSliderGapPx = useMemo(() => {
    const n = Number(style?.mobileSliderGapPx);
    if (!Number.isFinite(n)) return Number(style?.thumbGapPx) || 12;
    return Math.min(60, Math.max(0, n));
  }, [style?.mobileSliderGapPx, style?.thumbGapPx]);

  const safeMobileSliderControlMarginTopPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlMarginTopPx);
    if (!Number.isFinite(n)) return 12;
    return Math.min(80, Math.max(0, n));
  }, [style?.mobileSliderControlMarginTopPx]);

  const safeMobileSliderControlRadiusPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlRadiusPx);
    if (!Number.isFinite(n)) return 999;
    return Math.min(999, Math.max(0, n));
  }, [style?.mobileSliderControlRadiusPx]);

  const safeMobileSliderControlButtonWidthPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlButtonWidthPx);
    if (!Number.isFinite(n)) return 44;
    return Math.min(120, Math.max(20, n));
  }, [style?.mobileSliderControlButtonWidthPx]);

  const safeMobileSliderControlButtonHeightPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlButtonHeightPx);
    if (!Number.isFinite(n)) return 36;
    return Math.min(120, Math.max(20, n));
  }, [style?.mobileSliderControlButtonHeightPx]);

  const safeMobileSliderControlSeparatorWidthPx = useMemo(() => {
    const n = Number(style?.mobileSliderControlSeparatorWidthPx);
    if (!Number.isFinite(n)) return 1;
    return Math.min(12, Math.max(0, n));
  }, [style?.mobileSliderControlSeparatorWidthPx]);

  const safeAdminPreviewContentMaxWidth = useMemo(() => {
    const n = Number(style?.contentMaxWidthPx);
    if (!Number.isFinite(n)) return 680;
    return Math.min(760, Math.max(320, n));
  }, [style?.contentMaxWidthPx]);

  const setLookSection = (nextSection) => {
    const safe = normalizeLookSection(nextSection);
    const nextTheme = updateSectionInTheme(theme, safe);
    setPath("sections", nextTheme.sections);
  };

  const patchConfig = (patch) => {
    setLookSection({
      ...section,
      config: {
        ...config,
        ...patch,
      },
    });
  };

  const patchStyle = (patch) => {
    setLookSection({
      ...section,
      style: {
        ...style,
        ...patch,
      },
    });
  };

  const setProducts = (products) => {
    const safeProducts = Array.isArray(products) ? products.slice(0, LOOK_MAX_PRODUCTS) : [];
    const currentSelected = String(config.selectedProductId || "").trim();
    const ids = safeProducts.map((p) => String(p?.productId || "").trim()).filter(Boolean);

    let nextSelected = currentSelected;
    if (!ids.includes(currentSelected)) {
      nextSelected = ids[0] || "";
    }

    patchConfig({
      products: safeProducts,
      selectedProductId: nextSelected,
      maxItems: LOOK_MAX_PRODUCTS,
    });
  };

  const patchProduct = (productId, patch) => {
    const pid = String(productId || "").trim();
    const next = selectedItems.map((item) => {
      if (String(item?.productId || "").trim() !== pid) return item;
      return {
        ...item,
        ...patch,
      };
    });

    setProducts(next);
  };

  const titleTextStyle = useMemo(
    () => buildPreviewTextStyle(style, "title", { fontSize: 28, fontWeight: 700, color: "#374151" }),
    [style]
  );

  const descTextStyle = useMemo(
    () => buildPreviewTextStyle(style, "desc", { fontSize: 14, fontWeight: 400, color: "#374151" }),
    [style]
  );

  const thumbTitleTextStyle = useMemo(
    () =>
      buildPreviewTextStyle(style, "thumbTitle", {
        fontSize: 14,
        fontWeight: 500,
        color: "#1f2937",
      }),
    [style]
  );

  const thumbPriceTextStyle = useMemo(
    () =>
      buildPreviewTextStyle(style, "thumbPrice", {
        fontSize: 14,
        fontWeight: 500,
        color: "#e11d48",
      }),
    [style]
  );

  useEffect(() => {
    if (!selectedItems.length && config.selectedProductId) {
      patchConfig({ selectedProductId: "" });
      return;
    }

    if (!selectedItems.length) return;

    const ids = selectedItems.map((p) => String(p?.productId || "").trim()).filter(Boolean);
    if (!ids.includes(String(config.selectedProductId || "").trim())) {
      patchConfig({ selectedProductId: ids[0] || "" });
    }
  }, [selectedItems, config.selectedProductId]);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.45fr)] gap-4">
      <div className="space-y-4 min-w-0">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-extrabold text-neutral-900">Editor de sección LOOK</div>
              <div className="text-sm text-neutral-500 mt-1">
                Configura título, descripción, productos, imagen principal dinámica y estilos visuales.
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
                kind={tab === "slider-movil" ? "primary" : "ghost"}
                onClick={() => setTab("slider-movil")}
              >
                Slider móvil
              </Button>

              <Button
                type="button"
                kind={tab === "acciones" ? "primary" : "ghost"}
                onClick={() => setTab("acciones")}
              >
                Acciones
              </Button>
            </div>
          </div>
        </div>

        {tab === "contenido" && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Datos principales</div>

              <Field label="Activa esta sección">
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    active={section.enabled !== false}
                    onClick={() => setLookSection({ ...section, enabled: true })}
                  >
                    Activa
                  </ToggleChip>
                  <ToggleChip
                    active={section.enabled === false}
                    onClick={() => setLookSection({ ...section, enabled: false })}
                  >
                    Desactivada
                  </ToggleChip>
                </div>
              </Field>

              <Field
                label="Imagen del título"
                hint="Puedes usar una imagen subida a Cloudinary o una ruta pública."
              >
                <div className="space-y-3">
                  <Input
                    value={config.titleImage || ""}
                    onChange={(e) => patchConfig({ titleImage: e.target.value })}
                    placeholder="/ImgSEccionLook/Titulo.png o https://..."
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
                            if (url) patchConfig({ titleImage: url });
                          } catch (err) {
                            console.error("Error subiendo titleImage LOOK:", err);
                          }
                        }}
                      />
                    </label>

                    {config.titleImage ? (
                      <div className="w-28 h-14 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50">
                        <img
                          src={config.titleImage}
                          alt="Título look"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </Field>

              <Field
                label="Texto alternativo del título"
                hint="Se usa cuando no quieras depender solo de la imagen."
              >
                <Input
                  value={config.titleText || ""}
                  onChange={(e) => patchConfig({ titleText: e.target.value })}
                  placeholder="Ej: Looks para bautizo"
                />
              </Field>

              <Field label="Descripción de la sección">
                <textarea
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400 min-h-[100px]"
                  value={config.description || ""}
                  onChange={(e) => patchConfig({ description: e.target.value })}
                  placeholder="Texto descriptivo de la sección LOOK…"
                />
              </Field>
            </div>

            <LookProductPicker
              title="Productos de la sección LOOK"
              value={selectedItems}
              maxItems={LOOK_MAX_PRODUCTS}
              onChange={setProducts}
              onPick={(item, result) => {
                const next = [...selectedItems, item].slice(0, LOOK_MAX_PRODUCTS);
                const shouldSelect = !config.selectedProductId;
                patchConfig({
                  products: next,
                  selectedProductId: shouldSelect ? item.productId : config.selectedProductId,
                  maxItems: LOOK_MAX_PRODUCTS,
                });
              }}
            />

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Producto inicial (imagen grande al cargar)
              </div>

              {!selectedItems.length ? (
                <div className="text-sm text-neutral-500">
                  Primero agrega productos arriba.
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {selectedItems.map((item, index) => {
                    const pid = String(item?.productId || "").trim();
                    const active = pid === selectedProductId;

                    return (
                      <button
                        key={`${pid}_${index}`}
                        type="button"
                        onClick={() => patchConfig({ selectedProductId: pid })}
                        className={[
                          "rounded-xl border p-3 text-left transition",
                          active
                            ? "border-neutral-900 bg-neutral-900 text-white"
                            : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900",
                        ].join(" ")}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 rounded-lg overflow-hidden border border-neutral-200 bg-neutral-50 shrink-0">
                            {item?.mainImage ? (
                              <img
                                src={item.mainImage}
                                alt={item.title || pid}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[10px] text-neutral-400">
                                —
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="text-sm font-bold line-clamp-1">
                              {item?.title || "Producto"}
                            </div>
                            <div className="text-xs opacity-80 line-clamp-1">{pid}</div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {!!selectedItems.length && (
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="text-sm font-extrabold text-neutral-900 mb-3">
                  Imágenes por producto
                </div>

                <div className="space-y-4">
                  {selectedItems.map((item, index) => {
                    const pid = String(item?.productId || "").trim();

                    return (
                      <div
                        key={`${pid}_${index}`}
                        className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                      >
                        <div className="text-sm font-bold text-neutral-900 mb-2">
                          {item?.title || "Producto"} · {pid}
                        </div>

                        <CardImageMover
                          productId={pid}
                          item={item}
                          uploadToCloudinary={uploadToCloudinary}
                          onChangeImages={(patch) => patchProduct(pid, patch)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "estilos" && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Layout general</div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Padding superior"
                  min={0}
                  max={300}
                  step={1}
                  value={style.sectionPaddingTopPx}
                  onChange={(v) => patchStyle({ sectionPaddingTopPx: v })}
                />

                <RangeNumberField
                  label="Padding inferior"
                  min={0}
                  max={300}
                  step={1}
                  value={style.sectionPaddingBottomPx}
                  onChange={(v) => patchStyle({ sectionPaddingBottomPx: v })}
                />

                <RangeNumberField
                  label="Padding horizontal"
                  min={0}
                  max={120}
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

                <RangeNumberField
                  label="Separación entre columnas"
                  min={0}
                  max={120}
                  step={1}
                  value={style.contentGapPx}
                  onChange={(v) => patchStyle({ contentGapPx: v })}
                />

                <RangeNumberField
                  label="Ancho imagen grande (ratio izquierda)"
                  min={1}
                  max={4}
                  step={0.1}
                  value={style.desktopLeftRatio}
                  onChange={(v) => patchStyle({ desktopLeftRatio: v })}
                />

                <RangeNumberField
                  label="Ancho galería (ratio derecha)"
                  min={1}
                  max={4}
                  step={0.1}
                  value={style.desktopRightRatio}
                  onChange={(v) => patchStyle({ desktopRightRatio: v })}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Título y descripción</div>

              <div className="grid md:grid-cols-2 gap-3 mb-4">
                <RangeNumberField
                  label="Ancho máximo imagen título"
                  min={80}
                  max={1000}
                  step={1}
                  value={style.titleImageWidthPx}
                  onChange={(v) => patchStyle({ titleImageWidthPx: v })}
                />

                <RangeNumberField
                  label="Separación título / descripción"
                  min={0}
                  max={80}
                  step={1}
                  value={style.titleGapPx}
                  onChange={(v) => patchStyle({ titleGapPx: v })}
                />
              </div>

              <Field label="Alineación del bloque de título">
                <div className="flex flex-wrap gap-2">
                  <ToggleChip
                    active={style.titleAlign === "left"}
                    onClick={() => patchStyle({ titleAlign: "left" })}
                  >
                    Izquierda
                  </ToggleChip>
                  <ToggleChip
                    active={style.titleAlign === "center"}
                    onClick={() => patchStyle({ titleAlign: "center" })}
                  >
                    Centro
                  </ToggleChip>
                  <ToggleChip
                    active={style.titleAlign === "right"}
                    onClick={() => patchStyle({ titleAlign: "right" })}
                  >
                    Derecha
                  </ToggleChip>
                </div>
              </Field>

              <div className="grid xl:grid-cols-2 gap-4 mt-4">
                <TextStyleFields
                  title="Estilo del título"
                  prefix="title"
                  style={style}
                  onChange={patchStyle}
                />

                <TextStyleFields
                  title="Estilo de la descripción"
                  prefix="desc"
                  style={style}
                  onChange={patchStyle}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Imagen principal grande</div>

              <div className="grid md:grid-cols-2 gap-3">
                <Field label="Proporción">
                  <div className="flex flex-wrap gap-2">
                    {["1/1", "3/4", "4/5", "16/9"].map((aspect) => (
                      <ToggleChip
                        key={aspect}
                        active={style.mainImageAspect === aspect}
                        onClick={() => patchStyle({ mainImageAspect: aspect })}
                      >
                        {aspect}
                      </ToggleChip>
                    ))}
                  </div>
                </Field>

                <RangeNumberField
                  label="Radio de bordes"
                  min={0}
                  max={80}
                  step={1}
                  value={style.mainImageRadiusPx}
                  onChange={(v) => patchStyle({ mainImageRadiusPx: v })}
                />

                <RangeNumberField
                  label="Grosor del borde"
                  min={0}
                  max={20}
                  step={1}
                  value={style.mainImageBorderPx}
                  onChange={(v) => patchStyle({ mainImageBorderPx: v })}
                />

                <ColorField
                  label="Color del borde"
                  value={style.mainImageBorderColor}
                  onChange={(v) => patchStyle({ mainImageBorderColor: v })}
                />

                <Field label="Sombra">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.mainImageShadow}
                      onClick={() => patchStyle({ mainImageShadow: true })}
                    >
                      Con sombra
                    </ToggleChip>
                    <ToggleChip
                      active={!style.mainImageShadow}
                      onClick={() => patchStyle({ mainImageShadow: false })}
                    >
                      Sin sombra
                    </ToggleChip>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Miniaturas y textos</div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Columnas miniaturas (desktop)"
                  min={1}
                  max={4}
                  step={1}
                  value={style.thumbGridColsDesktop}
                  onChange={(v) => patchStyle({ thumbGridColsDesktop: v })}
                />

                <RangeNumberField
                  label="Columnas miniaturas (móvil)"
                  min={1}
                  max={3}
                  step={1}
                  value={style.thumbGridColsMobile}
                  onChange={(v) => patchStyle({ thumbGridColsMobile: v })}
                />

                <RangeNumberField
                  label="Separación entre miniaturas"
                  min={0}
                  max={60}
                  step={1}
                  value={style.thumbGapPx}
                  onChange={(v) => patchStyle({ thumbGapPx: v })}
                />

                <RangeNumberField
                  label="Alto miniaturas"
                  min={160}
                  max={360}
                  step={1}
                  value={safeThumbHeightPx}
                  onChange={(v) => patchStyle({ thumbHeightPx: v })}
                />

                <RangeNumberField
                  label="Ancho máximo miniatura"
                  min={140}
                  max={320}
                  step={1}
                  value={safeThumbCardMaxWidthPx}
                  onChange={(v) => patchStyle({ thumbCardMaxWidthPx: v })}
                />

                <RangeNumberField
                  label="Radio miniaturas"
                  min={0}
                  max={40}
                  step={1}
                  value={style.thumbRadiusPx}
                  onChange={(v) => patchStyle({ thumbRadiusPx: v })}
                />

                <RangeNumberField
                  label="Escala hover miniatura"
                  min={1}
                  max={1.2}
                  step={0.01}
                  value={style.thumbHoverScale}
                  onChange={(v) => patchStyle({ thumbHoverScale: v })}
                />

                <RangeNumberField
                  label="Rotación hover miniatura"
                  min={0}
                  max={10}
                  step={0.1}
                  value={style.thumbHoverRotateDeg}
                  onChange={(v) => patchStyle({ thumbHoverRotateDeg: v })}
                />

                <Field label="Sombra miniaturas">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={!!style.thumbShadow}
                      onClick={() => patchStyle({ thumbShadow: true })}
                    >
                      Con sombra
                    </ToggleChip>
                    <ToggleChip
                      active={!style.thumbShadow}
                      onClick={() => patchStyle({ thumbShadow: false })}
                    >
                      Sin sombra
                    </ToggleChip>
                  </div>
                </Field>

                <RangeNumberField
                  label="Tamaño puntos de color"
                  min={8}
                  max={40}
                  step={1}
                  value={style.colorDotSizePx}
                  onChange={(v) => patchStyle({ colorDotSizePx: v })}
                />

                <ColorField
                  label="Borde puntos de color"
                  value={style.colorDotBorderColor}
                  onChange={(v) => patchStyle({ colorDotBorderColor: v })}
                />
              </div>

              <div className="grid xl:grid-cols-2 gap-4 mt-4">
                <TextStyleFields
                  title="Texto nombre de miniatura"
                  prefix="thumbTitle"
                  style={style}
                  onChange={patchStyle}
                />

                <TextStyleFields
                  title="Texto precio miniatura"
                  prefix="thumbPrice"
                  style={style}
                  onChange={patchStyle}
                />
              </div>
            </div>
          </>
        )}

        {tab === "slider-movil" && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Mini slider móvil</div>

              <div className="grid md:grid-cols-2 gap-3">
                <RangeNumberField
                  label="Separación entre slides"
                  min={0}
                  max={60}
                  step={1}
                  value={safeMobileSliderGapPx}
                  onChange={(v) => patchStyle({ mobileSliderGapPx: v })}
                />

                <RangeNumberField
                  label="Margen superior de controles"
                  min={0}
                  max={80}
                  step={1}
                  value={safeMobileSliderControlMarginTopPx}
                  onChange={(v) => patchStyle({ mobileSliderControlMarginTopPx: v })}
                />

                <ColorField
                  label="Fondo de controles"
                  value={style.mobileSliderControlBg || "#ffffff"}
                  onChange={(v) => patchStyle({ mobileSliderControlBg: v })}
                />

                <ColorField
                  label="Borde de controles"
                  value={style.mobileSliderControlBorderColor || "#d4d4d8"}
                  onChange={(v) => patchStyle({ mobileSliderControlBorderColor: v })}
                />

                <ColorField
                  label="Color de íconos"
                  value={style.mobileSliderControlIconColor || "#111827"}
                  onChange={(v) => patchStyle({ mobileSliderControlIconColor: v })}
                />

                <ColorField
                  label="Color del separador"
                  value={style.mobileSliderControlSeparatorColor || "#d4d4d8"}
                  onChange={(v) => patchStyle({ mobileSliderControlSeparatorColor: v })}
                />

                <RangeNumberField
                  label="Radio de controles"
                  min={0}
                  max={999}
                  step={1}
                  value={safeMobileSliderControlRadiusPx}
                  onChange={(v) => patchStyle({ mobileSliderControlRadiusPx: v })}
                />

                <RangeNumberField
                  label="Ancho botón control"
                  min={20}
                  max={120}
                  step={1}
                  value={safeMobileSliderControlButtonWidthPx}
                  onChange={(v) => patchStyle({ mobileSliderControlButtonWidthPx: v })}
                />

                <RangeNumberField
                  label="Alto botón control"
                  min={20}
                  max={120}
                  step={1}
                  value={safeMobileSliderControlButtonHeightPx}
                  onChange={(v) => patchStyle({ mobileSliderControlButtonHeightPx: v })}
                />

                <RangeNumberField
                  label="Ancho separador"
                  min={0}
                  max={12}
                  step={1}
                  value={safeMobileSliderControlSeparatorWidthPx}
                  onChange={(v) => patchStyle({ mobileSliderControlSeparatorWidthPx: v })}
                />
              </div>
            </div>
          </>
        )}

        {tab === "acciones" && (
          <>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Botones de acción</div>

              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Favoritos">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={config?.actions?.favorite?.enabled !== false}
                      onClick={() =>
                        patchConfig({
                          actions: {
                            ...config.actions,
                            favorite: { ...(config.actions?.favorite || {}), enabled: true },
                          },
                        })
                      }
                    >
                      Activo
                    </ToggleChip>
                    <ToggleChip
                      active={config?.actions?.favorite?.enabled === false}
                      onClick={() =>
                        patchConfig({
                          actions: {
                            ...config.actions,
                            favorite: { ...(config.actions?.favorite || {}), enabled: false },
                          },
                        })
                      }
                    >
                      Oculto
                    </ToggleChip>
                  </div>
                </Field>

                <Field label="Carrito">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip
                      active={config?.actions?.cart?.enabled !== false}
                      onClick={() =>
                        patchConfig({
                          actions: {
                            ...config.actions,
                            cart: { ...(config.actions?.cart || {}), enabled: true },
                          },
                        })
                      }
                    >
                      Activo
                    </ToggleChip>
                    <ToggleChip
                      active={config?.actions?.cart?.enabled === false}
                      onClick={() =>
                        patchConfig({
                          actions: {
                            ...config.actions,
                            cart: { ...(config.actions?.cart || {}), enabled: false },
                          },
                        })
                      }
                    >
                      Oculto
                    </ToggleChip>
                  </div>
                </Field>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">
                Colores de los botones / tooltip
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <ColorField
                  label="Fondo botón"
                  value={style.actionButtonBg}
                  onChange={(v) => patchStyle({ actionButtonBg: v })}
                />

                <ColorField
                  label="Borde botón"
                  value={style.actionButtonBorderColor}
                  onChange={(v) => patchStyle({ actionButtonBorderColor: v })}
                />

                <ColorField
                  label="Color icono favorito"
                  value={style.actionFavoriteColor}
                  onChange={(v) => patchStyle({ actionFavoriteColor: v })}
                />

                <ColorField
                  label="Color icono carrito"
                  value={style.actionCartColor}
                  onChange={(v) => patchStyle({ actionCartColor: v })}
                />

                <ColorField
                  label="Fondo tooltip"
                  value={style.actionTooltipBg}
                  onChange={(v) => patchStyle({ actionTooltipBg: v })}
                />

                <ColorField
                  label="Texto tooltip"
                  value={style.actionTooltipTextColor}
                  onChange={(v) => patchStyle({ actionTooltipTextColor: v })}
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div className="space-y-4 w-full xl:max-w-[560px] xl:ml-auto">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 sticky top-4">
          <div className="text-base font-extrabold text-neutral-900 mb-3">Vista previa LOOK</div>

          <div
            className="rounded-2xl border border-neutral-200 bg-white overflow-hidden"
            style={{
              paddingTop: style.sectionPaddingTopPx,
              paddingBottom: style.sectionPaddingBottomPx,
              paddingLeft: style.sectionPaddingXPx,
              paddingRight: style.sectionPaddingXPx,
            }}
          >
            <div
              className="mx-auto grid grid-cols-1 md:grid-cols-[1.4fr_1fr] items-start"
              style={{
                maxWidth: safeAdminPreviewContentMaxWidth,
                gap: style.contentGapPx,
              }}
            >
              <div className="relative">
                <div
                  className={[
                    style.mainImageAspect === "1/1"
                      ? "aspect-square"
                      : style.mainImageAspect === "4/5"
                      ? "aspect-[4/5]"
                      : style.mainImageAspect === "16/9"
                      ? "aspect-video"
                      : "aspect-[3/4]",
                    "w-full overflow-hidden",
                  ].join(" ")}
                  style={{
                    borderRadius: style.mainImageRadiusPx,
                    borderWidth: style.mainImageBorderPx,
                    borderStyle: "solid",
                    borderColor: style.mainImageBorderColor,
                    boxShadow: style.mainImageShadow ? "0 20px 40px rgba(0,0,0,0.12)" : "none",
                  }}
                >
                  {selectedPreviewItem?.mainImage ? (
                    <img
                      src={selectedPreviewItem.mainImage}
                      alt={selectedPreviewItem.title || "Producto seleccionado"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-pink-50 flex items-center justify-center text-sm text-neutral-500">
                      Selecciona un producto
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-center w-full mt-6 md:mt-16">
                <div
                  className={`w-full mb-6 ${
                    style.titleAlign === "left"
                      ? "text-left"
                      : style.titleAlign === "right"
                      ? "text-right"
                      : "text-center"
                  }`}
                >
                  {config.titleImage ? (
                    <div className="mb-2 px-1">
                      <img
                        src={config.titleImage}
                        alt="Título look"
                        className="mx-auto h-auto"
                        style={{ maxWidth: style.titleImageWidthPx }}
                      />
                    </div>
                  ) : config.titleText ? (
                    <h2 style={titleTextStyle}>{config.titleText}</h2>
                  ) : null}

                  {config.description ? (
                    <p className="max-w-xl mx-auto mt-2" style={descTextStyle}>
                      {config.description}
                    </p>
                  ) : null}
                </div>

                <div
                  className="grid w-full"
                  style={{
                    gap: safeMobileSliderGapPx,
                    gridTemplateColumns: `repeat(${style.thumbGridColsMobile}, minmax(0, 1fr))`,
                    justifyItems: "center",
                  }}
                >
                  {selectedItems.slice(0, LOOK_MAX_PRODUCTS).map((prod, i) => {
                    const active =
                      String(prod?.productId || "").trim() === String(selectedProductId || "").trim();

                    return (
                      <div
                        key={`${prod?.productId || i}_${i}`}
                        className="w-full"
                        style={{ maxWidth: safeThumbCardMaxWidthPx }}
                      >
                        <div
                          className="relative transition-transform duration-300"
                          style={{
                            transform: active
                              ? `scale(${style.thumbHoverScale}) rotate(${style.thumbHoverRotateDeg}deg)`
                              : "scale(1) rotate(0deg)",
                          }}
                        >
                          <div
                            className="w-full overflow-hidden"
                            style={{
                              height: safeThumbHeightPx,
                              borderRadius: style.thumbRadiusPx,
                              boxShadow: style.thumbShadow ? "0 10px 24px rgba(0,0,0,0.12)" : "none",
                            }}
                          >
                            {prod?.mainImage ? (
                              <img
                                src={prod.mainImage}
                                alt={prod.title || "Producto"}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400">
                                Sin imagen
                              </div>
                            )}
                          </div>

                          <div className="absolute top-2 right-2 flex flex-col items-center space-y-2 overflow-visible">
                            {config?.actions?.favorite?.enabled !== false ? (
                              <button
                                type="button"
                                className="relative group p-1 rounded-full shadow focus:outline-none"
                                style={{
                                  backgroundColor: style.actionButtonBg,
                                  border: `1px solid ${style.actionButtonBorderColor}`,
                                }}
                              >
                                <span
                                  className="block w-5 h-5 rounded-full"
                                  style={{ color: style.actionFavoriteColor }}
                                >
                                  ★
                                </span>
                              </button>
                            ) : null}

                            {config?.actions?.cart?.enabled !== false ? (
                              <button
                                type="button"
                                className="relative group p-1 rounded-full shadow focus:outline-none"
                                style={{
                                  backgroundColor: style.actionButtonBg,
                                  border: `1px solid ${style.actionButtonBorderColor}`,
                                }}
                              >
                                <span
                                  className="block w-5 h-5 rounded-full"
                                  style={{ color: style.actionCartColor }}
                                >
                                  🛒
                                </span>
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-2 text-center">
                          <p style={thumbTitleTextStyle}>{prod?.title || "Producto"}</p>

                          <div className="flex justify-center space-x-2 mt-1">
                            <span
                              className="rounded-full border-2 border-neutral-300"
                              style={{
                                width: style.colorDotSizePx,
                                height: style.colorDotSizePx,
                                backgroundColor: "#ffffff",
                              }}
                            />
                            <span
                              className="rounded-full border-2"
                              style={{
                                width: style.colorDotSizePx,
                                height: style.colorDotSizePx,
                                backgroundColor: "#fce7f3",
                                borderColor: style.colorDotBorderColor,
                              }}
                            />
                          </div>

                          <p className="mt-1" style={thumbPriceTextStyle}>
                            {moneyCOP(0)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selectedItems.length ? (
                  <div
                    className="inline-flex items-center overflow-hidden"
                    style={{
                      marginTop: safeMobileSliderControlMarginTopPx,
                      backgroundColor: style.mobileSliderControlBg || "#ffffff",
                      border: `1px solid ${style.mobileSliderControlBorderColor || "#d4d4d8"}`,
                      borderRadius: safeMobileSliderControlRadiusPx,
                    }}
                  >
                    <button
                      type="button"
                      className="flex items-center justify-center text-sm font-semibold"
                      style={{
                        width: safeMobileSliderControlButtonWidthPx,
                        height: safeMobileSliderControlButtonHeightPx,
                        color: style.mobileSliderControlIconColor || "#111827",
                      }}
                    >
                      ←
                    </button>

                    <div
                      style={{
                        width: safeMobileSliderControlSeparatorWidthPx,
                        height: Math.max(16, safeMobileSliderControlButtonHeightPx - 10),
                        backgroundColor: style.mobileSliderControlSeparatorColor || "#d4d4d8",
                      }}
                    />

                    <button
                      type="button"
                      className="flex items-center justify-center text-sm font-semibold"
                      style={{
                        width: safeMobileSliderControlButtonWidthPx,
                        height: safeMobileSliderControlButtonHeightPx,
                        color: style.mobileSliderControlIconColor || "#111827",
                      }}
                    >
                      →
                    </button>
                  </div>
                ) : null}

                {!selectedItems.length ? (
                  <div className="mt-4 text-sm text-neutral-500 text-center">
                    Agrega productos para ver la galería de LOOK.
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Esta vista previa es referencial. La imagen grande cambia según el producto inicial seleccionado.
          </div>
        </div>
      </div>
    </div>
  );
}