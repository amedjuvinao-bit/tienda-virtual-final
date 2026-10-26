import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingBag, Check, ArrowUpRight } from "lucide-react";
import { CartGlass } from "../cart/CartMaterial";
import { cartVariantLabel, money } from "../cart/cartModel";
import PolishedGlassRim from "../PolishedGlassRim";
import { favoriteKey } from "../../utils/favoriteModel";
export default function FavoriteCard({
  item,
  config,
  material,
  remove,
  addToCart,
  cart = [],
  cartBusy = false,
  preview = false,
}) {
  const c = config.content,
    s = config.style,
    current = item.current;
  const destination = `/producto/${encodeURIComponent(item.slug || item.productId)}`;
  const [failed, setFailed] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const navigate = useNavigate();
  const requiresSelection = Boolean(current?.requiresSelection);
  const unavailable = current?.valid === false;
  const ready = Boolean(current) && !unavailable;
  const inCart = cart.some(
    (row) => favoriteKey(row) === favoriteKey(item) && Number(row.quantity) > 0,
  );
  const label = cartVariantLabel(item, { generalVariantText: "" });
  const cover =
    (current?.valid && current.image) || item.image || "/placeholder.png";
  const handleAdd = async () => {
    if (requiresSelection) {
      if (!preview) navigate(destination);
      return;
    }
    if (!ready || busy) return;
    setBusy(true);
    setError("");
    try {
      await addToCart?.({
        ...item,
        ...current,
        _id: item.productId,
        productId: item.productId,
        quantity: 1,
      });
    } catch {
      setError("No se pudo agregar al carrito. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <CartGlass config={material} className="favorite-card">
      <div className="favorite-card__photo">
        <Link
          to={destination}
          aria-label={`${c.detailButtonText}: ${item.title}`}
        >
          <img
            src={failed === cover ? "/placeholder.png" : cover}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(cover)}
          />
        </Link>
        {c.showRemoveButton && (
          <button
            type="button"
            className="favorite-card__remove"
            aria-label={`${c.removeButtonText}: ${item.title}${label ? ` · ${label}` : ""}`}
            onClick={() => remove?.(item)}
            style={{ color: s.favoriteIconColor }}
          >
            <Heart size={21} fill="currentColor" strokeWidth={1.5} />
          </button>
        )}
        {unavailable && (
          <span className="favorite-card__unavailable">
            {c.unavailableText}
          </span>
        )}
      </div>
      <div className="favorite-card__body">
        <h2 style={{ fontSize: s.cardTitleSizePx }}>
          <Link to={destination}>{current?.title || item.title}</Link>
        </h2>
        {c.showVariants && label && (
          <p className="favorite-card__variant">{label}</p>
        )}
        {c.showPrice && (
          <p className="favorite-card__price" style={{ color: s.priceColor }}>
            {money(current?.valid ? current.price : item.price)}
          </p>
        )}
        {item.alerts?.some((alert) => alert.code === "PRICE_CHANGED") && (
          <p className="favorite-card__variant">El precio se actualizó</p>
        )}
        <div className="favorite-card__actions">
          {c.showCartButton && (
            <button
              type="button"
              className="favorites-action"
              disabled={!ready || busy || cartBusy}
              aria-pressed={inCart}
              data-added={inCart}
              onClick={handleAdd}
            >
              {inCart ? <Check size={16} /> : <ShoppingBag size={16} />}
              <span>
                {requiresSelection ? c.selectOptionsText : c.addButtonText}
              </span>
              <PolishedGlassRim
                radius={s.buttonRadiusPx}
                width={material.presentation.borderWidth}
                reflection={material.presentation.reflection}
              />
            </button>
          )}
          <Link
            className="favorite-card__detail"
            to={destination}
            aria-label={`${c.detailButtonText}: ${item.title}`}
          >
            <ArrowUpRight size={18} />
          </Link>
        </div>
        {error && (
          <p role="alert" className="favorite-card__error">
            {error}
          </p>
        )}
      </div>
    </CartGlass>
  );
}
