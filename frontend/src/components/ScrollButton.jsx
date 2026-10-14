// src/components/ScrollButton.jsx
import React, { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ChevronUp, ChevronDown } from "lucide-react";
import "./storefrontLiquidGlass.css";
import './storefrontChromeGlassHover.css';
import { safeBannerButtonAnimation } from '../lib/bannerTemplates';
import { moveChromeGlassLight, resolveChromeGlassMotion } from '../lib/chromeGlassMotion';
import {
  DEFAULT_SECTION_IDS,
  resolveSectionControlStyle,
  getSectionControlPresetStyle,
} from "../admin/appearance/general/generalHelpers";

function getShadowValue(shadow) {
  if (shadow === "none") return "none";
  if (shadow === "strong") return "0 12px 30px rgba(0,0,0,0.28)";
  return "0 8px 20px rgba(0,0,0,0.18)";
}

function getButtonAnimation(name, fallback) {
  if (name === "none") return "none";
  if (name === "pulse") return "rbScrollPulse 450ms ease-in-out 1";
  if (name === "bounce") return "rbScrollBounce 550ms ease-in-out 1";
  if (name === "moveUp") return "rbScrollMoveUp 450ms ease-in-out 1";
  if (name === "moveDown") return "rbScrollMoveDown 450ms ease-in-out 1";
  return fallback;
}

function getLayoutTop(element) {
  let top = 0;
  for (let node = element; node; node = node.offsetParent) top += node.offsetTop;
  return top;
}

function getSectionTargets(sectionIds) {
  return sectionIds
    .map((id) => document.getElementById(id))
    .filter((element) => element && !element.matches('.storefront-section-shell:empty'))
    .map((element) => ({
      id: element.id,
      top: getLayoutTop(element),
    }))
    .sort((a, b) => a.top - b.top);
}

function scrollExactlyToSection(target, options = {}) {
  if (!target) return;
  const offset = Math.max(0, Number(options.offsetTopPx) || 0);
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  window.scrollTo({
    top: Math.max(0, target.top - offset),
    behavior: reducedMotion || options.behavior === "auto" ? "auto" : "smooth",
  });
}

export default function ScrollButton({ config, buttonAnimation }) {
  const [activeAnimation, setActiveAnimation] = useState(null);
  const safeConfig = config && typeof config === "object" ? config : {};

  const sectionIds =
    Array.isArray(safeConfig.sectionIds) && safeConfig.sectionIds.length
      ? safeConfig.sectionIds
      : DEFAULT_SECTION_IDS;

  const enabled = safeConfig.enabled !== false;
  const visualStyle = resolveSectionControlStyle(safeConfig.visualStyle);
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

  useEffect(() => {
    document.documentElement.classList.toggle("rb-section-dock-enabled", enabled);
    document.documentElement.style.setProperty(
      "--rb-scroll-dock-height",
      `${Math.max(0, bottomPx + buttonSizePx + 48)}px`
    );
    return () => {
      document.documentElement.classList.remove("rb-section-dock-enabled");
      document.documentElement.style.removeProperty("--rb-scroll-dock-height");
    };
  }, [enabled, bottomPx, buttonSizePx]);

  const navigate = (direction) => {
    const targets = getSectionTargets(sectionIds);
    if (!targets.length) return;
    const offset = Math.max(0, offsetTopPx);
    const at = window.scrollY + offset;
    const tolerance = 4;
    const target = direction === "next"
      ? targets.find((item) => item.top > at + tolerance) || targets[0]
      : [...targets].reverse().find((item) => item.top < at - tolerance) || targets[targets.length - 1];
    scrollExactlyToSection(target, { offsetTopPx: offset, behavior });
  };

  const handlePrev = () => {
    setActiveAnimation("up");
    navigate("prev");
  };

  const handleNext = () => {
    setActiveAnimation("down");
    navigate("next");
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
    "--liquid-tint": bgColor,
    border: `${borderWidthPx}px solid ${borderColor}`,
    borderRadius: `${borderRadiusPx}px`,
    boxShadow: getShadowValue(shadow),
    overflow: "hidden",
    ...getSectionControlPresetStyle(visualStyle, safeConfig),
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
          gap: `${visualStyle === "editorial" ? Math.max(gapPx, 22) : gapPx}px`,
          ...wrapperPositionStyle,
        }}
      >
        {showUp && (
          <button
            onClick={handlePrev}
            onPointerMove={moveChromeGlassLight}
            data-button-animation={resolveChromeGlassMotion(safeConfig.glassMotion, safeBannerButtonAnimation(buttonAnimation))}
            data-click-animation={activeAnimation === 'up'}
            onAnimationEnd={(event) => { if (event.animationName === 'rb-chrome-edge') setActiveAnimation(null); }}
            className="storefront-liquid-icon"
            data-scroll-style={visualStyle}
            style={{
              ...baseButtonStyle,
              animation: activeAnimation === 'up' ? getButtonAnimation(upAnimation, "rbScrollMoveUp 450ms ease-in-out 1") : 'none',
            }}
            aria-label="Sección anterior"
            type="button"
          >
            <span className="rb-chrome-hover__surface" aria-hidden="true" />
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
              visualStyle === "editorial" ? <ChevronUp
                style={{
                  width: `${buttonSizePx * 0.55}px`,
                  height: `${buttonSizePx * 0.55}px`,
                  color: iconColor,
                }}
              /> : <ArrowUp
                style={{ width: `${buttonSizePx * 0.55}px`, height: `${buttonSizePx * 0.55}px`, color: iconColor }}
              />
            )}
          </button>
        )}

        {visualStyle === "editorial" && showUp && showDown && <span aria-hidden="true" style={{ width: "1px", height: `${Math.round(buttonSizePx * .55)}px`, background: iconColor, opacity: .55 }} />}

        {showDown && (
          <button
            onClick={handleNext}
            onPointerMove={moveChromeGlassLight}
            data-button-animation={resolveChromeGlassMotion(safeConfig.glassMotion, safeBannerButtonAnimation(buttonAnimation))}
            data-click-animation={activeAnimation === 'down'}
            onAnimationEnd={(event) => { if (event.animationName === 'rb-chrome-edge') setActiveAnimation(null); }}
            className="storefront-liquid-icon"
            data-scroll-style={visualStyle}
            style={{
              ...baseButtonStyle,
              animation: activeAnimation === 'down' ? getButtonAnimation(
                downAnimation,
                "rbScrollMoveDown 450ms ease-in-out 1"
              ) : 'none',
            }}
            aria-label="Siguiente sección"
            type="button"
          >
            <span className="rb-chrome-hover__surface" aria-hidden="true" />
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
              visualStyle === "editorial" ? <ChevronDown
                style={{
                  width: `${buttonSizePx * 0.55}px`,
                  height: `${buttonSizePx * 0.55}px`,
                  color: iconColor,
                }}
              /> : <ArrowDown
                style={{ width: `${buttonSizePx * 0.55}px`, height: `${buttonSizePx * 0.55}px`, color: iconColor }}
              />
            )}
          </button>
        )}
      </div>
    </>
  );
}
