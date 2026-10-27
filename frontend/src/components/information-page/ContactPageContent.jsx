import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ArrowRight, Clock3, Mail, MessageCircle, Phone } from "lucide-react";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import {
  ContactGlass as CartGlass,
  ContactButton as ServiceButton,
} from "./ContactMaterial";
import ContactGlassRim from "./ContactGlassRim";
import WhatsAppGlyph from "../WhatsAppGlyph";
import { resolveContact } from "./contactPageConfig";
import ContactHoursDialog from "./ContactHoursDialog";
import ContactMap from "./ContactMap";
import "./contactPage.css";

const hasContent = (c, data) =>
  !!(
    (c.showWhatsapp && data.whatsapp) ||
    (c.showEmail && data.email) ||
    (c.showPhone && data.phone) ||
    (c.showHours && (data.hours || data.schedule.length)) ||
    (c.showLocation && data.map)
  );
const DEMO_STORE = {
  whatsapp: "+12025550123",
  email: "contacto@example.com",
  address: "Dirección de ejemplo",
  city: "Ciudad de ejemplo",
  customerServiceHours:
    "Horario de muestra. Configura aquí los días y horas de atención de tu negocio.",
};
function ContactTitle({ config, name }) {
  const [failedImage, setFailedImage] = useState("");
  return (
    <header className="contact-intro">
      {config.showEyebrow && config.eyebrowText && (
        <p className="contact-eyebrow">{config.eyebrowText}</p>
      )}
      <h1 className={config.showTitle ? "" : "sr-only"}>
        {config.titleMode === "image" &&
        config.titleImage &&
        failedImage !== config.titleImage ? (
          <img
            src={config.titleImage}
            alt={config.titleImageAlt || config.titleText || name}
            style={{ maxHeight: config.titleImageHeightPx }}
            onError={() => setFailedImage(config.titleImage)}
          />
        ) : (
          config.titleText || name || "Contacto"
        )}
      </h1>
      {config.showSubtitle && config.subtitleText && (
        <p className="contact-intro__description">{config.subtitleText}</p>
      )}
    </header>
  );
}
function Medallion({ icon: Icon, large = false, config }) {
  return (
    <span
      className={`contact-medallion${large ? " contact-medallion--large" : ""}`}
      aria-hidden="true"
    >
      <Icon strokeWidth={1.25} />
      <ContactGlassRim config={config} radius={large ? 42 : 999} />
    </span>
  );
}
export default function ContactPageContent({
  config,
  name,
  theme,
  preview = false,
}) {
  const settings = useContext(StorefrontSettingsContext),
    c = config.contact;
  const location = useLocation();
  const [hoursOpen, setHoursOpen] = useState(false);
  let data = resolveContact(c, settings, theme);
  const examples = preview && !hasContent(c, data);
  if (examples)
    data = resolveContact(
      {
        ...c,
        whatsappSource: "store",
        emailSource: "store",
        hoursSource: "store",
        locationSource: "store",
        latitude: "",
        longitude: "",
      },
      { store: DEMO_STORE },
    );
  const showLocation = c.showLocation && !!data.map;
  const showHours = c.showHours && !!(data.hours || data.schedule.length);
  useEffect(() => {
    if (
      preview ||
      !showLocation ||
      !(location.hash === "#ubicacion" || location.pathname === "/nuestra-sede")
    )
      return;
    const frame = requestAnimationFrame(() =>
      document
        .getElementById("ubicacion")
        ?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [location.hash, location.pathname, preview, showLocation]);
  return (
    <div
      className="contact-content"
      data-motion={c.motion}
      data-editorial={c.editorialHeading}
      data-location={showLocation}
      style={{
        "--info-body-size": `${config.style.bodyFontSizePx}px`,
        "--contact-section-size": `${config.style.sectionTitleSizePx}px`,
      }}
      onClickCapture={(event) => {
        if (preview && event.target.closest("a")) event.preventDefault();
      }}
    >
      {examples && (
        <p className="contact-preview-note" role="status">
          Vista previa con datos de ejemplo. No se guardan ni aparecen en la
          página pública.
        </p>
      )}
      <div className="contact-composition">
        <div className="contact-channels">
          <ContactTitle config={config} name={name} />
          {c.showWhatsapp && data.whatsapp && (
            <CartGlass config={config} className="contact-whatsapp">
              <a
                href={data.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-whatsapp__icon"
                aria-label={c.whatsappTitle || "WhatsApp"}
              >
                <Medallion icon={WhatsAppGlyph} large config={config} />
              </a>
              <div>
                <h2>{c.whatsappTitle}</h2>
                {c.whatsappDescription && <p>{c.whatsappDescription}</p>}
                <ServiceButton
                  as="a"
                  config={config}
                  href={data.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {c.whatsappAction || "Abrir conversación"}
                  <ArrowRight size={18} aria-hidden="true" />
                </ServiceButton>
              </div>
              <a
                href={data.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="contact-whatsapp__badge"
                aria-label={c.whatsappTitle || "WhatsApp"}
              >
                <MessageCircle size={21} aria-hidden="true" />
                <ContactGlassRim config={config} radius={999} />
              </a>
            </CartGlass>
          )}
          <div className="contact-rows">
            {c.showEmail && data.email && (
              <a className="contact-row" href={data.email}>
                <Medallion icon={Mail} config={config} />
                <span>
                  <span className="contact-row__title">{c.emailTitle}</span>
                  <span className="contact-row__description">
                    {c.emailAction}
                  </span>
                  <span className="contact-row__value">
                    {data.emailAddress}
                  </span>
                </span>
                <ArrowRight size={22} aria-hidden="true" />
              </a>
            )}
            {c.showPhone && data.phone && (
              <a className="contact-row" href={data.phone}>
                <Medallion icon={Phone} config={config} />
                <span>
                  <span className="contact-row__title">{c.phoneTitle}</span>
                  <span className="contact-row__description">
                    {c.phoneAction}
                    {c.phoneAction && " · "}
                    {data.phoneNumber}
                  </span>
                </span>
                <ArrowRight size={22} aria-hidden="true" />
              </a>
            )}
            {showHours && (
              <button
                type="button"
                className="contact-row"
                onClick={() => setHoursOpen(true)}
                aria-haspopup="dialog"
              >
                <Medallion icon={Clock3} config={config} />
                <span>
                  <span className="contact-row__title">{c.hoursTitle}</span>
                  <span className="contact-row__description">
                    {c.hoursAction}
                  </span>
                </span>
                <ArrowRight size={22} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        {showLocation && (
          <ContactMap config={config} data={data} preview={preview} />
        )}
      </div>
      {!hasContent(c, data) && <p className="contact-empty">{c.emptyText}</p>}
      {hoursOpen && (
        <ContactHoursDialog
          config={config}
          data={data}
          onClose={() => setHoursOpen(false)}
        />
      )}
    </div>
  );
}
