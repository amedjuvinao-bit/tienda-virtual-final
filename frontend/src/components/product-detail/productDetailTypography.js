export const PRODUCT_DETAIL_FONT_OPTIONS = [
  { value: "editorial", label: "Editorial del diseño actual" },
  { value: "inherit", label: "Heredar del sitio" },
  { value: "georgia", label: "Georgia" },
  { value: "system", label: "Sans del sistema" },
  { value: "arial", label: "Arial" },
];
const families = {
  editorial: '"Catalog Editorial", Georgia, serif',
  inherit: "inherit",
  georgia: "Georgia, serif",
  system: "system-ui, sans-serif",
  arial: "Arial, sans-serif",
};
export const normalizeProductDetailFont = (value) =>
  Object.hasOwn(families, value) ? value : "editorial";
export const productDetailFontFamily = (value) =>
  families[normalizeProductDetailFont(value)];
