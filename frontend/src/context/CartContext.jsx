// src/context/CartContext.jsx
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { setSessionId as setApiSessionId } from '../lib/api';
import { getSessionId } from '../utils/getSessionId';

// ---------- Helpers de mapeo ----------
/**
 * Convierte un item local (tu estado) al formato que espera el backend.
 * Local típico: { _id, title, image, color, size, quantity, price? }
 * Backend espera: { productId, qty, price?, title?, image?, color?, size? }
 */
function toBackendItem(it) {
  const productId =
    it.productId || it._id || (it.product && (it.product._id || it.product.id)) || it.id || '';
  const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
  const price = Number(it.price ?? it.unitPrice ?? it.priceNumber ?? 0) || 0;

  return {
    productId: String(productId),
    qty,
    quantity: qty, // compatibilidad
    title: it.title || (it.product && it.product.title) || '',
    image: it.image || (it.product && it.product.image) || '',
    color: it.color || '',
    size: it.size || '',
    price, // snapshot opcional (backend recalcula si hace falta)
  };
}

/**
 * Convierte un item que viene del backend al formato local.
 * Backend puede devolver productId como string o como objeto poblado.
 */
function fromBackendItem(it) {
  const p = typeof it.productId === 'object' ? it.productId : null;
  const _id = p?._id || it.productId || it._id || it.id;
  const qty = Number(it.qty ?? it.quantity ?? 0) || 0;
  const price = Number(it.price ?? p?.price ?? 0) || 0;

  return {
    _id: String(_id || ''),
    title: it.title || p?.title || '',
    image: it.image || p?.image || '',
    color: it.color || '',
    size: it.size || '',
    quantity: qty,
    price,
    // opcionales
    slug: p?.slug,
    sku: p?.sku ?? p?.skun,
  };
}

/** Calcula resumen local (para UI) */
function calcSummary(items) {
  let totalItems = 0;
  let subtotal = 0;
  for (const it of items) {
    const q = Number(it.quantity || 0);
    const pr = Number(it.price || 0);
    totalItems += q;
    subtotal += q * pr;
  }
  return { totalItems, subtotal };
}

/** Comparación superficial de arrays de items (evita loops al sincronizar) */
function itemsShallowEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];
    if (
      x._id !== y._id ||
      (x.color || '') !== (y.color || '') ||
      (x.size || '') !== (y.size || '') ||
      Number(x.quantity || 0) !== Number(y.quantity || 0) ||
      Number(x.price || 0) !== Number(y.price || 0)
    ) {
      return false;
    }
  }
  return true;
}

const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(false);
  const syncingRef = useRef(false);

  // Asegura que el header X-Session-Id esté siempre presente
  useEffect(() => {
    try {
      const sid = getSessionId();
      setApiSessionId(sid);
    } catch {}
  }, []);

  // ---------- Cargar carrito desde la base de datos (mount) ----------
  const syncCart = async () => {
    const sessionId = getSessionId();
    setLoading(true);
    try {
      const res = await api.get(`/api/cart/${encodeURIComponent(sessionId)}`, {
        params: { populate: 1 },
      });
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      const local = items.map(fromBackendItem).filter((x) => x._id);
      if (local.length && !itemsShallowEqual(local, cart)) {
        setCart(local);
      }
    } catch (err) {
      console.log('No hay carrito o error al conectar al backend:', err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    syncCart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- Sincronizar con backend ante cambios ----------
  useEffect(() => {
    const run = async () => {
      const sessionId = getSessionId();
      if (cart.length === 0) return; // la limpieza la maneja clearCart()
      if (syncingRef.current) return;

      const items = cart.map(toBackendItem);
      syncingRef.current = true;
      try {
        const putRes = await api.put(`/api/cart/${encodeURIComponent(sessionId)}`, { items });
        // Tomamos la versión **canónica** del server si viene en la respuesta
        const srvItems = putRes?.data?.cart?.items;
        if (Array.isArray(srvItems)) {
          const mapped = srvItems.map(fromBackendItem).filter((x) => x._id);
          if (!itemsShallowEqual(mapped, cart)) {
            setCart(mapped); // evita drift y respeta precios/ajustes del server
          }
        }
      } catch (err) {
        console.error('❌ Error al sincronizar carrito:', err?.message);
      } finally {
        syncingRef.current = false;
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart]);

  // ---------- Persistencia local ----------
  useEffect(() => {
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // ---------- Búsqueda índice (por _id + color + size) ----------
  const findItemIndex = (product) =>
    cart.findIndex(
      (item) =>
        item._id === product._id &&
        (item.color || '') === (product.color || '') &&
        (item.size || '') === (product.size || '')
    );

  // ---------- Acciones CRUD locales ----------
  const addToCart = (product) => {
    const index = findItemIndex(product);
    const unitPrice = Number(
      product.price ?? product.unitPrice ?? product.priceNumber ?? 0
    );
    const safePrice = Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    const inc = Number(product.quantity || 1) || 1;

    if (index !== -1) {
      const updated = [...cart];
      const nextQty = Math.max(1, Number(updated[index].quantity || 0) + inc);
      updated[index] = { ...updated[index], quantity: nextQty };
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          _id: String(product._id || product.id || ''),
          title: product.title || '',
          image: product.image || '',
          color: product.color || '',
          size: product.size || '',
          quantity: Math.max(1, inc),
          price: safePrice,
        },
      ]);
    }
  };

  const removeFromCart = (_id, color, size) => {
    setCart(
      cart.filter(
        (it) =>
          !(
            it._id === _id &&
            (it.color || '') === (color || '') &&
            (it.size || '') === (size || '')
          )
      )
    );
  };

  const increaseQuantity = (_id, color, size) => {
    setCart(
      cart.map((it) => {
        if (it._id === _id && (it.color || '') === (color || '') && (it.size || '') === (size || '')) {
          return { ...it, quantity: Math.max(1, Number(it.quantity || 0) + 1) };
        }
        return it;
      })
    );
  };

  const decreaseQuantity = (_id, color, size) => {
    setCart(
      cart.map((it) => {
        if (it._id === _id && (it.color || '') === (color || '') && (it.size || '') === (size || '')) {
          const next = Math.max(1, Number(it.quantity || 0) - 1);
          return { ...it, quantity: next };
        }
        return it;
      })
    );
  };

  // ---------- Limpiar / Eliminar documento ----------
  const clearCart = async () => {
    const sessionId = getSessionId();
    try {
      await api.delete(`/api/cart/${encodeURIComponent(sessionId)}`);
      console.log('🧹 Carrito eliminado en MongoDB');
    } catch (err) {
      if (err?.response?.status === 404) {
        console.warn('ℹ️ No hay carrito guardado para esta sesión (aún).');
      } else {
        console.error('❌ Error al eliminar carrito:', err?.message);
      }
    } finally {
      setCart([]);
    }
  };

  // ---------- Validación con backend ----------
  /**
   * Valida el carrito contra stock/precio actuales.
   * mode = 'soft'   → ajusta cantidades a stock, actualiza precios
   * mode = 'strict' → si excede stock, qty=0 (para confirmar pedido)
   * Retorna { items, adjustments, summary, ok, mode }
   */
  const validateCart = async (mode = 'soft') => {
    const sessionId = getSessionId();

    try {
      const { data } = await api.post('/api/cart/validate', { sessionId, mode });
      const items = Array.isArray(data?.items) ? data.items : [];
      const local = items.map(fromBackendItem).filter((x) => x._id);

      // Actualiza el estado local con los valores validados (cantidades y precios)
      if (!itemsShallowEqual(local, cart)) setCart(local);

      return {
        items: local,
        adjustments: Array.isArray(data?.adjustments) ? data.adjustments : [],
        summary: data?.summary || calcSummary(local),
        ok: !!data?.ok,
        mode: data?.mode || mode,
      };
    } catch (err) {
      console.error('❌ Error al validar carrito:', err?.message);
      const summary = calcSummary(cart);
      return { items: cart, adjustments: [], summary, ok: false, mode };
    }
  };

  // ---------- Derivados ----------
  const { totalItems, subtotal } = useMemo(() => calcSummary(cart), [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        totalItems,
        subtotal,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
        validateCart, // úsalo en Checkout si quieres
        syncCart,     // opcional: fuerza recarga desde backend
        API_BASE: api.defaults.baseURL,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
