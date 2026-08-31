import GraciasImg from '../../assets/IMGPAGGRACIAS.jpg';
import { getPaymentStatusMeta, mapGatewayStatusToUiStatus } from './paymentResponseModel';

export function buildThanksPageSlides(config) {
  const slides = Array.isArray(config?.slider?.slides)
    ? config.slider.slides.filter((slide) => slide?.image)
    : [];
  return slides.length ? slides : [{ id: 'fallback-slide', image: GraciasImg, alt: 'Gracias por su compra', badge: '', caption: '' }];
}

export function formatMoneyCop(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency', currency: 'COP',
  });
}

const VERIFYING_META = Object.freeze({
  badge: 'Verificando pago', badgeBg: '#eff6ff', badgeText: '#1d4ed8',
  title: 'Estamos confirmando tu pago',
  message: 'Espera un momento mientras consultamos el resultado seguro con el servidor.',
  showSuccessCheck: false,
});

const UNVERIFIED_META = Object.freeze({
  badge: 'Pago no verificado', badgeBg: '#fef3c7', badgeText: '#b45309',
  title: 'No pudimos confirmar tu pago',
  message: 'Recibimos el regreso de la pasarela, pero no pudimos confirmar el resultado con el servidor. No tomes esta pantalla como comprobante de pago.',
  showSuccessCheck: false,
});

export function buildThanksPageViewModel({
  paymentResponse,
  thanksOrderData,
  wompiTxData,
  thanksConfig,
  thanksAccessError = '',
  verificationLoading = false,
}) {
  const verified = Boolean(thanksOrderData || wompiTxData);
  const hasUnverifiedResult = Boolean(
    !verified && !verificationLoading &&
    (thanksAccessError || paymentResponse?.exists)
  );

  const orderNumber = String(thanksOrderData?.orderNumber || wompiTxData?.orderNumber || '');
  const orderId = String(thanksOrderData?.orderId || wompiTxData?.orderId || '');
  const customerName = String(thanksOrderData?.customerName || '');
  const itemCount = Math.max(0, Number(thanksOrderData?.itemCount || 0));
  const provider = String(
    thanksOrderData?.paymentProvider || (wompiTxData ? 'wompi' : '') || ''
  );
  const paymentStatus =
    mapGatewayStatusToUiStatus(thanksOrderData?.paymentStatus) || 'unknown';
  const fallbackStatus = paymentStatus === 'unknown'
    ? mapGatewayStatusToUiStatus(thanksOrderData?.status || wompiTxData?.paymentStatus)
    : paymentStatus;
  const rawPaymentStatus = String(
    thanksOrderData?.paymentStatusLabel ||
    thanksOrderData?.paymentStatusRaw ||
    thanksOrderData?.paymentGatewayStatus ||
    (provider === 'store_credit' && thanksOrderData?.paymentStatus === 'paid'
      ? 'Pagado con saldo a favor' : thanksOrderData?.paymentStatus) ||
    wompiTxData?.wompiStatus || ''
  );
  const shipping = Math.max(0, Number(thanksOrderData?.shipping || 0));
  const subtotal = Math.max(0, Number(thanksOrderData?.subtotal || 0));
  const storeCreditAmount = Math.max(0, Number(thanksOrderData?.storeCredit?.amount || 0));
  const amountDue = Math.max(0, Number(
    thanksOrderData?.amountDue ??
    (Number(thanksOrderData?.total || 0) - storeCreditAmount)
  ));
  const protectedWompiTotal = Math.max(0, Number(wompiTxData?.amountInCents || 0) / 100);
  const total = Math.max(0, Number(thanksOrderData?.total || 0)) || protectedWompiTotal || subtotal + shipping;

  const hasOrderInfo = verified && Boolean(orderNumber || orderId || thanksOrderData || wompiTxData);
  const hasPaymentResult = verified || hasUnverifiedResult || verificationLoading;
  const paymentMeta = verificationLoading
    ? VERIFYING_META
    : hasUnverifiedResult
      ? UNVERIFIED_META
      : getPaymentStatusMeta(fallbackStatus, provider, thanksConfig.mainMessage);

  return {
    orderNumber, orderId, customerName, itemCount, provider,
    paymentStatus: fallbackStatus, rawPaymentStatus,
    shipping, subtotal, total, storeCreditAmount, amountDue,
    hasOrderInfo, hasPaymentResult, verified, hasUnverifiedResult,
    verificationLoading, paymentMeta,
    dynamicTitleText: hasPaymentResult ? paymentMeta.title : thanksConfig.titleText,
    dynamicMainMessage: hasPaymentResult ? paymentMeta.message : thanksConfig.mainMessage,
    summaryTitle: verified ? 'Resumen del resultado' : thanksConfig.summaryTitle,
    totalLabel: fallbackStatus === 'approved' ? thanksConfig.totalLabel : 'Valor intentado:',
    paymentStatusLabel: provider === 'payu' ? 'Estado de PayU:'
      : provider === 'wompi' ? 'Estado de Wompi:'
        : provider === 'store_credit' ? 'Medio de pago:' : 'Estado del pago:',
    paymentStatusValue: verified ? rawPaymentStatus || '—' : 'No verificado',
  };
}

export function getThanksPagePresentationStyle(style) {
  const shadowClass = style.shadowStyle === 'none' ? ''
    : style.shadowStyle === 'medium' ? 'shadow-md'
      : style.shadowStyle === 'strong' ? 'shadow-xl' : 'shadow-sm';
  const buttonRadius = style.buttonStyle === 'pill' ? 999
    : style.buttonStyle === 'rounded' ? Math.min(style.buttonRadiusPx, 18) : 8;
  return { shadowClass, buttonRadius };
}
