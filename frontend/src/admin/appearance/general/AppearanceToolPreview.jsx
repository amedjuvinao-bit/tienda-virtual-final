import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Crown, Flower2, Gem, Heart, ShoppingBag, Sparkles, Star } from "lucide-react";
import WhatsAppGlyph from "../../../components/WhatsAppGlyph";
import "../../../components/storefrontLiquidGlass.css";
import '../../../components/storefrontChromeGlassHover.css';
import { moveChromeGlassLight, resolveChromeGlassMotion } from '../../../lib/chromeGlassMotion';

const loaderIcons = { sparkles: Sparkles, star: Star, heart: Heart, diamond: Gem, crown: Crown, flower: Flower2, bag: ShoppingBag };
const bounded = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

function PreviewImage({ url, fallback, className, style }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed
    ? <img src={url} alt="" className={className} style={style} onError={() => setFailed(true)} />
    : fallback;
}

export default function AppearanceToolPreview({ activeTool, config, inheritedMotion = 'prism' }) {
  const [previewClick, setPreviewClick] = useState(null);
  const whatsapp = config.whatsapp;
  const navigation = config.scrollButtons;
  const loader = config.loader;
  const Icon = loaderIcons[loader.icon];

  return (
    <aside className="appearance-general__preview" aria-label="Vista previa de la herramienta">
      <div className="appearance-general__preview-header">
        <span className="appearance-general__preview-live" aria-hidden="true" />
        <strong>Vista previa</strong>
        <small>Los cambios se ven aquí antes de guardar</small>
      </div>
      <div className="appearance-general__preview-stage">
        <div className="appearance-general__preview-browser" aria-hidden="true"><span /><span /><span /></div>
        <div className="appearance-general__preview-product" aria-hidden="true">
          <div className="appearance-general__preview-product-image" />
          <div className="appearance-general__preview-product-lines"><i /><i /><i /></div>
        </div>
        {activeTool === "whatsapp" && whatsapp.enabled && (
          <span className={`appearance-general__preview-float${whatsapp.showBackground === false ? " appearance-general__preview-float--plain" : " storefront-liquid-icon"}`}
            style={{
              [whatsapp.position === "left" ? "left" : "right"]: 18,
              width: bounded(whatsapp.sizePx, 44, 140, 56),
              height: bounded(whatsapp.sizePx, 44, 140, 56),
              bottom: 16,
              borderRadius: whatsapp.showBackground === false ? 0 : bounded(whatsapp.borderRadiusPx, 0, 999, 999),
              "--liquid-tint": whatsapp.bgColor || "#25D366",
            }}>
            <PreviewImage url={whatsapp.useCustomImage ? whatsapp.imageUrl : ""}
              style={{ width: whatsapp.showBackground === false ? "100%" : `${bounded(whatsapp.iconSizePercent, 20, 100, 80)}%`, height: whatsapp.showBackground === false ? "100%" : `${bounded(whatsapp.iconSizePercent, 20, 100, 80)}%`, objectFit: "contain" }}
              fallback={<span style={{ color: "#0e7548" }}><WhatsAppGlyph size={whatsapp.showBackground === false ? bounded(whatsapp.sizePx, 44, 140, 56) : 30} /></span>} />
          </span>
        )}
        {activeTool === "whatsapp" && whatsapp.enabled && String(whatsapp.greeting ?? "").trim() && (
          <span className="appearance-general__preview-greeting"
            style={{ [whatsapp.position === "left" ? "left" : "right"]: 18 }}>
            {String(whatsapp.greeting).trim().slice(0, 120)}
          </span>
        )}
        {activeTool === "scroll" && navigation.enabled && (
          <div className="appearance-general__preview-nav" style={{
            left: navigation.position === "left" ? 18 : navigation.position === "right" ? "auto" : "50%",
            right: navigation.position === "right" ? 18 : "auto",
            transform: navigation.position === "center" ? "translateX(-50%)" : "none",
            gap: bounded(navigation.gapPx, 0, 32, 16),
          }}>
            {navigation.showUp && <button type="button" aria-label="Probar animación de subir" onPointerMove={moveChromeGlassLight}
              onClick={() => setPreviewClick('up')} onAnimationEnd={(event) => { if (event.animationName === 'rb-chrome-edge') setPreviewClick(null); }}
              data-click-animation={previewClick === 'up'} data-button-animation={resolveChromeGlassMotion(navigation.glassMotion, inheritedMotion)}
              className="storefront-liquid-icon" style={{ width: bounded(navigation.buttonSizePx, 28, 70, 44), height: bounded(navigation.buttonSizePx, 28, 70, 44), borderRadius: bounded(navigation.borderRadiusPx, 0, 999, 999), "--liquid-tint": navigation.bgColor }}>
              <span className="rb-chrome-hover__surface" aria-hidden="true" />
              <PreviewImage url={navigation.upUseCustomImage ? navigation.upImageUrl : ""} fallback={<ArrowUp size={21} color={navigation.iconColor} />} />
            </button>}
            {navigation.showDown && <button type="button" aria-label="Probar animación de bajar" onPointerMove={moveChromeGlassLight}
              onClick={() => setPreviewClick('down')} onAnimationEnd={(event) => { if (event.animationName === 'rb-chrome-edge') setPreviewClick(null); }}
              data-click-animation={previewClick === 'down'} data-button-animation={resolveChromeGlassMotion(navigation.glassMotion, inheritedMotion)}
              className="storefront-liquid-icon" style={{ width: bounded(navigation.buttonSizePx, 28, 70, 44), height: bounded(navigation.buttonSizePx, 28, 70, 44), borderRadius: bounded(navigation.borderRadiusPx, 0, 999, 999), "--liquid-tint": navigation.bgColor }}>
              <span className="rb-chrome-hover__surface" aria-hidden="true" />
              <PreviewImage url={navigation.downUseCustomImage ? navigation.downImageUrl : ""} fallback={<ArrowDown size={21} color={navigation.iconColor} />} />
            </button>}
          </div>
        )}
        {activeTool === "loader" && loader.enabled && (
          <div className="appearance-general__preview-loader" style={{
            background: "transparent",
            color: loader.textColor || "#23212e",
          }}>
            {loader.showLogo && loader.logoUrl && <PreviewImage className="appearance-general__preview-logo" style={{ width: bounded(loader.logoSizePx, 20, 140, 72), height: bounded(loader.logoSizePx, 20, 140, 72) }} url={loader.logoUrl} fallback={null} />}
            <span className={`appearance-general__loader-mark appearance-general__loader-mark--${loader.type || "spinner"}`} style={{
              "--loader-color": loader.color || "#ec4899", "--loader-secondary": loader.secondaryColor || "#f9a8d4",
            }}>
              {Icon && <span className="appearance-general__preview-loader-icon" style={{ color: loader.color }}><Icon size={22} strokeWidth={1.7} /></span>}
            </span>
            {loader.showText && <span className="appearance-general__preview-loader-text">{loader.text || "Cargando..."}</span>}
          </div>
        )}
      </div>
      <p className="appearance-general__preview-note">
        {activeTool === "whatsapp" && (whatsapp.enabled ? (whatsapp.phone ? "El botón abre el chat con el número configurado." : "Añade un número para que el botón aparezca en la tienda.") : "El botón está apagado en la tienda.")}
        {activeTool === "scroll" && (navigation.enabled ? "Los botones permiten moverse entre secciones de la portada." : "La navegación está apagada en la tienda.")}
        {activeTool === "loader" && (loader.enabled ? "La figura elegida se muestra directamente sobre la tienda, sin fondo ni tarjeta." : "La pantalla de carga está apagada.")}
      </p>
    </aside>
  );
}
