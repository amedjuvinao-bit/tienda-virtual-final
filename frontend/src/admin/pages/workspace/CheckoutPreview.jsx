import { useMemo, useState } from "react";
import CheckoutPageView from "../../../checkout/page/CheckoutPageView";
import useCheckoutState from "../../../checkout/page/useCheckoutState";
import useCheckoutDerived from "../../../checkout/page/useCheckoutDerived";
import { buildSafeCheckoutPageConfig } from "../../../checkout/page/checkoutPageConfig";
import { checkoutQuoteKey } from "../../../checkout/page/checkoutQuoteModel";
const noop = () => {};
export default function CheckoutPreview({ draft }) {
  const form = useCheckoutState(),
    [mode, setMode] = useState("physical");
  const cart = useMemo(
    () =>
      mode === "empty"
        ? []
        : [
            {
              productId: "preview",
              title:
                mode === "digital"
                  ? "Producto digital de ejemplo"
                  : "Producto de ejemplo",
              image: "/placeholder.png",
              quantity: 2,
              price: 45000,
              requiresShipping: mode === "physical",
              productType: mode === "physical" ? "physical" : "digital",
              variantLabel: "Presentación de ejemplo",
            },
          ],
    [mode],
  );
  const config = useMemo(
    () =>
      buildSafeCheckoutPageConfig({
        ...draft.checkoutPageConfig,
        showHeader:
          draft.useHeader !== false &&
          draft.checkoutPageConfig?.showHeader !== false,
        showFooter:
          draft.useFooter !== false &&
          draft.checkoutPageConfig?.showFooter !== false,
      }),
    [draft],
  );
  const countries = [{ code: "CO", name: "Colombia" }],
    regions = [{ code: "47", name: "Magdalena" }],
    cities = [
      { code: "47001", name: "Santa Marta" },
      { code: "47189", name: "Ciénaga" },
    ];
  const state = {
    ...form,
    preview: true,
    checkoutConfig: config,
    checkoutPageData: draft,
    checkoutConfigLoading: false,
    paymentsConfigLoading: false,
    shippingConfigLoading: false,
    cartLoading: false,
    countries,
    regions,
    citiesList: cities,
    billingRegions: regions,
    billingCities: cities,
    paymentsConfig: {
      provider: "wompi",
      active: true,
      mode: "sandbox",
      currency: "COP",
    },
    quoteLoading: false,
  };
  const key = checkoutQuoteKey(state, {
    currentCart: cart,
    selectedCountry: countries.find(
      (country) => country.name === state.customerCountry,
    ),
  });
  const shipping =
    mode === "physical" && state.deliveryType === "envio" ? 10000 : 0;
  state.checkoutQuote = cart.length
    ? {
        _checkoutKey: key,
        consumerOffer: {
          ready: true,
          fingerprint: `preview-${key}`,
          version: "Vista previa",
          currency: "COP",
          pickupEnabled: true,
          seller: {
            legalName: "Nombre legal de ejemplo · vista previa",
            nit: "dato de ejemplo",
            notificationAddress: "Dirección de ejemplo",
            email: "contacto@example.com",
            phone: "Teléfono de ejemplo",
          },
          delivery: {
            text: "Plazo de ejemplo; en la tienda se conserva el plazo real aceptado.",
          },
          items: cart,
          policies: [],
          pricing: {
            subtotal: 90000,
            shipping,
            total: 90000 + shipping,
            taxAmount: 0,
            totalDiscount: 0,
          },
        },
        pricing: { subtotal: 90000, shipping, total: 90000 + shipping },
      }
    : null;
  const derived = useCheckoutDerived({ state, cart });
  return (
    <>
      <label
        className="checkout-preview-scenario"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 12,
          background: "#fff",
          color: "#222",
          font: "13px system-ui",
        }}
      >
        Escenario de vista previa
        <select
          aria-label="Escenario del checkout"
          value={mode}
          onChange={(event) => setMode(event.target.value)}
        >
          <option value="physical">Compra con envío</option>
          <option value="digital">Compra digital</option>
          <option value="empty">Carrito vacío</option>
        </select>
      </label>
      <CheckoutPageView
        state={state}
        derived={derived}
        actions={{
          handlePlaceOrder: () =>
            form.setErrors([
              "Vista previa: no se crean pedidos ni se realizan pagos.",
            ]),
          handleApplyCoupon: () =>
            form.setCouponMessage("Vista previa: cupón de demostración."),
          handlePreviewStoreCredit: () =>
            form.setStoreCreditPreview({
              status: "ready",
              eligible: false,
              balance: 0,
              message: "Vista previa: no se consultan saldos reales.",
            }),
          retryCheckoutQuote: noop,
        }}
        preview
      />
    </>
  );
}
