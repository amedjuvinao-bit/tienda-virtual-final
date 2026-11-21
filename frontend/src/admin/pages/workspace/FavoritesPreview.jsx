import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import { CartContext } from "../../../context/CartContext";
import { FavoritesContext } from "../../../context/FavoritesContext";
import FavoritesPageView from "../../../components/favorites/FavoritesPageView";
import {
  favoriteKey,
  normalizeFavoriteItem,
} from "../../../utils/favoriteModel";
import { buildCatalogCartIntent } from "../../../components/ProductCard";
const example = [
  normalizeFavoriteItem({
    _id: "preview-favorite",
    title: "Producto de ejemplo",
    price: 80000,
    image: "/placeholder.png",
    current: { valid: true, price: 80000 },
  }),
];
export default function FavoritesPreview({ draft }) {
  const [samples, setSamples] = useState(example),
    [items, setItems] = useState(example),
    [cart, setCart] = useState([]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/products?limit=8&status=published`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => {
        if (controller.signal.aborted || !data.products?.length) return;
        const rows = data.products.map((product) => {
          const intent = buildCatalogCartIntent(product);
          return normalizeFavoriteItem({
            ...product,
            current: {
              ...intent.payload,
              price: product.price,
              valid: !intent.unavailable,
              requiresSelection: intent.requiresSelection,
            },
          });
        });
        setSamples(rows);
        setItems(rows);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const favorites = {
    favorites: items,
    isInitialized: true,
    removeFromFavorites: (item) =>
      setItems((rows) =>
        rows.filter((row) => favoriteKey(row) !== favoriteKey(item)),
      ),
    isFavorite: (item) =>
      items.some((row) => favoriteKey(row) === favoriteKey(item)),
    toggleFavorite: () => {},
  };
  const cartState = {
    cart,
    totalItems: cart.reduce((n, item) => n + item.quantity, 0),
    addToCart: (item) =>
      setCart((rows) => {
        const found = rows.some(
          (row) => favoriteKey(row) === favoriteKey(item),
        );
        return found
          ? rows.map((row) =>
              favoriteKey(row) === favoriteKey(item)
                ? { ...row, quantity: row.quantity + 1 }
                : row,
            )
          : [...rows, { ...item, quantity: 1 }];
      }),
  };
  return (
    <FavoritesContext.Provider value={favorites}>
      <CartContext.Provider value={cartState}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 12,
            padding: 8,
            background: "#fff",
            color: "#333",
            font: "12px system-ui",
          }}
        >
          <button type="button" onClick={() => setItems(samples)}>
            Con productos
          </button>
          <button type="button" onClick={() => setItems([])}>
            Lista vacía
          </button>
        </div>
        <FavoritesPageView
          page={draft}
          favoritesState={favorites}
          cartState={cartState}
          preview
        />
      </CartContext.Provider>
    </FavoritesContext.Provider>
  );
}
