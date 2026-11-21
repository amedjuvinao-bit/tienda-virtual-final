import { createContext, useContext } from "react";
import { CartGlass, cartVariables } from "../../components/cart/CartMaterial";
import { buildSafeCartPageConfig } from "../../components/cart/cartPageConfig";
import PolishedGlassRim from "../../components/PolishedGlassRim";
export const CheckoutMaterialContext = createContext(null);
export function checkoutMaterial(config, summary = false) {
  const s = config.style;
  return buildSafeCartPageConfig({
    presentation: config.presentation,
    style: {
      ...s,
      cardBg: summary ? s.summaryBg : s.sectionCardBg,
      cardBorderColor: summary
        ? s.summaryBorderColor
        : s.sectionCardBorderColor,
      cardRadiusPx: summary ? s.summaryRadiusPx : s.sectionCardRadiusPx,
      cardPaddingPx: s.sectionCardPaddingPx,
    },
  });
}
export function CheckoutCard({
  children,
  className = "",
  summary = false,
  ...rest
}) {
  const config = useContext(CheckoutMaterialContext);
  if (!config)
    return (
      <section className={`co-card ${className}`} {...rest}>
        {children}
      </section>
    );
  const material = checkoutMaterial(config, summary);
  return (
    <CartGlass
      config={material}
      className={`co-card ${className}`}
      style={cartVariables(material)}
      {...rest}
    >
      {children}
    </CartGlass>
  );
}
export function CheckoutButton({
  children,
  className = "co-btn-secondary",
  ...rest
}) {
  const config = useContext(CheckoutMaterialContext);
  return (
    <button type="button" className={className} {...rest}>
      {children}
      {config && (
        <PolishedGlassRim
          radius={config.style.confirmButtonRadiusPx}
          width={config.presentation.borderWidth}
          reflection={config.presentation.reflection}
        />
      )}
    </button>
  );
}
