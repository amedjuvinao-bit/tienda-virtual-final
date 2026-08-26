// src/pages/GraciasPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import FooterSection from '../components/FooterSection';
import WhatsAppButton from '../components/WhatsAppButton';
import GraciasImg from '../assets/IMGPAGGRACIAS.jpg';
import { API_BASE_URL } from '../config/apiBaseUrl';
import {
  buildOrderPaymentAccessHeaders,
  getOrderPaymentAccess,
} from '../utils/orderPaymentAccess';
import { storeOrderReturnAccess } from '../utils/orderReturnAccess';

const API_BASE = API_BASE_URL;

/* ─── Helpers ─── */
function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function parseMoneyNumber(value, fallback = 0) {
  if (value == null || value === '') return fallback;
  const safe = String(value).replace(/[^0-9,.-]/g, '').replace(',', '.');
  const n = Number(safe);
  return Number.isFinite(n) ? n : fallback;
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(String(value || '').replace(/\+/g, ' '));
  } catch {
    return String(value || '');
  }
}

function parsePayUResponse(search) {
  const params = new URLSearchParams(search || '');

  const transactionState = String(params.get('transactionState') || '').trim();
  const lapTransactionState = decodeSafe(params.get('lapTransactionState') || '').trim();
  const referenceCode = decodeSafe(params.get('referenceCode') || '').trim();
  const description = decodeSafe(params.get('description') || '').trim();
  const txValue = parseMoneyNumber(params.get('TX_VALUE'), 0);
  const currency = decodeSafe(params.get('currency') || 'COP').trim().toUpperCase();
  const message = decodeSafe(params.get('message') || '').trim();
  const polResponseCode = String(params.get('polResponseCode') || '').trim();
  const buyerEmail = decodeSafe(params.get('buyerEmail') || '').trim();
  const processingDate = decodeSafe(params.get('processingDate') || '').trim();

  let status = 'unknown';

  if (lapTransactionState) {
    const safe = lapTransactionState.toLowerCase();
    if (safe.includes('aprob')) status = 'approved';
    else if (safe.includes('rechaz')) status = 'rejected';
    else if (safe.includes('pend')) status = 'pending';
    else if (safe.includes('expir')) status = 'expired';
    else if (safe.includes('error')) status = 'error';
  }

  if (status === 'unknown') {
    if (transactionState === '4') status = 'approved';
    else if (transactionState === '6') status = 'rejected';
    else if (transactionState === '7') status = 'pending';
    else if (transactionState === '5') status = 'expired';
    else if (transactionState === '104') status = 'error';
  }

  return {
    provider: 'payu',
    exists:
      !!referenceCode ||
      !!transactionState ||
      !!lapTransactionState ||
      !!txValue ||
      !!message,
    referenceCode,
    description,
    txValue,
    currency,
    transactionState,
    lapTransactionState,
    polResponseCode,
    buyerEmail,
    processingDate,
    message,
    status,
  };
}

function parseWompiResponse(search) {
  const params = new URLSearchParams(search || '');

  const orderId = decodeSafe(params.get('orderId') || '').trim();
  const orderNumber = decodeSafe(params.get('orderNumber') || '').trim();
  const customerName = decodeSafe(params.get('name') || '').trim();
  const subtotal = parseMoneyNumber(params.get('subtotal'), 0);
  const items = Number.parseInt(params.get('items') || '0', 10);
  const transactionId = decodeSafe(params.get('tx') || params.get('id') || '').trim();
  const rawStatus = decodeSafe(params.get('status') || '').trim().toUpperCase();

  let status = 'unknown';

  if (rawStatus === 'APPROVED') status = 'approved';
  else if (rawStatus === 'DECLINED') status = 'rejected';
  else if (rawStatus === 'PENDING') status = 'pending';
  else if (rawStatus === 'VOIDED') status = 'expired';
  else if (rawStatus === 'ERROR') status = 'error';

  return {
    provider: 'wompi',
    exists:
      !!orderId ||
      !!orderNumber ||
      !!customerName ||
      subtotal > 0 ||
      (Number.isFinite(items) && items > 0) ||
      !!transactionId ||
      !!rawStatus,
    orderId,
    referenceCode: orderNumber,
    customerName,
    txValue: subtotal,
    itemCount: Number.isFinite(items) ? items : 0,
    transactionId,
    currency: 'COP',
    buyerEmail: '',
    processingDate: '',
    message: '',
    rawStatus,
    status,
    transactionState: rawStatus,
    lapTransactionState: rawStatus,
  };
}

function mapGatewayStatusToUiStatus(status) {
  const safe = String(status || '').trim().toLowerCase();

  if (safe === 'approved' || safe === 'paid') return 'approved';
  if (safe === 'declined' || safe === 'rejected' || safe === 'failed') return 'rejected';
  if (safe === 'pending' || safe === 'pending_gateway') return 'pending';
  if (safe === 'voided' || safe === 'expired' || safe === 'cancelled') return 'expired';
  if (safe === 'error') return 'error';

  return 'unknown';
}

function getPaymentStatusMeta(status, provider, mainMessageFallback) {
  const providerLabel =
    provider === 'wompi'
      ? 'Wompi'
      : provider === 'payu'
        ? 'PayU'
        : provider === 'store_credit'
          ? 'el saldo a favor'
        : 'la pasarela de pago';

  switch (status) {
    case 'approved':
      return {
        badge: 'Pago aprobado',
        badgeBg: '#dcfce7',
        badgeText: '#15803d',
        title: '¡Pago confirmado con éxito!',
        message:
          'Tu pago fue aprobado correctamente. Ya recibimos tu orden y continuaremos con el proceso de preparación.',
        showSuccessCheck: true,
      };
    case 'rejected':
      return {
        badge: 'Pago rechazado',
        badgeBg: '#fee2e2',
        badgeText: '#b91c1c',
        title: 'Tu pago fue rechazado',
        message:
          `${providerLabel} informó que este intento de pago fue rechazado. Puedes intentarlo nuevamente con otro medio de pago o volver a la tienda.`,
        showSuccessCheck: false,
      };
    case 'pending':
      return {
        badge: 'Pago pendiente',
        badgeBg: '#fef3c7',
        badgeText: '#b45309',
        title: 'Tu pago está pendiente',
        message:
          `Recibimos tu intento de pago, pero ${providerLabel} aún no confirma el resultado final. Te avisaremos cuando el estado cambie.`,
        showSuccessCheck: false,
      };
    case 'expired':
      return {
        badge: 'Pago expirado',
        badgeBg: '#fef2f2',
        badgeText: '#b91c1c',
        title: 'Tu intento de pago expiró',
        message:
          'El intento de pago expiró antes de completarse. Puedes regresar a la tienda y generar un nuevo intento.',
        showSuccessCheck: false,
      };
    case 'error':
      return {
        badge: 'Error en el pago',
        badgeBg: '#fee2e2',
        badgeText: '#b91c1c',
        title: 'Hubo un problema con tu pago',
        message:
          `${providerLabel} devolvió un error en el procesamiento. Te recomendamos intentar nuevamente.`,
        showSuccessCheck: false,
      };
    default:
      return {
        badge: 'Orden recibida',
        badgeBg: '#fdf2f8',
        badgeText: '#db2777',
        title: '¡Gracias por tu compra!',
        message:
          mainMessageFallback ||
          'Hemos recibido tu pedido correctamente. Te enviaremos un mensaje cuando esté en camino.',
        showSuccessCheck: true,
      };
  }
}

function buildSafeThanksPageConfig(raw) {
  const cfg = raw && typeof raw === "object" ? raw : {};
  const slides = Array.isArray(cfg.slider?.slides) && cfg.slider.slides.length
    ? cfg.slider.slides.map((slide, index) => ({
        id: typeof slide?.id === "string" && slide.id.trim() ? slide.id : `slide-${index}`,
        image: typeof slide?.image === "string" ? slide.image : "",
        alt: typeof slide?.alt === "string" && slide.alt.trim() ? slide.alt : `Imagen ${index + 1}`,
        badge: typeof slide?.badge === "string" ? slide.badge : "",
        caption: typeof slide?.caption === "string" ? slide.caption : "",
      }))
    : [{ id: "default-slide-1", image: GraciasImg, alt: "Gracias por tu compra", badge: "", caption: "" }];

  return {
    titleMode: cfg.titleMode === "text" || cfg.titleMode === "image" ? cfg.titleMode : "text",
    titleText: typeof cfg.titleText === "string" && cfg.titleText.trim() ? cfg.titleText : "¡Gracias por tu compra!",
    titleImage: typeof cfg.titleImage === "string" ? cfg.titleImage : "",
    titleImageAlt: typeof cfg.titleImageAlt === "string" && cfg.titleImageAlt.trim() ? cfg.titleImageAlt : "Título gracias",

    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showOrderNumber: cfg.showOrderNumber !== false,
    showCustomerName: cfg.showCustomerName !== false,
    showItemCount: cfg.showItemCount !== false,
    showSubtotal: cfg.showSubtotal !== false,
    showShipping: cfg.showShipping !== false,
    showTotal: cfg.showTotal !== false,
    showContinueButton: cfg.showContinueButton !== false,
    showHelpText: cfg.showHelpText !== false,
    showVisualPanel: cfg.showVisualPanel !== false,

    mainMessage: typeof cfg.mainMessage === "string" && cfg.mainMessage.trim() ? cfg.mainMessage : "Hemos recibido tu pedido correctamente. Te enviaremos un mensaje cuando esté en camino.",
    summaryTitle: typeof cfg.summaryTitle === "string" && cfg.summaryTitle.trim() ? cfg.summaryTitle : "Resumen de tu orden",
    orderNumberLabel: typeof cfg.orderNumberLabel === "string" && cfg.orderNumberLabel.trim() ? cfg.orderNumberLabel : "Número de orden:",
    customerLabel: typeof cfg.customerLabel === "string" && cfg.customerLabel.trim() ? cfg.customerLabel : "Cliente:",
    itemCountLabel: typeof cfg.itemCountLabel === "string" && cfg.itemCountLabel.trim() ? cfg.itemCountLabel : "Productos comprados:",
    subtotalLabel: typeof cfg.subtotalLabel === "string" && cfg.subtotalLabel.trim() ? cfg.subtotalLabel : "Subtotal:",
    shippingLabel: typeof cfg.shippingLabel === "string" && cfg.shippingLabel.trim() ? cfg.shippingLabel : "Envío:",
    totalLabel: typeof cfg.totalLabel === "string" && cfg.totalLabel.trim() ? cfg.totalLabel : "Total pagado:",
    continueButtonText: typeof cfg.continueButtonText === "string" && cfg.continueButtonText.trim() ? cfg.continueButtonText : "Seguir comprando",
    helpText: typeof cfg.helpText === "string" && cfg.helpText.trim() ? cfg.helpText : "¿Tienes dudas? Contáctanos por WhatsApp o revisa tu correo electrónico para más detalles.",

    slider: {
      enabled: cfg?.slider?.enabled !== false,
      autoplay: cfg?.slider?.autoplay !== false,
      intervalMs: clampInt(cfg?.slider?.intervalMs, 1500, 12000, 3500),
      animation: cfg?.slider?.animation === "slide" || cfg?.slider?.animation === "zoom" || cfg?.slider?.animation === "fade" ? cfg.slider.animation : "fade",
      slides,
    },

    style: {
      pageBg: typeof cfg?.style?.pageBg === "string" ? cfg.style.pageBg : "#ffffff",
      contentMaxWidthPx: clampInt(cfg?.style?.contentMaxWidthPx, 900, 1800, 1200),
      contentTopPaddingPx: clampInt(cfg?.style?.contentTopPaddingPx, 0, 240, 70),
      titleTextColor: typeof cfg?.style?.titleTextColor === "string" ? cfg.style.titleTextColor : "#db2777",
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 28),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 72),
      panelBg: typeof cfg?.style?.panelBg === "string" ? cfg.style.panelBg : "#fdf2f8",
      panelBorderColor: typeof cfg?.style?.panelBorderColor === "string" ? cfg.style.panelBorderColor : "#f3c4d8",
      panelRadiusPx: clampInt(cfg?.style?.panelRadiusPx, 0, 40, 14),
      panelPaddingPx: clampInt(cfg?.style?.panelPaddingPx, 8, 48, 24),
      panelWidthPx: clampInt(cfg?.style?.panelWidthPx, 280, 900, 540),
      panelMinHeightPx: clampInt(cfg?.style?.panelMinHeightPx, 240, 900, 420),
      visualBorderColor: typeof cfg?.style?.visualBorderColor === "string" ? cfg.style.visualBorderColor : "#f59ad0",
      visualRadiusPx: clampInt(cfg?.style?.visualRadiusPx, 0, 40, 16),
      visualWidthPx: clampInt(cfg?.style?.visualWidthPx, 220, 900, 400),
      visualHeightPx: clampInt(cfg?.style?.visualHeightPx, 220, 760, 520),
      badgeBg: typeof cfg?.style?.badgeBg === "string" ? cfg.style.badgeBg : "#ffffffcc",
      badgeTextColor: typeof cfg?.style?.badgeTextColor === "string" ? cfg.style.badgeTextColor : "#db2777",
      captionBg: typeof cfg?.style?.captionBg === "string" ? cfg.style.captionBg : "#ffffffcc",
      captionTextColor: typeof cfg?.style?.captionTextColor === "string" ? cfg.style.captionTextColor : "#374151",
      textPrimaryColor: typeof cfg?.style?.textPrimaryColor === "string" ? cfg.style.textPrimaryColor : "#111827",
      textSecondaryColor: typeof cfg?.style?.textSecondaryColor === "string" ? cfg.style.textSecondaryColor : "#4b5563",
      accentColor: typeof cfg?.style?.accentColor === "string" ? cfg.style.accentColor : "#ec4899",
      buttonBg: typeof cfg?.style?.buttonBg === "string" ? cfg.style.buttonBg : "#ec4899",
      buttonTextColor: typeof cfg?.style?.buttonTextColor === "string" ? cfg.style.buttonTextColor : "#ffffff",
      buttonRadiusPx: clampInt(cfg?.style?.buttonRadiusPx, 0, 40, 14),
      buttonStyle: cfg?.style?.buttonStyle === "pill" || cfg?.style?.buttonStyle === "rounded" || cfg?.style?.buttonStyle === "square" ? cfg.style.buttonStyle : "rounded",
      shadowStyle: cfg?.style?.shadowStyle === "none" || cfg?.style?.shadowStyle === "soft" || cfg?.style?.shadowStyle === "medium" || cfg?.style?.shadowStyle === "strong" ? cfg.style.shadowStyle : "soft",
    },
  };
}

/* ─── Estilos globales ─── */
const GRACIAS_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=Mulish:wght@300;400;500;600;700&display=swap');

  .gp-page * { box-sizing: border-box; }
  .gp-page { font-family: 'Mulish', sans-serif; -webkit-font-smoothing: antialiased; }

  @keyframes gp-pop {
    0%   { opacity:0; transform: scale(0.6) rotate(-8deg); }
    70%  { transform: scale(1.12) rotate(2deg); }
    100% { opacity:1; transform: scale(1) rotate(0deg); }
  }
  @keyframes gp-slide-up {
    from { opacity:0; transform: translateY(28px); }
    to   { opacity:1; transform: translateY(0); }
  }
  @keyframes gp-fade-in {
    from { opacity:0; }
    to   { opacity:1; }
  }
  @keyframes gp-confetti-fall {
    0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
    100% { transform: translateY(60px)  rotate(360deg); opacity:0; }
  }
  @keyframes gp-pulse-ring {
    0%   { transform: scale(1);    opacity: 0.6; }
    100% { transform: scale(1.55); opacity: 0; }
  }
  @keyframes gp-slider-fade {
    from { opacity:0; }
    to   { opacity:1; }
  }

  .gp-check-icon {
    animation: gp-pop 0.55s cubic-bezier(.34,1.56,.64,1) both;
  }
  .gp-panel {
    animation: gp-slide-up 0.5s 0.15s ease both;
  }
  .gp-visual {
    animation: gp-fade-in 0.6s 0.05s ease both;
  }
  .gp-slide-img {
    animation: gp-slider-fade 0.4s ease both;
  }

  .gp-confetti-wrap {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    border-radius: inherit;
  }
  .gp-confetti-dot {
    position: absolute;
    width: 6px; height: 6px;
    border-radius: 50%;
    animation: gp-confetti-fall 1.8s ease-out both;
    opacity: 0;
  }

  .gp-pulse-ring {
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px solid;
    animation: gp-pulse-ring 1.4s ease-out 0.4s infinite;
  }

  .gp-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 32px;
    align-items: center;
  }
  @media (min-width: 768px) {
    .gp-layout {
      grid-template-columns: 1fr 1fr;
      gap: 48px;
    }
  }
  @media (min-width: 1024px) {
    .gp-layout { gap: 64px; }
  }

  .gp-visual-wrap {
    position: relative;
    overflow: hidden;
    width: 100%;
    max-width: 100%;
  }
  .gp-visual-inner {
    position: relative;
    width: 100%;
    padding-bottom: 120%;
    overflow: hidden;
  }
  @media (min-width: 768px) {
    .gp-visual-inner { padding-bottom: 0; height: var(--gp-visual-h); }
  }
  .gp-visual-inner img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: opacity 0.4s ease;
  }

  .gp-dots {
    position: absolute;
    bottom: 14px;
    left: 0; right: 0;
    display: flex;
    justify-content: center;
    gap: 8px;
    z-index: 4;
  }
  .gp-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    transition: transform 0.2s, background 0.2s;
    padding: 0;
  }
  .gp-dot.active { transform: scale(1.3); }

  .gp-panel-inner {
    width: 100%;
  }

  .gp-check-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 20px;
  }

  .gp-title {
    font-family: 'Playfair Display', serif;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
  }

  .gp-message {
    font-size: 14px;
    line-height: 1.7;
    margin: 0 0 24px;
  }

  .gp-summary-title {
    font-family: 'Playfair Display', serif;
    font-size: 17px;
    font-weight: 600;
    margin: 0 0 16px;
    letter-spacing: -0.01em;
  }
  .gp-summary-rows {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 24px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid;
  }
  .gp-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 14px;
    font-size: 13px;
    border-bottom: 1px solid;
    gap: 12px;
  }
  .gp-summary-row:last-child { border-bottom: none; }
  .gp-summary-row-label { font-weight: 500; opacity: 0.75; }
  .gp-summary-row-value { font-weight: 600; text-align: right; }
  .gp-summary-row.total {
    font-size: 14px;
    font-weight: 700;
  }
  .gp-summary-row.total .gp-summary-row-value { font-size: 16px; }

  .gp-divider {
    height: 1px;
    width: 100%;
    margin: 20px 0;
    opacity: 0.18;
  }

  .gp-cta-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 14px 24px;
    font-family: 'Mulish', sans-serif;
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border: none;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
  }
  .gp-cta-btn:hover  { transform: translateY(-2px); }
  .gp-cta-btn:active { transform: scale(0.97); opacity: 0.9; }

  .gp-help {
    margin-top: 16px;
    font-size: 11px;
    text-align: center;
    line-height: 1.6;
    opacity: 0.75;
  }

  .gp-badge {
    position: absolute;
    top: 14px; left: 14px;
    padding: 4px 12px;
    border-radius: 50px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    z-index: 3;
    pointer-events: none;
  }
  .gp-caption {
    position: absolute;
    bottom: 44px; left: 14px; right: 14px;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 13px;
    line-height: 1.5;
    z-index: 3;
    pointer-events: none;
    backdrop-filter: blur(4px);
  }

  .gp-fallback-msg {
    font-size: 14px;
    line-height: 1.7;
    padding: 16px;
    border-radius: 12px;
    border: 1px dashed;
    margin-bottom: 20px;
    text-align: center;
  }

  .gp-status-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
    margin-bottom: 12px;
  }

  .gp-page ::-webkit-scrollbar { width: 4px; }
  .gp-page ::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
`;

function ConfettiDots({ accent, accent2 }) {
  const dots = useMemo(() => {
    const colors = [accent, accent2, "#fbbf24", "#34d399", "#60a5fa"];
    return Array.from({ length: 12 }, (_, i) => ({
      left: `${8 + (i * 7.5) % 84}%`,
      top: `${(i * 17) % 60}%`,
      color: colors[i % colors.length],
      delay: `${(i * 0.12).toFixed(2)}s`,
      size: `${4 + (i % 3) * 2}px`,
    }));
  }, [accent, accent2]);

  return (
    <div className="gp-confetti-wrap" aria-hidden="true">
      {dots.map((d, i) => (
        <div
          key={i}
          className="gp-confetti-dot"
          style={{
            left: d.left,
            top: d.top,
            width: d.size,
            height: d.size,
            backgroundColor: d.color,
            animationDelay: d.delay,
          }}
        />
      ))}
    </div>
  );
}

export default function GraciasPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location;
  const accessOrderId =
    state?.orderId ||
    new URLSearchParams(location.search).get('orderId') ||
    '';
  const paymentAccess = useMemo(
    () => getOrderPaymentAccess(accessOrderId),
    [accessOrderId]
  );

  const wompiTransactionId =
  new URLSearchParams(location.search).get('id') ||
  state?.transactionId ||
  '';

  const [thanksConfig, setThanksConfig] = useState(buildSafeThanksPageConfig({}));
  const [thanksPageData, setThanksPageData] = useState(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [thanksOrderData, setThanksOrderData] = useState(null);
  const [wompiTxData, setWompiTxData] = useState(null);
  const [thanksAccessError, setThanksAccessError] = useState('');

  useEffect(() => {
    let cancel = false;

    if (!wompiTransactionId) {
      setWompiTxData(null);
      return;
    }

    if (!paymentAccess) {
      setWompiTxData(null);
      setThanksAccessError(
        'No fue posible verificar el acceso a esta orden. Abre esta página desde el mismo navegador donde realizaste la compra.'
      );
      return;
    }

    fetch(`${API_BASE}/api/payments/wompi/transaction/${wompiTransactionId}`, {
      headers: buildOrderPaymentAccessHeaders(paymentAccess),
    })
      .then(async res => {
        if (!res.ok) {
          const requestError = new Error(`HTTP ${res.status}`);
          requestError.status = res.status;
          throw requestError;
        }
        return res.json();
      })
      .then(data => {
        if (cancel) return;
        setThanksAccessError('');
        setWompiTxData(data?.ok ? data : null);
      })
      .catch(err => {
        if (cancel) return;
        console.error('Error consultando el estado protegido del pago.', {
          code: err?.code || 'REQUEST_FAILED',
          status: Number(err?.status || 0),
        });
        setWompiTxData(null);
        setThanksAccessError(
          'No fue posible verificar el acceso a esta orden. Revisa que estés usando el mismo navegador de la compra.'
        );
      });

    return () => {
      cancel = true;
    };
  }, [paymentAccess, wompiTransactionId]);

  const payuResponse = useMemo(
    () => parsePayUResponse(location.search),
    [location.search]
  );

  const wompiResponse = useMemo(
    () => parseWompiResponse(location.search),
    [location.search]
  );

  const paymentResponse = useMemo(() => {
    if (payuResponse.exists) return payuResponse;
    if (wompiResponse.exists) return wompiResponse;
    return {
      provider: '',
      exists: false,
      referenceCode: '',
      description: '',
      txValue: 0,
      currency: 'COP',
      transactionState: '',
      lapTransactionState: '',
      polResponseCode: '',
      buyerEmail: '',
      processingDate: '',
      message: '',
      status: 'unknown',
      customerName: '',
      itemCount: 0,
      transactionId: '',
      rawStatus: '',
      orderId: '',
    };
  }, [payuResponse, wompiResponse]);

  const stateOrderNumber = state?.orderNumber || '';
  const stateOrderId = state?.orderId || '';
  const stateCustomerName = state?.customerName || '';
  const stateItemCount = Number(state?.itemCount || 0);
  const stateSubtotal = Number(state?.subtotal || 0);

  const backendOrderId =
    stateOrderId ||
    paymentResponse.orderId ||
    (wompiTxData?.orderId || '') ||
    '';

  const resolvedOrderNumber =
    thanksOrderData?.orderNumber ||
    stateOrderNumber ||
    paymentResponse.referenceCode ||
    wompiTxData?.orderNumber ||
    '';

  const resolvedOrderId =
    thanksOrderData?.orderId ||
    stateOrderId ||
    paymentResponse.orderId ||
    wompiTxData?.orderId ||
    '';

  const resolvedCustomerName =
    thanksOrderData?.customerName ||
    stateCustomerName ||
    paymentResponse.customerName ||
    '';

  const resolvedItemCount =
    Number(thanksOrderData?.itemCount || 0) > 0
      ? Number(thanksOrderData?.itemCount || 0)
      : stateItemCount > 0
        ? stateItemCount
        : Number(paymentResponse.itemCount || 0);

  const resolvedBuyerEmail =
    paymentResponse.buyerEmail || '';

  const resolvedProvider =
    thanksOrderData?.paymentProvider ||
    paymentResponse.provider ||
    (wompiTxData ? 'wompi' : '');

  const resolvedPaymentStatus =
    (thanksOrderData?.paymentStatus
      ? mapGatewayStatusToUiStatus(thanksOrderData.paymentStatus)
      : '') ||
    (thanksOrderData?.status
      ? mapGatewayStatusToUiStatus(thanksOrderData.status)
      : '') ||
    (wompiTxData?.paymentStatus ? mapGatewayStatusToUiStatus(wompiTxData.paymentStatus) : '') ||
    paymentResponse.status ||
    'unknown';

  const resolvedRawPaymentStatus =
    thanksOrderData?.paymentStatusLabel ||
    thanksOrderData?.paymentStatusRaw ||
    thanksOrderData?.paymentGatewayStatus ||
    (resolvedProvider === 'store_credit' && thanksOrderData?.paymentStatus === 'paid'
      ? 'Pagado con saldo a favor'
      : thanksOrderData?.paymentStatus) ||
    wompiTxData?.wompiStatus ||
    paymentResponse.rawStatus ||
    paymentResponse.lapTransactionState ||
    paymentResponse.transactionState ||
    '';

  const resolvedShipping = Number(thanksOrderData?.shipping || 0);
  const resolvedSubtotal = Number(thanksOrderData?.subtotal || 0);
  const resolvedTotal = Number(thanksOrderData?.total || 0);
  const resolvedStoreCreditAmount = Number(
    thanksOrderData?.storeCredit?.amount ?? state?.storeCreditApplied ?? 0
  );
  const resolvedAmountDue = Number(
    thanksOrderData?.amountDue ??
      Math.max(0, resolvedTotal - resolvedStoreCreditAmount)
  );

  const stateShipping = Number(state?.shipping || state?.shippingCost || state?.deliveryCost || 0);

  const SHIP =
    resolvedShipping > 0
      ? resolvedShipping
      : stateShipping > 0
        ? stateShipping
        : 0;

  const sub =
    resolvedSubtotal > 0
      ? resolvedSubtotal
      : stateSubtotal > 0
        ? stateSubtotal
        : Math.max(0, (paymentResponse.txValue || 0) - SHIP);

  const total =
    resolvedTotal > 0
      ? resolvedTotal
      : paymentResponse.txValue > 0
        ? paymentResponse.txValue
        : sub + SHIP;

  const moneyCOP = (n) =>
    Number(n || 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP' });

  const hasOrderInfo = !!(
    resolvedOrderNumber ||
    resolvedOrderId ||
    paymentResponse.exists ||
    thanksOrderData ||
    wompiTxData
  );

  const paymentMeta = useMemo(
    () => getPaymentStatusMeta(resolvedPaymentStatus, resolvedProvider, thanksConfig.mainMessage),
    [resolvedPaymentStatus, resolvedProvider, thanksConfig.mainMessage]
  );

  const dynamicTitleText =
    (paymentResponse.exists || thanksOrderData || wompiTxData) && paymentMeta.title
      ? paymentMeta.title
      : thanksConfig.titleText;

  const dynamicMainMessage =
    (paymentResponse.exists || thanksOrderData || wompiTxData) && paymentMeta.message
      ? paymentMeta.message
      : thanksConfig.mainMessage;

  const summaryTitle =
    paymentResponse.exists || thanksOrderData || wompiTxData
      ? 'Resumen del resultado'
      : thanksConfig.summaryTitle;

  const totalLabel =
    resolvedPaymentStatus === 'approved'
      ? thanksConfig.totalLabel
      : paymentResponse.exists || thanksOrderData || wompiTxData
        ? 'Valor intentado:'
        : thanksConfig.totalLabel;

  const paymentStatusLabel =
    resolvedProvider === 'payu'
      ? 'Estado de PayU:'
      : resolvedProvider === 'wompi'
        ? 'Estado de Wompi:'
        : resolvedProvider === 'store_credit'
          ? 'Medio de pago:'
        : 'Estado del pago:';

  const paymentStatusValue =
    resolvedRawPaymentStatus || '—';

  const slides = useMemo(() => {
    const safeSlides = Array.isArray(thanksConfig?.slider?.slides)
      ? thanksConfig.slider.slides.filter(s => s?.image)
      : [];
    return safeSlides.length
      ? safeSlides
      : [{ id: "fallback-slide", image: GraciasImg, alt: "Gracias por su compra", badge: "", caption: "" }];
  }, [thanksConfig]);

  const currentVisualSlide = slides[currentSlide] || slides[0];

  const s = thanksConfig.style;

  const shadowClass =
    s.shadowStyle === "none" ? "" :
    s.shadowStyle === "medium" ? "shadow-md" :
    s.shadowStyle === "strong" ? "shadow-xl" : "shadow-sm";

  const buttonRadius =
    s.buttonStyle === "pill" ? 999 :
    s.buttonStyle === "rounded" ? Math.min(s.buttonRadiusPx, 18) : 8;

  const openReturnsPortal = () => {
    const returnAccess = thanksOrderData?.returnAccess;
    if (!returnAccess?.enabled || !returnAccess?.token || !returnAccess?.orderId) return;
    storeOrderReturnAccess(returnAccess);
    navigate(`/devoluciones/${returnAccess.orderId}`, {
      state: { returnAccess },
    });
  };

  useEffect(() => {
    let cancel = false;

    const load = async () => {
      let pageData = null;
      try {
        const pageRes = await fetch(`${API_BASE}/api/pages/gracias`);
        if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`);
        pageData = await pageRes.json();
      } catch (err) {
        console.error('Error cargando la configuración de la página de gracias.', {
          code: err?.code || 'REQUEST_FAILED',
          status: Number(err?.status || 0),
        });
        if (!cancel) {
          setThanksPageData(null);
          setThanksConfig(buildSafeThanksPageConfig({}));
        }
      }

      if (cancel) return;
      setThanksPageData(pageData);
      setThanksConfig(buildSafeThanksPageConfig(pageData?.thanksPageConfig));

      if (!backendOrderId) {
        setThanksOrderData(null);
        return;
      }

      if (!paymentAccess) {
        setThanksOrderData(null);
        setThanksAccessError(
          'No fue posible verificar el acceso a esta orden. Abre esta página desde el mismo navegador donde realizaste la compra.'
        );
        return;
      }

      try {
        const orderRes = await fetch(`${API_BASE}/api/orders/${backendOrderId}/thanks`, {
          headers: buildOrderPaymentAccessHeaders(paymentAccess),
        });
        if (!orderRes.ok) {
          const requestError = new Error(`HTTP ${orderRes.status}`);
          requestError.status = orderRes.status;
          throw requestError;
        }
        const orderData = await orderRes.json();
        if (cancel) return;
        setThanksOrderData(orderData?.ok ? orderData : null);
        setThanksAccessError('');
      } catch (err) {
        console.error('Error consultando el resumen protegido de la orden.', {
          code: err?.code || 'REQUEST_FAILED',
          status: Number(err?.status || 0),
        });
        if (cancel) return;
        setThanksOrderData(null);
        setThanksAccessError(
          'No fue posible verificar el acceso a esta orden. Revisa que estés usando el mismo navegador de la compra.'
        );
      }
    };

    load();
    return () => { cancel = true; };
  }, [backendOrderId, paymentAccess]);

  useEffect(() => {
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }, []);

  useEffect(() => {
    if (!thanksConfig?.slider?.autoplay) return;
    if (!thanksConfig?.slider?.enabled) return;
    if (!slides.length || slides.length <= 1) return;
    const interval = window.setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, thanksConfig.slider.intervalMs);
    return () => window.clearInterval(interval);
  }, [thanksConfig, slides]);

  useEffect(() => {
    if (currentSlide > slides.length - 1) setCurrentSlide(0);
  }, [slides, currentSlide]);

  return (
    <>
      <style>{GRACIAS_STYLES}</style>

      <div
        className="gp-page min-h-screen flex flex-col"
        style={{ backgroundColor: s.pageBg, color: s.textPrimaryColor }}
      >
        {thanksConfig.showHeader && <Header />}

        <div
          className="flex-1 mx-auto px-4 sm:px-6 pb-16"
          style={{
            maxWidth: `${s.contentMaxWidthPx}px`,
            width: "100%",
            paddingTop: `${s.contentTopPaddingPx}px`,
          }}
        >
          <div className="gp-layout">
            {thanksConfig.showVisualPanel && (
              <div className="gp-visual flex justify-center">
                <div
                  className={`gp-visual-wrap ${shadowClass}`}
                  style={{
                    borderRadius: `${s.visualRadiusPx}px`,
                    border: `4px solid ${s.visualBorderColor}`,
                    maxWidth: `min(100%, ${s.visualWidthPx}px)`,
                  }}
                >
                  <div
                    className="gp-visual-inner"
                    style={{ '--gp-visual-h': `${s.visualHeightPx}px` }}
                  >
                    <img
                      key={currentVisualSlide?.image}
                      src={currentVisualSlide?.image || GraciasImg}
                      alt={currentVisualSlide?.alt || "Gracias por su compra"}
                      className="gp-slide-img"
                    />

                    {currentVisualSlide?.badge && (
                      <div
                        className="gp-badge"
                        style={{ backgroundColor: s.badgeBg, color: s.badgeTextColor }}
                      >
                        {currentVisualSlide.badge}
                      </div>
                    )}

                    {currentVisualSlide?.caption && (
                      <div
                        className="gp-caption"
                        style={{ backgroundColor: s.captionBg, color: s.captionTextColor }}
                      >
                        {currentVisualSlide.caption}
                      </div>
                    )}

                    {slides.length > 1 && (
                      <div className="gp-dots">
                        {slides.map((slide, index) => (
                          <button
                            key={slide.id || index}
                            type="button"
                            onClick={() => setCurrentSlide(index)}
                            className={`gp-dot ${index === currentSlide ? "active" : ""}`}
                            style={{
                              backgroundColor: index === currentSlide ? s.accentColor : "#ffffffcc",
                            }}
                            aria-label={`Slide ${index + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center md:justify-start">
              <div
                className={`gp-panel gp-panel-inner border ${shadowClass} relative overflow-hidden`}
                style={{
                  backgroundColor: s.panelBg,
                  borderColor: s.panelBorderColor,
                  borderRadius: `${s.panelRadiusPx}px`,
                  padding: `${s.panelPaddingPx}px`,
                  minHeight: `${s.panelMinHeightPx}px`,
                }}
              >
                {hasOrderInfo && paymentMeta.showSuccessCheck && (
                  <ConfettiDots accent={s.accentColor} accent2="#d4af37" />
                )}

                <div style={{ position: "relative", zIndex: 1 }}>
                  {(paymentResponse.exists || thanksOrderData || wompiTxData) && (
                    <div
                      className="gp-status-badge"
                      style={{
                        backgroundColor: paymentMeta.badgeBg,
                        color: paymentMeta.badgeText,
                      }}
                    >
                      {paymentMeta.badge}
                    </div>
                  )}

                  <div className="gp-check-wrap">
                    {paymentMeta.showSuccessCheck ? (
                      <>
                        <div
                          className="gp-pulse-ring"
                          style={{ borderColor: s.accentColor, opacity: 0.3 }}
                        />
                        <div
                          className="gp-check-icon"
                          style={{
                            width: 56,
                            height: 56,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: `linear-gradient(135deg, ${s.accentColor}, #d4af37)`,
                            boxShadow: `0 8px 24px ${s.accentColor}44`,
                          }}
                        >
                          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path
                              d="M5 13l4 4L19 7"
                              stroke="#ffffff"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                      </>
                    ) : (
                      <div
                        className="gp-check-icon"
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: paymentMeta.badgeBg,
                          boxShadow: `0 8px 24px ${paymentMeta.badgeText}22`,
                        }}
                      >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path
                            d="M8 8l8 8M16 8l-8 8"
                            stroke={paymentMeta.badgeText}
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 4 }}>
                    {thanksConfig.titleMode === "image" && thanksConfig.titleImage && !paymentResponse.exists && !thanksOrderData && !wompiTxData ? (
                      <img
                        src={thanksConfig.titleImage}
                        alt={thanksConfig.titleImageAlt || "Gracias"}
                        style={{ height: `${s.titleImageHeightPx}px`, objectFit: "contain" }}
                      />
                    ) : (
                      <h1
                        className="gp-title"
                        style={{
                          color: paymentResponse.exists || thanksOrderData || wompiTxData ? paymentMeta.badgeText : s.titleTextColor,
                          fontSize: `clamp(20px, 4vw, ${s.titleFontSizePx}px)`,
                        }}
                      >
                        {dynamicTitleText}
                        {!paymentResponse.exists && hasOrderInfo && thanksConfig.showCustomerName && resolvedCustomerName
                          ? `, ${resolvedCustomerName}` : ""}
                      </h1>
                    )}
                  </div>

                  <p className="gp-message" style={{ color: s.textPrimaryColor }}>
                    {hasOrderInfo
                      ? dynamicMainMessage
                      : "Si realizaste una compra, te enviaremos los detalles por correo. Puedes volver al inicio para seguir navegando."}
                  </p>

                  {thanksAccessError && (
                    <div
                      role="alert"
                      data-testid="thanks-access-error"
                      className="gp-message"
                      style={{ color: '#991b1b' }}
                    >
                      {thanksAccessError}
                    </div>
                  )}

                  {hasOrderInfo && (
                    <>
                      <p
                        className="gp-summary-title"
                        style={{ color: s.titleTextColor }}
                      >
                        {summaryTitle}
                      </p>

                      <div
                        className="gp-summary-rows"
                        style={{ borderColor: s.panelBorderColor }}
                      >
                        {thanksConfig.showOrderNumber && (
                          <div
                            className="gp-summary-row"
                            style={{
                              backgroundColor: `${s.accentColor}08`,
                              borderBottomColor: s.panelBorderColor,
                              color: s.textPrimaryColor,
                            }}
                          >
                            <span className="gp-summary-row-label">{thanksConfig.orderNumberLabel}</span>
                            <span className="gp-summary-row-value" style={{ color: s.accentColor }}>
                              #{resolvedOrderNumber || resolvedOrderId || '—'}
                            </span>
                          </div>
                        )}

                        {(paymentResponse.exists || thanksOrderData || wompiTxData) && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">{paymentStatusLabel}</span>
                            <span className="gp-summary-row-value">
                              {paymentStatusValue}
                            </span>
                          </div>
                        )}

                        {thanksConfig.showCustomerName && resolvedCustomerName && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">{thanksConfig.customerLabel}</span>
                            <span className="gp-summary-row-value">{resolvedCustomerName}</span>
                          </div>
                        )}

                        {resolvedBuyerEmail && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">Correo:</span>
                            <span className="gp-summary-row-value">{resolvedBuyerEmail}</span>
                          </div>
                        )}

                        {thanksConfig.showItemCount && resolvedItemCount > 0 && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">{thanksConfig.itemCountLabel}</span>
                            <span className="gp-summary-row-value">{resolvedItemCount} artículo(s)</span>
                          </div>
                        )}

                        {thanksConfig.showSubtotal && sub > 0 && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">{thanksConfig.subtotalLabel}</span>
                            <span className="gp-summary-row-value">{moneyCOP(sub)}</span>
                          </div>
                        )}

                        {thanksConfig.showShipping && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">{thanksConfig.shippingLabel}</span>
                            <span className="gp-summary-row-value">
                              {SHIP > 0 ? moneyCOP(SHIP) : 'Gratis'}
                            </span>
                          </div>
                        )}

                        {resolvedStoreCreditAmount > 0 && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">Saldo a favor aplicado:</span>
                            <span className="gp-summary-row-value">
                              {moneyCOP(resolvedStoreCreditAmount)}
                            </span>
                          </div>
                        )}

                        {resolvedStoreCreditAmount > 0 && resolvedAmountDue > 0 && (
                          <div className="gp-summary-row" style={{ borderBottomColor: s.panelBorderColor, color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">Pagado con Wompi:</span>
                            <span className="gp-summary-row-value">
                              {moneyCOP(resolvedAmountDue)}
                            </span>
                          </div>
                        )}

                        {thanksConfig.showTotal && total > 0 && (
                          <div
                            className="gp-summary-row total"
                            style={{
                              borderBottomColor: s.panelBorderColor,
                              backgroundColor: `${s.accentColor}10`,
                              color: s.textPrimaryColor,
                            }}
                          >
                            <span className="gp-summary-row-label" style={{ fontWeight: 700, opacity: 1 }}>
                              {totalLabel}
                            </span>
                            <span className="gp-summary-row-value" style={{ color: s.accentColor }}>
                              {moneyCOP(total)}
                            </span>
                          </div>
                        )}

                        {paymentResponse.processingDate && (
                          <div className="gp-summary-row" style={{ color: s.textPrimaryColor }}>
                            <span className="gp-summary-row-label">Fecha de proceso:</span>
                            <span className="gp-summary-row-value">{paymentResponse.processingDate}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {!hasOrderInfo && (
                    <div
                      className="gp-fallback-msg"
                      style={{ borderColor: s.panelBorderColor, color: s.textSecondaryColor }}
                    >
                      Si realizaste una compra, te enviaremos los detalles por correo.
                    </div>
                  )}

                  {thanksOrderData?.returnAccess?.enabled ? (
                    <button
                      type="button"
                      className="gp-cta-btn"
                      onClick={openReturnsPortal}
                      style={{
                        marginBottom: 10,
                        backgroundColor: s.panelBg,
                        color: s.buttonBg,
                        border: `1px solid ${s.buttonBg}`,
                        borderRadius: `${buttonRadius}px`,
                      }}
                    >
                      Gestionar cambios o devoluciones
                    </button>
                  ) : null}

                  {thanksConfig.showContinueButton && (
                    <button
                      type="button"
                      className="gp-cta-btn"
                      onClick={() => navigate('/')}
                      style={{
                        backgroundColor: s.buttonBg,
                        color: s.buttonTextColor,
                        borderRadius: `${buttonRadius}px`,
                        boxShadow: `0 10px 28px ${s.buttonBg}44`,
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {thanksConfig.continueButtonText}
                    </button>
                  )}

                  {thanksConfig.showHelpText && (
                    <p className="gp-help" style={{ color: s.textSecondaryColor }}>
                      {thanksConfig.helpText}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {thanksConfig.showFooter && <FooterSection />}
        {thanksConfig.showWhatsAppButton && <WhatsAppButton />}
      </div>
    </>
  );
}
