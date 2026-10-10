// src/components/ScrollButton.jsx
import React, { useEffect, useState } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import "./storefrontLiquidGlass.css";
import './storefrontChromeGlassHover.css';
import { safeBannerButtonAnimation } from '../lib/bannerTemplates';
import { moveChromeGlassLight, resolveChromeGlassMotion } from '../lib/chromeGlassMotion';
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
  if (name === "pulse") return "rbScrollPulse 450ms ease-in-out 1";
  if (name === "bounce") return "rbScrollBounce 550ms ease-in-out 1";
  if (name === "moveUp") return "rbScrollMoveUp 450ms ease-in-out 1";
  if (name === "moveDown") return "rbScrollMoveDown 450ms ease-in-out 1";
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

  const destination = Math.max(0, y);
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const current = Array.from(document.querySelectorAll('.storefront-sections > section'))
    .find((section) => section.getBoundingClientRect().top <= window.innerHeight * 0.45 &&
      section.getBoundingClientRect().bottom > window.innerHeight * 0.45);

  if (current && current !== el && !reducedMotion && behavior === 'smooth') {
    current.dataset.sectionMotion = 'leaving';
    window.setTimeout(() => {
      window.scrollTo({ top: destination, behavior });
      if (current.dataset.sectionMotion === 'leaving') delete current.dataset.sectionMotion;
    }, 190);
  } else {
    window.scrollTo({ top: destination, behavior: reducedMotion ? 'auto' : behavior });
  }
}

export default function ScrollButton({ config, buttonAnimation }) {
  const [activeAnimation, setActiveAnimation] = useState(null);
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

  const [railClearancePx, setRailClearancePx] = useState(0);
  useEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const rail = document.querySelector('.rb-template__rail');
      const bounds = rail?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const count = Number(showUp) + Number(showDown);
      const controlsWidth = count * buttonSizePx + Math.max(0, count - 1) * gapPx;
      const left = position === 'left' ? 24 : position === 'right' ? viewportWidth - 24 - controlsWidth : (viewportWidth - controlsWidth) / 2;
      const top = viewportHeight - bottomPx - buttonSizePx;
      const intersectsRail = bounds && bounds.width > 0 && bounds.height > 0 &&
        bounds.left < left + controlsWidth && bounds.right > left &&
        bounds.top < top + buttonSizePx && bounds.bottom > top;
      const clearance = intersectsRail ? Math.max(0, Math.ceil(viewportHeight - bounds.top + 14 - bottomPx)) : 0;
      setRailClearancePx((previous) => previous === clearance ? previous : clearance);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(measure); };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [position, bottomPx, gapPx, buttonSizePx, showUp, showDown, config]);

  const scrollToIndex = (index) => {
    const id = sectionIds[index];
    if (!id) return;

    scrollExactlyToSection(id, {
      offsetTopPx,
      behavior,
    });
  };

  const handlePrev = () => {
    setActiveAnimation('up');
    const currentIndex = getCurrentSectionIndex(sectionIds);
    const prevIndex = getPrevSectionIndex(currentIndex, sectionIds);
    scrollToIndex(prevIndex);
  };

  const handleNext = () => {
    setActiveAnimation('down');
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
    "--liquid-tint": bgColor,
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
          bottom: `${bottomPx + railClearancePx}px`,
          gap: `${gapPx}px`,
          transition: 'bottom .2s ease',
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
            onPointerMove={moveChromeGlassLight}
            data-button-animation={resolveChromeGlassMotion(safeConfig.glassMotion, safeBannerButtonAnimation(buttonAnimation))}
            data-click-animation={activeAnimation === 'down'}
            onAnimationEnd={(event) => { if (event.animationName === 'rb-chrome-edge') setActiveAnimation(null); }}
            className="storefront-liquid-icon"
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
