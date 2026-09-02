// frontend/src/admin/pos/PosSalesPageSafe.jsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  Building2,
  CreditCard,
  Loader2,
  LockKeyhole,
  Minus,
  PackageSearch,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  buildPosIdempotencyKey,
  closePosHeldSale,
  createPosSale,
  getPosBootstrap,
  getPosProducts,
  previewPosSale,
} from '../api/adminPosApi';
import { getCurrentCashSession } from '../api/adminCashSessionApi';
import PosCheckoutPanel from './PosCheckoutPanel';
import PosOperationsPanel from './PosOperationsPanel';
import PosSaleReviewModal from './PosSaleReviewModal';
import {
  buildPosCommercialPayload,
  createInitialDiscount,
  createInitialPaymentDetails,
  paymentLabel,
  validatePosCheckout,
} from './posCheckoutModel';

const REGISTER_CODE = 'CAJA POS';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function rowKey(product = {}) {
  return product.id || `${product.productId || ''}:${product.variantKey || 'default__default'}`;
}

function variantLabel(product = {}) {
  if (String(product.variantLabel || '').trim()) {
    return String(product.variantLabel).trim();
  }
  if (Array.isArray(product.variantAttributes) && product.variantAttributes.length) {
    return product.variantAttributes
      .map((attribute) => String(attribute?.value || '').trim())
      .filter(Boolean)
      .join(' / ');
  }
  return [product.size, product.color].filter(Boolean).join(' / ') || 'Variante general';
}

function clampQty(value, max) {
  const safeMax = Math.max(1, Number(max || 1));
  const qty = Math.max(1, Math.floor(Number(value || 1)));
  return Math.min(qty, safeMax);
}

function orderNumber(order = {}) {
  return order.orderNumber || order.number || order.receiptNumber || order._id || order.id || '';
}

function getPaymentTotals(session = {}) {
  return session?.salesSummary?.paymentTotals || {};
}

function Card({ children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border ${className}`}
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        boxShadow: 'var(--admin-shadow-sm, 0 8px 24px rgba(0,0,0,0.06))',
      }}
    >
      {children}
    </section>
  );
}

function Pill({ icon: Icon, label, value }) {
  return (
    <div
      className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold"
      style={{
        borderColor: 'var(--admin-card-border)',
        background: 'var(--admin-primary-soft-bg)',
        color: 'var(--admin-primary-soft-text)',
      }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="opacity-75">{label}</span>
      <span className="truncate" style={{ color: 'var(--admin-card-text)' }}>{value}</span>
    </div>
  );
}

function ProductImage({ product }) {
  if (product?.image) {
    return <img src={product.image} alt={product.title || ''} className="h-16 w-16 rounded-2xl object-cover" />;
  }

  return (
    <div
      className="flex h-16 w-16 items-center justify-center rounded-2xl border"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}
    >
      <ShoppingBag className="h-6 w-6" />
    </div>
  );
}

function CashStatusPanel({ session, loading, error, required, branchName, onRefresh }) {
  const open = Boolean(session?.id && session?.status === 'open');
  const totals = getPaymentTotals(session);

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              borderColor: open ? '#bbf7d0' : '#fecaca',
              background: open ? '#ecfdf5' : '#fef2f2',
              color: open ? '#047857' : '#b91c1c',
            }}
          >
            {open ? <Wallet className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>
              Estado de caja
            </p>
            {loading ? (
              <p className="mt-1 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Consultando caja...</p>
            ) : open ? (
              <>
                <p className="mt-1 text-sm font-black text-emerald-700">Caja abierta: {session.cashRegisterCode || REGISTER_CODE}</p>
                <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                  {session.sessionCode} · Ventas {session.salesSummary?.ordersCount || 0} · Efectivo esperado {money(session.expectedCash)}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm font-black text-red-700">
                  {required ? 'Debes abrir caja antes de vender' : 'No hay caja abierta'}
                </p>
                <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Sede: {branchName || 'Sin sede'} · Código requerido: {REGISTER_CODE}
                </p>
              </>
            )}
            {error ? <p className="mt-2 text-xs font-bold text-red-700">{error}</p> : null}
          </div>
        </div>

        {open ? (
          <div className="grid gap-2 sm:grid-cols-3 xl:min-w-[430px]">
            <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
              <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Efectivo</p>
              <p className="mt-1 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{money(totals.cash)}</p>
            </div>
            <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
              <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Total vendido</p>
              <p className="mt-1 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{money(session.salesSummary?.netSales)}</p>
            </div>
            <div className="rounded-2xl border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
              <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Esperado</p>
              <p className="mt-1 text-sm font-black" style={{ color: 'var(--admin-primary)' }}>{money(session.expectedCash)}</p>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-60"
            style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Actualizar caja
          </button>
          <Link
            to="/admin/caja"
            className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-white"
            style={{ background: 'var(--admin-primary)' }}
          >
            <Banknote className="h-4 w-4" />
            Ir a caja
          </Link>
        </div>
      </div>
    </Card>
  );
}

function ProductRow({ product, quantityInCart, onAdd, disabled }) {
  const available = Number(product.availableStock || 0);
  const canAdd = available > Number(quantityInCart || 0) && !disabled;

  return (
    <div
      className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between"
      style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}
    >
      <div className="flex min-w-0 gap-3">
        <ProductImage product={product} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{product.title || 'Producto sin nombre'}</p>
          <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
            {product.sku ? <span>SKU: {product.sku}</span> : null}
            {product.barcode ? <span>Código: {product.barcode}</span> : null}
            <span>{variantLabel(product)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>Stock: {available}</span>
            {quantityInCart > 0 ? <span className="rounded-full px-2.5 py-1 text-[11px] font-black" style={{ background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}>En carrito: {quantityInCart}</span> : null}
            {product.category ? <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'var(--admin-card-bg)', color: 'var(--admin-card-muted-text)' }}>{product.category}</span> : null}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 lg:flex-col lg:items-end">
        <strong className="text-base" style={{ color: 'var(--admin-primary)' }}>{money(product.price)}</strong>
        <button
          type="button"
          onClick={() => onAdd(product)}
          disabled={!canAdd}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'var(--admin-primary)' }}
        >
          <Plus className="h-4 w-4" />
          {canAdd ? 'Agregar' : 'Sin stock'}
        </button>
      </div>
    </div>
  );
}

function CartRow({ item, disabled, onAdd, onSub, onRemove }) {
  const canAdd = Number(item.quantity || 1) < Number(item.availableStock || 1) && !disabled;

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{item.title || 'Producto sin nombre'}</p>
          <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{variantLabel(item)} · Stock {item.availableStock}</p>
          <p className="mt-1 text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{money(item.price)} x {item.quantity}</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(item.cartKey)}
          disabled={disabled}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-40"
          style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center rounded-xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
          <button type="button" onClick={() => onSub(item.cartKey)} disabled={disabled} className="flex h-9 w-9 items-center justify-center disabled:opacity-40"><Minus className="h-4 w-4" /></button>
          <span className="min-w-10 px-2 text-center text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>{item.quantity}</span>
          <button type="button" onClick={() => onAdd(item)} disabled={!canAdd} className="flex h-9 w-9 items-center justify-center disabled:opacity-40"><Plus className="h-4 w-4" /></button>
        </div>
        <strong className="text-sm" style={{ color: 'var(--admin-primary)' }}>{money(Number(item.price || 0) * Number(item.quantity || 1))}</strong>
      </div>
    </div>
  );
}

export default function PosSalesPageSafe() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bootstrap, setBootstrap] = useState(null);
  const [branchId, setBranchId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState('');
  const [cartItems, setCartItems] = useState([]);
  const [paymentDetails, setPaymentDetails] = useState(createInitialPaymentDetails);
  const [discount, setDiscount] = useState(createInitialDiscount);
  const [checkoutErrors, setCheckoutErrors] = useState({});
  const [reviewLoading, setReviewLoading] = useState(false);
  const [saleReview, setSaleReview] = useState(null);
  const [saleLoading, setSaleLoading] = useState(false);
  const [saleError, setSaleError] = useState('');
  const [saleSuccess, setSaleSuccess] = useState('');
  const [cashSession, setCashSession] = useState(null);
  const [cashLoading, setCashLoading] = useState(false);
  const [cashError, setCashError] = useState('');
  const [currentHeldSaleId, setCurrentHeldSaleId] = useState('');
  const saleAttemptKeyRef = useRef('');

  const branches = useMemo(() => (Array.isArray(bootstrap?.branches) ? bootstrap.branches : []), [bootstrap]);
  const paymentMethods = useMemo(() => (Array.isArray(bootstrap?.paymentMethods) ? bootstrap.paymentMethods : []), [bootstrap]);
  const selectedBranch = useMemo(() => branches.find((branch) => branch.id === branchId) || bootstrap?.defaultBranch || null, [branches, bootstrap?.defaultBranch, branchId]);
  const billingActive = bootstrap?.billing?.electronicBillingActive === true;
  const permissions = bootstrap?.permissions || {};
  const cashSessionRequired = selectedBranch?.settings?.requireCashSessionForPos === true;
  const hasOpenCashSession = Boolean(cashSession?.id && cashSession?.status === 'open');
  const canReviewSale = cartItems.length > 0 && !saleLoading && !reviewLoading && !cashLoading && (!cashSessionRequired || hasOpenCashSession);

  const cartByKey = useMemo(() => cartItems.reduce((acc, item) => {
    acc[item.cartKey] = item;
    return acc;
  }, {}), [cartItems]);

  const merchandiseSummary = useMemo(() => {
    const subtotal = cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1), 0);
    const totalItems = cartItems.reduce((sum, item) => sum + Number(item.quantity || 1), 0);
    return { subtotal, totalItems };
  }, [cartItems]);

  const checkoutValidation = useMemo(() => validatePosCheckout({
    subtotal: merchandiseSummary.subtotal,
    discount,
    paymentMethod,
    paymentDetails,
    permissions,
  }), [discount, merchandiseSummary.subtotal, paymentDetails, paymentMethod, permissions]);

  const cartSummary = useMemo(() => ({
    ...checkoutValidation.summary,
    totalItems: merchandiseSummary.totalItems,
  }), [checkoutValidation.summary, merchandiseSummary.totalItems]);

  const clearMessages = () => {
    setSaleError('');
    setSaleSuccess('');
    setCheckoutErrors({});
    setSaleReview(null);
  };

  const restoreCustomerSelection = (selection = { mode: 'guest' }) => {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent('pos:restore-customer-selection', {
      detail: selection,
    }));
  };

  const clearCurrentSale = ({ resetCustomer = true } = {}) => {
    setCartItems([]);
    setPaymentDetails(createInitialPaymentDetails());
    setDiscount(createInitialDiscount());
    setCheckoutErrors({});
    setSaleReview(null);
    setCurrentHeldSaleId('');
    saleAttemptKeyRef.current = '';
    if (resetCustomer) restoreCustomerSelection({ mode: 'guest' });
  };

  const holdCurrentSale = (heldSale) => {
    clearCurrentSale();
    setSaleError('');
    setSaleSuccess(`Venta ${heldSale?.code || ''} guardada en espera. El puesto quedó listo para una nueva venta.`);
  };

  const restoreHeldSale = (heldSale = {}) => {
    const restoredItems = Array.isArray(heldSale.items)
      ? heldSale.items.map((item) => ({
          ...item,
          cartKey: rowKey(item),
          quantity: Math.max(1, Number(item.quantity || 1)),
          availableStock: Math.max(Number(item.availableStock || 0), Number(item.quantity || 1)),
          price: Number(item.price ?? item.unitPrice ?? 0),
        }))
      : [];

    setCartItems(restoredItems);
    setPaymentMethod(heldSale.paymentMethod || 'cash');
    setPaymentDetails({
      ...createInitialPaymentDetails(),
      ...(heldSale.paymentDetails || {}),
      splitPayments: Array.isArray(heldSale.paymentDetails?.splitPayments)
        ? heldSale.paymentDetails.splitPayments.map((split, index) => ({
            ...split,
            id: split.id || `restored-${index}-${split.method || 'payment'}`,
          }))
        : createInitialPaymentDetails().splitPayments,
    });
    setDiscount({
      ...createInitialDiscount(),
      ...(heldSale.discount || {}),
    });
    setCurrentHeldSaleId(heldSale.id || '');
    setCheckoutErrors({});
    setSaleReview(null);
    setSaleError('');
    setSaleSuccess(`Venta ${heldSale.code || ''} recuperada. Revisa los datos y el stock antes de cobrar.`);
    saleAttemptKeyRef.current = '';
    restoreCustomerSelection(heldSale.customerSelection || { mode: 'guest' });
  };

  const loadCashSession = async (nextBranchId = branchId) => {
    if (!nextBranchId) {
      setCashSession(null);
      setCashError('');
      return null;
    }

    try {
      setCashLoading(true);
      setCashError('');
      const data = await getCurrentCashSession({ branchId: nextBranchId, cashRegisterCode: REGISTER_CODE });
      const session = data?.session || null;
      setCashSession(session);
      return session;
    } catch (err) {
      setCashSession(null);
      setCashError(err?.message || 'No fue posible consultar la caja abierta.');
      return null;
    } finally {
      setCashLoading(false);
    }
  };

  const loadBootstrap = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await getPosBootstrap();
      const nextBranchId = data?.defaultBranch?.id || data?.branches?.[0]?.id || '';
      setBootstrap(data);
      setBranchId(nextBranchId);
      setPaymentMethod(data?.defaultBranch?.settings?.defaultPaymentMethod || data?.paymentMethods?.[0]?.key || 'cash');
      if (nextBranchId) await loadCashSession(nextBranchId);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar el POS.');
    } finally {
      setLoading(false);
    }
  };

  const addProduct = (product) => {
    if (saleLoading) return;
    const key = rowKey(product);
    const available = Number(product.availableStock || 0);
    if (!key || available <= 0) return;
    clearMessages();

    setCartItems((prev) => {
      const existing = prev.find((item) => item.cartKey === key);
      if (existing) {
        return prev.map((item) => item.cartKey === key ? { ...item, quantity: clampQty(Number(item.quantity || 1) + 1, item.availableStock) } : item);
      }
      return [...prev, { ...product, cartKey: key, quantity: 1, availableStock: available, price: Number(product.price || 0) }];
    });
  };

  const subProduct = (key) => {
    if (saleLoading) return;
    clearMessages();
    setCartItems((prev) => prev.map((item) => item.cartKey === key ? { ...item, quantity: Number(item.quantity || 1) - 1 } : item).filter((item) => Number(item.quantity || 0) > 0));
  };

  const removeProduct = (key) => {
    if (saleLoading) return;
    clearMessages();
    setCartItems((prev) => prev.filter((item) => item.cartKey !== key));
  };

  const buildCurrentPayload = () => buildPosCommercialPayload({
    branchId,
    cartItems: cartItems.map((item) => ({
      ...item,
      variantLabel: item.variantLabel || variantLabel(item),
    })),
    paymentMethod,
    paymentDetails,
    discount,
    total: checkoutValidation.summary.total,
    registerCode: REGISTER_CODE,
  });

  const reviewSale = async () => {
    if (reviewLoading || saleLoading || !branchId || cartItems.length === 0) return;

    if (cashSessionRequired && !hasOpenCashSession) {
      setSaleError('Debes abrir caja antes de confirmar ventas POS. Entra a Caja y abre CAJA POS.');
      return;
    }

    if (!checkoutValidation.valid) {
      setCheckoutErrors(checkoutValidation.errors);
      setSaleError(checkoutValidation.errors.payment || checkoutValidation.errors.discount || checkoutValidation.errors.cart || 'Revisa los datos del cobro.');
      return;
    }

    try {
      setReviewLoading(true);
      setCheckoutErrors({});
      setSaleError('');
      setSaleSuccess('');
      const payload = buildCurrentPayload();
      const data = await previewPosSale(payload);
      setSaleReview({
        preview: data?.preview || null,
        payload,
        soldItems: cartItems.map((item) => ({ ...item })),
      });
    } catch (err) {
      setSaleError(err?.message || 'No fue posible revisar la venta POS.');
    } finally {
      setReviewLoading(false);
    }
  };

  const confirmSale = async () => {
    if (saleLoading || !saleReview?.payload || !saleReview?.preview) return;

    const soldItems = saleReview.soldItems || [];
    const idempotencyKey =
      saleAttemptKeyRef.current || buildPosIdempotencyKey('pos-sale');
    saleAttemptKeyRef.current = idempotencyKey;

    try {
      setSaleLoading(true);
      setSaleError('');
      setSaleSuccess('');
      const data = await createPosSale(saleReview.payload, { idempotencyKey });

      let heldSaleCloseWarning = '';
      if (currentHeldSaleId) {
        try {
          await closePosHeldSale(currentHeldSaleId, {
            reason: 'sold',
            orderId: data?.order?._id || data?.order?.id || '',
          });
        } catch (closeError) {
          console.warn('[PosSalesPage] La venta se creó, pero no se cerró su espera:', closeError?.message || closeError);
          heldSaleCloseWarning = ' La venta fue cobrada, pero debes descartar manualmente su registro en espera.';
        }
      }

      setProducts((prev) => prev.map((product) => {
        const sold = soldItems.find((item) => item.cartKey === rowKey(product));
        if (!sold) return product;
        const availableStock = Math.max(0, Number(product.availableStock || 0) - Number(sold.quantity || 0));
        return { ...product, availableStock, stock: availableStock };
      }).filter((product) => Number(product.availableStock || 0) > 0));

      if (data?.cashSession) setCashSession(data.cashSession);
      else await loadCashSession(branchId);

      clearCurrentSale();
      const number = orderNumber(data?.order || {});
      setSaleSuccess(number ? `Venta POS creada correctamente. Orden ${number}.${heldSaleCloseWarning}` : `Venta POS creada correctamente.${heldSaleCloseWarning}`);
    } catch (err) {
      setSaleError(err?.message || 'No fue posible confirmar la venta POS.');
      setSaleReview(null);
      await loadCashSession(branchId);
    } finally {
      setSaleLoading(false);
    }
  };

  useEffect(() => {
    loadBootstrap();
  }, []);

  useEffect(() => {
    saleAttemptKeyRef.current = '';
    setSaleReview(null);
  }, [branchId, cartItems, discount, paymentDetails, paymentMethod]);

  useEffect(() => {
    const resetAttempt = () => {
      saleAttemptKeyRef.current = '';
      setSaleReview(null);
    };
    window.addEventListener('pos:customer-selection-changed', resetAttempt);
    return () => {
      window.removeEventListener('pos:customer-selection-changed', resetAttempt);
    };
  }, []);

  useEffect(() => {
    setCartItems([]);
    setPaymentDetails(createInitialPaymentDetails());
    setDiscount(createInitialDiscount());
    setCheckoutErrors({});
    setSaleReview(null);
    setSaleError('');
    setSaleSuccess('');
    setCurrentHeldSaleId('');
    restoreCustomerSelection({ mode: 'guest' });
    if (branchId && !loading) loadCashSession(branchId);
  }, [branchId]);

  useEffect(() => {
    if (loading || !branchId) {
      setProducts([]);
      return undefined;
    }

    let active = true;
    const timeout = window.setTimeout(async () => {
      try {
        setProductsLoading(true);
        setProductsError('');
        const data = await getPosProducts({ branchId, q: searchTerm, limit: 30 });
        if (active) setProducts(Array.isArray(data?.products) ? data.products : []);
      } catch (err) {
        if (active) {
          setProducts([]);
          setProductsError(err?.message || 'No fue posible buscar productos POS.');
        }
      } finally {
        if (active) setProductsLoading(false);
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [branchId, loading, searchTerm]);

  return (
    <div className="min-h-full space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>
            <Store className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--admin-card-text)' }}>POS / Ventas físicas</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Registra ventas de mostrador conectadas a órdenes, pagos e inventario por sede.</p>
          </div>
        </div>
        <button type="button" onClick={loadBootstrap} disabled={loading || saleLoading} className="inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)' }}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar POS
        </button>
      </div>

      {error ? <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">No se pudo cargar la información del POS</p><p className="mt-1">{error}</p></div></div> : null}
      {saleSuccess ? <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><BadgeCheck className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Venta confirmada</p><p className="mt-1">{saleSuccess}</p></div></div> : null}

      {loading ? (
        <Card className="flex min-h-[360px] items-center justify-center p-8"><div className="text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Cargando configuración del POS...</p></div></Card>
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <Pill icon={Building2} label="Sede" value={selectedBranch?.name || 'Sin sede POS'} />
            <Pill icon={CreditCard} label="Pago" value={paymentLabel(paymentMethod)} />
            <Pill icon={ReceiptText} label="Facturación" value={billingActive ? `Activa (${bootstrap?.billing?.provider || 'proveedor'})` : 'No activa'} />
          </div>

          <CashStatusPanel
            session={cashSession}
            loading={cashLoading}
            error={cashError}
            required={cashSessionRequired}
            branchName={selectedBranch?.name || ''}
            onRefresh={() => loadCashSession(branchId)}
          />

          <PosOperationsPanel
            branchId={branchId}
            branchName={selectedBranch?.name || ''}
            cartItems={cartItems}
            paymentMethod={paymentMethod}
            paymentDetails={paymentDetails}
            discount={discount}
            permissions={permissions}
            currentHeldSaleId={currentHeldSaleId}
            disabled={saleLoading || reviewLoading}
            onHeld={holdCurrentSale}
            onRestore={restoreHeldSale}
            onDiscardCurrent={() => clearCurrentSale()}
          />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
            <div className="space-y-5">
              <Card className="p-5">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.65fr)] lg:items-end">
                  <div>
                    <label className="mb-2 block text-xs font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-card-muted-text)' }}>Sede de venta</label>
                    <select value={branchId} onChange={(event) => setBranchId(event.target.value)} disabled={saleLoading} className="w-full rounded-xl border bg-transparent px-4 py-3 text-sm font-bold outline-none disabled:opacity-60" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)', background: 'var(--admin-card-bg)' }}>
                      {branches.length === 0 ? <option value="">No hay sedes habilitadas para POS</option> : branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} - {branch.code}</option>)}
                    </select>
                  </div>
                  <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
                    <p className="text-xs font-black" style={{ color: 'var(--admin-card-text)' }}>Cobro protegido</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>El medio, el descuento y el cambio se validan antes de crear la orden.</p>
                  </div>
                </div>
              </Card>

              <Card className="overflow-hidden">
                <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Buscar productos</h2><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Consulta el inventario disponible de la sede seleccionada.</p></div><PackageSearch className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} /></div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
                    <Search className="h-5 w-5 shrink-0" style={{ color: 'var(--admin-card-muted-text)' }} />
                    <input type="text" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} disabled={saleLoading} placeholder="Buscar por nombre, SKU o código de barras" className="w-full bg-transparent text-sm font-semibold outline-none disabled:opacity-60" style={{ color: 'var(--admin-card-text)' }} />
                    {productsLoading ? <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--admin-primary)' }} /> : null}
                  </div>
                  {productsError ? <div className="mt-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">No se pudo buscar productos</p><p className="mt-1">{productsError}</p></div></div> : null}
                  {!productsError && productsLoading ? <div className="mt-5 rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}><Loader2 className="mx-auto h-8 w-8 animate-spin" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Buscando productos...</p></div> : null}
                  {!productsError && !productsLoading && products.length === 0 ? <div className="mt-5 rounded-2xl border p-8 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-primary-soft-bg)' }}><ShoppingBag className="mx-auto h-9 w-9" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>No hay productos con stock disponible</p><p className="mx-auto mt-2 max-w-md text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Cuando exista stock en la sede, aquí aparecerán los productos para agregarlos al carrito.</p></div> : null}
                  {!productsError && !productsLoading && products.length > 0 ? <div className="mt-5 space-y-3">{products.map((product) => { const key = rowKey(product); return <ProductRow key={key} product={product} quantityInCart={Number(cartByKey[key]?.quantity || 0)} onAdd={addProduct} disabled={saleLoading} />; })}</div> : null}
                </div>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="border-b p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
                <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-black" style={{ color: 'var(--admin-card-text)' }}>Carrito de venta</h2><p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>{cartItems.length > 0 ? `${cartSummary.totalItems} producto(s) agregados` : 'Resumen de productos, descuentos y pago.'}</p></div>{cartItems.length > 0 ? <button type="button" onClick={() => { if (!saleLoading) { clearMessages(); setCartItems([]); } }} disabled={saleLoading} className="rounded-xl border px-3 py-2 text-xs font-black disabled:opacity-40" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>Vaciar</button> : null}</div>
              </div>
              <div className="space-y-4 p-5">
                {cartItems.length === 0 ? <div className="rounded-2xl border p-5 text-center" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}><ReceiptText className="mx-auto h-8 w-8" style={{ color: 'var(--admin-primary)' }} /><p className="mt-3 text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Sin productos agregados</p><p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Agrega productos desde el buscador para calcular la venta.</p></div> : <div className="space-y-3">{cartItems.map((item) => <CartRow key={item.cartKey} item={item} disabled={saleLoading} onAdd={addProduct} onSub={subProduct} onRemove={removeProduct} />)}</div>}
                {cashSessionRequired && !hasOpenCashSession ? <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Caja cerrada</p><p className="mt-1">Abre CAJA POS en el módulo Caja para poder vender.</p></div></div> : null}
                <PosCheckoutPanel
                  subtotal={merchandiseSummary.subtotal}
                  paymentMethods={paymentMethods}
                  paymentMethod={paymentMethod}
                  paymentDetails={paymentDetails}
                  discount={discount}
                  permissions={permissions}
                  validationErrors={checkoutErrors}
                  disabled={saleLoading || reviewLoading || cartItems.length === 0}
                  onPaymentMethodChange={(nextMethod) => {
                    clearMessages();
                    setPaymentMethod(nextMethod);
                    setPaymentDetails((current) => ({ ...current, reference: '' }));
                  }}
                  onPaymentDetailsChange={(nextDetails) => {
                    clearMessages();
                    setPaymentDetails(nextDetails);
                  }}
                  onDiscountChange={(nextDiscount) => {
                    clearMessages();
                    setDiscount(nextDiscount);
                  }}
                />
                {saleError ? <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">Revisa la venta</p><p className="mt-1">{saleError}</p></div></div> : null}
                <div className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Subtotal</span><strong style={{ color: 'var(--admin-card-text)' }}>{money(cartSummary.subtotal)}</strong></div>
                  <div className="flex items-center justify-between text-sm"><span style={{ color: 'var(--admin-card-muted-text)' }}>Descuento</span><strong style={{ color: 'var(--admin-card-text)' }}>- {money(cartSummary.discount)}</strong></div>
                  <div className="h-px" style={{ background: 'var(--admin-card-border)' }} />
                  <div className="flex items-center justify-between text-base"><span className="font-black" style={{ color: 'var(--admin-card-text)' }}>Total</span><strong className="text-xl" style={{ color: 'var(--admin-primary)' }}>{money(cartSummary.total)}</strong></div>
                </div>
                <button type="button" disabled={!canReviewSale} onClick={reviewSale} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background: 'var(--admin-primary)' }}>
                  {reviewLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <BadgeCheck className="h-5 w-5" />}
                  {reviewLoading ? 'Validando venta...' : cashSessionRequired && !hasOpenCashSession ? 'Abre caja para vender' : 'Revisar y cobrar'}
                </button>
              </div>
            </Card>
          </div>
        </>
      )}
      <PosSaleReviewModal
        review={saleReview}
        saving={saleLoading}
        error={saleError}
        onClose={() => { if (!saleLoading) setSaleReview(null); }}
        onConfirm={confirmSale}
      />
    </div>
  );
}
