import React from "react";
import FooterSection from "./FooterSection";
import "./catalog/catalogFooterGlass.css";

export default function StorefrontFooter({ theme, store, preview = false }) {
  if (theme?.footer?.enabled === false && !preview) return null;
  return (
    <div
      className="cart-footer cpv-page"
      data-background="continuity"
      style={{ background: "transparent" }}
    >
      <div className="cpv-footer">
        <FooterSection
          theme={theme}
          store={store}
          preview={preview}
          polishedGlass
          inheritBackground
        />
      </div>
    </div>
  );
}
