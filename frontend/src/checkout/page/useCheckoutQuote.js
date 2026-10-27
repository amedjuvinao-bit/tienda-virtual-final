import { useEffect, useRef, useState } from 'react';
import api from '../../lib/api';
import { buildCartAccessHeaders } from '../../utils/cartAccess';
import { checkoutQuoteKey, checkoutQuotePayload } from './checkoutQuoteModel';
import { EMPTY_STORE_CREDIT_PREVIEW } from './checkoutPageModel';

export default function useCheckoutQuote({ state, derived, ensureCartReady }) {
  const {
    appliedCoupon,
    customerEmailOrPhone,
    customerId,
    customerPhone,
    discountCode,
    paymentsConfig,
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
  const { currentCart, total } = derived;
  const key = checkoutQuoteKey(state, derived);
  const [attempt, setAttempt] = useState(0);
  const creditRequest = useRef({ version: 0, controller: null });

  useEffect(() => {
    creditRequest.current.version++;
    creditRequest.current.controller?.abort();
    setStoreCreditPreview({ ...EMPTY_STORE_CREDIT_PREVIEW });
    setUseStoreCredit(false);
    setStoreCreditAmount('');
    return () => {
      creditRequest.current.version++;
      creditRequest.current.controller?.abort();
    };
  }, [
    customerEmailOrPhone,
    customerId,
    customerPhone,
    paymentsConfig.currency,
    setStoreCreditAmount,
    setStoreCreditPreview,
    setUseStoreCredit,
  ]);

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
    creditRequest.current.controller?.abort();
    const version = ++creditRequest.current.version;
    const controller = new AbortController();
    creditRequest.current.controller = controller;
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
      if (
        version !== creditRequest.current.version ||
        controller.signal.aborted
      )
        return;
      const { data } = await api.post(
        `/api/cart/${encodeURIComponent(cartAccess.sessionId)}/store-credit/preview`,
        {
          documentNumber,
          emailOrPhone: contact,
          phone,
          currency: paymentsConfig.currency || 'COP',
        },
        {
          headers: buildCartAccessHeaders(cartAccess),
          signal: controller.signal,
        }
      );
      if (
        version !== creditRequest.current.version ||
        controller.signal.aborted
      )
        return;
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
      if (
        version !== creditRequest.current.version ||
        controller.signal.aborted
      )
        return;
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
    const controller = new AbortController();
    setCheckoutQuote(null);
    state.setQuoteError('');
    if (!Array.isArray(currentCart) || !currentCart.length) {
      setQuoteLoading(false);
      return () => controller.abort();
    }
    setQuoteLoading(true);
    const couponCode = appliedCoupon?.code || '';
    const timer = window.setTimeout(async () => {
      try {
        const { data } = await api.post(
          '/api/orders/quote',
          checkoutQuotePayload(state, derived, couponCode),
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (!data?.pricing || !Number.isFinite(Number(data.pricing.total)))
          throw new Error('INVALID_QUOTE');
        setCheckoutQuote({ ...data, _checkoutKey: key });
        if (couponCode && data.coupon) {
          setCouponError('');
          setAppliedCoupon(data.coupon);
          setDiscountCode(data.coupon.code || couponCode);
          setCouponMessage(
            data.coupon.message || 'Cupón aplicado correctamente.'
          );
        } else if (!couponCode) setCouponMessage('');
      } catch (error) {
        if (controller.signal.aborted) return;
        setCheckoutQuote(null);
        state.setQuoteError(
          'No pudimos verificar el total. Revisa tu conexión y vuelve a intentarlo.'
        );
        if (couponCode && error?.response?.status === 400) {
          setAppliedCoupon(null);
          setCouponMessage('');
          setCouponError(
            error.response.data?.message || 'No se pudo aplicar el cupón.'
          );
        }
      } finally {
        if (!controller.signal.aborted) setQuoteLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [key, attempt, state.configurationAttempt]);
  return {
    handleApplyCoupon,
    handlePreviewStoreCredit,
    retryCheckoutQuote: () => setAttempt((value) => value + 1),
  };
}
