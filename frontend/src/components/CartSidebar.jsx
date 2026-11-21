import React, { useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import useCartPageConfiguration from "./cart/useCartPageConfiguration";
import CartDrawer from "./cart/CartDrawer";
export default function CartSidebar({ isOpen, onClose }) {
  const cartState = useCart() || { cart: [] };
  const sync = useRef(cartState.syncCart);
  sync.current = cartState.syncCart;
  const { page, loading } = useCartPageConfiguration();
  useEffect(() => {
    if (isOpen) void sync.current?.();
  }, [isOpen]);
  return (
    <CartDrawer
      isOpen={isOpen}
      onClose={onClose}
      page={page || {}}
      loading={loading}
      cartState={cartState}
    />
  );
}
