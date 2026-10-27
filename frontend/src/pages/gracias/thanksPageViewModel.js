import {
  getPaymentStatusMeta,
  mapGatewayStatusToUiStatus,
} from "./paymentResponseModel";

const nonnegative = (value) =>
  Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

export function buildThanksPageSlides(config) {
  const slides = Array.isArray(config?.slider?.slides)
    ? config.slider.slides.filter((slide) => slide?.image)
    : [];
  return slides;
}

export function formatMoneyCop(value) {
  return Number(value || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

const VERIFYING_META = Object.freeze({
  badge: "Verificando pago",
  badgeBg: "#eff6ff",
  badgeText: "#1d4ed8",
  title: "Estamos confirmando tu pago",
  message:
    "Espera un momento mientras consultamos el resultado seguro con el servidor.",
  showSuccessCheck: false,
});

const UNVERIFIED_META = Object.freeze({
  badge: "Pago no verificado",
  badgeBg: "#fef3c7",
  badgeText: "#b45309",
  title: "No pudimos confirmar tu pago",
  message:
    "Recibimos el regreso de la pasarela, pero no pudimos confirmar el resultado con el servidor. No tomes esta pantalla como comprobante de pago.",
  showSuccessCheck: false,
});

export function buildThanksPageViewModel({
  paymentResponse,
  thanksOrderData,
  wompiTxData,
  thanksConfig,
  thanksAccessError = "",
  verificationLoading = false,
}) {
  const verified = Boolean(thanksOrderData || wompiTxData);
  const hasUnverifiedResult = Boolean(
    !verified &&
      !verificationLoading &&
      (thanksAccessError || paymentResponse?.exists),
  );

  const orderNumber = String(
    thanksOrderData?.orderNumber || wompiTxData?.orderNumber || "",
  );
  const orderId = String(
    thanksOrderData?.orderId || wompiTxData?.orderId || "",
  );
  const customerName = String(thanksOrderData?.customerName || "");
  const itemCount = Math.floor(nonnegative(thanksOrderData?.itemCount));
  const provider = String(
    thanksOrderData?.paymentProvider || (wompiTxData ? "wompi" : "") || "",
  );
  const paymentStatus =
    mapGatewayStatusToUiStatus(thanksOrderData?.paymentStatus) || "unknown";
  const fallbackStatus =
    paymentStatus === "unknown"
      ? mapGatewayStatusToUiStatus(
          thanksOrderData?.status || wompiTxData?.paymentStatus,
        )
      : paymentStatus;
  const rawPaymentStatus = String(
    thanksOrderData?.paymentStatusLabel ||
      thanksOrderData?.paymentStatusRaw ||
      thanksOrderData?.paymentGatewayStatus ||
      (provider === "store_credit" && thanksOrderData?.paymentStatus === "paid"
        ? "Pagado con saldo a favor"
        : thanksOrderData?.paymentStatus) ||
      wompiTxData?.wompiStatus ||
      "",
  );
  const shipping = nonnegative(thanksOrderData?.shipping);
  const subtotal = nonnegative(thanksOrderData?.subtotal);
  const storeCreditAmount = nonnegative(thanksOrderData?.storeCredit?.amount);
  const amountDue = nonnegative(
    thanksOrderData?.amountDue ??
      nonnegative(thanksOrderData?.total) - storeCreditAmount,
  );
  const protectedWompiTotal = nonnegative(wompiTxData?.amountInCents) / 100;
  const total =
    thanksOrderData?.total != null
      ? nonnegative(thanksOrderData.total)
      : wompiTxData?.amountInCents != null
        ? protectedWompiTotal
        : subtotal + shipping;

  const hasOrderInfo =
    verified &&
    Boolean(orderNumber || orderId || thanksOrderData || wompiTxData);
  const hasPaymentResult =
    verified || hasUnverifiedResult || verificationLoading;
  const paymentMeta = verificationLoading
    ? VERIFYING_META
    : hasUnverifiedResult
      ? UNVERIFIED_META
      : !verified
        ? {
            badge: "",
            title: thanksConfig.entryTitleText,
            message: thanksConfig.entryMessage,
            showSuccessCheck: false,
            badgeText: thanksConfig.style.accentColor,
            badgeBg: "transparent",
            neutral: true,
          }
        : getPaymentStatusMeta(
            fallbackStatus,
            provider,
            thanksConfig.mainMessage,
          );

  return {
    orderNumber,
    orderId,
    customerName,
    itemCount,
    provider,
    consumerContract: thanksOrderData?.consumerContract || null,
    paymentStatus: fallbackStatus,
    rawPaymentStatus,
    shipping,
    subtotal,
    total,
    storeCreditAmount,
    amountDue,
    hasOrderInfo,
    hasPaymentResult,
    verified,
    hasUnverifiedResult,
    verificationLoading,
    paymentMeta,
    dynamicTitleText: hasPaymentResult
      ? paymentMeta.title
      : thanksConfig.entryTitleText,
    dynamicMainMessage:
      verified && !verificationLoading && fallbackStatus === "approved"
        ? thanksConfig.mainMessage
        : verified && !verificationLoading && fallbackStatus === "pending"
          ? thanksConfig.pendingMessageText
          : hasPaymentResult
            ? paymentMeta.message
            : thanksConfig.entryMessage,
    summaryTitle: thanksConfig.summaryTitle,
    hasOrderDetails: Boolean(thanksOrderData),
    totalLabel:
      fallbackStatus === "approved"
        ? thanksConfig.totalLabel
        : thanksConfig.pendingTotalLabel,
    paymentStatusLabel:
      provider === "payu"
        ? "Estado de PayU:"
        : provider === "wompi"
          ? "Estado de Wompi:"
          : provider === "store_credit"
            ? "Medio de pago:"
            : "Estado del pago:",
    paymentStatusValue: verified
      ? thanksOrderData?.paymentStatusLabel ||
        (provider === "store_credit" && fallbackStatus === "approved"
          ? "Pagado con saldo a favor"
          : "") ||
        {
          approved: "Aprobado",
          pending: "Pendiente",
          rejected: "Rechazado",
          expired: "Expirado",
          error: "Error",
          unknown: "Sin confirmar",
        }[fallbackStatus] ||
        rawPaymentStatus ||
        "—"
      : "No verificado",
  };
}

export function getThanksPagePresentationStyle(style) {
  const shadowClass =
    style.shadowStyle === "none"
      ? ""
      : style.shadowStyle === "medium"
        ? "shadow-md"
        : style.shadowStyle === "strong"
          ? "shadow-xl"
          : "shadow-sm";
  const buttonRadius =
    style.buttonStyle === "pill"
      ? 999
      : style.buttonStyle === "rounded"
        ? style.buttonRadiusPx
        : 8;
  return { shadowClass, buttonRadius };
}
