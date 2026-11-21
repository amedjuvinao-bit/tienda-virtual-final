import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ShoppingBag, UserRound, ShieldCheck } from "lucide-react";
import { CheckoutCard } from "./CheckoutMaterial";
export default function CheckoutHeading({ config }) {
  const [failed, setFailed] = useState("");
  return (
    <>
      {config.showBreadcrumb && (
        <nav
          className="co-breadcrumb"
          aria-label="Ruta de navegación"
          style={{ color: config.style.breadcrumbTextColor }}
        >
          <Link to="/" style={{ color: config.style.breadcrumbLinkColor }}>
            {config.breadcrumbHomeText}
          </Link>
          <span aria-hidden="true">/</span>
          <span>{config.breadcrumbCurrentText}</span>
        </nav>
      )}
      <CheckoutCard className="co-heading">
        <div>
          <h1
            style={{
              color: config.style.titleTextColor,
              fontSize: `clamp(min(22px,${config.style.titleFontSizePx}px),3.5vw,${config.style.titleFontSizePx}px)`,
            }}
          >
            {config.titleMode === "image" &&
            config.titleImage &&
            failed !== config.titleImage ? (
              <img
                src={config.titleImage}
                alt={config.titleImageAlt || config.titleText}
                style={{ maxHeight: config.style.titleImageHeightPx }}
                onError={() => setFailed(config.titleImage)}
              />
            ) : (
              config.titleText
            )}
          </h1>
          {config.subtitleText && <p>{config.subtitleText}</p>}
        </div>
        {config.showProgress && (
          <ol className="co-progress" aria-label="Progreso de compra">
            <li>
              <Link to="/carrito">
                <ShoppingBag size={17} />
                <span>Carrito</span>
                <Check size={12} />
              </Link>
            </li>
            <li aria-current="step">
              <UserRound size={17} />
              <span>Datos y pago</span>
            </li>
            <li>
              <ShieldCheck size={17} />
              <span>Confirmación</span>
            </li>
          </ol>
        )}
      </CheckoutCard>
    </>
  );
}
