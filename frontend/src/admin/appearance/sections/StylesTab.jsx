import { useState } from "react";
import SectionEditorCardTabs from "./ui/SectionEditorCardTabs";
import { normalizeTrendingPresentation } from "../../../components/trendingPresentation";
import boutiqueBackdrop from "../../../assets/trending-vitrine-boutique.webp";
import TrendingMobileColorsEditor from "./editor/TrendingMobileColorsEditor";
import { Field, Input, Toggle } from "./ui/UiComponents";
import { DEFAULT_STYLE, clampNumber } from "./ui/sectionHelpers";
import { ColorField, getCardTextStyle } from "./ui/SectionsPanelUI";
import { CARD_FONT_OPTIONS, normalizeTendenciaConfigPlus } from "./sectionEditorModel";

export default function StylesTab({ section, onChange, uploadToCloudinary }) {
  const st = section.style || DEFAULT_STYLE;
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundError, setBackgroundError] = useState("");

  const patchStyle = (partial) => {
    onChange({ style: { ...st, ...partial } });
  };

  const cardTextStyle = getCardTextStyle(st);

  const buildInlineStyle = (prefix) => {
    const s = {};

    const fontFamily = typeof st?.[`${prefix}FontFamily`] === "string" ? st[`${prefix}FontFamily`].trim() : "";
    const color = typeof st?.[`${prefix}Color`] === "string" ? st[`${prefix}Color`].trim() : "";
    const sizePx = Number.isFinite(Number(st?.[`${prefix}SizePx`])) ? Number(st[`${prefix}SizePx`]) : 0;
    const weight = Number.isFinite(Number(st?.[`${prefix}Weight`])) ? Number(st[`${prefix}Weight`]) : 0;
    const italic = typeof st?.[`${prefix}Italic`] === "boolean" ? st[`${prefix}Italic`] : false;
    const underline = typeof st?.[`${prefix}Underline`] === "boolean" ? st[`${prefix}Underline`] : false;

    if (fontFamily) s.fontFamily = fontFamily;
    if (color) s.color = color;
    if (sizePx > 0) s.fontSize = sizePx;
    if (weight > 0) s.fontWeight = weight;
    if (italic) s.fontStyle = "italic";
    if (underline) s.textDecoration = "underline";

    return Object.keys(s).length ? s : undefined;
  };

  const FieldStyleEditor = ({ title, prefix, defaultSize = 12, sizeMin = 10, sizeMax = 32, weightDefault = 700 }) => {
    const floatingColorKey = { cardTitle: "cardTitleColor", cardPrice: "cardPriceColor", cardMeta: "cardMetaColor", cardDesc: "cardDescColor" }[prefix];
    const floatingSizeKey = { cardTitle: "productTitleSizePx", cardPrice: "priceSizePx", cardMeta: "metaSizePx", cardDesc: "descSizePx" }[prefix];
    const isFloating = presentation.mode === "floatingGlass";
    const inline = { ...buildInlineStyle(prefix), ...(isFloating && floatingColorKey ? { color: presentation[floatingColorKey], fontSize: presentation[floatingSizeKey] } : {}) };

    const currentFont = typeof st?.[`${prefix}FontFamily`] === "string" ? st[`${prefix}FontFamily`] : "";
    const currentColor = isFloating && floatingColorKey ? presentation[floatingColorKey] : typeof st?.[`${prefix}Color`] === "string" ? st[`${prefix}Color`] : "";
    const currentSize = isFloating && floatingSizeKey ? presentation[floatingSizeKey] : Number.isFinite(Number(st?.[`${prefix}SizePx`])) ? Number(st[`${prefix}SizePx`]) : defaultSize;
    const currentWeight = Number.isFinite(Number(st?.[`${prefix}Weight`])) ? Number(st[`${prefix}Weight`]) : weightDefault;
    const currentItalic = typeof st?.[`${prefix}Italic`] === "boolean" ? st[`${prefix}Italic`] : false;
    const currentUnderline = typeof st?.[`${prefix}Underline`] === "boolean" ? st[`${prefix}Underline`] : false;

    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold text-neutral-900 mb-2">{title}</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fuente" name={`style.${prefix}FontFamily`}>
            <select
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              value={currentFont || ""}
              onChange={(e) => patchStyle({ [`${prefix}FontFamily`]: e.target.value })}
            >
              {CARD_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tamaño (px)" name={`style.${prefix}SizePx`} hint={`${sizeMin}–${sizeMax}`}>
            <Input
              type="number"
              min={sizeMin}
              max={sizeMax}
              value={currentSize}
              onChange={(e) => isFloating && floatingSizeKey
                ? patchPresentation({ [floatingSizeKey]: clampNumber(Number(e.target.value) || defaultSize, sizeMin, sizeMax) })
                : patchStyle({ [`${prefix}SizePx`]: clampNumber(Number(e.target.value) || defaultSize, sizeMin, sizeMax) })}
            />
          </Field>

          <Field label="Peso (negrita)" name={`style.${prefix}Weight`} hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={currentWeight}
              onChange={(e) =>
                patchStyle({
                  [`${prefix}Weight`]: clampNumber(Number(e.target.value) || weightDefault, 200, 900),
                })
              }
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ColorField
            label="Color"
            value={currentColor || ""}
            onChange={(value) => isFloating && floatingColorKey ? patchPresentation({ [floatingColorKey]: value }) : patchStyle({ [`${prefix}Color`]: value })}
          />

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!currentItalic}
                onChange={(e) => patchStyle({ [`${prefix}Italic`]: !!e.target.checked })}
              />
              Cursiva
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!currentUnderline}
                onChange={(e) => patchStyle({ [`${prefix}Underline`]: !!e.target.checked })}
              />
              Subrayado
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
          <div className="text-[11px] text-neutral-500 mb-1">Preview</div>
          <div className="text-sm" style={inline}>
            {title} — ejemplo
          </div>
        </div>
      </div>
    );
  };

  const cfg = section.type === "tendencia" ? normalizeTendenciaConfigPlus(section.config) : section.config || {};
  const cardFields = cfg?.cardFields && typeof cfg.cardFields === "object" ? cfg.cardFields : {};
  const presentation = normalizeTrendingPresentation(cfg.presentation);
  const patchPresentation = (partial) => onChange({ config: { ...cfg, presentation: normalizeTrendingPresentation({ ...presentation, ...partial }) } });
  const numericPresentationField = (key, label, min, max, step = 1) => (
    <Field label={label} name={`config.presentation.${key}`} key={key}>
      <Input type="number" aria-label={label} min={min} max={max} step={step} value={presentation[key]}
        onChange={(event) => patchPresentation({ [key]: clampNumber(Number(event.target.value), min, max) })} />
    </Field>
  );
  const colorPresentationField = (key, label) => (
    <ColorField key={key} label={label} value={presentation[key]} onChange={(value) => patchPresentation({ [key]: value })} />
  );
  const uploadBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadToCloudinary) return;
    setBackgroundError("");
    setUploadingBackground(true);
    try {
      const url = await uploadToCloudinary(file);
      if (!url || !normalizeTrendingPresentation({ backgroundImage: url }).backgroundImage) throw new Error("No se recibió una imagen válida de Cloudinary.");
      patchPresentation({ backgroundImage: url, backdropMode: "custom" });
    } catch (error) {
      setBackgroundError(error?.message || "No se pudo cargar el fondo.");
    } finally {
      setUploadingBackground(false);
    }
  };

  const patchCardFields = (partial) => {
    if (section.type !== "tendencia") return;
    onChange({
      config: {
        ...cfg,
        cardFields: {
          ...cardFields,
          ...partial,
        },
      },
    });
  };

  return (
    <SectionEditorCardTabs label="Diseño de Tendencia" labels={['Plantilla', 'Móvil', 'Texto general', 'Campos de la tarjeta', 'Datos visibles', 'Tarjetas y espacio']}>
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-900">Elige cómo se muestran los productos</h3>
          <p className="mt-1 text-xs text-neutral-600">La vista previa muestra la tienda con los productos que elegiste. Cambia de plantilla sin perder los ajustes de la otra.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { mode: "classic", label: "Tarjeta actual", hint: "Imagen y detalles en una sola tarjeta", preview: "rounded-t-xl rounded-b-xl" },
            { mode: "floatingGlass", label: "Vitrina flotante", hint: "Foto protagonista y ficha de vidrio separada", preview: "rounded-2xl" },
          ].map((option) => (
            <button key={option.mode} type="button" aria-pressed={presentation.mode === option.mode}
              onClick={() => patchPresentation({ mode: option.mode })}
              className={`rounded-2xl border-2 p-3 text-left transition ${presentation.mode === option.mode ? "border-rose-500 bg-rose-50/50" : "border-neutral-200 hover:border-rose-200"}`}>
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="block text-xs text-neutral-600">{option.hint}</span>
              <span aria-hidden="true" className="mt-3 flex h-16 max-w-28 flex-col gap-1">
                <span className={`block flex-1 border border-rose-200 bg-gradient-to-br from-rose-100 via-white to-amber-100 ${option.preview}`} style={option.mode === "floatingGlass" ? { backgroundImage: `url(${boutiqueBackdrop})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
                {option.mode === "floatingGlass" ? <span className="block h-4 rounded-lg border border-amber-200 bg-white/70 shadow-sm" /> : null}
              </span>
            </button>
          ))}
        </div>
        {presentation.mode === "floatingGlass" ? (
          <div className="space-y-3">
            <p className="text-xs text-neutral-600">Las fotos y los artículos se editan en Contenido → Productos. Los colores de Pasarela se ajustan en Móvil; las fichas de escritorio, en las opciones de esta pestaña.</p>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Título de la vitrina</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Mostrar título como" name="config.presentation.titleMode">
                  <select className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" value={presentation.titleMode} onChange={(event) => patchPresentation({ titleMode: event.target.value })}>
                    <option value="text">Texto editable</option><option value="image">Imagen del título</option>
                  </select>
                </Field>
                {presentation.titleMode === "text" ? <>
                  <Field label="Texto" name="config.title"><Input value={cfg.title || ""} placeholder="EN TENDENCIA" onChange={(event) => onChange({ config: { ...cfg, title: event.target.value } })} /></Field>
                  {colorPresentationField("titleColor", "Color del título")}
                  {numericPresentationField("titleSizePx", "Tamaño máximo del título (px)", 20, 80)}
                  <Field label="Fuente del título" name="config.presentation.titleFontFamily">
                    <select className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm" value={presentation.titleFontFamily} onChange={(event) => patchPresentation({ titleFontFamily: event.target.value })}>
                      {[{ label: "Clásica elegante", value: "Georgia, serif" }, ...CARD_FONT_OPTIONS.filter((item) => item.value)].map((item) => <option key={item.label} value={item.value}>{item.label}</option>)}
                    </select>
                  </Field>
                </> : <p className="text-xs text-neutral-600">Carga la imagen del título en Contenido → Imágenes.</p>}
              </div>
            </details>
            <details className="rounded-xl border border-neutral-200 p-3" open>
              <summary className="cursor-pointer text-sm font-semibold">Fondo y luz</summary>
              <p className="mt-2 text-xs text-neutral-600">El fondo floral ocupa el ancho completo de la sección. Puedes cambiarlo por un color o tu propia imagen.</p>
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Tipo de fondo">
                {[
                  { value: "boutique", label: "Floral incluido" },
                  { value: "color", label: "Color y luz" },
                  { value: "custom", label: "Mi imagen" },
                ].map((option) => (
                  <button key={option.value} type="button" aria-pressed={presentation.backdropMode === option.value}
                    onClick={() => patchPresentation({ backdropMode: option.value })}
                    className={`rounded-xl border px-2 py-2 text-xs ${presentation.backdropMode === option.value ? "border-rose-500 bg-rose-50 text-rose-950" : "border-neutral-200 bg-white text-neutral-700"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorPresentationField("backgroundColor", "Color de fondo")}
                {colorPresentationField("glowColor", "Color de la luz ambiental")}
                {numericPresentationField("glowStrength", "Intensidad de luz (0–1)", 0, 1, .05)}
                <Field label="Cargar mi imagen de fondo" name="config.presentation.backgroundImage">
                  <input type="file" accept="image/*" aria-label="Cargar mi imagen de fondo" onChange={uploadBackground} disabled={uploadingBackground} className="block w-full text-xs" />
                  {uploadingBackground ? <span role="status" className="text-xs">Cargando imagen…</span> : null}
                  {backgroundError ? <span role="alert" className="text-xs text-red-700">{backgroundError}</span> : null}
                  {presentation.backgroundImage ? <button type="button" onClick={() => patchPresentation({ backgroundImage: "", backdropMode: "boutique" })} className="mt-1 text-xs underline">Volver al floral incluido</button> : null}
                  {presentation.backdropMode === "custom" && !presentation.backgroundImage ? <span className="block text-xs text-amber-800">Carga una imagen para verla en la vitrina.</span> : null}
                </Field>
              </div>
              <div className="mt-3 rounded-xl border border-rose-200/70 bg-rose-50/40 p-3">
                <div className="text-xs font-semibold text-rose-950">Profundidad del escenario</div>
                <p className="mt-1 text-xs text-neutral-600">Separa visualmente la pared, ilumina los productos y da apoyo al suelo. Puedes llevar Profundidad a 0 para apagar el efecto.</p>
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[["sceneDepth", "Profundidad", 1, "%"], ["sceneLight", "Luz detrás de las fotos", 1, "%"], ["sceneBlurPx", "Desenfoque de la pared", 12, "px"]].map(([key, label, max, unit]) => (
                    <label key={key} className="block text-xs text-neutral-800">
                      <span className="flex items-center justify-between gap-2"><span>{label}</span><strong>{unit === "%" ? `${Math.round(presentation[key] * 100)}%` : `${presentation[key]} px`}</strong></span>
                      <input type="range" aria-label={label} min={0} max={max} step={unit === "%" ? .05 : 1} value={presentation[key]}
                        onChange={(event) => patchPresentation({ [key]: Number(event.target.value) })} className="mt-2 w-full accent-rose-600" />
                    </label>
                  ))}
                </div>
              </div>
            </details>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Vidrio y bordes</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorPresentationField("glassColor", "Color del vidrio")}
                {colorPresentationField("borderColor", "Color del borde")}
                {numericPresentationField("glassOpacity", "Opacidad del vidrio (0,25–1)", .25, 1, .05)}
                {numericPresentationField("blurPx", "Desenfoque (px)", 0, 40)}
                {numericPresentationField("borderOpacity", "Opacidad del borde (0–1)", 0, 1, .05)}
                {numericPresentationField("borderWidthPx", "Grosor del borde (px)", 0, 4, .5)}
                {numericPresentationField("shadowStrength", "Intensidad de sombra (0–1)", 0, 1, .05)}
              </div>
            </details>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Letras de las fichas</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {colorPresentationField("cardTitleColor", "Nombre del producto")}
                {colorPresentationField("cardPriceColor", "Precio")}
                {colorPresentationField("cardMetaColor", "Tallas y colores")}
                {colorPresentationField("cardDescColor", "Descripción y características")}
                {colorPresentationField("cardMutedColor", "Precio anterior")}
              </div>
              <p className="mt-2 text-xs text-neutral-600">La tipografía y los tamaños siguen disponibles en «Campos de la tarjeta».</p>
              {numericPresentationField("oldPriceSizePx", "Precio anterior (px)", 8, 15)}
            </details>
            <details className="rounded-xl border border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-semibold">Forma y botones</summary>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {numericPresentationField("imageHeightPx", "Alto de la foto (px)", 240, 600)}
                {numericPresentationField("imageRadiusPx", "Redondeo de la foto (px)", 0, 60)}
                {numericPresentationField("dockRadiusPx", "Redondeo de la ficha (px)", 0, 60)}
                {numericPresentationField("dockGapPx", "Separación foto/ficha (px)", 0, 30)}
                {numericPresentationField("dockPaddingPx", "Espacio interior de la ficha (px)", 8, 30)}
                {numericPresentationField("hoverLiftPx", "Elevación al pasar el mouse (px)", 0, 18)}
                {numericPresentationField("actionSizePx", "Tamaño de los botones (px)", 28, 52)}
                {colorPresentationField("actionColor", "Color de los iconos")}
                {colorPresentationField("actionBackgroundColor", "Fondo de los botones")}
                <Toggle checked={presentation.ornamentEnabled} label="Decoración junto al título" onChange={(value) => patchPresentation({ ornamentEnabled: !!value })} />
                <Toggle checked={presentation.showWatermark} label="Mostrar marca de agua en las fichas" onChange={(value) => patchPresentation({ showWatermark: !!value })} />
                <Toggle checked={presentation.showDescription} label="Mostrar descripción y características" onChange={(value) => patchPresentation({ showDescription: !!value })} />
              </div>
            </details>
          </div>
        ) : null}
      </div>
      <div>
        {presentation.mode === "floatingGlass"
          ? <TrendingMobileColorsEditor presentation={presentation} onChange={patchPresentation} uploadToCloudinary={uploadToCloudinary} />
          : <p className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">Selecciona Vitrina flotante en Plantilla para personalizar los colores de Pasarela en móvil.</p>}
      </div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="text-sm font-semibold text-neutral-900 mb-2">Texto de todas las tarjetas</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Fuente (texto cards)" name="style.cardTextFontFamily">
            <select
              className="w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm"
              value={st.cardTextFontFamily || ""}
              onChange={(e) => patchStyle({ cardTextFontFamily: e.target.value })}
            >
              {CARD_FONT_OPTIONS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tamaño texto cards (px)" name="style.cardTextSizePx" hint="10–32">
            <Input
              type="number"
              min={10}
              max={32}
              value={st.cardTextSizePx ?? 15}
              onChange={(e) =>
                patchStyle({ cardTextSizePx: clampNumber(Number(e.target.value) || 15, 10, 32) })
              }
            />
          </Field>

          <Field label="Peso (negrita) texto cards" name="style.cardTextWeight" hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={st.cardTextWeight ?? 700}
              onChange={(e) =>
                patchStyle({ cardTextWeight: clampNumber(Number(e.target.value) || 700, 200, 900) })
              }
            />
          </Field>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <ColorField
            label="Color texto cards"
            value={st.cardTextColor || ""}
            onChange={(value) => patchStyle({ cardTextColor: value })}
          />

          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!st.cardTextItalic}
                onChange={(e) => patchStyle({ cardTextItalic: !!e.target.checked })}
              />
              Cursiva
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                className="h-3 w-3 rounded border-neutral-300"
                checked={!!st.cardTextUnderline}
                onChange={(e) => patchStyle({ cardTextUnderline: !!e.target.checked })}
              />
              Subrayado
            </label>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-2 text-xs">
          <div className="text-[11px] text-neutral-500 mb-1">Preview (texto de card)</div>
          <div className="text-sm" style={cardTextStyle}>
            Título de card
          </div>
          <div className="text-xs" style={cardTextStyle}>
            Subtítulo de card / descripción
          </div>
          <div className="text-xs mt-1" style={cardTextStyle}>
            Precio: $111.111 — Tallas: 6 / 8
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <FieldStyleEditor title="Título del producto" prefix="cardTitle" defaultSize={12} sizeMin={10} sizeMax={20} weightDefault={800} />
        <FieldStyleEditor title="Precio" prefix="cardPrice" defaultSize={14} sizeMin={10} sizeMax={22} weightDefault={800} />
        <FieldStyleEditor title="Tallas y colores" prefix="cardMeta" defaultSize={12} sizeMin={12} sizeMax={18} weightDefault={700} />
        <FieldStyleEditor title="Descripción y características" prefix="cardDesc" defaultSize={11} sizeMin={9} sizeMax={18} weightDefault={600} />
      </div>

      {section.type === "tendencia" ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="text-sm font-semibold text-neutral-900">Qué mostrar en el card (Tendencia)</div>
          <div className="text-xs text-neutral-500">
            Elige qué información verá el cliente en cada tarjeta.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Tallas</span>
              <Toggle
                checked={typeof cardFields.showSizes === "boolean" ? cardFields.showSizes : true}
                onChange={(v) => patchCardFields({ showSizes: !!v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Colores</span>
              <Toggle
                checked={typeof cardFields.showColors === "boolean" ? cardFields.showColors : true}
                onChange={(v) => patchCardFields({ showColors: !!v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Features</span>
              <Toggle
                checked={typeof cardFields.showFeatures === "boolean" ? cardFields.showFeatures : true}
                onChange={(v) => patchCardFields({ showFeatures: !!v })}
              />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-xs text-neutral-700">Mostrar Descripción</span>
              <Toggle
                checked={typeof cardFields.showDescription === "boolean" ? cardFields.showDescription : true}
                onChange={(v) => patchCardFields({ showDescription: !!v })}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Máximo tallas a mostrar" hint="2–20 (para evitar chorizo)" name="config.cardFields.maxSizesToShow">
              <Input
                type="number"
                min={2}
                max={20}
                value={Number.isFinite(Number(cardFields.maxSizesToShow)) ? Number(cardFields.maxSizesToShow) : 6}
                onChange={(e) => patchCardFields({ maxSizesToShow: clampNumber(Number(e.target.value) || 6, 2, 20) })}
              />
            </Field>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 space-y-4">
        <div className="text-sm font-semibold text-neutral-900 mb-1">Estilos (sección)</div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <ColorField label="Fondo" value={st.bgColor} onChange={(value) => patchStyle({ bgColor: value })} />
          <ColorField label="Texto" value={st.textColor} onChange={(value) => patchStyle({ textColor: value })} />
          <ColorField label="Acento" value={st.accentColor} onChange={(value) => patchStyle({ accentColor: value })} />

          <Field label="Título (px)" name="style.titleSizePx" hint="18–96">
            <Input
              type="number"
              min={18}
              max={96}
              value={st.titleSizePx}
              onChange={(e) =>
                patchStyle({ titleSizePx: clampNumber(Number(e.target.value) || st.titleSizePx, 18, 96) })
              }
            />
          </Field>

          <Field label="Peso título" name="style.titleWeight" hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={st.titleWeight}
              onChange={(e) =>
                patchStyle({ titleWeight: clampNumber(Number(e.target.value) || st.titleWeight, 200, 900) })
              }
            />
          </Field>

          <Field label="Peso subtítulo" name="style.subtitleWeight" hint="200–900">
            <Input
              type="number"
              min={200}
              max={900}
              value={st.subtitleWeight}
              onChange={(e) =>
                patchStyle({ subtitleWeight: clampNumber(Number(e.target.value) || st.subtitleWeight, 200, 900) })
              }
            />
          </Field>

          <Field label="Subtítulo (px)" name="style.subtitleSizePx" hint="10–40">
            <Input
              type="number"
              min={10}
              max={40}
              value={st.subtitleSizePx}
              onChange={(e) =>
                patchStyle({ subtitleSizePx: clampNumber(Number(e.target.value) || st.subtitleSizePx, 10, 40) })
              }
            />
          </Field>

          <Field label="Radio cards (px)" name="style.cardRadiusPx" hint="0–60">
            <Input
              type="number"
              min={0}
              max={60}
              value={st.cardRadiusPx}
              onChange={(e) =>
                patchStyle({ cardRadiusPx: clampNumber(Number(e.target.value) || st.cardRadiusPx, 0, 60) })
              }
            />
          </Field>

          <Field label="Alto imagen items (px)" name="style.imageHeightPx" hint="160–500">
            <Input
              type="number"
              min={160}
              max={500}
              value={st.imageHeightPx}
              onChange={(e) =>
                patchStyle({ imageHeightPx: clampNumber(Number(e.target.value) || st.imageHeightPx, 160, 500) })
              }
            />
          </Field>

          <Field label="Espaciado (px)" name="style.spacingPx" hint="0–60">
            <Input
              type="number"
              min={0}
              max={60}
              value={st.spacingPx}
              onChange={(e) =>
                patchStyle({ spacingPx: clampNumber(Number(e.target.value) || st.spacingPx, 0, 60) })
              }
            />
          </Field>
        </div>
      </div>
    </SectionEditorCardTabs>
  );
}
