import React from "react";
import { ArrowDown, ArrowUp, Crown, Flower2, Gem, Heart, ShoppingBag, Sparkles, Star } from "lucide-react";
import "../../../components/storefrontLiquidGlass.css";

const loaderIcons = { sparkles: Sparkles, star: Star, heart: Heart, diamond: Gem, crown: Crown, flower: Flower2, bag: ShoppingBag };
const bounded = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export default function AppearanceToolPreview({ activeTool, config }) {
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
          <span className="appearance-general__preview-float storefront-liquid-icon"
            style={{
              [whatsapp.position === "left" ? "left" : "right"]: 18,
              width: bounded(whatsapp.sizePx, 36, 90, 56),
              height: bounded(whatsapp.sizePx, 36, 90, 56),
              bottom: 16,
              borderRadius: bounded(whatsapp.borderRadiusPx, 0, 999, 999),
              "--liquid-tint": whatsapp.bgColor || "#25D366",
            }}>
            <img src={whatsapp.useCustomImage && whatsapp.imageUrl ? whatsapp.imageUrl : "/icons/Whatsapp.svg"}
              alt="" style={{ width: `${bounded(whatsapp.iconSizePercent, 20, 100, 80)}%`, height: `${bounded(whatsapp.iconSizePercent, 20, 100, 80)}%`, objectFit: "contain" }} />
          </span>
        )}
        {activeTool === "scroll" && navigation.enabled && (
          <div className="appearance-general__preview-nav" style={{
            left: navigation.position === "left" ? 18 : navigation.position === "right" ? "auto" : "50%",
            right: navigation.position === "right" ? 18 : "auto",
            transform: navigation.position === "center" ? "translateX(-50%)" : "none",
            gap: bounded(navigation.gapPx, 0, 32, 16),
          }}>
            {navigation.showUp && <span className="storefront-liquid-icon" style={{ width: bounded(navigation.buttonSizePx, 28, 70, 44), height: bounded(navigation.buttonSizePx, 28, 70, 44), borderRadius: bounded(navigation.borderRadiusPx, 0, 999, 999), "--liquid-tint": navigation.bgColor }}>
              {navigation.upUseCustomImage && navigation.upImageUrl ? <img src={navigation.upImageUrl} alt="" /> : <ArrowUp size={21} color={navigation.iconColor} />}
            </span>}
            {navigation.showDown && <span className="storefront-liquid-icon" style={{ width: bounded(navigation.buttonSizePx, 28, 70, 44), height: bounded(navigation.buttonSizePx, 28, 70, 44), borderRadius: bounded(navigation.borderRadiusPx, 0, 999, 999), "--liquid-tint": navigation.bgColor }}>
              {navigation.downUseCustomImage && navigation.downImageUrl ? <img src={navigation.downImageUrl} alt="" /> : <ArrowDown size={21} color={navigation.iconColor} />}
            </span>}
          </div>
        )}
        {activeTool === "loader" && loader.enabled && (
          <div className="appearance-general__preview-loader" style={{
            background: loader.visualStyle === "dark" ? "rgba(53,32,57,.9)" : loader.visualStyle === "glass" ? "rgba(255,255,255,.42)" : (loader.backgroundColor || "#fff"),
            color: loader.textColor || "#23212e",
          }}>
            {loader.showLogo && loader.logoUrl && <img className="appearance-general__preview-logo" src={loader.logoUrl} alt="" />}
            <span className={`appearance-general__loader-mark appearance-general__loader-mark--${loader.type || "spinner"}`} style={{
              "--loader-color": loader.color || "#ec4899", "--loader-secondary": loader.secondaryColor || "#f9a8d4",
            }}>
              {Icon && <span className="storefront-liquid-icon appearance-general__preview-loader-icon" style={{ "--liquid-tint": loader.color }}><Icon size={22} strokeWidth={1.7} /></span>}
            </span>
            {loader.showText && <span className="appearance-general__preview-loader-text">{loader.text || "Cargando..."}</span>}
          </div>
        )}
      </div>
      <p className="appearance-general__preview-note">
        {activeTool === "whatsapp" && (whatsapp.enabled ? (whatsapp.phone ? "El botón abre el chat con el número configurado." : "Añade un número para que el botón aparezca en la tienda.") : "El botón está apagado en la tienda.")}
        {activeTool === "scroll" && (navigation.enabled ? "Los botones permiten moverse entre secciones de la portada." : "La navegación está apagada en la tienda.")}
        {activeTool === "loader" && (loader.enabled ? "La pantalla aparece mientras carga una página de la tienda." : "La pantalla de carga está apagada.")}
      </p>
    </aside>
  );
}
