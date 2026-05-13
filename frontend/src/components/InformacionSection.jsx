// src/components/informacionSection.jsx
import React, { useMemo } from "react";
import { Truck, Headset, Store } from "lucide-react";
import {
  normalizeInfoSection,
  INFO_SECTION_DEFAULTS,
  getInfoBackground,
} from "../admin/appearance/sections/info/infoSectionHelpers";

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getInfoSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];

  const found = sections.find((section) => {
    const id = typeof section?.id === "string" ? section.id.trim().toLowerCase() : "";
    const type = typeof section?.type === "string" ? section.type.trim().toLowerCase() : "";

    return (
      id === "informacion" ||
      type === "informacion" ||
      id === "info" ||
      type === "info"
    );
  });

  return normalizeInfoSection(found || INFO_SECTION_DEFAULTS);
}

function getIconComponent(iconName) {
  const key = typeof iconName === "string" ? iconName.trim().toLowerCase() : "";

  if (key === "truck") return Truck;
  if (key === "headset") return Headset;
  if (key === "store") return Store;

  return Truck;
}

function getEntranceAnimationStyles(animation) {
  switch (animation) {
    case "fade-in":
      return {
        animation: "infoFadeIn 0.8s ease-out both",
      };

    case "fade-up":
      return {
        animation: "infoFadeUp 0.85s ease-out both",
      };

    case "zoom-in":
      return {
        animation: "infoZoomIn 0.85s ease-out both",
      };

    case "slide-left":
      return {
        animation: "infoSlideLeft 0.85s ease-out both",
      };

    case "slide-right":
      return {
        animation: "infoSlideRight 0.85s ease-out both",
      };

    case "none":
    default:
      return {};
  }
}

export default function InfoSection({ theme }) {
  const section = useMemo(() => getInfoSectionFromTheme(theme), [theme]);

  if (!section?.enabled) return null;

  const config = section.config || {};
  const cards = Array.isArray(config.cards) ? config.cards.slice(0, 3) : [];
  const animationStyle = getEntranceAnimationStyles(config.entranceAnimation);

  const desktopContainerMaxWidth = clampNumber(config.containerMaxWidth, 320, 2000, 1200);
  const desktopContainerMinHeight = clampNumber(config.containerMinHeight, 120, 1200, 250);
  const desktopPaddingY = clampNumber(config.paddingY, 12, 160, 48);
  const desktopPaddingX = clampNumber(config.paddingX, 12, 120, 24);
  const desktopBorderRadius = clampNumber(config.borderRadius, 0, 80, 24);
  const desktopBorderWidth = clampNumber(config.borderWidth, 0, 16, 4);
  const desktopTitleFontSize = clampNumber(config.titleFontSize, 14, 90, 32);

  const mobileContainerMinHeight = Math.max(180, Math.round(desktopContainerMinHeight * 0.68));
  const mobilePaddingY = Math.max(18, Math.round(desktopPaddingY * 0.58));
  const mobilePaddingX = Math.max(14, Math.round(desktopPaddingX * 0.58));
  const mobileBorderRadius = Math.max(16, Math.round(desktopBorderRadius * 0.78));
  const mobileBorderWidth = Math.max(2, Math.round(desktopBorderWidth * 0.75));

  const containerStyle = {
    maxWidth: `${desktopContainerMaxWidth}px`,
    minHeight: `${desktopContainerMinHeight}px`,
    paddingTop: `${desktopPaddingY}px`,
    paddingBottom: `${desktopPaddingY}px`,
    paddingLeft: `${desktopPaddingX}px`,
    paddingRight: `${desktopPaddingX}px`,
    borderRadius: `${desktopBorderRadius}px`,
    borderWidth: `${desktopBorderWidth}px`,
    borderStyle: "solid",
    borderColor: config.borderColor || "#ffffff",
    background: getInfoBackground(config),
    boxShadow: config.shadow
      ? "0 25px 50px -12px rgba(0,0,0,0.25)"
      : "none",
    ...animationStyle,
  };

  const titleStyle = {
    color: config.titleColor || "#ffffff",
    fontSize: `clamp(16px, 5vw, ${desktopTitleFontSize}px)`,
    fontFamily: config.titleFontFamily || undefined,
    fontWeight: config.titleFontWeight || 700,
    lineHeight: 1.2,
  };

  return (
    <>
      <style>
        {`
          @keyframes infoFadeIn {
            0% {
              opacity: 0;
            }
            100% {
              opacity: 1;
            }
          }

          @keyframes infoFadeUp {
            0% {
              opacity: 0;
              transform: translateY(32px);
            }
            100% {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes infoZoomIn {
            0% {
              opacity: 0;
              transform: scale(0.92);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes infoSlideLeft {
            0% {
              opacity: 0;
              transform: translateX(-38px);
            }
            100% {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes infoSlideRight {
            0% {
              opacity: 0;
              transform: translateX(38px);
            }
            100% {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @media (max-width: 767px) {
            .info-responsive-container {
              min-height: ${mobileContainerMinHeight}px !important;
              padding-top: ${mobilePaddingY}px !important;
              padding-bottom: ${mobilePaddingY}px !important;
              padding-left: ${mobilePaddingX}px !important;
              padding-right: ${mobilePaddingX}px !important;
              border-radius: ${mobileBorderRadius}px !important;
              border-width: ${mobileBorderWidth}px !important;
            }

            .info-responsive-title {
              line-height: 1.12 !important;
              margin-bottom: 1.2rem !important;
              word-break: break-word !important;
              overflow-wrap: anywhere !important;
              max-width: 100% !important;
            }

            .info-responsive-grid {
              gap: 1.25rem !important;
            }

            .info-responsive-card {
              padding-left: 0.2rem !important;
              padding-right: 0.2rem !important;
            }

            .info-responsive-icon-shell {
              padding: 0.7rem !important;
              margin-bottom: 0.8rem !important;
            }

            .info-responsive-text {
              line-height: 1.45 !important;
            }
          }
        `}
      </style>

      <section className="mt-16 flex justify-center px-4">
        <div className="w-full info-responsive-container" style={containerStyle}>
          <h2
            className="text-center mb-10 info-responsive-title"
            style={{
              ...titleStyle,
              maxWidth: "100%",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            {config.titleText || "¡Te acompañamos en cada etapa de su historia!"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 info-responsive-grid">
            {cards.map((card, index) => {
              const Icon = getIconComponent(card?.icon);
              const desktopIconSize = clampNumber(card?.iconSize, 12, 120, 32);
              const desktopTextFontSize = clampNumber(card?.textFontSize, 12, 40, 18);

              const mobileIconSize = Math.max(20, Math.round(desktopIconSize * 0.76));
              const mobileTextFontSize = Math.max(14, Math.round(desktopTextFontSize * 0.8));

              const textStyle = {
                color: card?.textColor || "#ffffff",
                fontSize: `clamp(${mobileTextFontSize}px, 3.8vw, ${desktopTextFontSize}px)`,
                fontFamily: card?.textFontFamily || undefined,
                lineHeight: 1.6,
              };

              return (
                <div
                  key={card?.id || `info-card-${index + 1}`}
                  className="flex flex-col items-center text-center px-4 info-responsive-card"
                >
                  <div
                    className="rounded-full p-4 mb-4 flex items-center justify-center info-responsive-icon-shell"
                    style={{
                      backgroundColor: card?.iconBgColor || "rgba(255,255,255,0.30)",
                    }}
                  >
                    {card?.iconType === "image" && card?.iconUrl ? (
                      <img
                        src={card.iconUrl}
                        alt={`Icono bloque ${index + 1}`}
                        className="object-contain"
                        style={{
                          width: `clamp(${mobileIconSize}px, 6vw, ${desktopIconSize}px)`,
                          height: `clamp(${mobileIconSize}px, 6vw, ${desktopIconSize}px)`,
                        }}
                      />
                    ) : (
                      <Icon
                        style={{
                          width: `clamp(${mobileIconSize}px, 6vw, ${desktopIconSize}px)`,
                          height: `clamp(${mobileIconSize}px, 6vw, ${desktopIconSize}px)`,
                          color: card?.iconColor || "#ffffff",
                        }}
                      />
                    )}
                  </div>

                  <p className="info-responsive-text" style={textStyle}>
                    {card?.text || ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}