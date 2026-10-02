// src/components/WhatsAppButton.jsx
import React from "react";
import WhatsAppGlyph from "./WhatsAppGlyph";
import "./storefrontLiquidGlass.css";
import "./whatsappButton.css";

function getShadowValue(shadow) {
  if (shadow === "none") return "none";
  if (shadow === "strong") return "0 12px 30px rgba(0,0,0,0.28)";
  return "0 8px 20px rgba(0,0,0,0.18)";
}

function getAnimationName(animation) {
  if (animation === "pulse") return "rbWhatsappPulse";
  if (animation === "float") return "rbWhatsappFloat";
  if (animation === "bounce") return "rbWhatsappBounce";
  return "";
}

export default function WhatsAppButton({ config }) {
  const safeConfig = config && typeof config === "object" ? config : {};

  const enabled = safeConfig.enabled !== false;

  const phone = String(safeConfig.phone || "").replace(/\D/g, "");
  const message = encodeURIComponent(safeConfig.message || "");
  const greeting = String(safeConfig.greeting ?? "¡Hola! ¿En qué podemos ayudarte?").trim().slice(0, 120);
  const greetingId = React.useId();

  const isLeft = safeConfig.position === "left";

  const bottomPx = Number.isFinite(Number(safeConfig.bottomPx))
    ? Number(safeConfig.bottomPx)
    : 24;

  const configuredSize = Number(safeConfig.sizePx);
  const sizePx = Number.isFinite(configuredSize) ? Math.max(44, Math.min(140, configuredSize)) : 56;
  const showBackground = safeConfig.showBackground !== false;

  const bgColor = safeConfig.bgColor || "#25D366";

  const useCustomImage = safeConfig.useCustomImage === true;
  const imageUrl = String(safeConfig.imageUrl || "").trim();
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => setImageFailed(false), [imageUrl]);

  const configuredIconSize = Number(safeConfig.iconSizePercent);
  const iconSizePercent = Number.isFinite(configuredIconSize)
    ? Math.max(20, Math.min(100, configuredIconSize))
    : 80;

  const borderRadiusPx = Number.isFinite(Number(safeConfig.borderRadiusPx))
    ? Number(safeConfig.borderRadiusPx)
    : 999;

  const borderWidthPx = Number.isFinite(Number(safeConfig.borderWidthPx))
    ? Number(safeConfig.borderWidthPx)
    : 0;

  const borderColor = safeConfig.borderColor || "#25D366";
  const shadow = safeConfig.shadow || "soft";
  const animation = safeConfig.animation || "none";

  if (!enabled || !phone) return null;

  const href = `https://wa.me/${phone}${message ? `?text=${message}` : ""}`;
  const internalIconSizePx = showBackground ? (sizePx * iconSizePercent) / 100 : sizePx;
  const animationName = getAnimationName(animation);

  return (
    <>
      <style>{`
        @keyframes rbWhatsappPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        @keyframes rbWhatsappFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }

        @keyframes rbWhatsappBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
      `}</style>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={showBackground ? "whatsapp-button storefront-liquid-icon transition-transform hover:scale-105" : "whatsapp-button whatsapp-button--plain transition-transform hover:scale-105"}
        style={{
          position: "fixed",
          bottom: `${bottomPx}px`,
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          "--liquid-tint": bgColor,
          zIndex: 9999,
          borderRadius: showBackground ? `${borderRadiusPx}px` : "0",
          border: showBackground ? `${borderWidthPx}px solid ${borderColor}` : "0",
          boxShadow: showBackground && shadow !== "none" ? getShadowValue(shadow) : "none",
          animation: animationName ? `${animationName} 2s ease-in-out infinite` : "none",
          [isLeft ? "left" : "right"]: "24px",
          overflow: showBackground ? "hidden" : "visible",
        }}
        aria-label="WhatsApp"
        aria-describedby={greeting ? greetingId : undefined}
      >
        {useCustomImage && imageUrl && !imageFailed ? (
          <img
            src={imageUrl}
            alt="WhatsApp"
            onError={() => setImageFailed(true)}
            style={{
              width: `${internalIconSizePx}px`,
              height: `${internalIconSizePx}px`,
              objectFit: "contain",
            }}
          />
        ) : (
          <span style={{ color: "#0e7548", display: "grid", placeItems: "center" }}>
            <WhatsAppGlyph size={internalIconSizePx} />
          </span>
        )}
      </a>
      {greeting && (
        <span
          id={greetingId}
          role="tooltip"
          className="whatsapp-button__greeting"
          style={{ bottom: `min(${bottomPx + sizePx + 12}px, calc(100dvh - 96px))`, [isLeft ? "left" : "right"]: "24px" }}
        >
          {greeting}
        </span>
      )}
    </>
  );
}
