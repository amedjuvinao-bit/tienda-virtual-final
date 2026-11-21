import React, { useEffect, useState } from "react";
import { CartContext } from "../../../context/CartContext";
import { CartPageConfigurationContext } from "../../../components/cart/useCartPageConfiguration";
import CartPageView from "../../../components/cart/CartPageView";
import CartDrawer from "../../../components/cart/CartDrawer";
import { buildSafeCartPageConfig } from "../../../components/cart/cartPageConfig";
import {
  cartItemIdentity,
  applyCartOperation,
} from "../../../utils/cartMutationConcurrency";
import useBackdrop from "../../../components/useStorefrontBackdrop";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
const example = [
  {
    _id: "preview",
    title: "Producto de ejemplo",
    image: "/placeholder.png",
    price: 80000,
    quantity: 1,
    variantLabel: "Presentación de ejemplo",
  },
];
export default function CartPreview({ draft }) {
  const [samples, setSamples] = useState(example),
    [items, setItems] = useState(example);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/products?limit=3&status=published`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (controller.signal.aborted || !data.products?.length) return;
        const products = data.products.map((product) => ({
          ...product,
          quantity: 1,
          price: Number(product.price || 0),
        }));
        setSamples(products);
        setItems(products.slice(0, 2));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const update = (type) => (id, color, size, variantKey) =>
    setItems((current) =>
      applyCartOperation(current, {
        type,
        identity: cartItemIdentity({ _id: id, color, size, variantKey }),
      }),
    );
  const cartState = {
    cart: items,
    totalItems: items.reduce((n, item) => n + item.quantity, 0),
    loading: false,
    removeFromCart: update("remove"),
    increaseQuantity: update("increase"),
    decreaseQuantity: update("decrease"),
    addToCart: () => {},
    syncCart: () => {},
  };
  const config = buildSafeCartPageConfig(draft.cartPageConfig),
    backdrop = useBackdrop(config.presentation, config.style.pageBg);
  return (
    <CartPageConfigurationContext.Provider value={draft}>
      <CartContext.Provider value={cartState}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            padding: 8,
            background: "#fff",
            color: "#333",
            font: "12px system-ui",
          }}
        >
          <button type="button" onClick={() => setItems(samples.slice(0, 2))}>
            Con productos
          </button>
          <button type="button" onClick={() => setItems([])}>
            Carrito vacío
          </button>
        </div>
        {draft.cartPreviewMode === "drawer" ? (
          <div
            style={{
              minHeight: "100vh",
              backgroundColor: backdrop.color,
              backgroundImage: backdrop.image
                ? `url(${JSON.stringify(backdrop.image)})`
                : "none",
              backgroundSize: "cover",
            }}
          >
            <CartDrawer isOpen page={draft} cartState={cartState} preview />
          </div>
        ) : (
          <CartPageView page={draft} cartState={cartState} preview />
        )}
      </CartContext.Provider>
    </CartPageConfigurationContext.Provider>
  );
}
