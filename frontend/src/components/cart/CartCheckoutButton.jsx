import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PolishedGlassRim from "../PolishedGlassRim";

export default function CartCheckoutButton({
  config,
  tint,
  textColor,
  radius,
  disabled = false,
  onClick,
}) {
  const material = config.presentation;
  const props = {
    className: "cart-checkout",
    style: {
      "--cart-checkout-tint": tint,
      "--cart-checkout-alpha": `${material.checkoutGlassOpacity * 100}%`,
      "--cart-checkout-blur": `${material.checkoutGlassBlur}px`,
      color: material.checkoutUseThemeText ? "var(--cart-ink)" : textColor,
      borderRadius: radius,
    },
  };
  const content = (
    <>
      {config.checkoutButtonText}
      <ArrowRight size={17} aria-hidden="true" />
      <PolishedGlassRim
        radius={radius}
        width={material.borderWidth}
        reflection={material.reflection}
      />
    </>
  );
  return disabled ? (
    <button {...props} type="button" disabled>
      {content}
    </button>
  ) : (
    <Link {...props} to="/checkout" onClick={onClick}>
      {content}
    </Link>
  );
}
