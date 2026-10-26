import StorefrontLoadingScreen from "../components/StorefrontLoadingScreen";
import React, { useEffect, useRef } from "react";
import { useCart } from "../context/CartContext";
import CartPageView from "../components/cart/CartPageView";
import useCartPageConfiguration from "../components/cart/useCartPageConfiguration";
export default function CartPage() {
  const cartState = useCart();
  const sync = useRef(cartState.syncCart);
  sync.current = cartState.syncCart;
  useEffect(() => {
    void sync.current?.();
  }, []);
  const { page, loading, error } = useCartPageConfiguration();
  if (loading) return <StorefrontLoadingScreen message="Cargando carrito" />;
  return (
    <CartPageView
      page={page || {}}
      cartState={cartState}
      loading={loading}
      configError={error}
    />
  );
}
