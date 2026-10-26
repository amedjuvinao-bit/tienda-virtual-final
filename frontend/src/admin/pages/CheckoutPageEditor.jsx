import SystemPageEditor from "./workspace/SystemPageEditor";
import CheckoutAppearanceControls from "./workspace/CheckoutAppearanceControls";
import { buildSafeCheckoutPageConfig } from "../../checkout/page/checkoutPageConfig";
const tabs = [
  { id: "content", label: "Título y navegación", group: "content" },
  { id: "contact", label: "Contacto y entrega", group: "content" },
  { id: "summary", label: "Resumen y pago", group: "content" },
  { id: "background", label: "Fondo y cristal", group: "design" },
  { id: "colors", label: "Colores", group: "design" },
  { id: "layout", label: "Medidas y formas", group: "design" },
  { id: "visibility", label: "Visibilidad", group: "options" },
  { id: "settings", label: "Configuración", group: "settings" },
];
function normalizePage(page) {
  return {
    name: "Checkout",
    slug: "checkout",
    pageType: "checkout-page",
    enabled: page.enabled !== false,
    useHeader:
      page.useHeader !== false && page.checkoutPageConfig?.showHeader !== false,
    useFooter:
      page.useFooter !== false && page.checkoutPageConfig?.showFooter !== false,
    blocks: [],
    checkoutPageConfig: buildSafeCheckoutPageConfig(page.checkoutPageConfig),
  };
}
export default function CheckoutPageEditor() {
  return (
    <SystemPageEditor
      pageType="checkout-page"
      label="Finalización de compra"
      normalizePage={normalizePage}
      tabs={tabs}
      Controls={CheckoutAppearanceControls}
    />
  );
}
