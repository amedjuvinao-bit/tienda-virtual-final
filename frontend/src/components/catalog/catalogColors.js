// ===== Util colores =====
const COLOR_LABELS = {
  "#d4af37": "Dorado",
  "#6fd2c5": "Aqua pastel",
  "#ffe991": "Amarillo pastel",
  "#a9d4ed": "Azul pastel",
  "#fae1b8": "Durazno",
  "#ffffff": "Blanco",
  "#cfa8e0": "Lila",
  "#eacbcb": "Rosa claro",
  "#ff7bac": "Rosa",
  "#fbb2d3": "Rosa suave",
  "#ff8c94": "Coral",
  "#000000": "Negro",
  "#ff69b4": "Rosa",
  "#ff1493": "Fucsia",
  "#0000ff": "Azul",
  "#00ff00": "Verde",
  "#ff0000": "Rojo",
};

const NAME_ALIASES = {
  negro: "#000000",
  blanco: "#ffffff",
  rojo: "#ff0000",
  verde: "#00ff00",
  azul: "#0000ff",
  fucsia: "#ff1493",
  rosa: "#ff69b4",
  "rosa palo": "#f4a2b7",
  celeste: "#87ceeb",
  dorado: "#d4af37",
  morado: "#800080",
  lila: "#cfa8e0",
  coral: "#ff8c94",
};

export const prettyColor = (c) =>
  COLOR_LABELS[String(c || "").toLowerCase()] || c;

const isValidCssColor = (c) => {
  if (!c) return false;
  const s = new Option().style;
  s.color = "";
  s.color = c;
  return s.color !== "";
};

export const normalizeToCss = (c) => {
  if (!c) return "";
  if (typeof c === "object") {
    const raw = c?.hex || c?.value || c?.name || "";
    return normalizeToCss(raw);
  }
  const raw = String(c).trim();
  if (isValidCssColor(raw)) return raw;
  const alias = NAME_ALIASES[raw.toLowerCase()];
  return alias && isValidCssColor(alias) ? alias : "";
};
