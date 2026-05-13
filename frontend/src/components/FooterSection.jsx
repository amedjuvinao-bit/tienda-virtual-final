// src/components/FooterSection.jsx
import React, { useMemo, useState } from "react";

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function buildFooterConfig(theme) {
  const footer = theme?.footer || {};

  return {
    bgColor: footer.bgColor || "rgb(255,207,223)",
    textColor: footer.textColor || "#D4AF37",
    headingColor: footer.headingColor || "#FFFFFF",
    buttonColor: footer.buttonColor || "#D4AF37",
    buttonTextColor: footer.buttonTextColor || "#FFFFFF",
    bottomBarBg: footer.bottomBarBg || "#FCDCE1",
    bottomBarTextColor: footer.bottomBarTextColor || "#D4AF37",

    logoUrl: footer.logoUrl || "/LOGO1.png",
    logoSizePx: clampNumber(footer.logoSizePx ?? 144, 60, 260, 144),

    footerHeightPx: clampNumber(footer.footerHeightPx ?? 420, 260, 900, 420),

    subscribeText:
      footer.subscribeText ||
      "Suscríbete y sé la primera en recibir ofertas exclusivas, lanzamientos y novedades para consentirla.",
    inputPlaceholder: footer.inputPlaceholder || "Ingresa aquí tu e-mail",
    buttonText: footer.buttonText || "Suscríbete ➔",
    subscribeButtonWidthPx: clampNumber(
      footer.subscribeButtonWidthPx ?? 170,
      90,
      320,
      170
    ),
    subscribeButtonHeightPx: clampNumber(
      footer.subscribeButtonHeightPx ?? 44,
      32,
      80,
      44
    ),
    subscribeButtonFontSizePx: clampNumber(
      footer.subscribeButtonFontSizePx ?? 16,
      10,
      28,
      16
    ),

    facebook: footer.facebook || "https://facebook.com/andreamilano.co",
    instagram: footer.instagram || "https://instagram.com/andreamilano.co",
    tiktok: footer.tiktok || "https://tiktok.com/@andreamilano.co",
    whatsapp: footer.whatsapp || "https://wa.me/3154101276",

    facebookIcon: footer.facebookIcon || "",
    instagramIcon: footer.instagramIcon || "",
    tiktokIcon: footer.tiktokIcon || "",
    whatsappIcon: footer.whatsappIcon || "",
    socialIconSizePx: clampNumber(footer.socialIconSizePx ?? 48, 24, 90, 48),
    socialIconGapPx: clampNumber(footer.socialIconGapPx ?? 8, 0, 40, 8),

    column1Title: footer.column1Title || "Rosa Boutique",
    column1Links: Array.isArray(footer.column1Links)
      ? footer.column1Links
      : [
          { label: "Nuestra historia", href: "/nuestra-historia" },
          { label: "Nuestra sede", href: "/nuestra-sede" },
        ],

    column2Title: footer.column2Title || "Compra con nosotros",
    column2Links: Array.isArray(footer.column2Links)
      ? footer.column2Links
      : [
          { label: "Contáctanos", href: "/contacto" },
          { label: "Cambio y devoluciones", href: "/cambios-devoluciones" },
          { label: "Preguntas frecuentes", href: "/preguntas-frecuentes" },
        ],

    column3Title: footer.column3Title || "Otros",
    column3Links: Array.isArray(footer.column3Links)
      ? footer.column3Links
      : [
          { label: "Políticas de compra, despacho y envío", href: "/politicas" },
          { label: "Términos y condiciones", href: "/terminos" },
        ],

    copyright:
      footer.copyright ||
      "© Rosa Boutique 2025. Todos los derechos reservados. Desarrollado por Amed Juvinao.",
  };
}

function sanitizeLinks(links) {
  const arr = Array.isArray(links) ? links : [];
  return arr.filter(
    (item) =>
      item &&
      typeof item === "object" &&
      typeof item.label === "string" &&
      item.label.trim() &&
      typeof item.href === "string" &&
      item.href.trim()
  );
}

function SocialIcon({ href, imageUrl, fallbackSrc, alt, sizePx }) {
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={alt}
      className="inline-flex items-center justify-center shrink-0 transition-transform duration-300 hover:scale-105"
      style={{
        width: `${sizePx}px`,
        height: `${sizePx}px`,
      }}
    >
      <img
        src={imageUrl || fallbackSrc}
        alt={alt}
        className="block h-full w-full object-contain transition-transform duration-300 hover:scale-110 hover:rotate-6"
      />
    </a>
  );
}

function FooterAccordionSection({
  id,
  title,
  links,
  isOpen,
  onToggle,
  headingColor,
  textColor,
}) {
  return (
    <div className="border-b border-white/60 last:border-b-0">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center justify-between gap-4 py-4 text-left"
        aria-expanded={isOpen}
        aria-controls={`footer-accordion-${id}`}
      >
        <span
          className="text-[17px] font-semibold leading-6"
          style={{ color: headingColor }}
        >
          {title}
        </span>

        <span
          className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/10"
          aria-hidden="true"
        >
          <span
            className="absolute h-[2px] w-3.5 rounded-full"
            style={{ backgroundColor: headingColor }}
          />
          <span
            className={`absolute h-3.5 w-[2px] rounded-full transition-transform duration-300 ${
              isOpen ? "scale-y-0" : "scale-y-100"
            }`}
            style={{ backgroundColor: headingColor }}
          />
        </span>
      </button>

      <div
        id={`footer-accordion-${id}`}
        className={`grid transition-all duration-300 ease-out ${
          isOpen ? "grid-rows-[1fr] pb-4" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <ul className="space-y-3 pr-1">
            {links.map((item, index) => (
              <li key={`${id}-${index}`}>
                <a
                  href={item.href}
                  className="inline-flex text-sm leading-6 transition-opacity duration-200 hover:opacity-80"
                  style={{ color: textColor }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function FooterSection({ theme }) {
  const footer = useMemo(() => buildFooterConfig(theme), [theme]);

  const column1Links = sanitizeLinks(footer.column1Links);
  const column2Links = sanitizeLinks(footer.column2Links);
  const column3Links = sanitizeLinks(footer.column3Links);

  const [openSections, setOpenSections] = useState({
    column1: false,
    column2: false,
    column3: false,
  });

  const toggleSection = (sectionKey) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const socialSizeMobile = clampNumber(
    Math.round(footer.socialIconSizePx * 0.82),
    24,
    footer.socialIconSizePx,
    40
  );

  const subscribeButtonMobileWidth = clampNumber(
    Math.round(footer.subscribeButtonWidthPx * 0.75),
    110,
    footer.subscribeButtonWidthPx,
    140
  );

  return (
    <footer
      className="relative mt-16 overflow-hidden rounded-[28px] sm:rounded-[32px]"
      style={{
        backgroundColor: footer.bgColor,
        color: footer.textColor,
        "--footer-height": `${footer.footerHeightPx}px`,
      }}
    >
      <div className="relative z-10 flex flex-col md:min-h-[var(--footer-height)]">
        {/* Logo */}
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6 sm:pt-10 md:px-8 md:pt-10">
          <div className="flex justify-center">
            <img
              src={footer.logoUrl}
              alt="Rosa Boutique"
              draggable={false}
              className="block shrink-0 object-contain"
              style={{
                width: `clamp(92px, 28vw, ${footer.logoSizePx}px)`,
              }}
            />
          </div>
        </div>

        {/* Contenido superior */}
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-6 pt-6 sm:px-6 md:px-8 md:pb-8 md:pt-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
            {/* Suscripción */}
            <div className="min-w-0">
              <h3
                className="mx-auto max-w-[34rem] text-center text-[18px] font-medium leading-7 sm:text-[20px] sm:leading-8 md:mx-0 md:max-w-none md:text-left md:text-[22px]"
                style={{ color: footer.headingColor }}
              >
                {footer.subscribeText}
              </h3>

              <form className="mx-auto mt-6 w-full max-w-[34rem] md:mx-0">
                <div className="flex w-full items-center overflow-hidden rounded-full bg-white shadow-[0_10px_30px_rgba(0,0,0,0.08)]">
                  <input
                    type="email"
                    placeholder={footer.inputPlaceholder}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 sm:px-5 sm:text-[15px]"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-full px-4 font-medium transition-colors"
                    style={{
                      backgroundColor: footer.buttonColor,
                      color: footer.buttonTextColor,
                      width: `clamp(${subscribeButtonMobileWidth}px, 34vw, ${footer.subscribeButtonWidthPx}px)`,
                      minHeight: `${footer.subscribeButtonHeightPx}px`,
                      fontSize: `clamp(13px, 3.2vw, ${footer.subscribeButtonFontSizePx}px)`,
                    }}
                  >
                    {footer.buttonText}
                  </button>
                </div>
              </form>

              <div
                className="mt-5 flex flex-wrap items-center justify-center md:justify-start"
                style={{
                  gap: `${footer.socialIconGapPx}px`,
                }}
              >
                <SocialIcon
                  href={footer.facebook}
                  imageUrl={footer.facebookIcon}
                  fallbackSrc="/icons/Facebook.svg"
                  alt="Facebook"
                  sizePx={socialSizeMobile}
                />

                <SocialIcon
                  href={footer.instagram}
                  imageUrl={footer.instagramIcon}
                  fallbackSrc="/icons/Instagram.svg"
                  alt="Instagram"
                  sizePx={socialSizeMobile}
                />

                <SocialIcon
                  href={footer.tiktok}
                  imageUrl={footer.tiktokIcon}
                  fallbackSrc="/icons/Tiktok.svg"
                  alt="TikTok"
                  sizePx={socialSizeMobile}
                />

                <SocialIcon
                  href={footer.whatsapp}
                  imageUrl={footer.whatsappIcon}
                  fallbackSrc="/icons/Whatsapp.svg"
                  alt="WhatsApp"
                  sizePx={socialSizeMobile}
                />
              </div>
            </div>

            {/* Columnas desktop */}
            <div className="hidden min-w-0 md:grid md:grid-cols-3 md:gap-6 lg:gap-8">
              <div className="min-w-0">
                <h4
                  className="mb-3 text-base font-semibold"
                  style={{ color: footer.headingColor }}
                >
                  {footer.column1Title}
                </h4>
                <ul className="space-y-2">
                  {column1Links.map((item, index) => (
                    <li key={`desktop-col1-${index}`} className="min-w-0">
                      <a
                        href={item.href}
                        className="inline-flex max-w-full break-words text-sm leading-6 transition-opacity duration-200 hover:opacity-80"
                        style={{ color: footer.textColor }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <h4
                  className="mb-3 text-base font-semibold"
                  style={{ color: footer.headingColor }}
                >
                  {footer.column2Title}
                </h4>
                <ul className="space-y-2">
                  {column2Links.map((item, index) => (
                    <li key={`desktop-col2-${index}`} className="min-w-0">
                      <a
                        href={item.href}
                        className="inline-flex max-w-full break-words text-sm leading-6 transition-opacity duration-200 hover:opacity-80"
                        style={{ color: footer.textColor }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="min-w-0">
                <h4
                  className="mb-3 text-base font-semibold"
                  style={{ color: footer.headingColor }}
                >
                  {footer.column3Title}
                </h4>
                <ul className="space-y-2">
                  {column3Links.map((item, index) => (
                    <li key={`desktop-col3-${index}`} className="min-w-0">
                      <a
                        href={item.href}
                        className="inline-flex max-w-full break-words text-sm leading-6 transition-opacity duration-200 hover:opacity-80"
                        style={{ color: footer.textColor }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Acordeones móvil / tablet pequeña */}
          <div className="mt-8 md:hidden">
            <FooterAccordionSection
              id="column1"
              title={footer.column1Title}
              links={column1Links}
              isOpen={openSections.column1}
              onToggle={toggleSection}
              headingColor={footer.headingColor}
              textColor={footer.textColor}
            />

            <FooterAccordionSection
              id="column2"
              title={footer.column2Title}
              links={column2Links}
              isOpen={openSections.column2}
              onToggle={toggleSection}
              headingColor={footer.headingColor}
              textColor={footer.textColor}
            />

            <FooterAccordionSection
              id="column3"
              title={footer.column3Title}
              links={column3Links}
              isOpen={openSections.column3}
              onToggle={toggleSection}
              headingColor={footer.headingColor}
              textColor={footer.textColor}
            />
          </div>
        </div>

        {/* Barra inferior */}
        <div
          className="mt-auto px-4 py-4 text-center text-xs leading-6 sm:px-6 sm:text-sm md:px-8"
          style={{
            backgroundColor: footer.bottomBarBg,
            color: footer.bottomBarTextColor,
          }}
        >
          <div className="mx-auto max-w-6xl">{footer.copyright}</div>
        </div>
      </div>
    </footer>
  );
}