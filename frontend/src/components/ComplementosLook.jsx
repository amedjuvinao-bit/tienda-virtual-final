// src/components/ComplementosLook.jsx
import React, { useMemo, useState } from "react";
import {
  ArrowRight,
  ChevronRight,
  ChevronsRight,
  MoveRight,
  Sparkles,
} from "lucide-react";
import {
  COMPLEMENTOS_SECTION_DEFAULTS,
  normalizeComplementosSection,
} from "../admin/appearance/sections/complementos/complementosSectionHelpers";

function buildButtonAnimationClass(animation) {
  if (animation === "pulse") return "animate-pulse";
  if (animation === "soft-float") return "animate-[floatY_3.2s_ease-in-out_infinite]";
  return "";
}

function renderArrow(styleName) {
  switch (styleName) {
    case "none":
      return null;

    case "chevron-right":
      return <ChevronRight className="w-4 h-4 shrink-0" />;

    case "double-chevron":
      return <ChevronsRight className="w-4 h-4 shrink-0" />;

    case "long-arrow":
      return <MoveRight className="w-4 h-4 shrink-0" />;

    case "spark-arrow":
      return (
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <ArrowRight className="w-4 h-4 shrink-0" />
        </span>
      );

    case "minimal-line":
      return <span className="text-[1em] leading-none">⟶</span>;

    case "arrow-right":
    default:
      return <ArrowRight className="w-4 h-4 shrink-0" />;
  }
}

export default function ComplementosLook({ theme, imageSrc }) {
  const [isHoveringButton, setIsHoveringButton] = useState(false);

  const complementosSection = useMemo(() => {
    const list = Array.isArray(theme?.sections) ? theme.sections : [];

    const found = list.find((s) => {
      const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
      const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
      return id === "complementos" || type === "complementos";
    });

    if (found) return normalizeComplementosSection(found);

    return normalizeComplementosSection({
      ...COMPLEMENTOS_SECTION_DEFAULTS,
      config: {
        ...COMPLEMENTOS_SECTION_DEFAULTS.config,
        imageSrc:
          typeof imageSrc === "string" && imageSrc.trim()
            ? imageSrc.trim()
            : COMPLEMENTOS_SECTION_DEFAULTS.config.imageSrc,
      },
    });
  }, [theme, imageSrc]);

  const config = complementosSection.config;
  const style = complementosSection.style;

  if (complementosSection.enabled === false) return null;

  const buttonAnimationClass = buildButtonAnimationClass(style.buttonAnimation);

  const sectionVars = {
    "--comp-section-margin-top": `${style.sectionMarginTopPx}px`,
    "--comp-section-padding-x": `${style.sectionPaddingXPx}px`,
    "--comp-content-max-width": `${style.contentMaxWidthPx}px`,
    "--comp-image-width": `${style.imageWidthPercent}%`,
    "--comp-image-height": `${style.imageHeightPx}px`,
    "--comp-image-radius": `${style.imageRadiusPx}px`,
    "--comp-image-border-width": `${style.imageBorderPx}px`,
    "--comp-image-border-color": style.imageBorderColor,
    "--comp-ring-width": `${style.ringWidthPx}px`,
    "--comp-ring-color": style.ringColor,
    "--comp-btn-left": `${style.buttonPosXPercent}%`,
    "--comp-btn-top": `${style.buttonPosYPercent}%`,
    "--comp-btn-bg": isHoveringButton ? style.buttonHoverBg : style.buttonBg,
    "--comp-btn-color": isHoveringButton
      ? style.buttonHoverTextColor
      : style.buttonTextColor,
    "--comp-btn-radius": `${style.buttonRadiusPx}px`,
    "--comp-btn-font-size": `${style.buttonFontSizePx}px`,
    "--comp-btn-font-weight": style.buttonFontWeight,
    "--comp-btn-px": `${style.buttonPx}px`,
    "--comp-btn-py": `${style.buttonPy}px`,
    "--comp-btn-gap": `${style.buttonGapPx}px`,
    "--comp-btn-shadow":
      isHoveringButton && style.buttonHoverShadow
        ? "0 14px 30px rgba(0,0,0,0.20)"
        : style.buttonShadow
        ? "0 10px 24px rgba(0,0,0,0.16)"
        : "none",
    "--comp-btn-transform": isHoveringButton
      ? `translate(-50%, -50%) scale(${style.buttonHoverScale})`
      : "translate(-50%, -50%) scale(1)",
  };

  const imageStyle = {
    width: "var(--comp-image-width)",
    maxWidth: "100%",
    height: "var(--comp-image-height)",
    objectFit: style.imageObjectFit,
    borderRadius: "var(--comp-image-radius)",
    borderWidth: "var(--comp-image-border-width)",
    borderStyle: "solid",
    borderColor: "var(--comp-image-border-color)",
    boxShadow: style.imageShadow ? "0 25px 50px rgba(0,0,0,0.18)" : "none",
    outline: `var(--comp-ring-width) solid var(--comp-ring-color)`,
    outlineOffset: "0px",
  };

  const buttonStyle = {
    left: "var(--comp-btn-left)",
    top: "var(--comp-btn-top)",
    background: "var(--comp-btn-bg)",
    color: "var(--comp-btn-color)",
    borderRadius: "var(--comp-btn-radius)",
    boxShadow: "var(--comp-btn-shadow)",
    fontSize: "var(--comp-btn-font-size)",
    fontWeight: "var(--comp-btn-font-weight)",
    paddingLeft: "var(--comp-btn-px)",
    paddingRight: "var(--comp-btn-px)",
    paddingTop: "var(--comp-btn-py)",
    paddingBottom: "var(--comp-btn-py)",
    gap: "var(--comp-btn-gap)",
    backdropFilter: "blur(4px)",
    transform: "var(--comp-btn-transform)",
    transition:
      "transform 220ms ease, background 220ms ease, color 220ms ease, box-shadow 220ms ease",
  };

  return (
    <section
      className="complementos-look-section relative w-full"
      style={sectionVars}
    >
      <style>{`
        @keyframes floatY {
          0% { transform: translate(-50%, -50%) translateY(0px); }
          50% { transform: translate(-50%, -50%) translateY(-6px); }
          100% { transform: translate(-50%, -50%) translateY(0px); }
        }

        .complementos-look-section {
          margin-top: var(--comp-section-margin-top);
          padding-left: var(--comp-section-padding-x);
          padding-right: var(--comp-section-padding-x);
        }

        .complementos-look-container {
          width: 100%;
          max-width: var(--comp-content-max-width);
        }

        .complementos-look-image {
          display: block;
        }

        .complementos-look-button {
          white-space: nowrap;
        }

        @media (max-width: 1024px) {
          .complementos-look-section {
            padding-left: 18px !important;
            padding-right: 18px !important;
          }

          .complementos-look-image {
            width: 100% !important;
            height: auto !important;
            max-height: 520px;
          }

          .complementos-look-button {
            font-size: clamp(12px, 1.65vw, 16px) !important;
            padding: clamp(8px, 1.1vw, 11px) clamp(14px, 2vw, 20px) !important;
            gap: clamp(6px, 0.8vw, 10px) !important;
          }

          .complementos-look-button svg {
            width: clamp(14px, 1.35vw, 17px) !important;
            height: clamp(14px, 1.35vw, 17px) !important;
          }
        }

        @media (max-width: 767px) {
          .complementos-look-section {
            padding-left: 12px !important;
            padding-right: 12px !important;
          }

          .complementos-look-container {
            max-width: 100% !important;
          }

          .complementos-look-image {
            width: 100% !important;
            height: auto !important;
            max-height: none !important;
            object-fit: contain !important;
          }

          .complementos-look-button {
            left: 50% !important;
            top: auto !important;
            bottom: clamp(8px, 2.5vw, 14px) !important;
            transform: translateX(-50%) !important;
            font-size: clamp(10px, 2.7vw, 14px) !important;
            padding: clamp(6px, 1.8vw, 10px) clamp(10px, 3.4vw, 16px) !important;
            gap: clamp(4px, 1.4vw, 8px) !important;
            max-width: calc(100% - 20px);
            line-height: 1;
            border-radius: clamp(12px, 4vw, 22px) !important;
          }

          .complementos-look-button svg {
            width: clamp(11px, 2.3vw, 15px) !important;
            height: clamp(11px, 2.3vw, 15px) !important;
          }
        }

        @media (max-width: 480px) {
          .complementos-look-button {
            bottom: clamp(6px, 2.2vw, 12px) !important;
            font-size: clamp(9px, 2.5vw, 12px) !important;
            padding: clamp(5px, 1.6vw, 8px) clamp(9px, 3vw, 14px) !important;
            gap: clamp(4px, 1vw, 6px) !important;
            max-width: calc(100% - 16px);
          }

          .complementos-look-button svg {
            width: clamp(10px, 2vw, 13px) !important;
            height: clamp(10px, 2vw, 13px) !important;
          }
        }

        @media (max-width: 360px) {
          .complementos-look-button {
            font-size: 9px !important;
            padding: 5px 10px !important;
            gap: 4px !important;
          }

          .complementos-look-button svg {
            width: 10px !important;
            height: 10px !important;
          }
        }
      `}</style>

      <div className="complementos-look-container mx-auto w-full">
        <div className="relative w-full">
          <img
            src={config.imageSrc}
            alt={config.imageAlt}
            className="complementos-look-image"
            style={imageStyle}
          />

          {config.buttonEnabled ? (
            <a
              href={config.linkHref}
              className={[
                "complementos-look-button absolute -translate-x-1/2 -translate-y-1/2",
                "inline-flex items-center uppercase",
                "duration-300 ease-in-out",
                buttonAnimationClass,
              ].join(" ")}
              style={buttonStyle}
              onMouseEnter={() => setIsHoveringButton(true)}
              onMouseLeave={() => setIsHoveringButton(false)}
            >
              <span>{config.buttonText}</span>
              {renderArrow(style.buttonArrowStyle)}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}