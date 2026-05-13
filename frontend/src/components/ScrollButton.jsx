// src/components/ScrollButton.jsx
import React from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import {
  DEFAULT_SECTION_IDS,
  getCurrentSectionIndex,
  getNextSectionIndex,
  getPrevSectionIndex,
} from "../admin/appearance/general/generalHelpers";

function getShadowValue(shadow) {
  if (shadow === "none") return "none";
  if (shadow === "strong") return "0 12px 30px rgba(0,0,0,0.28)";
  return "0 8px 20px rgba(0,0,0,0.18)";
}

function getButtonAnimation(name, fallback) {
  if (name === "none") return "none";
  if (name === "pulse") return "rbScrollPulse 2s ease-in-out infinite";
  if (name === "bounce") return "rbScrollBounce 2s ease-in-out infinite";
  if (name === "moveUp") return "rbScrollMoveUp 2s ease-in-out infinite";
  if (name === "moveDown") return "rbScrollMoveDown 2s ease-in-out infinite";
  return fallback;
}

function scrollExactlyToSection(id, options = {}) {
  const el = document.getElementById(id);
  if (!el) return;

  const extraOffsetPx = Number.isFinite(Number(options.offsetTopPx))
    ? Number(options.offsetTopPx)
    : 0;

  const behavior = options.behavior === "auto" ? "auto" : "smooth";

  const y = el.getBoundingClientRect().top + window.pageYOffset - extraOffsetPx;

  window.scrollTo({
    top: Math.max(0, y),
    behavior,
  });
}

export default function ScrollButton({ config }) {
  const safeConfig = config && typeof config === "object" ? config : {};

  const sectionIds =
    Array.isArray(safeConfig.sectionIds) && safeConfig.sectionIds.length
      ? safeConfig.sectionIds
      : DEFAULT_SECTION_IDS;

  const enabled = safeConfig.enabled !== false;
  const showUp = safeConfig.showUp !== false;
  const showDown = safeConfig.showDown !== false;

  const offsetTopPx = Number.isFinite(Number(safeConfig.offsetTopPx))
    ? Number(safeConfig.offsetTopPx)
    : 0;

  const behavior = safeConfig.behavior === "auto" ? "auto" : "smooth";

  const position = safeConfig.position || "center";

  const bottomPx = Number.isFinite(Number(safeConfig.bottomPx))
    ? Number(safeConfig.bottomPx)
    : 24;

  const gapPx = Number.isFinite(Number(safeConfig.gapPx))
    ? Number(safeConfig.gapPx)
    : 16;

  const buttonSizePx = Number.isFinite(Number(safeConfig.buttonSizePx))
    ? Number(safeConfig.buttonSizePx)
    : 44;

  const bgColor = safeConfig.bgColor || "rgba(252, 231, 243, 0.5)";
  const iconColor = safeConfig.iconColor || "#D4AF37";

  const borderWidthPx = Number.isFinite(Number(safeConfig.borderWidthPx))
    ? Number(safeConfig.borderWidthPx)
    : 2;

  const borderColor = safeConfig.borderColor || "#D4AF37";

  const borderRadiusPx = Number.isFinite(Number(safeConfig.borderRadiusPx))
    ? Number(safeConfig.borderRadiusPx)
    : 999;

  const shadow = safeConfig.shadow || "soft";

  const upAnimation = safeConfig.upAnimation || "moveUp";
  const downAnimation = safeConfig.downAnimation || "moveDown";

  const upUseCustomImage = safeConfig.upUseCustomImage === true;
  const upImageUrl = String(safeConfig.upImageUrl || "").trim();
  const upImageSizePercent = Number.isFinite(Number(safeConfig.upImageSizePercent))
    ? Number(safeConfig.upImageSizePercent)
    : 70;

  const downUseCustomImage = safeConfig.downUseCustomImage === true;
  const downImageUrl = String(safeConfig.downImageUrl || "").trim();
  const downImageSizePercent = Number.isFinite(Number(safeConfig.downImageSizePercent))
    ? Number(safeConfig.downImageSizePercent)
    : 70;

  const scrollToIndex = (index) => {
    const id = sectionIds[index];
    if (!id) return;

    scrollExactlyToSection(id, {
      offsetTopPx,
      behavior,
    });
  };

  const handlePrev = () => {
    const currentIndex = getCurrentSectionIndex(sectionIds);
    const prevIndex = getPrevSectionIndex(currentIndex, sectionIds);
    scrollToIndex(prevIndex);
  };

  const handleNext = () => {
    const currentIndex = getCurrentSectionIndex(sectionIds);
    const nextIndex = getNextSectionIndex(currentIndex, sectionIds);
    scrollToIndex(nextIndex);
  };

  if (!enabled) return null;

  const wrapperPositionStyle =
    position === "left"
      ? { left: "24px" }
      : position === "right"
      ? { right: "24px" }
      : { left: "50%", transform: "translateX(-50%)" };

  const baseButtonStyle = {
    width: `${buttonSizePx}px`,
    height: `${buttonSizePx}px`,
    background: bgColor,
    border: `${borderWidthPx}px solid ${borderColor}`,
    borderRadius: `${borderRadiusPx}px`,
    boxShadow: getShadowValue(shadow),
    overflow: "hidden",
  };

  const upImageSizePx = (buttonSizePx * upImageSizePercent) / 100;
  const downImageSizePx = (buttonSizePx * downImageSizePercent) / 100;

  return (
    <>
      <style>{`
        @keyframes rbScrollMoveUp {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes rbScrollMoveDown {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }

        @keyframes rbScrollPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.08); }
        }

        @keyframes rbScrollBounce {
          0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
          60% { transform: translateY(-5px); }
        }
      `}</style>

      <div
        className="hidden md:flex fixed z-50 items-center"
        style={{
          bottom: `${bottomPx}px`,
          gap: `${gapPx}px`,
          ...wrapperPositionStyle,
        }}
      >
        {showUp && (
          <button
            onClick={handlePrev}
            className="flex items-center justify-center transition-transform duration-200 hover:scale-105"
            style={{
              ...baseButtonStyle,
              animation: getButtonAnimation(upAnimation, "rbScrollMoveUp 2s ease-in-out infinite"),
            }}
            aria-label="Sección anterior"
            type="button"
          >
            {upUseCustomImage && upImageUrl ? (
              <img
                src={upImageUrl}
                alt="Subir"
                style={{
                  width: `${upImageSizePx}px`,
                  height: `${upImageSizePx}px`,
                  objectFit: "contain",
                }}
              />
            ) : (
              <ArrowUp
                style={{
                  width: `${buttonSizePx * 0.55}px`,
                  height: `${buttonSizePx * 0.55}px`,
                  color: iconColor,
                }}
              />
            )}
          </button>
        )}

        {showDown && (
          <button
            onClick={handleNext}
            className="flex items-center justify-center transition-transform duration-200 hover:scale-105"
            style={{
              ...baseButtonStyle,
              animation: getButtonAnimation(
                downAnimation,
                "rbScrollMoveDown 2s ease-in-out infinite"
              ),
            }}
            aria-label="Siguiente sección"
            type="button"
          >
            {downUseCustomImage && downImageUrl ? (
              <img
                src={downImageUrl}
                alt="Bajar"
                style={{
                  width: `${downImageSizePx}px`,
                  height: `${downImageSizePx}px`,
                  objectFit: "contain",
                }}
              />
            ) : (
              <ArrowDown
                style={{
                  width: `${buttonSizePx * 0.55}px`,
                  height: `${buttonSizePx * 0.55}px`,
                  color: iconColor,
                }}
              />
            )}
          </button>
        )}
      </div>
    </>
  );
}