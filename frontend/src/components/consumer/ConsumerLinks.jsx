import { useLocation } from "react-router-dom";
import "./consumer.css";
import { normalizeEditorialOptions } from "../footer/footerEditorialConfig";
import useStorefrontBackdrop from "../useStorefrontBackdrop";
export default function ConsumerLinks() {
  const location = useLocation();
  const backdrop = useStorefrontBackdrop(
    { backgroundMode: "continuity" },
    "transparent",
  );
  const footer = normalizeEditorialOptions(
    backdrop.settings?.theme?.footer || {},
    { theme: backdrop.settings?.theme, store: backdrop.settings?.store },
  );
  if (location.pathname.startsWith("/admin")) return null;
  return (
    <nav
      style={{
        color: footer.textColor,
        backgroundColor: backdrop.color,
        backgroundImage: backdrop.image
          ? `url(${JSON.stringify(backdrop.image)})`
          : "none",
        backgroundSize: "cover",
        backgroundAttachment: "fixed",
      }}
      className="consumer-legal-links"
      aria-label="Información y protección al consumidor"
    >
      {[
        ["envios", "Envíos y entregas"],
        ["cambios-y-devoluciones", "Retracto y garantía"],
        ["terminos", "Condiciones de compra"],
        ["privacidad", "Datos personales"],
        ["pqr", "Peticiones y reclamos"],
      ].map(([slug, label]) => (
        <a href={`/${slug}`} key={slug}>
          {label}
        </a>
      ))}
      <a
        href="https://www.sic.gov.co/"
        target="_blank"
        rel="noopener noreferrer"
      >
        SIC · Protección al consumidor
      </a>
    </nav>
  );
}
