// src/context/CartContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import api, { setSessionId as setApiSessionId } from '../lib/api';
import {
  buildCartAccessHeaders,
  getCartAccess,
  storeCartAccess,
} from '../utils/cartAccess';
import {
  applyCartOperation,
  cartItemIdentity,
  createCartMutationCoordinator,
  normalizeCartSnapshot,
  writeVersionedCart,
} from '../utils/cartMutationConcurrency';
import {
  buildCartRecoveryHeaders,
  clearCartRecoveryFragment,
  readCartRecoveryFragment,
} from '../utils/cartRecoveryAccess';
import {
  readCartSnapshot,
  storeCartSnapshot,
} from '../utils/cartSnapshotStorage';

function clean(value) {
  return String(value || '').trim();
}

function readVariantId(item = {}) {
  return clean(
    item.variantId ||
      item.variantKey ||
      item.selectedVariantId ||
      item.selectedVariantKey ||
      ''
  );
}

function normalizeVariantAttributes(attributes = []) {
  const normalized = [];
  const seen = new Set();

  (Array.isArray(attributes) ? attributes : []).forEach((attribute) => {
    const key = clean(
      attribute?.key || attribute?.name || attribute?.label
    ).toLowerCase();
    const label = clean(attribute?.label || attribute?.name || attribute?.key);
    const value = clean(attribute?.value);
    if (!key || !value || seen.has(key) || normalized.length >= 4) return;
    seen.add(key);
    normalized.push({ key, label: label || key, value });
  });

  return normalized;
}

// ---------- Helpers de mapeo ----------
/**
 * Convierte un item local (estado UI) al formato que espera el backend.
 * Local: { _id, title, image, color, size, variantId, quantity, price }
 * Backend: { productId, qty, price, title, image, color, size, variantId }
 */
function toBackendItem(it) {
  const productId =
    it.productId ||
    it._id ||
    (it.product && (it.product._id || it.product.id)) ||
    it.id ||
    '';
  const qty = Number(it.qty ?? it.quantity ?? 1) || 1;
  const price = Number(it.price ?? it.unitPrice ?? it.priceNumber ?? 0) || 0;
  const variantId = readVariantId(it);

  return {
    productId: String(productId),
    qty,
    quantity: qty,
    title: it.title || (it.product && it.product.title) || '',
    image: it.image || (it.product && it.product.image) || '',
    color: it.colorValue || it.color || '',
    colorLabel: it.colorLabel || it.color || '',
    size: it.size || '',
    variantId,
    variantKey: clean(it.variantKey || variantId),
    variantLabel: clean(it.variantLabel || it.selectedVariant?.label),
    variantAttributes: normalizeVariantAttributes(
      it.variantAttributes || it.attributes || it.selectedVariant?.attributes
    ),
    price,
    productType: it.productType || it?.product?.productType || 'physical',
    requiresShipping:
      it.requiresShipping ?? it?.product?.requiresShipping ?? true,
    fulfillment: it.fulfillment || it?.product?.fulfillment || null,
  };
}

/**
 * Convierte un item que viene del backend al formato local.
 */
function fromBackendItem(it) {
  const p =
    it?.product && typeof it.product === 'object'
      ? it.product
      : typeof it.productId === 'object'
        ? it.productId
        : null;
  const _id = p?._id || it.productId || it._id || it.id;
  const qty = Number(it.qty ?? it.quantity ?? 0) || 0;
  const price = Number(it.price ?? p?.price ?? 0) || 0;
  const variantId = readVariantId(it);

  return {
    _id: String(_id || ''),
    title: it.title || p?.title || '',
    image: it.image || p?.image || '',
    color: it.colorLabel || it.color || '',
    colorValue: it.color || it.colorValue || '',
    colorLabel: it.colorLabel || it.color || '',
    size: it.size || '',
    variantId,
    variantKey: clean(it.variantKey || variantId),
    variantLabel: clean(it.variantLabel),
    variantAttributes: normalizeVariantAttributes(
      it.variantAttributes || it.attributes
    ),
    quantity: qty,
    price,
    slug: p?.slug,
    sku: it.variantSku || p?.sku || p?.skun || '',
    barcode: it.variantBarcode || p?.barcode || '',
    productType: it.productType || p?.productType || 'physical',
    requiresShipping: it.requiresShipping ?? p?.requiresShipping ?? true,
    fulfillment: it.fulfillment || p?.fulfillment || null,
    availableStock:
      it.availableStock == null ? null : Number(it.availableStock),
    inventoryTracked: it.inventoryTracked === true,
    purchasable: it.purchasable !== false && it.valid !== false,
    validationMessage: clean(it.validationMessage),
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

function readStoredCart() {
  try {
    const access = getCartAccess();
    const saved = readCartSnapshot(access?.sessionId);
    if (saved) return saved;
    const stored = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(stored)
      ? stored.filter((item) => item && item._id)
      : [];
  } catch {
    return [];
  }
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
      (x.title || '') !== (y.title || '') ||
      (x.image || '') !== (y.image || '') ||
      (x.color || '') !== (y.color || '') ||
      (x.colorValue || '') !== (y.colorValue || '') ||
      (x.colorLabel || '') !== (y.colorLabel || '') ||
      (x.size || '') !== (y.size || '') ||
      readVariantId(x) !== readVariantId(y) ||
      (x.variantLabel || '') !== (y.variantLabel || '') ||
      JSON.stringify(normalizeVariantAttributes(x.variantAttributes)) !==
        JSON.stringify(normalizeVariantAttributes(y.variantAttributes)) ||
      Number(x.quantity || 0) !== Number(y.quantity || 0) ||
      Number(x.price || 0) !== Number(y.price || 0) ||
      (x.productType || 'physical') !== (y.productType || 'physical') ||
      (x.requiresShipping !== false) !== (y.requiresShipping !== false)
    ) {
      return false;
    }
  }
  return true;
}

export const CartContext = createContext();

export function CartProvider({ children }) {
  const [cart, setCart] = useState(readStoredCart);
  const [loading, setLoading] = useState(false);
  const [cartMessage, setCartMessage] = useState('');
  const [pendingOperations, setPendingOperations] = useState(0);
  const [syncError, setSyncError] = useState(false);
  const cartRef = useRef(cart);
  const authoritativeRef = useRef({ items: cart, version: '' });
  const creatingRef = useRef(null);
  const coordinatorRef = useRef(null);
  const recoveryClaimRef = useRef(false);
  const refreshingRef = useRef(null);

  const adoptSnapshot = (value, { updateUi = true } = {}) => {
    const snapshot = normalizeCartSnapshot(value);
    const local = snapshot.items
      .map(fromBackendItem)
      .filter((item) => item._id);
    const normalized = { items: local, version: snapshot.version };
    authoritativeRef.current = normalized;
    storeCartSnapshot(getCartAccess()?.sessionId, local);
    setSyncError(false);
    if (updateUi) {
      cartRef.current = local;
      setCart(local);
    }
    return normalized;
  };

  const createRemoteCart = async (items) => {
    if (creatingRef.current) return creatingRef.current;
    const creation = api
      .post('/api/cart', { items })
      .then(({ data }) => {
        const sessionId = String(
          data?.sessionId || data?.cart?.sessionId || ''
        ).trim();
        const token = String(data?.cartAccessToken || '').trim();
        if (!storeCartAccess(sessionId, token)) {
          throw new Error(
            'No fue posible conservar el acceso seguro al carrito.'
          );
        }
        const snapshot = adoptSnapshot({
          cart: data?.cart || { items },
          version: data?.version || data?.cart?.updatedAt,
        });
        return { sessionId, token, version: snapshot.version };
      })
      .finally(() => {
        creatingRef.current = null;
      });
    creatingRef.current = creation;
    return creation;
  };

  const loadRemoteCart = async (access = getCartAccess()) => {
    if (!access) throw new Error('CART_ACCESS_NOT_FOUND');
    const response = await api.get(
      `/api/cart/${encodeURIComponent(access.sessionId)}`,
      {
        params: { populate: 1 },
        headers: buildCartAccessHeaders(access),
      }
    );
    return adoptSnapshot(response.data || {});
  };

  const createValidatedCart = async (items) => {
    const { data } = items.length
      ? await api.post('/api/cart/validate', { items, mode: 'soft' })
      : { data: { items: [], adjustments: [] } };
    if (!Array.isArray(data?.items))
      throw new Error('No se pudo validar el carrito guardado.');
    const restored = data.items.filter(
      (item) => Number(item.qty ?? item.quantity) > 0
    );
    const access = await createRemoteCart(restored);
    return { access, adjustments: data.adjustments || [] };
  };

  const ensureCartReady = async (items) => {
    const existing = getCartAccess();
    if (existing) {
      if (!authoritativeRef.current.version) await loadRemoteCart(existing);
      return { ...existing, version: authoritativeRef.current.version };
    }
    // The public validator canonicalizes only the browser's own saved selection.
    // Commit new credentials and items only after successful server creation.
    const { access, adjustments } = await createValidatedCart(
      Array.isArray(items) ? items : cartRef.current.map(toBackendItem)
    );
    if (adjustments.length) {
      toast.info(
        'Actualizamos los precios y la disponibilidad de tu carrito guardado.'
      );
    }
    return access;
  };

  const renewCartAccess = async () => {
    const access = getCartAccess();
    if (!access) throw new Error('CART_ACCESS_NOT_FOUND');
    const { data } = await api.post(
      `/api/cart/${encodeURIComponent(access.sessionId)}/access/refresh`,
      null,
      { headers: buildCartAccessHeaders(access) }
    );
    const sessionId = clean(data?.sessionId);
    const token = clean(data?.cartAccessToken);
    if (!storeCartAccess(sessionId, token)) {
      throw new Error('CART_ACCESS_REFRESH_INVALID');
    }
    setApiSessionId(sessionId);
    const version = clean(data?.version);
    authoritativeRef.current = {
      ...authoritativeRef.current,
      version,
    };
    return { sessionId, token, version };
  };

  const writeCartVersion = async ({ items, version }) => {
    const access = getCartAccess();
    if (!access) throw new Error('CART_ACCESS_NOT_FOUND');
    const response = await writeVersionedCart({
      api,
      access,
      version,
      items: items.map(toBackendItem),
    });
    return {
      cart: response?.data?.cart,
      version: response?.data?.version,
    };
  };

  const recoverMissingCart = async (operation) => {
    // A privacy-preserving 404 means missing OR unauthorized. It is never proof
    // that the customer's selection should be erased. Rebuild a new capability
    // from the last confirmed local items, without reading the inaccessible cart.
    const previous = authoritativeRef.current;
    const desired = applyCartOperation(previous.items, operation);
    try {
      const { adjustments } = await createValidatedCart(
        desired.map(toBackendItem)
      );
      const message = adjustments.length
        ? 'Recuperamos tu carrito y actualizamos los precios y la disponibilidad de los productos.'
        : 'Recuperamos tu carrito conservando tus productos.';
      setCartMessage(message);
      toast.info(message, { toastId: 'cart-recovered' });
      return { ...authoritativeRef.current, recoveredMissingCart: true };
    } catch (error) {
      adoptSnapshot(previous);
      setSyncError(true);
      const message =
        'No pudimos recuperar el acceso al carrito. Conservamos tus productos; vuelve a intentarlo.';
      setCartMessage(message);
      toast.error(message, { toastId: 'cart-recovery-failed' });
      throw error;
    }
  };

  coordinatorRef.current ||= createCartMutationCoordinator({
    getSnapshot: async () => {
      await ensureCartReady(authoritativeRef.current.items.map(toBackendItem));
      return authoritativeRef.current;
    },
    write: writeCartVersion,
    reload: async () => {
      const access =
        getCartAccess() ||
        (await ensureCartReady(
          authoritativeRef.current.items.map(toBackendItem)
        ));
      const response = await api.get(
        `/api/cart/${encodeURIComponent(access.sessionId)}`,
        {
          params: { populate: 1 },
          headers: buildCartAccessHeaders(access),
        }
      );
      return response.data || {};
    },
    adopt: (snapshot) => adoptSnapshot(snapshot),
    onTerminalConflict: () => {
      const message =
        'El carrito volvió a cambiar. Conservamos la versión más reciente.';
      setCartMessage(message);
      toast.error(message, { toastId: 'cart-write-conflict' });
    },
    onRejected: (error, _snapshot, operation, recovery = {}) => {
      const invalidItems = Array.isArray(error?.response?.data?.items)
        ? error.response.data.items
        : [];
      const affected = invalidItems[0] || {};
      const productName = String(
        affected.title || operation?.item?.title || 'Este producto'
      ).trim();
      const reasonMessages = {
        OUT_OF_STOCK: 'se agotó',
        INSUFFICIENT_STOCK: 'no tiene suficientes unidades disponibles',
        INVALID_VARIANT: 'ya no tiene disponible la opción seleccionada',
        PRODUCT_NOT_AVAILABLE: 'ya no está disponible',
        PRODUCT_NOT_FOUND: 'ya no se encuentra en el catálogo',
        INVALID_QUANTITY: 'tiene una cantidad no válida',
        PRODUCT_PRICE_INVALID: 'requiere actualizar su precio',
      };
      const reason = reasonMessages[affected.invalidReason || affected.reason];
      if (!authoritativeRef.current.version) setSyncError(true);
      const message = recovery.recovered
        ? `Retiramos “${productName}” porque ${reason || 'requiere revisión'}. El nuevo producto sí se agregó.`
        : invalidItems.length
          ? `${productName} ${reason || 'no se puede agregar en este momento'}.`
          : 'No fue posible actualizar el carrito. Conservamos su estado anterior.';
      setCartMessage(message);
      const notify = invalidItems.length ? toast.warning : toast.error;
      notify(message, {
        toastId: invalidItems.length
          ? 'cart-item-unavailable'
          : 'cart-update-rejected',
      });
    },
    onMissingCart: recoverMissingCart,
    getFallbackSnapshot: () => authoritativeRef.current,
  });

  const enqueueCartOperation = (operation, { optimistic = true } = {}) => {
    if (optimistic) {
      const optimisticCart = applyCartOperation(cartRef.current, operation);
      cartRef.current = optimisticCart;
      setCart(optimisticCart);
    }
    setPendingOperations((value) => value + 1);
    setCartMessage('');
    return coordinatorRef.current
      .enqueue(operation)
      .catch((error) => {
        if (error?.code !== 'CART_WRITE_CONFLICT') {
          console.error('Error al sincronizar carrito:', error?.message);
        }
        throw error;
      })
      .finally(() => setPendingOperations((value) => Math.max(0, value - 1)));
  };

  // Asegura que el header X-Session-Id esté siempre presente
  useEffect(() => {
    try {
      const access = getCartAccess();
      if (access?.sessionId) setApiSessionId(access.sessionId);
    } catch {}
  }, []);

  useEffect(() => {
    if (recoveryClaimRef.current) return;
    const recovery = readCartRecoveryFragment();
    if (!recovery) return;
    recoveryClaimRef.current = true;
    clearCartRecoveryFragment();
    setLoading(true);
    api
      .post('/api/cart/recovery/claim', null, {
        headers: buildCartRecoveryHeaders(recovery),
      })
      .then(({ data }) => {
        const sessionId = clean(data?.sessionId);
        const token = clean(data?.cartAccessToken);
        if (!storeCartAccess(sessionId, token)) {
          throw new Error('CART_RECOVERY_ACCESS_INVALID');
        }
        setApiSessionId(sessionId);
        adoptSnapshot({
          cart: data?.cart,
          version: data?.version || data?.cart?.version,
        });
        toast.success('Tu carrito fue recuperado de forma segura.');
      })
      .catch(() => {
        toast.error('El enlace de recuperacion no es valido o ya expiro.');
      })
      .finally(() => {
        recoveryClaimRef.current = false;
        setLoading(false);
      });
  }, []);

  // Refreshes share the mutation queue and one in-flight request.
  const syncCart = () => {
    if (refreshingRef.current) return refreshingRef.current;
    if (!getCartAccess() && !authoritativeRef.current.items.length)
      return Promise.resolve(true);
    setLoading(true);
    const request = coordinatorRef.current
      .enqueue({ type: 'refresh' })
      .then(() => {
        setCartMessage('');
        return true;
      })
      .catch(() => {
        setSyncError(true);
        setCartMessage(
          'No se pudo actualizar el carrito. Revisa tu conexión e inténtalo de nuevo.'
        );
        return false;
      })
      .finally(() => {
        refreshingRef.current = null;
        setLoading(false);
      });
    refreshingRef.current = request;
    return request;
  };

  useEffect(() => {
    const refresh = () => {
      if (
        !recoveryClaimRef.current &&
        (getCartAccess() || authoritativeRef.current.items.length) &&
        !readCartRecoveryFragment()
      )
        void syncCart();
    };
    refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  // ---------- Persistencia local ----------
  useEffect(() => {
    cartRef.current = cart;
    try {
      localStorage.setItem('cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);

  // ---------- Acciones CRUD locales ----------
  const addToCart = (product) => {
    const unitPrice = Number(
      product.price ?? product.unitPrice ?? product.priceNumber ?? 0
    );
    const safePrice =
      Number.isFinite(unitPrice) && unitPrice >= 0 ? unitPrice : 0;
    const inc = Number(product.quantity || 1) || 1;
    const variantId = readVariantId(product);
    const item = {
      _id: String(product._id || product.id || ''),
      title: product.title || '',
      image: product.image || '',
      color: product.color || product.colorLabel || '',
      colorValue: product.colorValue || '',
      colorLabel: product.colorLabel || product.color || '',
      size: product.size || '',
      variantId,
      variantKey: product.variantKey || variantId,
      variantLabel:
        product.variantLabel || product.selectedVariant?.label || '',
      variantAttributes: normalizeVariantAttributes(
        product.variantAttributes ||
          product.attributes ||
          product.selectedVariant?.attributes
      ),
      variantSku:
        product.variantSku || product.selectedVariant?.sku || product.sku || '',
      variantBarcode:
        product.variantBarcode ||
        product.selectedVariant?.barcode ||
        product.barcode ||
        '',
      productType: product.productType || 'physical',
      requiresShipping: product.requiresShipping !== false,
      fulfillment: product.fulfillment || null,
      quantity: Math.max(1, inc),
      price: safePrice,
    };
    void enqueueCartOperation({ type: 'add', item }).catch(() => undefined);
  };

  const removeFromCart = (_id, color, size, variantId = '') => {
    const identity = cartItemIdentity({
      _id,
      color,
      size,
      variantId,
      variantKey: variantId,
    });
    void enqueueCartOperation({ type: 'remove', identity }).catch(
      () => undefined
    );
  };

  const increaseQuantity = (_id, color, size, variantId = '') => {
    const identity = cartItemIdentity({
      _id,
      color,
      size,
      variantId,
      variantKey: variantId,
    });
    void enqueueCartOperation({ type: 'increase', identity }).catch(
      () => undefined
    );
  };

  const decreaseQuantity = (_id, color, size, variantId = '') => {
    const identity = cartItemIdentity({
      _id,
      color,
      size,
      variantId,
      variantKey: variantId,
    });
    void enqueueCartOperation({ type: 'decrease', identity }).catch(
      () => undefined
    );
  };

  // ---------- Vaciar sin borrar la credencial ni la sesion ----------
  const clearCart = async () => {
    try {
      const targetIdentities = cartRef.current.map(cartItemIdentity);
      await enqueueCartOperation({ type: 'clear', targetIdentities });
    } catch (err) {
      console.error('Error al vaciar carrito:', err?.message);
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
    await coordinatorRef.current.waitForIdle();
    try {
      const access = await ensureCartReady(cartRef.current.map(toBackendItem));
      const { data } = await api.post(
        '/api/cart/validate',
        {
          sessionId: access.sessionId,
          mode,
        },
        {
          headers: buildCartAccessHeaders(access),
        }
      );
      const items = Array.isArray(data?.items) ? data.items : [];
      const local = items.map(fromBackendItem).filter((x) => x._id);

      if (!itemsShallowEqual(local, authoritativeRef.current.items)) {
        await enqueueCartOperation(
          { type: 'replace_validated', items: local },
          { optimistic: true }
        );
      } else if (data?.version) {
        authoritativeRef.current = {
          ...authoritativeRef.current,
          version: clean(data.version),
        };
      }

      return {
        items: cartRef.current,
        adjustments: Array.isArray(data?.adjustments) ? data.adjustments : [],
        summary: data?.summary || calcSummary(cartRef.current),
        ok: !!data?.ok,
        mode: data?.mode || mode,
        version: authoritativeRef.current.version || clean(data?.version),
        orderSnapshotFingerprint: clean(data?.orderSnapshotFingerprint),
      };
    } catch (err) {
      console.error('Error al validar carrito:', err?.message);
      const current = cartRef.current;
      return {
        items: current,
        adjustments: [],
        summary: calcSummary(current),
        ok: false,
        mode,
        version: authoritativeRef.current.version,
        orderSnapshotFingerprint: '',
      };
    }
  };

  // ---------- Derivados ----------
  const { totalItems, subtotal } = useMemo(() => calcSummary(cart), [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartVersion: authoritativeRef.current.version,
        cartMessage,
        loading: loading || pendingOperations > 0,
        syncing: loading,
        syncError,
        pendingOperations,
        totalItems,
        subtotal,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        clearCart,
        validateCart,
        ensureCartReady: async (...args) => {
          await coordinatorRef.current.waitForIdle();
          return ensureCartReady(...args);
        },
        renewCartAccess,
        syncCart,
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
