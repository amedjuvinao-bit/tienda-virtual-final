import { useId, useState } from "react";
import { MapPin, ArrowUpRight, Copy, Check, Map } from "lucide-react";
import {
  ContactGlass as CartGlass,
  ContactButton as ServiceButton,
} from "./ContactMaterial";
import ContactGlassRim from "./ContactGlassRim";
import { contactEmbedUrl } from "./contactPageConfig";

function MapIllustration() {
  const id = "contact-map-" + useId().replace(/:/g, "");
  return (
    <svg
      className="contact-map__drawing"
      viewBox="0 0 720 480"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={id}
          width="105"
          height="80"
          patternTransform="rotate(-25)"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M0 0H105V80H0Z M40 0V80 M0 35H105"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
        </pattern>
      </defs>
      <rect width="720" height="480" fill={`url(#${id})`} opacity=".3" />
      <g fill="none" stroke="currentColor" strokeLinecap="round">
        <path
          d="M-25 390C170 370 130 160 330 180S590 390 760 70"
          strokeWidth="12"
          opacity=".23"
        />
        <path
          d="M80-20C90 240 450 80 470 300S610 490 740 420"
          strokeWidth="8"
          opacity=".3"
        />
        <path
          d="M-20 120L730 430M130 500L430-30"
          strokeWidth="5"
          opacity=".25"
        />
        <circle cx="276" cy="249" r="28" strokeWidth="7" opacity=".35" />
      </g>
    </svg>
  );
}
export default function ContactMap({ config, data, preview }) {
  const c = config.contact,
    [exploring, setExploring] = useState(false),
    [copyStatus, setCopyStatus] = useState({ message: "", success: false });
  const copy = async () => {
    setCopyStatus({ message: "", success: false });
    if (preview) {
      setCopyStatus({
        message: "Vista previa: no se modifica el portapapeles.",
        success: false,
      });
      return;
    }
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(data.address);
      setCopyStatus({ message: c.copiedText, success: true });
    } catch {
      setCopyStatus({ message: c.copyErrorText, success: false });
    }
  };
  return (
    <CartGlass
      config={config}
      className="contact-location"
      id="ubicacion"
      aria-labelledby="contact-location-title"
    >
      <header className="contact-location__heading">
        <MapPin size={26} strokeWidth={1.3} aria-hidden="true" />
        <h2 id="contact-location-title">{c.locationTitle}</h2>
        <span />
      </header>
      <div
        className="contact-map"
        style={{ "--contact-map-height": `${c.mapHeightPx}px` }}
      >
        {exploring && data.coordinates && !preview ? (
          <iframe
            title={c.mapText || "Mapa de ubicación"}
            key={contactEmbedUrl(data.coordinates)}
            src={contactEmbedUrl(data.coordinates)}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <a
            className="contact-map__open"
            href={data.map}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={c.mapText || "Ver ubicación en el mapa"}
          >
            <MapIllustration />
            <span className="contact-map__marker">
              <MapPin size={64} strokeWidth={1.25} />
              <span />
            </span>
            <span className="contact-map__caption">
              {c.schematicText}
              <ArrowUpRight size={14} />
            </span>
          </a>
        )}
        <ContactGlassRim
          config={config}
          radius={Math.max(0, config.style.cardRadiusPx - 8)}
        />
      </div>
      <div className="contact-location__bottom">
        <div>
          <p>{c.locationLabel}</p>
          {data.address && <address>{data.address}</address>}
        </div>
        <ServiceButton
          as="a"
          config={config}
          href={data.directions}
          target="_blank"
          rel="noopener noreferrer"
        >
          {c.directionsText || "Cómo llegar"}
          <ArrowUpRight size={18} aria-hidden="true" />
        </ServiceButton>
      </div>
      {(data.coordinates || (c.showCopyAddress && data.address)) && (
        <div className="contact-location__tools">
          {data.coordinates && (
            <button
              type="button"
              onClick={() => setExploring((value) => !value)}
              aria-pressed={exploring}
            >
              <Map size={15} aria-hidden="true" />
              {exploring ? c.closeMapText : c.interactiveMapText}
            </button>
          )}
          {c.showCopyAddress && data.address && (
            <button type="button" onClick={copy}>
              {copyStatus.success ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
              {c.copyText || "Copiar dirección"}
            </button>
          )}
        </div>
      )}
      <p className="contact-copy-status" role="status">
        {copyStatus.message}
      </p>
    </CartGlass>
  );
}
