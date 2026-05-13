// src/components/InstagramSection.jsx
import React, { useMemo, useState } from "react";
import { Instagram } from "lucide-react";
import { normalizeInstagramSection } from "../admin/appearance/sections/instagram/instagramSectionHelpers";

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function getInstagramSectionFromTheme(theme) {
  const sections = Array.isArray(theme?.sections) ? theme.sections : [];
  const found = sections.find((s) => {
    const id = typeof s?.id === "string" ? s.id.trim().toLowerCase() : "";
    const type = typeof s?.type === "string" ? s.type.trim().toLowerCase() : "";
    return id === "instagram" || type === "instagram";
  });

  return normalizeInstagramSection(found);
}

function buildBadgeBackground(config) {
  const gradient = config?.profileBadgeGradient || "none";

  if (gradient === "instagram") {
    return "linear-gradient(135deg, #feda75 0%, #fa7e1e 25%, #d62976 50%, #962fbf 75%, #4f5bd5 100%)";
  }
  if (gradient === "pink-orange") {
    return "linear-gradient(135deg, #ff4d6d 0%, #ff758f 40%, #ffb703 100%)";
  }
  if (gradient === "purple-pink") {
    return "linear-gradient(135deg, #7209b7 0%, #b5179e 50%, #f72585 100%)";
  }
  if (gradient === "golden") {
    return "linear-gradient(135deg, #f4d35e 0%, #e9c46a 50%, #d4a373 100%)";
  }
  if (gradient === "ocean") {
    return "linear-gradient(135deg, #4361ee 0%, #4895ef 50%, #4cc9f0 100%)";
  }
  if (gradient === "mint") {
    return "linear-gradient(135deg, #95d5b2 0%, #74c69d 50%, #52b788 100%)";
  }

  return config?.profileBadgeBgColor || "#ffffff";
}

function mapFallbackPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.map((post, index) => ({
    id: `post_${index + 1}`,
    image: post?.image || post?.thumb || "",
    link: post?.link || "#",
    enabled: post?.enabled !== false,
  }));
}

function getAnimationStyle(config) {
  const animation = config?.animation || "fade";
  const duration = clampNumber(config?.animationDuration ?? 0.6, 0.1, 3);

  if (animation === "none") return {};
  if (animation === "slide") {
    return { animation: `instagramSectionSlideIn ${duration}s ease both` };
  }
  if (animation === "zoom") {
    return { animation: `instagramSectionZoomIn ${duration}s ease both` };
  }

  return { animation: `instagramSectionFadeIn ${duration}s ease both` };
}

function getBigLogoAnimationStyle(config, hasHover) {
  const animationName = (config.logoAnimation || "none").toLowerCase();
  const duration = clampNumber(config.logoAnimationDuration ?? 2.4, 0.6, 8);
  const shrinkOnHover =
    typeof config.logoShrinkOnHover === "boolean" ? config.logoShrinkOnHover : true;
  const shrinkScale = clampNumber(config.logoShrinkScale ?? 0.76, 0.35, 1);

  let animation = "none";

  if (animationName === "pulse") {
    animation = `instagramLogoPulse ${duration}s ease-in-out infinite`;
  } else if (animationName === "float") {
    animation = `instagramLogoFloat ${duration}s ease-in-out infinite`;
  } else if (animationName === "bounce") {
    animation = `instagramLogoBounce ${duration}s ease-in-out infinite`;
  } else if (animationName === "spin-slow") {
    animation = `instagramLogoSpin ${duration}s linear infinite`;
  } else if (animationName === "breathing") {
    animation = `instagramLogoBreathing ${duration}s ease-in-out infinite`;
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
  const logoSizePx = clampNumber(config.hoverLogoSizePx ?? 74, 20, 220);
  const logoOpacity = clampNumber(config.hoverLogoOpacity ?? 0.32, 0.05, 1);
  const logoColor = config.hoverLogoColor || "#ffffff";
  const customHoverLogo = config.hoverLogoImage || config.instagramLogo || "";

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
        alt="Instagram"
        draggable={false}
        style={sharedStyle}
      />
    );
  }

  if (logoStyle === "outline") {
    return (
      <Instagram
        strokeWidth={1.6}
        style={{
          ...sharedStyle,
          color: logoColor,
        }}
      />
    );
  }

  return (
    <Instagram
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

export default function InstagramSection({ theme, posts = [] }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [touchedId, setTouchedId] = useState(null);

  const section = useMemo(() => getInstagramSectionFromTheme(theme), [theme]);
  const config = section?.config || {};

  const finalPosts = useMemo(() => {
    const configPosts = Array.isArray(config?.posts) ? config.posts : [];
    const activeConfigPosts = configPosts.filter(
      (post) => post?.enabled !== false && post?.image
    );

    if (activeConfigPosts.length > 0) {
      return activeConfigPosts;
    }

    return mapFallbackPosts(posts).filter(
      (post) => post?.enabled !== false && post?.image
    );
  }, [config?.posts, posts]);

  if (!section?.enabled) return null;
  if (!finalPosts.length) return null;

  const columns = clampNumber(config.columns ?? 4, 1, 6);
  const gapPx = clampNumber(config.gapPx ?? 16, 0, 60);
  const imageHeightPx = clampNumber(config.imageHeightPx ?? 260, 120, 2000);
  const borderRadiusPx = clampNumber(config.borderRadiusPx ?? 8, 0, 40);
  const overlayOpacity = clampNumber(config.overlayOpacity ?? 0.3, 0, 1);
  const hoverScale = clampNumber(config.hoverScale ?? 1.05, 1, 1.3);

  const baseCardWidthPx = clampNumber(config.baseCardWidthPx ?? 88, 40, 320);
  const hoveredCardWidthPx = clampNumber(config.hoveredCardWidthPx ?? 260, 80, 1400);
  const cardBorderColor = config.cardBorderColor || "#d4af379f";
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
      : "flex-hover";

  const hoverTransitionMs = clampNumber(config.hoverTransitionMs ?? 380, 120, 1200);

  const hoverLogoEnabled =
    typeof config.hoverLogoEnabled === "boolean" ? config.hoverLogoEnabled : true;

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

  const profileUser = config.profileUser || "@rosaboutique33";

  const mobilePosts = finalPosts.slice(0, 5);

  const mobileFeaturedPost = mobilePosts[0] || null;
  const mobileRightTopPost = mobilePosts[1] || null;
  const mobileRightBottomPost = mobilePosts[2] || null;
  const mobileBottomLeftPost = mobilePosts[3] || null;
  const mobileBottomRightPost = mobilePosts[4] || null;

  const containerGridStyle = {
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: `${gapPx}px`,
  };

  const desktopFlexHoverStyle = {
    justifyContent: "flex-end",
    alignItems: "stretch",
    gap: `${gapPx}px`,
    width: "100%",
    height: `${imageHeightPx}px`,
    overflow: "visible",
  };

  const cardBaseStyle = {
    borderRadius: `${borderRadiusPx}px`,
    height: `${imageHeightPx}px`,
    border: `${cardBorderWidthPx}px solid ${cardBorderColor}`,
  };

  const imageShellStyle = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "rgba(255,255,255,0.12)",
  };

  const imageStyle = (imageTransform, imageOpacity) => ({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center center",
    transform: imageTransform,
    opacity: imageOpacity,
    transition: `transform ${hoverTransitionMs}ms ease, opacity ${hoverTransitionMs}ms ease`,
  });

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

  function getMobileCardState(post) {
    const isHovered = hoveredId === post.id;
    const isTouched = touchedId === post.id;
    const isActive = isHovered || isTouched;

    let imageTransform = "scale(1)";
    let imageOpacity = 1;

    if (isTouched) {
      imageTransform = "scale(1.03)";
    }

    if (isHovered && config.hoverEffect === "zoom") {
      imageTransform = `scale(${hoverScale})`;
    }

    if (isActive && config.hoverEffect === "fade") {
      imageOpacity = 0.84;
    }

    return { isActive, imageTransform, imageOpacity, isTouched };
  }

  function renderMobileCard(post, idx, className = "") {
    if (!post) return null;

    const { isActive, imageTransform, imageOpacity, isTouched } = getMobileCardState(post);

    return (
      <a
        key={post.id || idx}
        href={post.link || config.profileLink || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className={`group relative overflow-hidden block bg-white/30 ${className}`}
        style={{
          borderRadius: `${Math.max(borderRadiusPx, 10)}px`,
          border: `${cardBorderWidthPx}px solid ${cardBorderColor}`,
          transform: isTouched ? "translateY(-2px)" : "translateY(0)",
          transition: `transform ${hoverTransitionMs}ms ease, box-shadow ${hoverTransitionMs}ms ease, opacity ${hoverTransitionMs}ms ease`,
          boxShadow: isActive
            ? "0 12px 24px rgba(0,0,0,0.12)"
            : "0 5px 12px rgba(0,0,0,0.05)",
          WebkitTapHighlightColor: "transparent",
          touchAction: "manipulation",
        }}
        onMouseEnter={() => setHoveredId(post.id)}
        onMouseLeave={() => setHoveredId(null)}
        onTouchStart={() => setTouchedId(post.id)}
        onTouchEnd={() => setTouchedId(null)}
        onTouchCancel={() => setTouchedId(null)}
      >
        <div style={imageShellStyle}>
          <img
            src={post.image}
            alt={`Instagram ${idx + 1}`}
            style={imageStyle(imageTransform, imageOpacity)}
          />
        </div>

        {config.overlayEnabled ? (
          <div
            className="absolute inset-0"
            style={{
              backgroundColor: config.overlayColor || "#000000",
              opacity: isActive ? overlayOpacity : 0,
              transition: `opacity ${hoverTransitionMs}ms ease`,
            }}
          />
        ) : null}

        {hoverLogoEnabled ? (
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{
              opacity: isActive ? 1 : 0,
              transition: `opacity ${hoverTransitionMs}ms ease`,
            }}
          >
            {renderHoverLogo(config)}
          </div>
        ) : null}
      </a>
    );
  }

  return (
    <section
      className="relative mt-18 max-w-6xl mx-auto px-4 sm:px-6 md:px-10 lg:px-16 overflow-visible"
      style={{
        ...sectionAnimationStyle,
        isolation: "isolate",
      }}
    >
      <style>
        {`
          @keyframes instagramSectionFadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }

          @keyframes instagramSectionSlideIn {
            from { opacity: 0; transform: translateY(28px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes instagramSectionZoomIn {
            from { opacity: 0; transform: scale(0.94); }
            to { opacity: 1; transform: scale(1); }
          }

          @keyframes instagramLogoPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.08); }
          }

          @keyframes instagramLogoFloat {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }

          @keyframes instagramLogoBounce {
            0%, 100% { transform: translateY(0px); }
            30% { transform: translateY(-10px); }
            55% { transform: translateY(0px); }
            70% { transform: translateY(-4px); }
          }

          @keyframes instagramLogoSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }

          @keyframes instagramLogoBreathing {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.06); opacity: 0.9; }
          }

          @media (max-width: 767px) {
            .instagram-mobile-head {
              margin-bottom: 0.35rem;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }

            .instagram-mobile-profile {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 0.18rem;
              margin: 0.8rem auto 0.35rem;
              text-decoration: none;
              max-width: 100%;
              width: fit-content;
              align-self: center;
            }

            .instagram-mobile-profile-icon {
              width: 24px;
              height: 24px;
              flex-shrink: 0;
            }

            .instagram-mobile-profile-user {
              font-size: 0.8rem;
              line-height: 1;
              font-weight: 700;
              color: ${config.userTextColor || "#111111"};
              letter-spacing: 0;
              white-space: nowrap;
            }

            .instagram-mobile-layout {
              display: grid;
              grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
              gap: 4px;
              align-items: stretch;
            }

            .instagram-mobile-left {
              display: flex;
            }

            .instagram-mobile-right {
              display: grid;
              grid-template-rows: repeat(2, minmax(0, 1fr));
              gap: 4px;
            }

            .instagram-mobile-bottom {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 4px;
              margin-top: 4px;
            }

            .instagram-mobile-featured-card {
              min-height: 348px;
              height: 100%;
            }

            .instagram-mobile-small-card {
              min-height: 168px;
            }

            .instagram-mobile-bottom-card {
              min-height: 118px;
            }
          }
        `}
      </style>

      {watermarkEnabled && watermarkImage ? (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-visible">
          {watermarkRepeat ? (
            <div
              className="absolute inset-0"
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
              style={sectionWatermarkStyle}
            />
          )}
        </div>
      ) : null}

      <div className="relative z-10">
        <div className="mb-6 px-1 py-4 instagram-mobile-head">
          {config.titleImage ? (
            <img
              src={config.titleImage}
              alt={config.titleAlt || "Título de Instagram"}
              className="mx-auto w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl h-auto object-contain"
              draggable={false}
            />
          ) : (
            <div className="text-center" style={titleStyle}>
              {config.titleText || "Síguenos en Instagram"}
            </div>
          )}

          <a
            href={config.profileLink || "https://instagram.com"}
            target="_blank"
            rel="noopener noreferrer"
            className="instagram-mobile-profile md:hidden"
            style={bigLogoAnimationStyle}
          >
            {config.instagramLogo ? (
              <img
                src={config.instagramLogo}
                alt="Instagram Logo"
                draggable={false}
                className="instagram-mobile-profile-icon"
              />
            ) : (
              <Instagram
                className="instagram-mobile-profile-icon"
                style={{
                  color:
                    config.profileBadgeTextColor ||
                    config.userTextColor ||
                    "#111111",
                }}
              />
            )}
            <span className="instagram-mobile-profile-user">{profileUser}</span>
          </a>
        </div>

        <div className="flex flex-col md:flex-row w-full items-stretch gap-6">
          <div className="hidden md:flex w-full md:w-auto md:min-w-[220px] md:max-w-[320px] md:flex-shrink-0 justify-center items-center p-4">
            <div className="text-center w-full" style={bigLogoAnimationStyle}>
              <a
                href={config.profileLink || "https://instagram.com"}
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
                {config.instagramLogo ? (
                  <img
                    src={config.instagramLogo}
                    alt="Instagram Logo"
                    draggable={false}
                    style={{
                      width: `${clampNumber(config.logoSizePx ?? 32, 24, 300)}px`,
                      height: `${clampNumber(config.logoSizePx ?? 32, 24, 300)}px`,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <Instagram
                    style={{
                      width: `${clampNumber(config.logoSizePx ?? 32, 24, 300)}px`,
                      height: `${clampNumber(config.logoSizePx ?? 32, 24, 300)}px`,
                      color:
                        config.profileBadgeTextColor ||
                        config.userTextColor ||
                        "#111111",
                    }}
                  />
                )}
              </a>
            </div>
          </div>

          <div className="w-full md:flex-1 md:min-w-0 p-2">
            <div className="block md:hidden overflow-hidden">
              <div className="instagram-mobile-layout">
                <div className="instagram-mobile-left">
                  {renderMobileCard(
                    mobileFeaturedPost,
                    0,
                    "instagram-mobile-featured-card"
                  )}
                </div>

                <div className="instagram-mobile-right">
                  {renderMobileCard(
                    mobileRightTopPost,
                    1,
                    "instagram-mobile-small-card"
                  )}
                  {renderMobileCard(
                    mobileRightBottomPost,
                    2,
                    "instagram-mobile-small-card"
                  )}
                </div>
              </div>

              {mobileBottomLeftPost || mobileBottomRightPost ? (
                <div className="instagram-mobile-bottom">
                  {mobileBottomLeftPost ? (
                    renderMobileCard(
                      mobileBottomLeftPost,
                      3,
                      "instagram-mobile-bottom-card"
                    )
                  ) : (
                    <div />
                  )}

                  {mobileBottomRightPost ? (
                    renderMobileCard(
                      mobileBottomRightPost,
                      4,
                      "instagram-mobile-bottom-card"
                    )
                  ) : (
                    <div />
                  )}
                </div>
              ) : null}
            </div>

            <div
              className={
                galleryMode === "grid"
                  ? "hidden md:grid"
                  : "hidden md:flex"
              }
              style={
                galleryMode === "grid"
                  ? containerGridStyle
                  : desktopFlexHoverStyle
              }
            >
              {finalPosts.map((post, idx) => {
                const isHovered = hoveredId === post.id;

                let imageTransform = "scale(1)";
                let imageOpacity = 1;
                let cardTranslate = "translateY(0px)";

                if (isHovered && config.hoverEffect === "zoom") {
                  imageTransform = `scale(${hoverScale})`;
                } else if (
                  galleryMode === "flex-hover" &&
                  hasDesktopHover &&
                  !isHovered &&
                  config.hoverEffect === "zoom"
                ) {
                  imageTransform = "scale(1.01)";
                }

                if (isHovered && config.hoverEffect === "fade") {
                  imageOpacity = 0.78;
                }

                if (isHovered && config.hoverEffect === "lift") {
                  cardTranslate = "translateY(-6px)";
                }

                const cardWidthPx =
                  galleryMode === "flex-hover"
                    ? hasDesktopHover
                      ? isHovered
                        ? hoveredCardWidthPx
                        : baseCardWidthPx
                      : baseCardWidthPx
                    : undefined;

                const desktopCardStyle =
                  galleryMode === "grid"
                    ? {
                        ...cardBaseStyle,
                        minWidth: 0,
                        transform: cardTranslate,
                        transition: `transform ${hoverTransitionMs}ms ease, box-shadow ${hoverTransitionMs}ms ease`,
                        boxShadow: isHovered
                          ? "0 10px 30px rgba(0,0,0,0.10)"
                          : "none",
                      }
                    : {
                        ...cardBaseStyle,
                        minWidth: `${baseCardWidthPx}px`,
                        width: `${cardWidthPx}px`,
                        flex: `0 0 ${cardWidthPx}px`,
                        transform: cardTranslate,
                        transformOrigin: "right center",
                        transition: [
                          `width ${hoverTransitionMs}ms ease`,
                          `flex-basis ${hoverTransitionMs}ms ease`,
                          `transform ${hoverTransitionMs}ms ease`,
                          `box-shadow ${hoverTransitionMs}ms ease`,
                          `filter ${hoverTransitionMs}ms ease`,
                        ].join(", "),
                        boxShadow: isHovered
                          ? "0 14px 34px rgba(0,0,0,0.14)"
                          : "0 4px 14px rgba(0,0,0,0.05)",
                        filter:
                          hasDesktopHover && !isHovered
                            ? "brightness(0.96)"
                            : "brightness(1)",
                      };

                return (
                  <a
                    key={post.id || idx}
                    href={post.link || config.profileLink || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden block bg-white/30"
                    style={desktopCardStyle}
                    onMouseEnter={() => setHoveredId(post.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div style={imageShellStyle}>
                      <img
                        src={post.image}
                        alt={`Instagram ${idx + 1}`}
                        style={imageStyle(imageTransform, imageOpacity)}
                      />
                    </div>

                    {config.overlayEnabled ? (
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundColor: config.overlayColor || "#000000",
                          opacity: isHovered ? overlayOpacity : 0,
                          transition: `opacity ${hoverTransitionMs}ms ease`,
                        }}
                      />
                    ) : null}

                    {hoverLogoEnabled ? (
                      <div
                        className="absolute inset-0 flex items-center justify-center pointer-events-none"
                        style={{
                          opacity: isHovered ? 1 : 0,
                          transition: `opacity ${hoverTransitionMs}ms ease`,
                        }}
                      >
                        {renderHoverLogo(config)}
                      </div>
                    ) : null}
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}