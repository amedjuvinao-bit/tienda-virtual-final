// src/components/TiktokSection.jsx
import React, { useMemo, useState } from "react";
import { Music2 } from "lucide-react";
import { normalizeTiktokSection } from "../admin/appearance/sections/tiktok/tiktokSectionHelpers";

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function getTiktokSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "tiktok" || type === "tiktok";
  });

  return normalizeTiktokSection(found);
}

function mapFallbackPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.map((post, index) => ({
    id: `post_${index + 1}`,
    image: post?.image || post?.thumb || "",
    thumb: post?.thumb || post?.image || "",
    link: post?.link || "#",
    videoUrl: post?.videoUrl || "",
    enabled: post?.enabled !== false,
  }));
}

function getAnimationStyle(config) {
  const animation = config?.animation || "fade";
  const duration = clampNumber(config?.animationDuration ?? 0.6, 0.1, 3);

  if (animation === "none") return {};
  if (animation === "slide") {
    return { animation: `tiktokSectionSlideIn ${duration}s ease both` };
  }
  if (animation === "zoom") {
    return { animation: `tiktokSectionZoomIn ${duration}s ease both` };
  }

  return { animation: `tiktokSectionFadeIn ${duration}s ease both` };
}

function getBigLogoAnimationStyle(config, hasHover) {
  const animationName = (config.logoAnimation || "none").toLowerCase();
  const duration = clampNumber(config.logoAnimationDuration ?? 2.4, 0.6, 8);
  const shrinkOnHover =
    typeof config.logoShrinkOnHover === "boolean" ? config.logoShrinkOnHover : true;
  const shrinkScale = clampNumber(config.logoShrinkScale ?? 0.88, 0.35, 1);

  let animation = "none";

  if (animationName === "pulse") {
    animation = `tiktokLogoPulse ${duration}s ease-in-out infinite`;
  } else if (animationName === "float") {
    animation = `tiktokLogoFloat ${duration}s ease-in-out infinite`;
  } else if (animationName === "bounce") {
    animation = `tiktokLogoBounce ${duration}s ease-in-out infinite`;
  } else if (animationName === "spin-slow") {
    animation = `tiktokLogoSpin ${duration}s linear infinite`;
  } else if (animationName === "breathing") {
    animation = `tiktokLogoBreathing ${duration}s ease-in-out infinite`;
  }

  return {
    animation,
    transform: hasHover && shrinkOnHover ? `scale(${shrinkScale})` : "scale(1)",
    transformOrigin: "center center",
    transition: "transform 320ms ease",
  };
}

function renderHoverLogo(config) {
  const logoStyle = (config.hoverLogoStyle || "glyph").toLowerCase();
  const logoSizePx = clampNumber(config.hoverLogoSizePx ?? 64, 20, 220);
  const logoOpacity = clampNumber(config.hoverLogoOpacity ?? 0.8, 0.05, 1);
  const logoColor = config.hoverLogoColor || "#ffffff";
  const customHoverLogo = config.hoverLogoImage || config.tiktokLogo || "";

  const sharedStyle = {
    width: `${logoSizePx}px`,
    height: `${logoSizePx}px`,
    opacity: logoOpacity,
    objectFit: "contain",
    filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.18))",
  };

  if ((logoStyle === "custom-image" || logoStyle === "square") && customHoverLogo) {
    return (
      <img
        src={customHoverLogo}
        alt="TikTok"
        draggable={false}
        style={sharedStyle}
      />
    );
  }

  if (logoStyle === "outline") {
    return (
      <Music2
        strokeWidth={1.8}
        style={{
          ...sharedStyle,
          color: logoColor,
        }}
      />
    );
  }

  return (
    <Music2
      strokeWidth={2}
      style={{
        ...sharedStyle,
        color: logoColor,
      }}
    />
  );
}

function getWatermarkAnchor(position) {
  switch ((position || "custom").toLowerCase()) {
    case "center":
      return { x: 50, y: 50 };
    case "top-left":
      return { x: 12, y: 12 };
    case "top-center":
      return { x: 50, y: 12 };
    case "top-right":
      return { x: 88, y: 12 };
    case "middle-left":
      return { x: 12, y: 50 };
    case "middle-right":
      return { x: 88, y: 50 };
    case "bottom-left":
      return { x: 12, y: 88 };
    case "bottom-center":
      return { x: 50, y: 88 };
    case "bottom-right":
      return { x: 88, y: 88 };
    default:
      return null;
  }
}

function getHoverLogoAnchor(position) {
  switch ((position || "center").toLowerCase()) {
    case "top-left":
      return { x: 14, y: 14 };
    case "top-center":
      return { x: 50, y: 14 };
    case "top-right":
      return { x: 86, y: 14 };
    case "middle-left":
      return { x: 14, y: 50 };
    case "middle-right":
      return { x: 86, y: 50 };
    case "bottom-left":
      return { x: 14, y: 86 };
    case "bottom-center":
      return { x: 50, y: 86 };
    case "bottom-right":
      return { x: 86, y: 86 };
    case "custom":
      return null;
    case "center":
    default:
      return { x: 50, y: 50 };
  }
}

function getBigLogoPositionStyle(config) {
  const position = (config.bigLogoPosition || "center").toLowerCase();
  const offsetX = clampNumber(config.bigLogoOffsetXPx ?? 0, -500, 500);
  const offsetY = clampNumber(config.bigLogoOffsetYPx ?? 0, -500, 500);

  if (position === "custom") {
    const x = clampNumber(config.bigLogoXPercent ?? 50, 0, 100);
    const y = clampNumber(config.bigLogoYPercent ?? 50, 0, 100);

    return {
      position: "absolute",
      left: `${x}%`,
      top: `${y}%`,
      transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
    };
  }

  const base = {
    position: "absolute",
  };

  switch (position) {
    case "top":
      return {
        ...base,
        left: "50%",
        top: "0%",
        transform: `translate(-50%, 0%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "bottom":
      return {
        ...base,
        left: "50%",
        top: "100%",
        transform: `translate(-50%, -100%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "left":
      return {
        ...base,
        left: "0%",
        top: "50%",
        transform: `translate(0%, -50%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "right":
      return {
        ...base,
        left: "100%",
        top: "50%",
        transform: `translate(-100%, -50%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "top-left":
      return {
        ...base,
        left: "0%",
        top: "0%",
        transform: `translate(0%, 0%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "top-right":
      return {
        ...base,
        left: "100%",
        top: "0%",
        transform: `translate(-100%, 0%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "bottom-left":
      return {
        ...base,
        left: "0%",
        top: "100%",
        transform: `translate(0%, -100%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "bottom-right":
      return {
        ...base,
        left: "100%",
        top: "100%",
        transform: `translate(-100%, -100%) translate(${offsetX}px, ${offsetY}px)`,
      };
    case "center":
    default:
      return {
        ...base,
        left: "50%",
        top: "50%",
        transform: `translate(-50%, -50%) translate(${offsetX}px, ${offsetY}px)`,
      };
  }
}

function extractTikTokVideoId(link) {
  try {
    const url = new URL(link);
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    return last.split("?")[0] || "";
  } catch {
    return "";
  }
}

function TikTokThumbnail({
  post,
  config,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  hoverTransitionMs,
  overlayOpacity,
  hoverScale,
  cardStyle,
}) {
  const [playing, setPlaying] = useState(false);

  const link = post?.link || "#";
  const thumb = post?.thumb || post?.image || "";
  const image = post?.image || post?.thumb || "";
  const videoUrl = post?.videoUrl || "";
  const hasDirectVideo = typeof videoUrl === "string" && videoUrl.trim() !== "";
  const videoId = extractTikTokVideoId(link);
  const embedUrl = videoId
    ? `https://www.tiktok.com/embed/v2/${videoId}?autoplay=1&muted=1&controls=0&loop=1`
    : "";

  const hoverLogoAnchor = getHoverLogoAnchor(config.hoverLogoPosition);
  const hoverLogoXPercent = clampNumber(
    hoverLogoAnchor?.x ?? config.hoverLogoXPercent ?? 50,
    0,
    100
  );
  const hoverLogoYPercent = clampNumber(
    hoverLogoAnchor?.y ?? config.hoverLogoYPercent ?? 50,
    0,
    100
  );

  let imageTransform = "scale(1)";
  let imageOpacity = 1;
  let cardTranslate = "translateY(0px)";

  if (isHovered && config.hoverEffect === "zoom") {
    imageTransform = `scale(${hoverScale})`;
  }

  if (isHovered && config.hoverEffect === "fade") {
    imageOpacity = 0.78;
  }

  if (isHovered && config.hoverEffect === "lift") {
    cardTranslate = "translateY(-6px)";
  }

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative overflow-hidden block bg-black"
      style={{
        ...cardStyle,
        transform: cardTranslate,
        transition: `transform ${hoverTransitionMs}ms ease, box-shadow ${hoverTransitionMs}ms ease, width ${hoverTransitionMs}ms ease, flex-basis ${hoverTransitionMs}ms ease, filter ${hoverTransitionMs}ms ease`,
        boxShadow: isHovered ? "0 14px 34px rgba(0,0,0,0.14)" : "0 4px 14px rgba(0,0,0,0.05)",
      }}
      onMouseEnter={(e) => {
        onMouseEnter?.(e);
        setPlaying(true);
      }}
      onMouseLeave={(e) => {
        onMouseLeave?.(e);
        setPlaying(false);
      }}
    >
      {playing && hasDirectVideo ? (
        <video
          src={videoUrl}
          className="absolute inset-0 w-full h-full"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            display: "block",
          }}
        />
      ) : playing && embedUrl ? (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            width: "100%",
            height: "100%",
          }}
        >
          <iframe
            src={embedUrl}
            className="absolute inset-0 w-full h-full border-0"
            frameBorder="0"
            scrolling="no"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            title={`TikTok ${post?.id || ""}`}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              overflow: "hidden",
              display: "block",
            }}
          />
        </div>
      ) : thumb || image ? (
        <img
          src={thumb || image}
          alt="TikTok thumbnail"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            transform: imageTransform,
            opacity: imageOpacity,
            transition: `transform ${hoverTransitionMs}ms ease, opacity ${hoverTransitionMs}ms ease`,
          }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400 bg-black">
          Sin imagen
        </div>
      )}

      {config.overlayEnabled && !playing ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: config.overlayColor || "#000000",
            opacity: isHovered ? overlayOpacity : 0,
            transition: `opacity ${hoverTransitionMs}ms ease`,
          }}
        />
      ) : null}

      {config.hoverLogoEnabled ? (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: isHovered ? 1 : 0,
            transition: `opacity ${hoverTransitionMs}ms ease`,
            zIndex: 5,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: `${hoverLogoXPercent}%`,
              top: `${hoverLogoYPercent}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            {renderHoverLogo(config)}
          </div>
        </div>
      ) : null}
    </a>
  );
}

export default function TiktokSection({ theme, posts = [] }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [mobileActiveId, setMobileActiveId] = useState(null);

  const section = useMemo(() => getTiktokSectionFromTheme(theme), [theme]);
  const config = section?.config || {};

  const finalPosts = useMemo(() => {
    const configPosts = Array.isArray(config?.posts) ? config.posts : [];
    const activeConfigPosts = configPosts.filter(
      (post) => post?.enabled !== false && (post?.image || post?.thumb)
    );

    if (activeConfigPosts.length > 0) {
      return activeConfigPosts;
    }

    return mapFallbackPosts(posts).filter(
      (post) => post?.enabled !== false && (post?.image || post?.thumb)
    );
  }, [config?.posts, posts]);

  if (!section?.enabled) return null;
  if (!finalPosts.length) return null;

  const columns = clampNumber(config.columns ?? 3, 1, 6);
  const gapPx = clampNumber(config.gapPx ?? 24, 0, 80);
  const imageHeightPx = clampNumber(config.imageHeightPx ?? 512, 120, 2000);
  const borderRadiusPx = clampNumber(config.borderRadiusPx ?? 24, 0, 80);
  const overlayOpacity = clampNumber(config.overlayOpacity ?? 0.3, 0, 1);
  const hoverScale = clampNumber(config.hoverScale ?? 1.05, 1, 1.3);

  const baseCardWidthPx = clampNumber(
    config.imageWidthPx ?? config.baseCardWidthPx ?? 288,
    40,
    1200
  );
  const hoveredCardWidthPx = clampNumber(config.hoveredCardWidthPx ?? 340, 80, 1400);
  const cardBorderColor = config.cardBorderColor || "#D4AF37";
  const cardBorderWidthPx = clampNumber(config.cardBorderWidthPx ?? 2, 0, 20);

  const titleStyle = {
    color: config.titleTextColor || "#111111",
    fontFamily: config.titleFontFamily || undefined,
    fontSize: `${clampNumber(config.titleFontSizePx ?? 28, 12, 80)}px`,
    fontWeight: clampNumber(config.titleFontWeight ?? 700, 200, 900),
    lineHeight: 1.1,
  };

  const sectionAnimationStyle = getAnimationStyle(config);

  const galleryMode =
    typeof config.galleryMode === "string" && config.galleryMode.trim()
      ? config.galleryMode.trim().toLowerCase()
      : "grid";

  const hoverTransitionMs = clampNumber(config.hoverTransitionMs ?? 380, 120, 1200);

  const hasDesktopHover = hoveredId !== null;
  const bigLogoAnimationStyle = getBigLogoAnimationStyle(config, hasDesktopHover);

  const watermarkEnabled =
    typeof config.watermarkEnabled === "boolean" ? config.watermarkEnabled : false;
  const watermarkImage = config.watermarkImage || "";
  const watermarkRepeat =
    typeof config.watermarkRepeat === "boolean" ? config.watermarkRepeat : false;
  const watermarkOpacity = clampNumber(config.watermarkOpacity ?? 0.12, 0, 1);
  const watermarkWidthPx = clampNumber(config.watermarkWidthPx ?? 320, 40, 2400);
  const watermarkHeightPx = clampNumber(config.watermarkHeightPx ?? 320, 40, 2400);
  const watermarkRotateDeg = clampNumber(config.watermarkRotateDeg ?? 0, -360, 360);
  const watermarkSizeMode =
    (config.watermarkSizeMode || "contain").toLowerCase() === "cover" ? "cover" : "contain";

  const watermarkAnchor = getWatermarkAnchor(config.watermarkPosition);
  const watermarkXPercent = clampNumber(
    watermarkAnchor?.x ?? config.watermarkXPercent ?? 50,
    0,
    100
  );
  const watermarkYPercent = clampNumber(
    watermarkAnchor?.y ?? config.watermarkYPercent ?? 50,
    0,
    100
  );

  const profileUser = config.profileUser || "@rosaboutique35";

  const mobileAccordionPosts = finalPosts.slice(0, 5);
  const effectiveMobileActiveId =
    mobileAccordionPosts.find((post) => post.id === mobileActiveId)?.id || null;

  const desktopGridStyle = {
    gridTemplateColumns: `repeat(${columns}, ${baseCardWidthPx}px)`,
    gap: `${gapPx}px`,
    justifyContent: "start",
    width: "fit-content",
    maxWidth: "100%",
  };

  const desktopFlexHoverStyle = {
    justifyContent: "flex-start",
    alignItems: "stretch",
    gap: `${gapPx}px`,
    width: "fit-content",
    maxWidth: "100%",
    height: `${imageHeightPx}px`,
    overflow: "visible",
  };

  const cardBaseStyle = {
    borderRadius: `${borderRadiusPx}px`,
    height: `${imageHeightPx}px`,
    border: `${cardBorderWidthPx}px solid ${cardBorderColor}`,
  };

  const sectionWatermarkStyle = {
    position: "absolute",
    left: `${watermarkXPercent}%`,
    top: `${watermarkYPercent}%`,
    width: `${watermarkWidthPx}px`,
    height: `${watermarkHeightPx}px`,
    transform: `translate(-50%, -50%) rotate(${watermarkRotateDeg}deg)`,
    opacity: watermarkOpacity,
    objectFit: watermarkSizeMode,
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 0,
  };

  const bigLogoPositionStyle = getBigLogoPositionStyle(config);

  return (
    <section
      className="relative mt-16 max-w-6xl mx-auto px-6 overflow-visible"
      style={{
        ...sectionAnimationStyle,
        isolation: "isolate",
      }}
    >
      <style>
        {`
          @keyframes tiktokSectionFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes tiktokSectionSlideIn {
            from { opacity: 0; transform: translateY(28px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes tiktokSectionZoomIn {
            from { opacity: 0; transform: scale(0.94); }
            to { opacity: 1; transform: scale(1); }
          }

          @keyframes tiktokLogoPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }

          @keyframes tiktokLogoFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }

          @keyframes tiktokLogoBounce {
            0%, 100% { transform: translateY(0px); }
            30% { transform: translateY(-10px); }
            55% { transform: translateY(0px); }
            70% { transform: translateY(-4px); }
          }

          @keyframes tiktokLogoSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes tiktokLogoBreathing {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.06); opacity: 0.9; }
          }

          @media (max-width: 767px) {
            .tiktok-mobile-head {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              margin-bottom: 0.75rem;
              position: relative;
              z-index: 2;
            }

            .tiktok-mobile-profile {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 0.3rem;
              margin: 0.28rem auto 0.55rem;
              text-decoration: none;
              max-width: 100%;
              width: fit-content;
              align-self: center;
            }

            .tiktok-mobile-profile-logo {
              width: 20px;
              height: 20px;
              object-fit: contain;
              display: block;
              flex-shrink: 0;
            }

            .tiktok-mobile-profile-user {
              font-size: 0.84rem;
              line-height: 1;
              font-weight: 700;
              color: ${config.userTextColor || config.titleTextColor || "#111111"};
              letter-spacing: 0;
              white-space: nowrap;
            }

            .tiktok-mobile-watermark-single {
              transform: translate(-50%, -50%) rotate(${watermarkRotateDeg}deg) scale(0.42) !important;
              transform-origin: center center !important;
              opacity: ${Math.min(watermarkOpacity + 0.04, 0.18)} !important;
            }

            .tiktok-mobile-watermark-repeat {
              opacity: ${Math.min(watermarkOpacity + 0.03, 0.16)} !important;
              background-size: 180px 180px !important;
            }

            .tiktok-mobile-accordion-wrap {
              display: flex;
              align-items: stretch;
              gap: 2px;
              width: 100%;
              overflow: hidden;
              min-height: 360px;
            }

            .tiktok-mobile-accordion-card {
              position: relative;
              min-width: 0;
              overflow: hidden;
              transition:
                flex-basis ${hoverTransitionMs}ms ease,
                width ${hoverTransitionMs}ms ease,
                transform ${hoverTransitionMs}ms ease,
                box-shadow ${hoverTransitionMs}ms ease,
                filter ${hoverTransitionMs}ms ease;
            }

            .tiktok-mobile-accordion-card.is-active {
              box-shadow: 0 14px 34px rgba(0,0,0,0.14);
              filter: brightness(1);
            }

            .tiktok-mobile-accordion-card.is-idle {
              box-shadow: 0 4px 14px rgba(0,0,0,0.05);
              filter: brightness(0.97);
            }
          }
        `}
      </style>

      {watermarkEnabled && watermarkImage ? (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-visible">
          {watermarkRepeat ? (
            <div
              className="absolute inset-0 tiktok-mobile-watermark-repeat"
              style={{
                backgroundImage: `url(${watermarkImage})`,
                backgroundRepeat: "repeat",
                backgroundSize: `${watermarkWidthPx}px ${watermarkHeightPx}px`,
                opacity: watermarkOpacity,
                transform: `rotate(${watermarkRotateDeg}deg)`,
                transformOrigin: "center center",
              }}
            />
          ) : (
            <img
              src={watermarkImage}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="tiktok-mobile-watermark-single"
              style={sectionWatermarkStyle}
            />
          )}
        </div>
      ) : null}

      <div className="relative z-10">
        <div className="mb-4 text-center tiktok-mobile-head">
          {config.titleImage ? (
            <img
              src={config.titleImage}
              alt={config.titleAlt || "Síguenos en TikTok"}
              className="mx-auto w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg h-auto object-contain"
              draggable={false}
            />
          ) : (
            <div className="text-center" style={titleStyle}>
              {config.titleText || "Síguenos en TikTok"}
            </div>
          )}

          <a
            href={config.profileLink || "https://www.tiktok.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="tiktok-mobile-profile md:hidden"
            style={bigLogoAnimationStyle}
          >
            {config.tiktokLogo ? (
              <img
                src={config.tiktokLogo}
                alt="TikTok Logo"
                draggable={false}
                className="tiktok-mobile-profile-logo"
              />
            ) : (
              <Music2
                className="tiktok-mobile-profile-logo"
                style={{
                  color: config.userTextColor || config.titleTextColor || "#111111",
                }}
              />
            )}
            <span className="tiktok-mobile-profile-user">{profileUser}</span>
          </a>
        </div>

        <div className="flex flex-col md:flex-row w-full items-start md:justify-between md:gap-8 gap-6">
          <div className="w-full md:w-auto md:flex-[0_0_auto]">
            <div className="md:hidden">
              <div className="tiktok-mobile-accordion-wrap">
                {mobileAccordionPosts.map((post, idx) => {
                  const isActive = post.id === effectiveMobileActiveId;
                  const noActiveSelected = effectiveMobileActiveId === null;
                  const collapsedBasis = mobileAccordionPosts.length > 1 ? "18%" : "100%";
                  const expandedBasis = mobileAccordionPosts.length > 1 ? "44%" : "100%";

                  return (
                    <div
                      key={post.id || idx}
                      className={`tiktok-mobile-accordion-card ${
                        isActive ? "is-active" : "is-idle"
                      }`}
                      style={{
                        flex: noActiveSelected
                          ? `0 0 ${collapsedBasis}`
                          : isActive
                          ? `0 0 ${expandedBasis}`
                          : `0 0 ${collapsedBasis}`,
                      }}
                      onClick={() =>
                        setMobileActiveId((current) =>
                          current === post.id ? null : post.id
                        )
                      }
                      onTouchStart={() =>
                        setMobileActiveId((current) =>
                          current === post.id ? null : post.id
                        )
                      }
                    >
                      <TikTokThumbnail
                        post={post}
                        config={config}
                        isHovered={false}
                        onMouseEnter={() => {}}
                        onMouseLeave={() => {}}
                        hoverTransitionMs={hoverTransitionMs}
                        overlayOpacity={overlayOpacity}
                        hoverScale={hoverScale}
                        cardStyle={{
                          ...cardBaseStyle,
                          width: "100%",
                          height: `${clampNumber(imageHeightPx, 260, 420)}px`,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className={galleryMode === "grid" ? "hidden md:grid" : "hidden md:flex"}
              style={galleryMode === "grid" ? desktopGridStyle : desktopFlexHoverStyle}
            >
              {finalPosts.map((post, idx) => {
                const isHovered = hoveredId === post.id;

                const cardWidthPx =
                  galleryMode === "flex-hover"
                    ? hasDesktopHover
                      ? isHovered
                        ? hoveredCardWidthPx
                        : baseCardWidthPx
                      : baseCardWidthPx
                    : baseCardWidthPx;

                const desktopCardStyle =
                  galleryMode === "grid"
                    ? {
                        ...cardBaseStyle,
                        width: `${baseCardWidthPx}px`,
                        minWidth: `${baseCardWidthPx}px`,
                        justifySelf: "start",
                      }
                    : {
                        ...cardBaseStyle,
                        minWidth: `${baseCardWidthPx}px`,
                        width: `${cardWidthPx}px`,
                        flex: `0 0 ${cardWidthPx}px`,
                        filter:
                          hasDesktopHover && !isHovered
                            ? "brightness(0.96)"
                            : "brightness(1)",
                      };

                return (
                  <TikTokThumbnail
                    key={post.id || idx}
                    post={post}
                    config={config}
                    isHovered={isHovered}
                    onMouseEnter={() => setHoveredId(post.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    hoverTransitionMs={hoverTransitionMs}
                    overlayOpacity={overlayOpacity}
                    hoverScale={hoverScale}
                    cardStyle={desktopCardStyle}
                  />
                );
              })}
            </div>
          </div>

          <div className="hidden md:block w-full md:flex-1 relative min-h-[260px] overflow-visible">
            <div style={bigLogoPositionStyle}>
              <div
                style={bigLogoAnimationStyle}
                className="group flex flex-col justify-center items-center"
              >
                <a
                  href={config.profileLink || "https://www.tiktok.com"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center"
                  style={{
                    background: "transparent",
                    border: "none",
                    boxShadow: "none",
                    padding: 0,
                  }}
                >
                  {config.tiktokLogo ? (
                    <img
                      src={config.tiktokLogo}
                      alt="TikTok Logo"
                      draggable={false}
                      style={{
                        width: `${clampNumber(config.logoSizePx ?? 180, 24, 420)}px`,
                        height: `${clampNumber(config.logoSizePx ?? 180, 24, 420)}px`,
                        objectFit: "contain",
                        maxWidth: "none",
                        display: "block",
                      }}
                    />
                  ) : (
                    <Music2
                      style={{
                        width: `${clampNumber(config.logoSizePx ?? 180, 24, 420)}px`,
                        height: `${clampNumber(config.logoSizePx ?? 180, 24, 420)}px`,
                        color: "#111111",
                        maxWidth: "none",
                        display: "block",
                      }}
                    />
                  )}
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}