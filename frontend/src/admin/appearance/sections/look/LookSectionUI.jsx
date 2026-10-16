// src/admin/appearance/sections/look/LookSectionUI.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Field, Input } from "../ui/UiComponents";
import {
  ColorField,
  CardImageMover,
  TextStyleFields,
  RangeNumberField,
  ToggleChip,
} from "../ui/SectionsPanelUI";
import LookProductPicker from "./LookProductPicker";
import SectionEditorSteps from "../ui/SectionEditorSteps";
import SectionEditorCardTabs from "../ui/SectionEditorCardTabs";
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

export default function LookSectionUI({
  theme,
  setPath,
  uploadToCloudinary,
}) {
  const section = useMemo(() => getLookSectionFromTheme(theme), [theme]);
  const [tab, setTab] = useState("contenido");
  const [contentStep, setContentStep] = useState("principal");
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [heroError, setHeroError] = useState("");

  const style = section?.style || LOOK_SECTION_DEFAULTS.style;
  const config = section?.config || LOOK_SECTION_DEFAULTS.config;

  const selectedItems = Array.isArray(config.products) ? config.products : [];
  const selectedProductId = String(config.selectedProductId || "").trim();

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

  const uploadHero = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!uploadToCloudinary) {
      setHeroError("No está disponible la carga de imágenes.");
      return;
    }
    setUploadingHero(true);
    setHeroError("");
    try {
      const url = await uploadToCloudinary(file);
      if (!url || !normalizeLookSection({ config: { heroImage: url } }).config.heroImage) {
        throw new Error("No se recibió una imagen válida. Inténtalo de nuevo.");
      }
      patchConfig({ heroImage: url, heroMode: "custom" });
    } catch (error) {
      setHeroError(error?.message || "No se pudo subir la imagen.");
    } finally {
      setUploadingHero(false);
    }
  };

  const uploadBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadToCloudinary) return;
    setUploadingBackground(true);
    setHeroError("");
    try {
      const url = await uploadToCloudinary(file);
      if (!normalizeLookSection({ config: { editorialBackgroundImage: url } }).config.editorialBackgroundImage) {
        throw new Error("No se recibió una imagen de fondo válida.");
      }
      patchConfig({ editorialBackgroundImage: url });
    } catch (error) {
      setHeroError(error?.message || "No se pudo subir el fondo.");
    } finally {
      setUploadingBackground(false);
    }
  };

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
    <div className="section-editor-workspace w-full min-w-0" data-tab={tab}>
      <div className="section-editor-workspace__controls space-y-4 min-w-0">
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-base font-extrabold text-neutral-900">Editor de sección LOOK</div>
              <div className="text-sm text-neutral-500 mt-1">
                Elige la imagen grande, agrega productos y ajusta las fotos de sus tarjetas.
              </div>
            </div>

            <SectionEditorSteps value={["slider-movil", "acciones"].includes(tab) ? "estilos" : tab} onChange={setTab} sectionName="LOOK" items={[
              { value: "contenido", label: "Contenido", hint: "Elige productos y define los textos e imágenes que mostrarás." },
              { value: "estilos", label: "Diseño", hint: "Ajusta la apariencia, el slider móvil y los botones." },
            ]} />
          </div>
        </div>

        {["estilos", "slider-movil", "acciones"].includes(tab) && (
          <nav className="section-editor-substeps" aria-label="Opciones de diseño">
            {[{ value: "estilos", label: "Apariencia" }, ...(style.layoutPreset === "classic" ? [{ value: "slider-movil", label: "En móviles" }] : []), { value: "acciones", label: "Botones" }].map((item) => (
              <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => setTab(item.value)}>{item.label}</button>
            ))}
          </nav>
        )}

        {tab === "contenido" && (
          <>
            <nav className="section-editor-substeps" aria-label="Editar contenido de Looks">
              {[
                { value: "principal", label: "1 · Imagen grande" },
                { value: "products", label: `2 · Productos (${selectedItems.length})` },
                { value: "photos", label: "3 · Fotos de tarjetas" },
              ].map(({ value, label }) => (
                <button key={value} type="button" aria-pressed={contentStep === value} onClick={() => setContentStep(value)}>{label}</button>
              ))}
            </nav>

            {contentStep === "principal" && <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
              <div>
                <h3 className="text-base font-extrabold text-neutral-900">Imagen grande al abrir Looks</h3>
                <p className="mt-1 text-xs text-neutral-600">Puede ser una foto independiente del catálogo. También quedará como primera tarjeta de la galería para volver a verla al tocar una prenda.</p>
              </div>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Origen de la imagen grande">
                <button type="button" aria-pressed={config.heroMode === "custom"} onClick={() => patchConfig({ heroMode: "custom" })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${config.heroMode === "custom" ? "border-rose-500 bg-rose-50 text-rose-900" : "border-neutral-200 bg-white text-neutral-700"}`}>
                  Subir imagen propia
                </button>
                <button type="button" aria-pressed={config.heroMode !== "custom"} onClick={() => patchConfig({ heroMode: "product" })}
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold ${config.heroMode !== "custom" ? "border-rose-500 bg-rose-50 text-rose-900" : "border-neutral-200 bg-white text-neutral-700"}`}>
                  Usar foto de producto
                </button>
              </div>
              {config.heroMode === "custom" ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/40 p-3">
                  {config.heroImage ? <img src={config.heroImage} alt="Imagen principal elegida" className="h-24 w-20 rounded-lg object-cover" /> : <div className="flex h-24 w-20 items-center justify-center rounded-lg border border-dashed border-rose-200 text-xs text-neutral-500">Sin imagen</div>}
                  <div className="min-w-0 flex-1 space-y-2">
                    <label className="inline-flex cursor-pointer rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700">
                      {uploadingHero ? "Subiendo…" : config.heroImage ? "Cambiar imagen grande" : "Cargar imagen grande"}
                      <input type="file" accept="image/*" aria-label="Cargar imagen grande" className="sr-only" disabled={uploadingHero} onChange={uploadHero} />
                    </label>
                    {config.heroImage ? <button type="button" onClick={() => patchConfig({ heroImage: "", heroMode: "product" })} className="ml-2 text-xs font-semibold text-rose-800 underline">Quitar imagen</button> : null}
                    {heroError ? <p role="alert" className="text-xs text-red-700">{heroError}</p> : null}
                    {!config.heroImage && !heroError ? <p className="text-xs text-neutral-600">Carga una foto para verla en la vista previa.</p> : null}
                  </div>
                </div>
              ) : (
                <Field label="Producto cuya foto se muestra al abrir">
                  {selectedItems.length ? (
                    <select className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm" value={selectedProductId}
                      onChange={(event) => patchConfig({ selectedProductId: event.target.value })}>
                      {selectedItems.map((item) => <option key={item.productId} value={item.productId}>{item.title || "Producto"}</option>)}
                    </select>
                  ) : <p className="text-sm text-neutral-600">Agrega productos en el paso 2 para elegir uno.</p>}
                </Field>
              )}
            </div>}

            {contentStep === "principal" && style.layoutPreset === "editorialGlass" && <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-4">
              <h3 className="text-sm font-extrabold text-neutral-900">Mensaje junto a la foto</h3>
              <Field label="Texto pequeño"><Input value={config.editorialEyebrow || ""} onChange={(e) => patchConfig({ editorialEyebrow: e.target.value })} /></Field>
              <Field label="Título editorial"><Input value={config.editorialHeadline || ""} onChange={(e) => patchConfig({ editorialHeadline: e.target.value })} /></Field>
              <Field label="Descripción de la sección"><textarea className="w-full min-h-[84px] rounded-xl border border-neutral-200 px-3 py-2 text-sm" value={config.description || ""}
                onChange={(e) => patchConfig({ description: e.target.value })} placeholder="Texto descriptivo de la sección LOOK…" /></Field>
              <Field label="Visibilidad"><div className="flex gap-2">
                <ToggleChip active={section.enabled !== false} onClick={() => setLookSection({ ...section, enabled: true })}>Activa</ToggleChip>
                <ToggleChip active={section.enabled === false} onClick={() => setLookSection({ ...section, enabled: false })}>Desactivada</ToggleChip>
              </div></Field>
            </div>}

            {contentStep === "principal" && style.layoutPreset === "classic" && <details className="rounded-2xl border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-extrabold text-neutral-900">Título, descripción y visibilidad</summary>
              <div className="mt-4 space-y-3">

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
                    <label className="inline-flex items-center px-3 py-2 rounded-xl section-editor-accent text-white text-xs font-medium cursor-pointer shadow-sm section-editor-accent-hover transition">
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
            </details>}

            {contentStep === "products" && <LookProductPicker
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
            />}

            {contentStep === "photos" && (selectedItems.length ? (
              <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                <h3 className="text-sm font-extrabold text-neutral-900">Fotos de las tarjetas</h3>
                <p className="mb-3 mt-1 text-xs text-neutral-600">Selecciona una tarjeta y cambia su foto normal o la que aparece al pasar el cursor. La imagen grande independiente se edita en el paso 1.</p>
                <div className="flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Tarjeta para editar">
                  {selectedItems.map((item) => <button key={item.productId} type="button" aria-pressed={item.productId === selectedProductId}
                    onClick={() => patchConfig({ selectedProductId: item.productId })}
                    className={`flex shrink-0 items-center gap-2 rounded-xl border p-2 text-left text-xs font-semibold ${item.productId === selectedProductId ? "border-rose-500 bg-rose-50 text-rose-950" : "border-neutral-200 bg-white text-neutral-700"}`}>
                    {item.mainImage ? <img src={item.mainImage} alt="" className="h-9 w-9 rounded-lg object-cover" /> : null}{item.title || "Producto"}
                  </button>)}
                </div>

                <div className="space-y-4">
                  {selectedItems.map((item, index) => {
                    const pid = String(item?.productId || "").trim();

                    return (
                      <div
                        key={`${pid}_${index}`}
                        className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
                        hidden={pid !== selectedProductId}
                      >
                        <div className="text-sm font-bold text-neutral-900 mb-2">{item?.title || "Producto"}</div>

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
            ) : <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Agrega productos en el paso 2 para editar sus fotos.</div>)}
          </>
        )}

        {tab === "estilos" && (
          <SectionEditorCardTabs label="Diseño de Looks" labels={['Composición', 'Espacio', 'Textos', 'Imagen principal', 'Miniaturas']}>
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
              <div><h3 className="text-sm font-extrabold text-neutral-900">Composición de Looks</h3>
                <p className="mt-1 text-xs text-neutral-600">El diseño editorial coloca la foto a la izquierda y las tarjetas en una franja de cristal que se superpone a su borde inferior. En móvil se apilan para conservar la lectura.</p></div>
              <Field label="Diseño de la sección"><div className="flex flex-wrap gap-2">
                <ToggleChip active={style.layoutPreset === "editorialGlass"} onClick={() => patchStyle({ layoutPreset: "editorialGlass" })}>Editorial de cristal</ToggleChip>
                <ToggleChip active={style.layoutPreset === "classic"} onClick={() => patchStyle({ layoutPreset: "classic" })}>Diseño anterior</ToggleChip>
              </div></Field>
              {style.layoutPreset === "editorialGlass" && <>
                <Field label="Imagen de fondo" hint="Puedes usar la textura incluida o cargar tu propio fondo en Cloudinary.">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-900">
                      {uploadingBackground ? "Subiendo…" : "Cargar fondo"}
                      <input type="file" accept="image/*" aria-label="Cargar fondo de Looks" className="sr-only" disabled={uploadingBackground} onChange={uploadBackground} />
                    </label>
                    {config.editorialBackgroundImage && <button type="button" className="text-xs text-rose-900 underline" onClick={() => patchConfig({ editorialBackgroundImage: "" })}>Usar fondo incluido</button>}
                    <img src={config.editorialBackgroundImage || "/looks-editorial-background.webp"} alt="Fondo seleccionado" className="h-12 w-24 rounded-lg object-cover" />
                  </div>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <ColorField label="Color de fondo" value={style.editorialBackgroundColor} onChange={(v) => patchStyle({ editorialBackgroundColor: v })} />
                  <ColorField label="Color del cristal" value={style.editorialGlassColor} onChange={(v) => patchStyle({ editorialGlassColor: v })} />
                  <ColorField label="Texto editorial" value={style.editorialTextColor} onChange={(v) => patchStyle({ editorialTextColor: v })} />
                  <ColorField label="Bordes e iconos" value={style.editorialAccentColor} onChange={(v) => patchStyle({ editorialAccentColor: v })} />
                  <RangeNumberField label="Ancho máximo" min={1000} max={1800} step={10} value={style.editorialContentWidthPx} onChange={(v) => patchStyle({ editorialContentWidthPx: v })} />
                  <RangeNumberField label="Tamaño del título" min={30} max={90} step={1} value={style.editorialHeadlineSizePx} onChange={(v) => patchStyle({ editorialHeadlineSizePx: v })} />
                  <RangeNumberField label="Grosor del título" min={300} max={800} step={100} value={style.editorialTitleWeight} onChange={(v) => patchStyle({ editorialTitleWeight: v })} />
                  <RangeNumberField label="Tamaño de la descripción" min={12} max={30} step={1} value={style.editorialDescriptionSizePx} onChange={(v) => patchStyle({ editorialDescriptionSizePx: v })} />
                  <RangeNumberField label="Superposición de tarjetas (%)" min={0} max={22} step={1} value={style.editorialOverlapPercent} onChange={(v) => patchStyle({ editorialOverlapPercent: v })} />
                  <RangeNumberField label="Posición horizontal del carrusel" hint="0 = izquierda · 100 = borde del diseño · 150 = borde derecho de la sección. En móvil se adapta al ancho." min={0} max={150} step={1} value={style.editorialRailPositionPercent} onChange={(v) => patchStyle({ editorialRailPositionPercent: v })} />
                  <RangeNumberField label="Tarjetas visibles" min={2} max={4} step={1} value={style.editorialVisibleCards} onChange={(v) => patchStyle({ editorialVisibleCards: v })} />
                  <RangeNumberField label="Separación de tarjetas" min={4} max={30} step={1} value={style.editorialCardGapPx} onChange={(v) => patchStyle({ editorialCardGapPx: v })} />
                  <RangeNumberField label="Profundidad del cristal" min={0} max={100} step={1} value={style.editorialDepth} onChange={(v) => patchStyle({ editorialDepth: v })} />
                  <RangeNumberField label="Opacidad del cristal (%)" min={0} max={90} step={1} value={style.editorialGlassOpacity} onChange={(v) => patchStyle({ editorialGlassOpacity: v })} />
                  <RangeNumberField label="Desenfoque del cristal" min={0} max={40} step={1} value={style.editorialGlassBlurPx} onChange={(v) => patchStyle({ editorialGlassBlurPx: v })} />
                </div>
                <Field label="Encuadre de la foto grande" hint="Foto completa adapta el marco a cada imagen. Recortar llena la proporción elegida, pero puede ocultar bordes de la foto.">
                  <div className="flex flex-wrap gap-2">
                    <ToggleChip active={style.editorialHeroFit !== "crop"} onClick={() => patchStyle({ editorialHeroFit: "natural" })}>Foto completa</ToggleChip>
                    <ToggleChip active={style.editorialHeroFit === "crop"} onClick={() => patchStyle({ editorialHeroFit: "crop" })}>Recortar</ToggleChip>
                  </div>
                  {style.editorialHeroFit === "crop" && <div className="mt-2 flex flex-wrap gap-2">{["1/1", "3/4", "4/5", "16/9"].map((aspect) =>
                    <ToggleChip key={aspect} active={style.editorialHeroAspect === aspect} onClick={() => patchStyle({ editorialHeroAspect: aspect })}>{aspect}</ToggleChip>)}</div>}
                </Field>
              </>}
              {heroError && <p role="alert" className="text-xs text-red-700">{heroError}</p>}
            </div>
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

                {style.layoutPreset === "classic" && <><RangeNumberField
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
                /></>}
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Título y descripción</div>

              {style.layoutPreset === "classic" && <><div className="grid md:grid-cols-2 gap-3 mb-4">
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
              </Field></>}

              {style.layoutPreset === "editorialGlass" ? <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fuente del título"><Input value={style.titleFontFamily || ""} onChange={(e) => patchStyle({ titleFontFamily: e.target.value })} placeholder="Georgia, serif" /></Field>
                <Field label="Fuente de la descripción"><Input value={style.descFontFamily || ""} onChange={(e) => patchStyle({ descFontFamily: e.target.value })} placeholder="Fuente del tema" /></Field>
              </div> : <div className="grid xl:grid-cols-2 gap-4 mt-4">
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
              </div>}
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="text-sm font-extrabold text-neutral-900 mb-3">Imagen principal grande</div>

              <div className="grid md:grid-cols-2 gap-3">
                {style.layoutPreset === "classic" && <Field label="Proporción">
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
                </Field>}

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

              {style.layoutPreset === "classic" && <div className="grid md:grid-cols-2 gap-3">
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
              </div>}

              {style.layoutPreset === "editorialGlass" && <div className="grid gap-3 sm:grid-cols-2">
                <RangeNumberField label="Radio de las tarjetas" min={0} max={40} step={1} value={style.thumbRadiusPx} onChange={(v) => patchStyle({ thumbRadiusPx: v })} />
                <RangeNumberField label="Ampliación de la foto al pasar" min={1} max={1.2} step={0.01} value={style.thumbHoverScale} onChange={(v) => patchStyle({ thumbHoverScale: v })} />
                <Field label="Profundidad de las tarjetas"><div className="flex gap-2">
                  <ToggleChip active={!!style.thumbShadow} onClick={() => patchStyle({ thumbShadow: true })}>Con sombra</ToggleChip>
                  <ToggleChip active={!style.thumbShadow} onClick={() => patchStyle({ thumbShadow: false })}>Sin sombra</ToggleChip>
                </div></Field>
              </div>}

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
          </SectionEditorCardTabs>
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

    </div>
  );
}
