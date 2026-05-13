// src/components/CategoriasSection.jsx
import "keen-slider/keen-slider.min.css";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  CATEGORIAS_SECTION_DEFAULTS,
  normalizeCategoriasSection,
} from "../admin/appearance/sections/categorias/categoriasSectionHelpers";

function getCategoriasSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "categorias" || type === "categorias";
  });

  return normalizeCategoriasSection(found || CATEGORIAS_SECTION_DEFAULTS);
}

function getArrowClasses(arrowStyle) {
  if (arrowStyle === "glass") {
    return "backdrop-blur-md shadow-[0_12px_30px_rgba(0,0,0,0.14)]";
  }

  if (arrowStyle === "outline") {
    return "shadow-none";
  }

  if (arrowStyle === "minimal") {
    return "shadow-[0_8px_20px_rgba(0,0,0,0.08)]";
  }

  return "shadow-[0_14px_32px_rgba(0,0,0,0.14)]";
}

function getButtonAnimationClass(animation) {
  if (animation === "pulse") return "animate-pulse";
  if (animation === "soft-float") return "animate-[floatY_3.2s_ease-in-out_infinite]";
  if (animation === "hover-bounce") return "hover:-translate-y-1";
  return "";
}

function getSafeIndex(index, total) {
  if (!total) return 0;
  return ((index % total) + total) % total;
}

function clampPercent(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, n));
}

function getButtonRadius(style) {
  if ((style?.buttonShape || "rounded") === "pill") return 999;
  if (style?.buttonShape === "square") return 0;
  return Number(style?.buttonRadiusPx) || 12;
}

export default function CategoriasSection({ theme }) {
  const categoriasSection = useMemo(() => getCategoriasSectionFromTheme(theme), [theme]);
  const config = categoriasSection.config;
  const style = categoriasSection.style;

  const enabledSlides = useMemo(() => {
    return Array.isArray(config?.slides)
      ? config.slides.filter((slide) => slide?.enabled !== false)
      : [];
  }, [config]);

  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!enabledSlides.length) return;

    const delay = Math.max(Number(style?.autoplayMs) || 3000, 1200);
    const timer = setInterval(() => {
      setCurrentSlide((prev) => getSafeIndex(prev + 1, enabledSlides.length));
    }, delay);

    return () => clearInterval(timer);
  }, [enabledSlides.length, style?.autoplayMs]);

  useEffect(() => {
    if (!enabledSlides.length) return;
    setCurrentSlide((prev) => getSafeIndex(prev, enabledSlides.length));
  }, [enabledSlides.length]);

  if (categoriasSection.enabled === false) return null;
  if (!enabledSlides.length) return null;

  const activeIndex = getSafeIndex(currentSlide, enabledSlides.length);
  const activeSlide = enabledSlides[activeIndex];

  const thumbIndexes = [];
  for (let i = 1; i <= Math.min(enabledSlides.length - 1, 3); i += 1) {
    thumbIndexes.push(getSafeIndex(activeIndex + i, enabledSlides.length));
  }

  const titleNode = config.titleImage ? (
    <img
      src={config.titleImage}
      alt={config.titleAlt || "Título de categorías"}
      className="mx-auto h-auto"
      style={{
        width: "100%",
        maxWidth: style.titleMaxWidthPx,
      }}
      draggable={false}
    />
  ) : (
    <div className="text-center font-semibold text-neutral-900 text-2xl md:text-3xl">
      {config.titleText || "Categorías"}
    </div>
  );

  const goPrev = () => {
    setCurrentSlide((prev) => getSafeIndex(prev - 1, enabledSlides.length));
  };

  const goNext = () => {
    setCurrentSlide((prev) => getSafeIndex(prev + 1, enabledSlides.length));
  };

  const heroWidthPx = Number(style?.heroWidthPx) || Number(style?.sectionMaxWidthPx) || 1280;
  const heroHeight = Number(style?.heroHeightPx) || 470;
  const heroRadiusPx = Number(style?.heroRadiusPx ?? style?.cardRadiusPx) || 24;
  const heroBorderPx = Number(style?.heroBorderPx ?? style?.cardBorderPx) || 0;
  const heroBorderColor = style?.heroBorderColor || style?.cardBorderColor || "#f9a8d4";
  const heroOverlayStart = style?.heroOverlayStart || "rgba(0,0,0,0.34)";
  const heroOverlayMiddle = style?.heroOverlayMiddle || "rgba(0,0,0,0.14)";
  const heroOverlayEnd = style?.heroOverlayEnd || "rgba(0,0,0,0.28)";
  const heroImagePosX = clampPercent(style?.heroImagePosXPercent, 50);
  const heroImagePosY = clampPercent(style?.heroImagePosYPercent, 50);
  const heroImageScale = Number(style?.heroImageScale) || 1.02;
  const heroContentPosX = clampPercent(style?.heroContentPosXPercent, 8);
  const heroContentPosY = clampPercent(style?.heroContentPosYPercent, 10);
  const thumbsPosX = clampPercent(style?.thumbsPosXPercent, 68);
  const thumbsPosY = clampPercent(style?.thumbsPosYPercent, 50);
  const thumbWidthPx = Number(style?.thumbWidthPx) || 140;
  const thumbHeightPx = Number(style?.thumbHeightPx) || 190;
  const thumbGapPx = Number(style?.thumbGapPx) || 14;
  const thumbTiltDeg = Number(style?.thumbTiltDeg) || 8;
  const showReview = style?.showReview !== false;
  const showBadge = style?.showBadge !== false;
  const buttonAnimationClass = getButtonAnimationClass(style?.buttonAnimation || "none");
  const buttonRadius = getButtonRadius(style);
  const buttonTextColor = style?.buttonTextColor || "#111827";
  const buttonTextHoverColor = style?.buttonTextHoverColor || buttonTextColor;
  const buttonFontSizePx = Number(style?.buttonFontSizePx) || 14;
  const buttonFontWeight = style?.buttonFontWeight || "600";

  const arrowSizePx = Number(style?.arrowSizePx) || 52;
  const buttonOverlayBg = style?.buttonOverlayHoverBg || style?.buttonOverlayBg;
  const buttonImageWidthPx = Number(style?.buttonImageWidthPx) || 170;

  return (
    <section
      className="w-full"
      style={{
        paddingTop: style.sectionPaddingTopPx,
        paddingBottom: style.sectionPaddingBottomPx,
        paddingLeft: style.sectionPaddingXPx,
        paddingRight: style.sectionPaddingXPx,
      }}
    >
      <style>{`
        @keyframes floatY {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }

        .categorias-hero {
          min-height: ${heroHeight}px;
        }

        .categorias-content-box {
          width: 36%;
          min-width: 200px;
          max-width: 360px;
        }

        .categorias-main-title {
          font-size: clamp(1.25rem, 2.4vw, 2.25rem);
          line-height: 1.05;
        }

        .categorias-main-subtitle {
          font-size: clamp(0.75rem, 1vw, 1rem);
          line-height: 1.35;
        }

        .categorias-main-review {
          font-size: clamp(0.75rem, 0.95vw, 0.95rem);
          line-height: 1.5;
        }

        .categorias-cta-img {
          width: ${buttonImageWidthPx}px;
          max-width: 100%;
          height: auto;
        }

        .categorias-mobile-thumbs {
          display: none;
        }

        @media (max-width: 1180px) {
          .categorias-hero {
            min-height: clamp(400px, 46vw, ${heroHeight}px);
          }

          .categorias-content-box {
            width: 40%;
            max-width: 340px;
          }
        }

        @media (max-width: 991px) {
          .categorias-hero {
            min-height: clamp(360px, 54vw, 520px);
          }

          .categorias-content-box {
            width: 48%;
            min-width: 0;
            max-width: 320px;
          }
        }

        @media (max-width: 767px) {
          .categorias-hero {
            min-height: auto !important;
            height: auto !important;
            aspect-ratio: 4 / 5;
          }

          .categorias-content-box {
            left: 6% !important;
            top: 10% !important;
            width: 54% !important;
            min-width: 0 !important;
            max-width: none !important;
          }

          .categorias-main-title {
            font-size: clamp(0.95rem, 4.7vw, 1.4rem);
            line-height: 1.02;
          }

          .categorias-main-subtitle {
            margin-top: 6px !important;
            font-size: clamp(0.62rem, 2.35vw, 0.8rem);
            line-height: 1.25;
          }

          .categorias-main-review {
            margin-top: 7px !important;
            font-size: clamp(0.58rem, 2.1vw, 0.74rem);
            line-height: 1.28;
          }

          .categorias-badge {
            margin-bottom: 7px !important;
            padding: 4px 9px !important;
            font-size: 9px !important;
          }

          .categorias-cta-wrap {
            margin-top: 9px !important;
          }

          .categorias-cta {
            padding-top: clamp(5px, 1.35vw, 8px) !important;
            padding-bottom: clamp(5px, 1.35vw, 8px) !important;
            padding-left: clamp(8px, 2.2vw, 12px) !important;
            padding-right: clamp(8px, 2.2vw, 12px) !important;
            max-width: 100%;
            border-radius: clamp(12px, 3vw, 18px) !important;
          }

          .categorias-cta-text {
            font-size: clamp(9px, 2.2vw, 11px) !important;
            line-height: 1 !important;
          }

          .categorias-cta-img {
            width: clamp(84px, 24vw, 118px) !important;
            max-width: 100%;
          }

          .categorias-desktop-thumbs {
            display: none !important;
          }

          .categorias-mobile-thumbs {
            position: absolute;
            right: clamp(6px, 1.8vw, 10px);
            bottom: clamp(6px, 1.8vw, 10px);
            z-index: 10;
            display: flex;
            align-items: flex-end;
            gap: clamp(4px, 1.2vw, 8px);
          }

          .categorias-mobile-thumb {
            position: relative;
            overflow: hidden;
            border-radius: clamp(8px, 2vw, 14px);
            border: 1px solid rgba(255,255,255,0.25);
            box-shadow: 0 8px 18px rgba(0,0,0,0.18);
            background: rgba(255,255,255,0.14);
            backdrop-filter: blur(2px);
            transition: transform 260ms ease, box-shadow 260ms ease;
          }

          .categorias-mobile-thumb:active {
            transform: scale(0.98);
          }

          .categorias-mobile-thumb.is-main {
            width: clamp(42px, 12vw, 58px) !important;
            height: clamp(58px, 16vw, 80px) !important;
          }

          .categorias-mobile-thumb:not(.is-main) {
            width: clamp(32px, 9vw, 46px) !important;
            height: clamp(44px, 12vw, 64px) !important;
          }

          .categorias-arrow {
            display: none !important;
          }
        }

        @media (max-width: 560px) {
          .categorias-hero {
            aspect-ratio: 4 / 5.2;
          }

          .categorias-content-box {
            left: 5.5% !important;
            top: 9% !important;
            width: 56% !important;
          }

          .categorias-main-title {
            font-size: clamp(0.84rem, 4.8vw, 1.12rem);
          }

          .categorias-main-subtitle {
            font-size: clamp(0.54rem, 2.2vw, 0.68rem);
          }

          .categorias-main-review {
            font-size: clamp(0.5rem, 2vw, 0.64rem);
            line-height: 1.22;
          }

          .categorias-mobile-thumbs {
            right: 6px;
            bottom: 7px;
            gap: 4px;
          }

          .categorias-mobile-thumb.is-main {
            width: clamp(38px, 11vw, 50px) !important;
            height: clamp(52px, 15vw, 68px) !important;
          }

          .categorias-mobile-thumb:not(.is-main) {
            width: clamp(28px, 8vw, 39px) !important;
            height: clamp(38px, 11vw, 54px) !important;
          }

          .categorias-cta {
            padding-top: 4px !important;
            padding-bottom: 4px !important;
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .categorias-cta-img {
            width: clamp(72px, 22vw, 98px) !important;
          }

          .categorias-cta-text {
            font-size: 9px !important;
          }
        }

        @media (max-width: 420px) {
          .categorias-hero {
            aspect-ratio: 4 / 5.35;
          }

          .categorias-content-box {
            width: 57% !important;
          }

          .categorias-main-title {
            font-size: clamp(0.78rem, 4.5vw, 1.02rem);
          }

          .categorias-main-subtitle {
            font-size: 0.5rem;
            line-height: 1.18;
          }

          .categorias-main-review {
            font-size: 0.48rem;
            line-height: 1.15;
          }

          .categorias-badge {
            font-size: 8px !important;
            padding: 3px 7px !important;
          }

          .categorias-cta-img {
            width: clamp(66px, 20vw, 88px) !important;
          }

          .categorias-cta-text {
            font-size: 8px !important;
          }
        }
      `}</style>

      <div
        className="mx-auto w-full"
        style={{
          maxWidth: style.sectionMaxWidthPx,
        }}
      >
        <div
          className="px-1"
          style={{
            marginBottom: style.titleMarginBottomPx,
          }}
        >
          {titleNode}
        </div>

        <div
          className="relative mx-auto"
          style={{
            width: "100%",
            maxWidth: heroWidthPx,
          }}
        >
          <div
            className="categorias-hero relative overflow-hidden"
            style={{
              height: heroHeight,
              borderRadius: heroRadiusPx,
              borderWidth: heroBorderPx,
              borderStyle: "solid",
              borderColor: heroBorderColor,
              background: `linear-gradient(135deg, ${style.cardBgFrom}, ${style.cardBgTo})`,
              boxShadow: style.cardShadow
                ? "0 26px 58px rgba(0,0,0,0.16)"
                : "none",
            }}
          >
            <div className="absolute inset-0">
              <img
                key={activeSlide?.id || activeIndex}
                src={activeSlide?.image || ""}
                alt={activeSlide?.title || `Slide ${activeIndex + 1}`}
                className="h-full w-full"
                style={{
                  objectFit: style.imageObjectFit || "cover",
                  objectPosition: `${heroImagePosX}% ${heroImagePosY}%`,
                  transition: "opacity 420ms ease, transform 620ms ease",
                  transform: `scale(${heroImageScale})`,
                }}
              />
            </div>

            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${heroOverlayStart} 0%, ${heroOverlayMiddle} 45%, ${heroOverlayEnd} 100%)`,
              }}
            />

            <div
              className="categorias-content-box absolute z-10"
              style={{
                left: `${heroContentPosX}%`,
                top: `${heroContentPosY}%`,
                transform: "translate(0, 0)",
              }}
            >
              {showBadge && activeSlide?.badge ? (
                <div className="categorias-badge inline-flex mb-3 rounded-full bg-white/18 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                  {activeSlide.badge}
                </div>
              ) : null}

              {activeSlide?.title ? (
                <div className="text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
                  <div className="categorias-main-title font-bold">
                    {activeSlide.title}
                  </div>

                  {activeSlide?.subtitle ? (
                    <div className="categorias-main-subtitle mt-2 font-medium text-white/85">
                      {activeSlide.subtitle}
                    </div>
                  ) : null}

                  {showReview && activeSlide?.review ? (
                    <div className="categorias-main-review mt-3 leading-relaxed text-white/80">
                      {activeSlide.review}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="categorias-cta-wrap mt-4">
                <a
                  href={activeSlide?.href || "/"}
                  className={[
                    "categorias-cta inline-flex items-center justify-center overflow-hidden transition-all duration-300 hover:scale-[1.03]",
                    buttonAnimationClass,
                  ].join(" ")}
                  style={{
                    background: buttonOverlayBg,
                    paddingTop: style.buttonOverlayPaddingYPx,
                    paddingBottom: style.buttonOverlayPaddingYPx,
                    paddingLeft: 14,
                    paddingRight: 14,
                    borderRadius: buttonRadius,
                    color: buttonTextColor,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = buttonTextHoverColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = buttonTextColor;
                  }}
                >
                  {activeSlide?.buttonImg ? (
                    <img
                      src={activeSlide.buttonImg}
                      alt={activeSlide.buttonText || `Ver más ${activeSlide.title || ""}`}
                      className="categorias-cta-img h-auto"
                      draggable={false}
                    />
                  ) : (
                    <span
                      className="categorias-cta-text"
                      style={{
                        color: "inherit",
                        fontSize: buttonFontSizePx,
                        fontWeight: buttonFontWeight,
                        lineHeight: 1.1,
                      }}
                    >
                      {activeSlide?.buttonText || "Ver más"}
                    </span>
                  )}
                </a>
              </div>
            </div>

            <div
              className="categorias-desktop-thumbs absolute z-10 hidden md:flex"
              style={{
                left: `${thumbsPosX}%`,
                top: `${thumbsPosY}%`,
                transform: "translate(-50%, -50%)",
                gap: thumbGapPx,
                alignItems: "center",
              }}
            >
              {thumbIndexes.map((thumbIndex, order) => {
                const thumb = enabledSlides[thumbIndex];
                const rotate =
                  order === 0 ? -thumbTiltDeg : order === 1 ? 0 : thumbTiltDeg;
                const translateY = order === 1 ? 0 : 14;
                const width =
                  order === 1 ? thumbWidthPx : Math.max(thumbWidthPx - 16, 70);
                const height =
                  order === 1 ? thumbHeightPx : Math.max(thumbHeightPx - 20, 100);
                const opacity = order === 1 ? 1 : 0.88;

                return (
                  <button
                    key={thumb?.id || thumbIndex}
                    type="button"
                    onClick={() => setCurrentSlide(thumbIndex)}
                    className="group relative overflow-hidden rounded-2xl border border-white/25 bg-white/8 backdrop-blur-[2px] transition-all duration-500 hover:scale-[1.03]"
                    style={{
                      width,
                      height,
                      transform: `translateY(${translateY}px) rotate(${rotate}deg)`,
                      opacity,
                      boxShadow: "0 18px 38px rgba(0,0,0,0.22)",
                    }}
                    aria-label={thumb?.title || `Slide ${thumbIndex + 1}`}
                  >
                    <img
                      src={thumb?.image || ""}
                      alt={thumb?.title || `Slide ${thumbIndex + 1}`}
                      className="h-full w-full transition-transform duration-500 group-hover:scale-105"
                      style={{
                        objectFit: style.imageObjectFit || "cover",
                      }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-black/10" />
                  </button>
                );
              })}
            </div>

            <div className="categorias-mobile-thumbs md:hidden">
              {[activeIndex, ...thumbIndexes].slice(0, 3).map((thumbIndex, order) => {
                const thumb = enabledSlides[thumbIndex];
                const isMainThumb = order === 0;

                return (
                  <button
                    key={thumb?.id || thumbIndex}
                    type="button"
                    onClick={() => setCurrentSlide(thumbIndex)}
                    className={[
                      "categorias-mobile-thumb",
                      isMainThumb ? "is-main" : "",
                    ].join(" ")}
                    style={{
                      width: isMainThumb ? 72 : 56,
                      height: isMainThumb ? 96 : 74,
                    }}
                    aria-label={thumb?.title || `Slide ${thumbIndex + 1}`}
                  >
                    <img
                      src={thumb?.image || ""}
                      alt={thumb?.title || `Slide ${thumbIndex + 1}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                    <div className="absolute inset-0 bg-black/10" />
                  </button>
                );
              })}
            </div>
          </div>

          {style.showArrows ? (
            <>
              <button
                type="button"
                onClick={goPrev}
                className={[
                  "categorias-arrow categorias-arrow-left absolute left-2 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-300 hover:scale-105 md:left-4",
                  getArrowClasses(style.arrowStyle),
                ].join(" ")}
                style={{
                  width: arrowSizePx,
                  height: arrowSizePx,
                  background: style.arrowBg,
                  color: style.arrowColor,
                  borderColor: style.arrowBorderColor,
                }}
                aria-label="Anterior"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={goNext}
                className={[
                  "categorias-arrow categorias-arrow-right absolute right-2 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full border transition-all duration-300 hover:scale-105 md:right-4",
                  getArrowClasses(style.arrowStyle),
                ].join(" ")}
                style={{
                  width: arrowSizePx,
                  height: arrowSizePx,
                  background: style.arrowBg,
                  color: style.arrowColor,
                  borderColor: style.arrowBorderColor,
                }}
                aria-label="Siguiente"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>

        {style.showDots ? (
          <div className="mt-5 flex justify-center gap-2">
            {enabledSlides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className="inline-block rounded-full transition-all duration-300"
                style={{
                  width: idx === activeIndex ? 22 : 8,
                  height: 8,
                  background: idx === activeIndex ? "#111827" : "#d1d5db",
                }}
                aria-label={`Ir al slide ${idx + 1}`}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}