import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import CatalogPageView from "../../../components/catalog/CatalogPageView";
import ProductDetailView from "../../../components/product-detail/ProductDetailView";
import Header from "../../../components/Header";
import FooterSection from "../../../components/FooterSection";
import { CartContext } from "../../../context/CartContext";
import { FavoritesContext } from "../../../context/FavoritesContext";
import { API_BASE_URL } from "../../../config/apiBaseUrl";
import "../../../index.css";
const noop = () => {};
const cart = {
  cart: [],
  totalItems: 0,
  subtotal: 0,
  addToCart: noop,
  removeFromCart: noop,
};
const favorites = {
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: noop,
};
const exampleProduct = {
  _id: "preview",
  title: "Producto de ejemplo",
  name: "Producto de ejemplo",
  price: 80000,
  image: "/placeholder.png",
  sizes: ["Pequeño", "Mediano"],
  colors: ["#303030", "#b58167"],
  description: "Elige un producto real para comprobar su presentación.",
  reviews: [],
};
function DetailPreview({ draft }) {
  const [products, setProducts] = useState([]),
    [productId, setProductId] = useState("");
  const [size, setSize] = useState(""),
    [color, setColor] = useState(""),
    [quantity, setQuantity] = useState(1);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/products?limit=12&status=published`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) =>
        setProducts(Array.isArray(data.products) ? data.products : []),
      )
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const product =
    products.find((item) => String(item._id || item.id) === productId) ||
    products[0] ||
    exampleProduct;
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    setSelected(null);
    setSize("");
    setColor("");
    if (!product._id || product._id === "preview") return;
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/products/${encodeURIComponent(product._id)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data) setSelected(data.product || data);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [product._id]);
  return (
    <>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 10,
          background: "#fff",
          color: "#222",
          font: "14px system-ui",
        }}
      >
        Producto para la vista previa
        <select
          aria-label="Producto de vista previa"
          value={productId || String(products[0]?._id || products[0]?.id || "")}
          onChange={(event) => setProductId(event.target.value)}
        >
          {products.length ? (
            products.map((item) => (
              <option key={item._id || item.id} value={item._id || item.id}>
                {item.title || item.name}
              </option>
            ))
          ) : (
            <option value="">Producto de ejemplo</option>
          )}
        </select>
      </label>
      <ProductDetailView
        product={selected || product}
        config={draft.productDetailConfig}
        withChrome={false}
        isFavorite={false}
        onToggleFavorite={noop}
        onAddToCart={noop}
        selectedSize={size}
        setSelectedSize={setSize}
        selectedColor={color}
        setSelectedColor={setColor}
        quantity={quantity}
        setQuantity={setQuantity}
        reviewName=""
        setReviewName={noop}
        reviewComment=""
        setReviewComment={noop}
        reviewRating={5}
        setReviewRating={noop}
        reviewLoading={false}
        onSubmitReview={(event) => event.preventDefault()}
      />
    </>
  );
}
class PreviewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="alert">
        No se pudo mostrar esta configuración. Tus cambios siguen en el editor.
      </p>
    ) : (
      this.props.children
    );
  }
}
function Preview() {
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    const receive = (event) => {
      if (
        window.parent === window ||
        event.origin !== window.location.origin ||
        event.source !== window.parent
      )
        return;
      if (event.data?.type === "pages-preview:connect")
        window.parent.postMessage(
          { type: "pages-preview:ready" },
          window.location.origin,
        );
      if (
        event.data?.type === "pages-preview:update" &&
        ["catalog", "product-detail"].includes(event.data.draft?.pageType)
      )
        setDraft(event.data.draft);
    };
    const escape = (event) => {
      if (event.key === "Escape")
        window.parent.postMessage(
          { type: "pages-preview:close" },
          window.location.origin,
        );
    };
    window.addEventListener("keydown", escape);
    window.addEventListener("message", receive);
    window.parent.postMessage(
      { type: "pages-preview:ready" },
      window.location.origin,
    );
    return () => {
      window.removeEventListener("message", receive);
      window.removeEventListener("keydown", escape);
    };
  }, []);
  if (!draft)
    return (
      <p style={{ padding: 24, fontFamily: "system-ui" }}>
        Abre esta vista desde el editor de páginas.
      </p>
    );
  return (
    <PreviewBoundary>
      <MemoryRouter>
        <CartContext.Provider value={cart}>
          <FavoritesContext.Provider value={favorites}>
            <div
              onSubmitCapture={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClickCapture={(event) => {
                if (event.target.closest("a")) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              {draft.useHeader !== false && <Header />}
              {draft.pageType === "catalog" ? (
                <CatalogPageView
                  page={draft}
                  catalogConfig={draft.catalogConfig}
                />
              ) : (
                <DetailPreview draft={draft} />
              )}
              {draft.useFooter !== false && <FooterSection />}
            </div>
          </FavoritesContext.Provider>
        </CartContext.Provider>
      </MemoryRouter>
    </PreviewBoundary>
  );
}
createRoot(document.getElementById("root")).render(<Preview />);
