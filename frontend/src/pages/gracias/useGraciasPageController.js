import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../../config/apiBaseUrl';
import { buildOrderPaymentAccessHeaders, getOrderPaymentAccess } from '../../utils/orderPaymentAccess';
import { storeOrderReturnAccess } from '../../utils/orderReturnAccess';
import { selectPaymentResponse } from './paymentResponseModel';
import { buildSafeThanksPageConfig } from './thanksPageConfig';
import { buildThanksPageSlides, buildThanksPageViewModel, getThanksPagePresentationStyle } from './thanksPageViewModel';

const ACCESS_REQUIRED = 'No fue posible verificar el acceso a esta orden. Abre esta página desde el mismo navegador donde realizaste la compra.';
const ACCESS_FAILED = 'No fue posible verificar el acceso a esta orden. Revisa que estés usando el mismo navegador de la compra.';

function safeHttpError(response) {
  const error = new Error(`HTTP ${response.status}`);
  error.status = response.status;
  return error;
}

function logSafe(message, error) {
  console.error(message, {
    code: error?.code || 'REQUEST_FAILED',
    status: Number(error?.status || 0),
  });
}

export function useGraciasPageController() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state || {};
  const paymentResponse = useMemo(
    () => selectPaymentResponse(location.search),
    [location.search]
  );
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const backendOrderId = String(
    state.orderId || paymentResponse.orderId || query.get('orderId') || ''
  );
  const transactionId = String(
    query.get('id') || query.get('tx') || state.transactionId || paymentResponse.transactionId || ''
  );
  const paymentAccess = useMemo(
    () => getOrderPaymentAccess(backendOrderId),
    [backendOrderId]
  );

  const [thanksConfig, setThanksConfig] = useState(() => buildSafeThanksPageConfig({}));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [thanksOrderData, setThanksOrderData] = useState(null);
  const [wompiTxData, setWompiTxData] = useState(null);
  const [orderState, setOrderState] = useState({ loading: false, error: '' });
  const [transactionState, setTransactionState] = useState({ loading: false, error: '' });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/api/pages/gracias`)
      .then((response) => {
        if (!response.ok) throw safeHttpError(response);
        return response.json();
      })
      .then((data) => {
        if (!cancelled) setThanksConfig(buildSafeThanksPageConfig(data?.thanksPageConfig));
      })
      .catch((error) => {
        logSafe('Error cargando la configuración de la página de gracias.', error);
        if (!cancelled) setThanksConfig(buildSafeThanksPageConfig({}));
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setThanksOrderData(null);
    if (!backendOrderId) {
      setOrderState({ loading: false, error: paymentResponse.exists ? ACCESS_REQUIRED : '' });
      return undefined;
    }
    if (!paymentAccess) {
      setOrderState({ loading: false, error: ACCESS_REQUIRED });
      return undefined;
    }
    setOrderState({ loading: true, error: '' });
    fetch(`${API_BASE_URL}/api/orders/${backendOrderId}/thanks`, {
      headers: buildOrderPaymentAccessHeaders(paymentAccess),
    })
      .then((response) => {
        if (!response.ok) throw safeHttpError(response);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setThanksOrderData(data?.ok ? data : null);
        setOrderState({ loading: false, error: data?.ok ? '' : ACCESS_FAILED });
      })
      .catch((error) => {
        if (cancelled) return;
        logSafe('Error consultando el resumen protegido de la orden.', error);
        setThanksOrderData(null);
        setOrderState({ loading: false, error: ACCESS_FAILED });
      });
    return () => { cancelled = true; };
  }, [backendOrderId, paymentAccess, paymentResponse.exists]);

  useEffect(() => {
    let cancelled = false;
    setWompiTxData(null);
    if (!transactionId) {
      setTransactionState({ loading: false, error: '' });
      return undefined;
    }
    if (!paymentAccess) {
      setTransactionState({ loading: false, error: ACCESS_REQUIRED });
      return undefined;
    }
    setTransactionState({ loading: true, error: '' });
    fetch(`${API_BASE_URL}/api/payments/wompi/transaction/${transactionId}`, {
      headers: buildOrderPaymentAccessHeaders(paymentAccess),
    })
      .then((response) => {
        if (!response.ok) throw safeHttpError(response);
        return response.json();
      })
      .then((data) => {
        if (cancelled) return;
        setWompiTxData(data?.ok ? data : null);
        setTransactionState({ loading: false, error: data?.ok ? '' : ACCESS_FAILED });
      })
      .catch((error) => {
        if (cancelled) return;
        logSafe('Error consultando el estado protegido del pago.', error);
        setWompiTxData(null);
        setTransactionState({ loading: false, error: ACCESS_FAILED });
      });
    return () => { cancelled = true; };
  }, [paymentAccess, transactionId]);

  const verificationLoading = orderState.loading || transactionState.loading;
  const verified = Boolean(thanksOrderData || wompiTxData);
  const thanksAccessError = verified || verificationLoading
    ? '' : orderState.error || transactionState.error;
  const viewModel = useMemo(() => buildThanksPageViewModel({
    paymentResponse, thanksOrderData, wompiTxData, thanksConfig,
    thanksAccessError, verificationLoading,
  }), [paymentResponse, thanksOrderData, wompiTxData, thanksConfig, thanksAccessError, verificationLoading]);
  const slides = useMemo(() => buildThanksPageSlides(thanksConfig), [thanksConfig]);
  const presentationStyle = useMemo(
    () => getThanksPagePresentationStyle(thanksConfig.style),
    [thanksConfig.style]
  );

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);
  useEffect(() => {
    if (!thanksConfig.slider.autoplay || !thanksConfig.slider.enabled || slides.length <= 1) return undefined;
    const timer = window.setInterval(
      () => setCurrentSlide((previous) => (previous + 1) % slides.length),
      thanksConfig.slider.intervalMs
    );
    return () => window.clearInterval(timer);
  }, [thanksConfig, slides]);
  useEffect(() => {
    if (currentSlide >= slides.length) setCurrentSlide(0);
  }, [currentSlide, slides.length]);

  const openReturnsPortal = () => {
    const access = thanksOrderData?.returnAccess;
    if (!access?.enabled || !access?.token || !access?.orderId) return;
    storeOrderReturnAccess(access);
    navigate(`/devoluciones/${access.orderId}`, { state: { returnAccess: access } });
  };

  return {
    thanksConfig, currentSlide, setCurrentSlide, slides, viewModel,
    thanksOrderData, thanksAccessError, presentationStyle, openReturnsPortal,
    continueShopping: () => navigate('/'),
  };
}
