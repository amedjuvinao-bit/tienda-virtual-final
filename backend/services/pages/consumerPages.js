"use strict";
const CONSUMER_PAGES = [
  { slug: "envios", role: "consumer-shipping", name: "Envíos y entregas" },
  { slug: "terminos", role: "consumer-terms", name: "Condiciones de compra" },
  { slug: "privacidad", role: "consumer-privacy", name: "Datos personales" },
  {
    slug: "cambios-y-devoluciones",
    role: "consumer-returns",
    name: "Retracto, garantía y devoluciones",
  },
  { slug: "pqr", role: "consumer-claims", name: "Peticiones y reclamos" },
];
async function ensureConsumerPages(Page) {
  for (const p of CONSUMER_PAGES) {
    if (await Page.findOne({ slug: p.slug })) continue;
    try {
      await Page.findOneAndUpdate(
        { slug: p.slug },
        {
          $setOnInsert: {
            name: p.name,
            slug: p.slug,
            systemRole: p.role,
            pageType: "information",
            enabled: true,
            useHeader: true,
            useFooter: true,
            blocks: [],
            informationPageConfig: {
              layout: "editorial",
              titleText: p.name,
              subtitleText:
                "Información clara para comprar y recibir atención.",
              eyebrowText: "Tu compra, con confianza",
              titleFontSizePx: 40,
              sections: [],
              actionText: "",
              style: {
                cardRadiusPx: 28,
                buttonRadiusPx: 999,
                buttonBg: "#7e2440",
                buttonTextColor: "#fff4ed",
              },
              presentation: {
                borderWidth: 2,
                checkoutGlassOpacity: 0.88,
                checkoutGlassBlur: 8,
              },
            },
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (e) {
      if (e.code !== 11000 || !(await Page.findOne({ slug: p.slug }))) throw e;
    }
  }
}
module.exports = { CONSUMER_PAGES, ensureConsumerPages };
