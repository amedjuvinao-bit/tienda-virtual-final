import React from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, Trash2 } from "lucide-react";
import { cartItemKey, cartVariantLabel, money } from "./cartModel";
export default function CartItems({
  items,
  config,
  actions = {},
  busy = false,
  compact = false,
  preview = false,
}) {
  const style = config.style;
  const act = (action, item) =>
    actions[action]?.(
      item._id || item.productId,
      item.color,
      item.size,
      item.variantKey || item.variantId,
    );
  return (
    <div className={`cart-items ${compact ? "cart-items--compact" : ""}`}>
      {config.showTableHeader && !compact && (
        <div className="cart-items__labels" aria-hidden="true">
          <span>{config.tableProductText}</span>
          <span>{config.tablePriceText}</span>
          <span>{config.tableQuantityText}</span>
          <span>{config.tableTotalText}</span>
        </div>
      )}
      <ul aria-label="Productos del carrito">
        {items.map((item) => (
          <li key={cartItemKey(item)} className="cart-item">
            <div className="cart-item__product">
              <Link
                to={`/producto/${encodeURIComponent(item.slug || item._id || item.productId)}`}
                tabIndex={preview ? -1 : undefined}
                className="cart-item__photo"
                aria-label={`Ver ${item.title}`}
              >
                <img
                  src={item.image || "/placeholder.png"}
                  alt={item.title}
                  onError={(event) => {
                    if (!event.currentTarget.src.endsWith("/placeholder.png"))
                      event.currentTarget.src = "/placeholder.png";
                  }}
                />
              </Link>
              <div className="cart-item__description">
                <Link
                  className="cart-item__title"
                  to={`/producto/${encodeURIComponent(item.slug || item._id || item.productId)}`}
                >
                  {item.title}
                </Link>
                <p>
                  {config.variantLabelText}: {cartVariantLabel(item, config)}
                </p>
                {item.validationMessage && (
                  <p className="cart-item__warning" role="status">
                    {item.validationMessage}
                  </p>
                )}
                {config.showRemoveButton && (
                  <button
                    type="button"
                    className="cart-item__remove"
                    disabled={busy}
                    onClick={() => act("removeFromCart", item)}
                    aria-label={`${config.removeButtonText} ${item.title}`}
                  >
                    <Trash2 size={14} />
                    {config.removeButtonText}
                  </button>
                )}
              </div>
            </div>
            <div className="cart-item__price">
              <span className="cart-item__mobile-label">
                {config.tablePriceText}
              </span>
              {money(item.price)}
            </div>
            <div className="cart-item__quantity">
              {config.showQuantityControls ? (
                <div
                  className="cart-quantity"
                  style={{
                    borderColor: style.quantityBorderColor,
                    color: style.quantityTextColor,
                    "--cart-qty-icon": style.quantityIconColor,
                    borderRadius: style.quantityRadiusPx,
                  }}
                >
                  <button
                    type="button"
                    disabled={busy || Number(item.quantity) <= 1}
                    aria-label={`Disminuir cantidad de ${item.title}`}
                    onClick={() => act("decreaseQuantity", item)}
                  >
                    <Minus size={15} />
                  </button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      item.purchasable === false ||
                      (item.inventoryTracked &&
                        item.availableStock != null &&
                        Number(item.quantity) >= Number(item.availableStock))
                    }
                    aria-label={`Aumentar cantidad de ${item.title}`}
                    onClick={() => act("increaseQuantity", item)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
              ) : (
                <span>
                  {config.tableQuantityText}: {item.quantity}
                </span>
              )}
            </div>
            <div className="cart-item__total">
              <span className="cart-item__mobile-label">
                {config.tableTotalText}
              </span>
              {money(Number(item.price || 0) * Number(item.quantity || 0))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
