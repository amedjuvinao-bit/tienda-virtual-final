import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PolishedGlassRim from "../PolishedGlassRim";

export default function ProductDetailGallery({
  images,
  image,
  setImage,
  title,
  config,
  discount,
  animationStyle,
}) {
  const style = config.style;
  const thumbnails = images.slice(0, config.thumbCount);
  const position = config.thumbnailPosition;
  const step = (direction) =>
    setImage(
      images[
        (Math.max(0, images.indexOf(image)) + direction + images.length) %
          images.length
      ],
    );
  return (
    <div
      className="pd-frame-gallery"
      data-thumbnails={position}
      data-image-fit={config.imageFit}
      style={{
        "--pd-thumb-width": `${config.thumbWidthPx}px`,
        "--pd-thumb-height": `${config.thumbHeightPx}px`,
        "--pd-thumb-gap": `${config.thumbGapPx}px`,
        "--pd-thumb-radius": `${style.thumbRadiusPx}px`,
        "--pd-thumb-edge": style.thumbBorderColor,
        "--pd-thumb-active": style.selectedThumbBorderColor,
        "--pd-photo-clearance":
          config.showThumbnails && images.length > 1 && position === "overlay"
            ? "calc(var(--pd-thumb-visible-height, var(--pd-thumb-height)) + 24px)"
            : "0px",
        "--pd-image-height": `${config.mainImageMaxHeightPx}px`,
        "--pd-image-width": `${config.mainImageMaxWidthPx}px`,
        ...animationStyle,
      }}
    >
      <div
        className="pd-main-img-wrap"
        style={{ borderWidth: `${style.borderWidthPx}px` }}
      >
        {discount > 0 && (
          <span className="pd-discount-badge">−{discount}%</span>
        )}
        <img
          src={image || "/placeholder.png"}
          alt={title}
          className={`pd-main-img ${config.imageHoverZoom ? "pd-main-img-zoom" : ""}`}
          style={{ objectFit: config.imageFit }}
          onError={(event) => {
            if (!event.currentTarget.src.endsWith("/placeholder.png"))
              event.currentTarget.src = "/placeholder.png";
          }}
        />
        {config.showArrows && images.length > 1 && (
          <div className="pd-gallery-arrows">
            <button
              type="button"
              aria-label="Ver imagen anterior"
              onClick={() => step(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              aria-label="Ver imagen siguiente"
              onClick={() => step(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
      {config.showThumbnails && images.length > 1 && (
        <div
          className="pd-frame-thumbnails"
          aria-label="Galería del producto"
          data-hover={config.thumbHoverEffect}
        >
          {thumbnails.map((source, index) => (
            <button
              key={source}
              type="button"
              className="pd-thumb-btn"
              aria-label={`Ver foto ${index + 1}`}
              aria-pressed={image === source}
              onClick={() => setImage(source)}
            >
              <img
                src={source}
                alt={`Miniatura ${index + 1}`}
                style={{ objectFit: config.imageFit }}
              />
              <PolishedGlassRim
                radius={style.thumbRadiusPx}
                width={style.borderWidthPx}
                reflection={config.presentation.reflection}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
