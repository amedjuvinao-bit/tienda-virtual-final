import { useEffect } from 'react';
import api from '../../lib/api';
import { buildCartAccessHeaders } from '../../utils/cartAccess';
import { getSessionId } from '../../utils/getSessionId';
import {
  EMPTY_STORE_CREDIT_PREVIEW,
  getItemQuantity,
} from './checkoutPageModel';

export default function useCheckoutQuote({ state, derived, ensureCartReady }) {
  const {
    appliedCoupon,
    customerCity,
    customerCountry,
    customerEmailOrPhone,
    customerId,
    customerPhone,
    deliveryType,
    discountCode,
    paymentsConfig,
    selectedRegion,
    setAppliedCoupon,
    setCheckoutQuote,
    setCouponError,
    setCouponMessage,
    setDiscountCode,
    setQuoteLoading,
    setStoreCreditAmount,
    setStoreCreditPreview,
    setUseStoreCredit,
  } = state;
  const { currentCart, selectedCountry, total } = derived;

  useEffect(() => {
    setStoreCreditPreview({ ...EMPTY_STORE_CREDIT_PREVIEW });
    setUseStoreCredit(false);
    setStoreCreditAmount('');
  }, [
    customerEmailOrPhone,
    customerId,
    customerPhone,
    setStoreCreditAmount,
    setStoreCreditPreview,
    setUseStoreCredit,
  ]);

  const buildQuoteRequestPayload = (couponCode = '') => ({
    sessionId: getSessionId(),
    items: (currentCart || []).map((item) => ({
      productId: String(
        item.productId || item._id || item.id || item?.product?._id || ''
      ),
      title: item.title || item?.product?.title || '',
      image: item.image || item?.product?.image || '',
      color: item.color || '',
      size: item.size || '',
      variantId: item.variantId || item.variantKey || '',
      variantKey: item.variantKey || item.variantId || '',
      variantLabel: item.variantLabel || '',
      variantAttributes: Array.isArray(item.variantAttributes)
        ? item.variantAttributes
        : [],
      quantity: getItemQuantity(item),
      price: Number(item.price ?? item?.product?.price ?? 0),
      productType: item.productType || item?.product?.productType || 'physical',
      requiresShipping:
        item.requiresShipping ?? item?.product?.requiresShipping ?? true,
      fulfillment: item.fulfillment || item?.product?.fulfillment || null,
    })),
    customer: {
      deliveryType,
      country: customerCountry,
      countryCode: selectedCountry?.code || '',
      department: selectedRegion,
      departmentCode: selectedRegion,
      city: customerCity,
      email: String(customerEmailOrPhone || '').includes('@')
        ? String(customerEmailOrPhone || '').trim()
        : '',
      emailOrPhone: customerEmailOrPhone,
    },
    couponCode,
  });

  const handleApplyCoupon = () => {
    const code = String(discountCode || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    if (!code) {
      setAppliedCoupon(null);
      setCouponMessage('');
      setCouponError('Ingresa un código de descuento.');
      return;
    }
    setCouponError('');
    setCouponMessage('Validando cupón...');
    setAppliedCoupon({ code });
  };

  const handlePreviewStoreCredit = async () => {
    const documentNumber = String(customerId || '').replace(/\D/g, '');
    const contact = String(customerEmailOrPhone || '').trim();
    const phone = String(customerPhone || '').trim();
    if (documentNumber.length < 4 || (!contact && !phone)) {
      setStoreCreditPreview({
        ...EMPTY_STORE_CREDIT_PREVIEW,
        status: 'error',
        currency: paymentsConfig.currency || 'COP',
        message:
          'Escribe primero la cédula y el correo o teléfono usados en tus compras.',
      });
      return;
    }

    setStoreCreditPreview({
      ...EMPTY_STORE_CREDIT_PREVIEW,
      status: 'checking',
      currency: paymentsConfig.currency || 'COP',
      message: 'Comprobando saldo...',
    });
    setUseStoreCredit(false);
    setStoreCreditAmount('');

    try {
      const cartAccess = await ensureCartReady();
      const { data } = await api.post(
        `/api/cart/${encodeURIComponent(cartAccess.sessionId)}/store-credit/preview`,
        {
          documentNumber,
          emailOrPhone: contact,
          phone,
          currency: paymentsConfig.currency || 'COP',
        },
        { headers: buildCartAccessHeaders(cartAccess) }
      );
      const balance = Math.max(0, Number(data?.balance || 0));
      if (data?.eligible !== true || balance <= 0 || !data?.accessToken) {
        setStoreCreditPreview({
          ...EMPTY_STORE_CREDIT_PREVIEW,
          status: 'ready',
          currency: data?.currency || paymentsConfig.currency || 'COP',
          message: 'No encontramos saldo a favor disponible con esos datos.',
        });
        return;
      }
      const initialAmount = Math.min(balance, total);
      setStoreCreditPreview({
        status: 'ready',
        eligible: true,
        balance,
        currency: data.currency || paymentsConfig.currency || 'COP',
        accessToken: data.accessToken,
        accessExpiresAt: data.accessExpiresAt || null,
        message: 'Saldo disponible. Puedes aplicarlo a esta compra.',
      });
      setStoreCreditAmount(String(initialAmount));
      setUseStoreCredit(true);
    } catch (error) {
      setStoreCreditPreview({
        ...EMPTY_STORE_CREDIT_PREVIEW,
        status: 'error',
        currency: paymentsConfig.currency || 'COP',
        message:
          error?.response?.data?.message ||
          'No fue posible comprobar el saldo en este momento.',
      });
    }
  };

  useEffect(() => {
    if (!Array.isArray(currentCart) || currentCart.length === 0) {
      setCheckoutQuote(null);
      setQuoteLoading(false);
      return undefined;
    }
    let cancelled = false;
    const couponCode = appliedCoupon?.code || '';
    const timer = window.setTimeout(async () => {
      try {
        setQuoteLoading(true);
        const { data } = await api.post(
          '/api/orders/quote',
          buildQuoteRequestPayload(couponCode)
        );
        if (cancelled) return;
        setCheckoutQuote(data || null);
        if (couponCode && data?.coupon) {
          setCouponError('');
          setAppliedCoupon(data.coupon);
          setDiscountCode(data.coupon.code || couponCode);
          setCouponMessage(
            data.coupon.message || 'Cupón aplicado correctamente.'
          );
        } else if (!couponCode) {
          setCouponMessage('');
        }
      } catch (error) {
        if (cancelled) return;
        const response = error?.response?.data || {};
        if (response.pricing) setCheckoutQuote({ pricing: response.pricing });
        if (couponCode) {
          setAppliedCoupon(null);
          setCouponMessage('');
          setCouponError(
            response.message ||
              error?.userMessage ||
              'No se pudo aplicar el cupón.'
          );
        }
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    currentCart,
    deliveryType,
    customerCountry,
    selectedCountry?.code,
    selectedRegion,
    customerCity,
    customerEmailOrPhone,
    appliedCoupon?.code,
  ]);

  return { handleApplyCoupon, handlePreviewStoreCredit };
}
