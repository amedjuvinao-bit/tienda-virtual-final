import React, { useId, useRef } from "react";
import { FileText, Truck, Star } from "lucide-react";

export default function ProductDetailInformation({
  presentation,
  product,
  active,
  onChange,
  delivery,
  specifications,
  reviews,
  reviewCount,
  showReviews,
}) {
  const id = useId();
  const buttons = useRef([]);
  const tabs = [
    ...(presentation.showDescription
      ? [
          {
            key: "description",
            label: presentation.descriptionLabel,
            icon: FileText,
          },
        ]
      : []),
    ...(delivery
      ? [{ key: "delivery", label: presentation.deliveryLabel, icon: Truck }]
      : []),
    ...(showReviews
      ? [
          {
            key: "reviews",
            label: `${presentation.reviewsLabel}${reviewCount ? ` (${reviewCount})` : ""}`,
            icon: Star,
          },
        ]
      : []),
  ];
  const selected = tabs.some((tab) => tab.key === active)
    ? active
    : tabs[0]?.key;
  if (!tabs.length && !specifications) return null;
  const select = (index) => {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].key);
    buttons.current[next]?.focus();
  };
  return (
    <section
      className="pd-frame-information"
      aria-label="Información del producto"
    >
      <div
        className="pd-information-tabs"
        role="tablist"
        aria-label="Detalles del producto"
      >
        {tabs.map(({ key, label, icon: Icon }, index) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`${id}-${key}-tab`}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            aria-selected={selected === key}
            aria-controls={`${id}-${key}-panel`}
            tabIndex={selected === key ? 0 : -1}
            onClick={() => onChange(key)}
            onKeyDown={(event) => {
              if (
                ["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)
              ) {
                event.preventDefault();
                select(
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? tabs.length - 1
                      : index + (event.key === "ArrowRight" ? 1 : -1),
                );
              }
            }}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {tabs.map(({ key }) => (
        <div
          key={key}
          role="tabpanel"
          id={`${id}-${key}-panel`}
          aria-labelledby={`${id}-${key}-tab`}
          hidden={selected !== key}
          tabIndex={0}
          className={`pd-information-panel pd-information-panel--${key}`}
        >
          {key === "description" && (
            <>
              <p className="pd-product-description">
                {product.description || product.shortDescription || ""}
              </p>
              {specifications}
            </>
          )}
          {key === "delivery" && delivery}
          {key === "reviews" && reviews}
        </div>
      ))}
      {!presentation.showDescription && specifications}
    </section>
  );
}
