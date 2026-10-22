import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Heart, RotateCcw, ShoppingBag, Upload } from "lucide-react";
import SectionColorPicker from "../ui/SectionColorPicker";
import { DEFAULT_TRENDING_MOBILE_COLORS, normalizeTrendingPresentation, trendingMobileColorsVars } from "../../../../components/trendingPresentation";
import runwayBackdrop from "../../../../assets/trending-runway-mobile.webp";
import "./trendingMobileColorsEditor.css";
import "../../../../components/trendingLiquidButton.css";

const COLOR = /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i;
const PALETTES = [
  { name: "Rosa original", colors: DEFAULT_TRENDING_MOBILE_COLORS },
  { name: "Malva", colors: { ...DEFAULT_TRENDING_MOBILE_COLORS,
    mobileTitleColor: "#532653", mobileProductColor: "#532653", mobilePriceColor: "#6c2d70",
    mobileMetaColor: "#684768", mobileMutedColor: "#92728e", mobileDescriptionColor: "#755572",
    mobileButtonColor: "#6c2d70", mobileFavoriteColor: "#9b438d", mobileFavoriteActiveColor: "#792a81",
    mobileIndicatorColor: "#6c2d70", mobileIndicatorInactiveColor: "#ae89ac", mobileBackgroundColor: "#f8eef7",
  } },
  { name: "Cacao", colors: { ...DEFAULT_TRENDING_MOBILE_COLORS,
    mobileTitleColor: "#523127", mobileProductColor: "#523127", mobilePriceColor: "#754535",
    mobileMetaColor: "#795747", mobileMutedColor: "#a28273", mobileDescriptionColor: "#826252",
    mobileButtonColor: "#754535", mobileFavoriteColor: "#b66b62", mobileFavoriteActiveColor: "#88483e",
    mobileIndicatorColor: "#754535", mobileIndicatorInactiveColor: "#bd9a86", mobileBackgroundColor: "#fff4e9",
  } },
];
const GROUPS = [
  { id: "text", name: "Textos", fields: [
    ["mobileTitleColor", "Título de la sección"], ["mobileProductColor", "Nombre del producto"],
    ["mobilePriceColor", "Precio"], ["mobileMetaColor", "Texto de tamaños y colores"],
    ["mobileMutedColor", "Precio anterior"], ["mobileDescriptionColor", "Descripción"],
  ] },
  { id: "button", name: "Botón", fields: [
    ["mobileButtonColor", "Fondo del botón"], ["mobileButtonTextColor", "Texto e icono del botón"],
  ] },
  { id: "favorites", name: "Corazón e indicadores", fields: [
    ["mobileFavoriteColor", "Corazón sin marcar"], ["mobileFavoriteActiveColor", "Corazón marcado"],
    ["mobileFavoriteBackgroundColor", "Fondo del corazón"], ["mobileIndicatorColor", "Indicador seleccionado"],
    ["mobileIndicatorInactiveColor", "Otros indicadores"],
  ] },
  { id: "background", name: "Fondo y detalles", fields: [
    ["mobileSizeBackgroundColor", "Fondo de los tamaños"], ["mobilePhotoBorderColor", "Borde de las fotos"],
  ] },
];

function MobileColorControl({ label, value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <div className="trending-mobile-colors__field" onBlur={(event) => {
    if (!event.currentTarget.contains(event.relatedTarget) && !COLOR.test(draft)) setDraft(value);
  }}>
    <span className="trending-mobile-colors__label">{label}</span>
    <SectionColorPicker label={`${label} del móvil`} value={draft} onChange={(next) => {
      setDraft(next);
      if (COLOR.test(next)) onChange(next);
    }} />
    {/^#(?:[a-f\d]{4}|[a-f\d]{8})$/i.test(draft) && <p className="trending-mobile-colors__note" role="status">Elige un color sólido, sin transparencia.</p>}
  </div>;
}

export default function TrendingMobileColorsEditor({ presentation, onChange, uploadToCloudinary }) {
  const [groupId, setGroupId] = useState("text");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const uploadBackground = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !uploadToCloudinary || uploading) return;
    setUploadError("");
    if (!/^image\/(jpeg|png|webp|gif|avif)$/i.test(file.type)) {
      setUploadError("Selecciona una imagen JPG, PNG, WebP, GIF o AVIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("La imagen debe pesar como máximo 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadToCloudinary(file);
      if (!normalizeTrendingPresentation({ mobileBackgroundImage: url }).mobileBackgroundImage) throw new Error("No se recibió una imagen válida. Intenta cargarla de nuevo.");
      onChangeRef.current({ mobileBackgroundImage: url, mobileBackgroundMode: "custom" });
    } catch (error) {
      setUploadError(error?.message || "No se pudo cargar la imagen. Inténtalo de nuevo.");
    } finally {
      setUploading(false);
    }
  };
  const group = GROUPS.find((item) => item.id === groupId);
  const colorField = ([key, label]) => <MobileColorControl key={key} label={label} value={presentation[key]}
    onChange={(value) => onChange({ [key]: value })} />;
  const image = presentation.mobileBackgroundMode === "color" ? ""
    : (presentation.mobileBackgroundMode === "custom" && presentation.mobileBackgroundImage)
      || (presentation.backdropMode === "custom" ? presentation.backgroundImage
        : presentation.backdropMode === "boutique" ? runwayBackdrop : "");
  const background = presentation.mobileBackgroundMode === "color" ? presentation.mobileBackgroundColor : presentation.backgroundColor;

  return <section className="trending-mobile-colors" aria-label="Colores del móvil">
    <div className="trending-mobile-colors__header">
      <div><h3>Colores del móvil</h3><p>Personaliza Pasarela. Elige una combinación o cambia cada color con la paleta.</p></div>
      <button type="button" className="trending-mobile-colors__reset" onClick={() => onChange({ ...DEFAULT_TRENDING_MOBILE_COLORS })}>
        <RotateCcw size={15} aria-hidden="true" />Restaurar colores originales
      </button>
    </div>

    <div className="trending-mobile-colors__palettes" role="group" aria-label="Combinaciones para móvil">
      {PALETTES.map((palette) => <button type="button" key={palette.name}
        aria-pressed={Object.entries(palette.colors).every(([key, value]) => presentation[key]?.toLowerCase() === value.toLowerCase())}
        onClick={() => onChange({ ...palette.colors })}>
        <span className="trending-mobile-colors__swatches" aria-hidden="true">
          {[palette.colors.mobileTitleColor, palette.colors.mobileButtonColor, palette.colors.mobileFavoriteColor].map((color, index) => <i key={index} style={{ backgroundColor: color }} />)}
        </span><span>{palette.name}</span>
      </button>)}
    </div>

    <div className="trending-mobile-colors__sample" role="group" aria-label="Muestra de colores del móvil"
      style={{ ...trendingMobileColorsVars(presentation), backgroundColor: background, backgroundImage: image ? `url("${image}")` : "none" }}>
      <span className="trending-mobile-colors__sample-heading">En tendencia <ArrowRight size={17} aria-hidden="true" /></span>
      <div className="trending-mobile-colors__sample-photo" aria-hidden="true">
        <span><Heart size={19} /></span><span><Heart size={19} fill="currentColor" /></span>
      </div>
      <span className="trending-mobile-colors__sample-product">Nombre del producto</span>
      <span className="trending-mobile-colors__sample-price">Precio <del>Precio anterior</del></span>
      <span className="trending-mobile-colors__sample-meta">TAMAÑOS Y COLORES <i>Tamaño</i></span>
      <span className="trending-mobile-colors__sample-description">Descripción del producto</span>
      <span className="trending-mobile-colors__sample-dots" aria-hidden="true"><i /><i /><i /></span>
      <span className="trending-mobile-colors__sample-button trending-liquid-button"><span className="trending-liquid-button__glint" aria-hidden="true" /><ShoppingBag size={18} aria-hidden="true" />Ver producto</span>
    </div>
    <p className="trending-mobile-colors__note">Muestra de combinación. Para probar la sección completa con tus productos, pulsa «Vista móvil» en la vista previa.</p>

    <section className="trending-mobile-colors__background" aria-label="Fondo exclusivo del móvil">
      <h4>Fondo del móvil</h4>
      <p className="trending-mobile-colors__note">Elige el fondo actual, un color o tu propia imagen. La imagen se ajusta para cubrir la sección; una composición vertical funciona mejor.</p>
      <div className="trending-mobile-colors__groups" role="group" aria-label="Fondo del móvil">
        {[["inherit", "Fondo actual"], ["color", "Color liso"], ["custom", "Mi imagen"]].map(([value, label]) => <button type="button" key={value}
          disabled={uploading} aria-pressed={presentation.mobileBackgroundMode === value}
          onClick={() => { setUploadError(""); onChange({ mobileBackgroundMode: value }); }}>{label}</button>)}
      </div>
      {presentation.mobileBackgroundMode === "color" && colorField(["mobileBackgroundColor", "Fondo de la sección"])}
      <label className="trending-mobile-colors__upload">
        <span><Upload size={16} aria-hidden="true" />{presentation.mobileBackgroundImage ? "Cambiar imagen de fondo móvil" : "Cargar imagen de fondo móvil"}</span>
        <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          aria-label="Cargar imagen de fondo móvil" disabled={uploading || !uploadToCloudinary} onChange={uploadBackground} />
      </label>
      {!uploadToCloudinary && <p className="trending-mobile-colors__note">La carga de imágenes no está disponible en este momento.</p>}
      {uploading && <p className="trending-mobile-colors__note" role="status">Cargando imagen…</p>}
      {uploadError && <p className="trending-mobile-colors__error" role="alert">{uploadError}</p>}
      {presentation.mobileBackgroundImage && <div className="trending-mobile-colors__uploaded">
        <img src={presentation.mobileBackgroundImage} alt="Imagen elegida para el fondo móvil" />
        <div><p className="trending-mobile-colors__note">{presentation.mobileBackgroundMode === "custom" ? "Imagen lista. Pulsa Guardar cambios para aplicarla en la tienda." : "Imagen guardada. Pulsa Mi imagen para volver a usarla."}</p>
          <button type="button" disabled={uploading} onClick={() => onChange({ mobileBackgroundImage: "", ...(presentation.mobileBackgroundMode === "custom" ? { mobileBackgroundMode: "inherit" } : {}) })}>Quitar imagen móvil</button>
        </div>
      </div>}
      {presentation.mobileBackgroundMode === "custom" && !presentation.mobileBackgroundImage && !uploading && <p className="trending-mobile-colors__note">Carga una imagen para activar tu fondo móvil. Mientras tanto se muestra el fondo actual.</p>}
    </section>

    <div className="trending-mobile-colors__groups" role="group" aria-label="Partes del diseño móvil">
      {GROUPS.map((item) => <button type="button" key={item.id} aria-pressed={groupId === item.id}
        onClick={() => setGroupId(item.id)}>{item.name}</button>)}
    </div>
    {groupId === "button" && <div className="trending-mobile-colors__glass-controls">
      <p className="trending-mobile-colors__note">El fondo se ve a través del cristal. Menos tinte y menos desenfoque conservan las ondas o los detalles de tu imagen.</p>
      <label><span>Intensidad del tinte <strong>{Math.round(presentation.mobileButtonTintOpacity * 100)}%</strong></span>
        <input type="range" aria-label="Intensidad del tinte del botón móvil" min="0" max="35" step="1"
          value={Math.round(presentation.mobileButtonTintOpacity * 100)} onChange={(event) => onChange({ mobileButtonTintOpacity: Number(event.target.value) / 100 })} />
      </label>
      <label><span>Desenfoque del cristal <strong>{presentation.mobileButtonBlurPx} px</strong></span>
        <input type="range" aria-label="Desenfoque del cristal del botón móvil" min="0" max="12" step="1"
          value={presentation.mobileButtonBlurPx} onChange={(event) => onChange({ mobileButtonBlurPx: Number(event.target.value) })} />
      </label>
      <button type="button" className="trending-mobile-colors__reset" onClick={() => onChange({ mobileButtonTintOpacity: .08, mobileButtonBlurPx: 2 })}>Restaurar cristal transparente</button>
    </div>}
    <div className="trending-mobile-colors__fields">{group.fields.map(colorField)}</div>
    {groupId === "text" && <p className="trending-mobile-colors__note">Las muestras de color de los productos conservan sus colores reales.
      {presentation.titleMode === "image" ? " El título es una imagen: su color se cambia editando esa imagen." : ""}</p>}
  </section>;
}
