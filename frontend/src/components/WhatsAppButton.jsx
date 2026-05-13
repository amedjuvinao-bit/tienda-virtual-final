// src/components/WhatsAppButton.jsx
import React from "react";

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

  const isLeft = safeConfig.position === "left";

  const bottomPx = Number.isFinite(Number(safeConfig.bottomPx))
    ? Number(safeConfig.bottomPx)
    : 24;

  const sizePx = Number.isFinite(Number(safeConfig.sizePx))
    ? Number(safeConfig.sizePx)
    : 56;

  const bgColor = safeConfig.bgColor || "#25D366";

  const useCustomImage = safeConfig.useCustomImage === true;
  const imageUrl = String(safeConfig.imageUrl || "").trim();

  const iconSizePercent = Number.isFinite(Number(safeConfig.iconSizePercent))
    ? Number(safeConfig.iconSizePercent)
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
  const internalIconSizePx = (sizePx * iconSizePercent) / 100;
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
        className="fixed flex items-center justify-center transition-transform hover:scale-110"
        style={{
          bottom: `${bottomPx}px`,
          width: `${sizePx}px`,
          height: `${sizePx}px`,
          backgroundColor: bgColor,
          zIndex: 9999,
          borderRadius: `${borderRadiusPx}px`,
          border: `${borderWidthPx}px solid ${borderColor}`,
          boxShadow: getShadowValue(shadow),
          animation: animationName ? `${animationName} 2s ease-in-out infinite` : "none",
          [isLeft ? "left" : "right"]: "24px",
          overflow: "hidden",
        }}
        aria-label="WhatsApp"
      >
        {useCustomImage && imageUrl ? (
          <img
            src={imageUrl}
            alt="WhatsApp"
            style={{
              width: `${internalIconSizePx}px`,
              height: `${internalIconSizePx}px`,
              objectFit: "contain",
            }}
          />
        ) : (
          <img
            src="/icons/Whatsapp.svg"
            alt="WhatsApp"
            style={{
              width: `${internalIconSizePx}px`,
              height: `${internalIconSizePx}px`,
              objectFit: "contain",
            }}
          />
        )}
      </a>
    </>
  );
}