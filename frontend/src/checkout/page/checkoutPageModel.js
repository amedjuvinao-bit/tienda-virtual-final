export const EMPTY_STORE_CREDIT_PREVIEW = Object.freeze({
  status: 'idle',
  eligible: false,
  balance: 0,
  currency: 'COP',
  accessToken: '',
  message: '',
});

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function getFirstFiniteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

export function getItemQuantity(item) {
  return getFirstFiniteNumber(item?.quantity, item?.qty, item?.amount, 0);
}

export function getItemUnitPrice(item) {
  return getFirstFiniteNumber(
    item?.price,
    item?.unitPrice,
    item?.unit_price,
    item?.productPrice,
    item?.priceSnapshot,
    item?.salePrice,
    item?.finalPrice,
    item?.product?.price,
    item?.product?.unitPrice,
    0
  );
}

export function getItemLineTotal(item) {
  const explicitTotal = getFirstFiniteNumber(
    item?.lineTotal,
    item?.total,
    item?.subtotal,
    item?.amountTotal,
    Number.NaN
  );
  if (explicitTotal > 0) return explicitTotal;
  return getItemUnitPrice(item) * getItemQuantity(item);
}

export function getVariantDisplay(item = {}) {
  const explicitLabel = String(item.variantLabel || '').trim();
  if (explicitLabel) return explicitLabel;
  const attributes = Array.isArray(item.variantAttributes)
    ? item.variantAttributes
        .map((attribute) => String(attribute?.value || '').trim())
        .filter(Boolean)
    : [];
  return attributes.join(' / ') || [item.color, item.size].filter(Boolean).join(' / ');
}

export function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function normalizePaymentProvider(value) {
  const safe = String(value || '').trim().toLowerCase();
  const allowed = ['bold', 'wompi', 'mercado-pago', 'payu', 'manual'];
  return allowed.includes(safe) ? safe : '';
}

export function buildSafePaymentsConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  const provider = normalizePaymentProvider(cfg.provider);
  return {
    active: cfg.active !== false,
    provider,
    mode: cfg.mode === 'production' ? 'production' : 'sandbox',
    currency:
      typeof cfg.currency === 'string' && cfg.currency.trim()
        ? cfg.currency.trim().toUpperCase()
        : 'COP',
    checkoutLabel:
      typeof cfg.checkoutLabel === 'string' && cfg.checkoutLabel.trim()
        ? cfg.checkoutLabel.trim()
        : '',
    successMessage:
      typeof cfg.successMessage === 'string' && cfg.successMessage.trim()
        ? cfg.successMessage.trim()
        : '',
    enableWebhook: cfg.enableWebhook === true,
    credentials:
      cfg.credentials && typeof cfg.credentials === 'object' ? cfg.credentials : {},
  };
}

export function getPaymentProviderMeta(provider) {
  switch (provider) {
    case 'bold':
      return {
        label: 'Bold',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, serás redirigido a Bold para completar tu compra de forma segura.',
      };
    case 'wompi':
      return {
        label: 'Wompi',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, se abrirá Wompi para completar tu compra de forma segura.',
      };
    case 'mercado-pago':
      return {
        label: 'Mercado Pago',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, serás redirigido a Mercado Pago para completar tu compra de forma segura.',
      };
    case 'payu':
      return {
        label: 'PayU',
        checkoutMessage:
          'Después de hacer clic en el botón de pago, serás redirigido a PayU para completar tu compra de forma segura.',
      };
    case 'manual':
      return {
        label: 'Pago manual',
        checkoutMessage:
          'Después de confirmar tu pedido, verás las instrucciones para completar el pago manualmente según la configuración de la tienda.',
      };
    default:
      return {
        label: 'Proveedor no configurado',
        checkoutMessage:
          'La tienda aún no tiene una pasarela de pago configurada correctamente.',
      };
  }
}

export function buildSafeCheckoutPageConfig(raw) {
  const cfg = raw && typeof raw === 'object' ? raw : {};
  return {
    titleMode: cfg.titleMode === 'text' || cfg.titleMode === 'image' ? cfg.titleMode : 'text',
    titleText: typeof cfg.titleText === 'string' && cfg.titleText.trim() ? cfg.titleText : 'Checkout',
    titleImage: typeof cfg.titleImage === 'string' ? cfg.titleImage : '',
    titleImageAlt: typeof cfg.titleImageAlt === 'string' && cfg.titleImageAlt.trim() ? cfg.titleImageAlt : 'Título checkout',
    showHeader: cfg.showHeader !== false,
    showFooter: cfg.showFooter !== false,
    showWhatsAppButton: cfg.showWhatsAppButton !== false,
    showBreadcrumb: cfg.showBreadcrumb !== false,
    showContactSection: cfg.showContactSection !== false,
    showDeliverySection: cfg.showDeliverySection !== false,
    showBillingSection: cfg.showBillingSection !== false,
    showOrderSummary: cfg.showOrderSummary !== false,
    showPaymentMethodsImage: cfg.showPaymentMethodsImage !== false,
    showNewsletterCheckbox: cfg.showNewsletterCheckbox !== false,
    showPoliciesText: cfg.showPoliciesText !== false,
    showConfirmButton: cfg.showConfirmButton !== false,
    breadcrumbHomeText: typeof cfg.breadcrumbHomeText === 'string' && cfg.breadcrumbHomeText.trim() ? cfg.breadcrumbHomeText : 'Home',
    breadcrumbCurrentText: typeof cfg.breadcrumbCurrentText === 'string' && cfg.breadcrumbCurrentText.trim() ? cfg.breadcrumbCurrentText : 'Checkout',
    contactSectionTitle: typeof cfg.contactSectionTitle === 'string' && cfg.contactSectionTitle.trim() ? cfg.contactSectionTitle : 'Contacto',
    deliverySectionTitle: typeof cfg.deliverySectionTitle === 'string' && cfg.deliverySectionTitle.trim() ? cfg.deliverySectionTitle : 'Entrega',
    billingSectionTitle: typeof cfg.billingSectionTitle === 'string' && cfg.billingSectionTitle.trim() ? cfg.billingSectionTitle : 'Dirección de facturación',
    orderSummaryTitle: typeof cfg.orderSummaryTitle === 'string' && cfg.orderSummaryTitle.trim() ? cfg.orderSummaryTitle : 'Resumen de compra',
    emailLabelText: typeof cfg.emailLabelText === 'string' && cfg.emailLabelText.trim() ? cfg.emailLabelText : 'Email o número de teléfono móvil',
    phoneLabelText: typeof cfg.phoneLabelText === 'string' && cfg.phoneLabelText.trim() ? cfg.phoneLabelText : 'Teléfono',
    documentLabelText: typeof cfg.documentLabelText === 'string' && cfg.documentLabelText.trim() ? cfg.documentLabelText : 'Cédula',
    nameLabelText: typeof cfg.nameLabelText === 'string' && cfg.nameLabelText.trim() ? cfg.nameLabelText : 'Nombre',
    cityLabelText: typeof cfg.cityLabelText === 'string' && cfg.cityLabelText.trim() ? cfg.cityLabelText : 'Ciudad',
    addressLabelText: typeof cfg.addressLabelText === 'string' && cfg.addressLabelText.trim() ? cfg.addressLabelText : 'Dirección',
    neighborhoodLabelText: typeof cfg.neighborhoodLabelText === 'string' && cfg.neighborhoodLabelText.trim() ? cfg.neighborhoodLabelText : 'Barrio',
    notesLabelText: typeof cfg.notesLabelText === 'string' && cfg.notesLabelText.trim() ? cfg.notesLabelText : 'Información adicional',
    billingToggleText: typeof cfg.billingToggleText === 'string' && cfg.billingToggleText.trim() ? cfg.billingToggleText : 'Mi información de facturación es diferente',
    newsletterText: typeof cfg.newsletterText === 'string' && cfg.newsletterText.trim() ? cfg.newsletterText : 'Enviarme novedades y ofertas por correo electrónico',
    policiesText: typeof cfg.policiesText === 'string' && cfg.policiesText.trim() ? cfg.policiesText : 'Tus datos están seguros y encriptados',
    subtotalLabelText: typeof cfg.subtotalLabelText === 'string' && cfg.subtotalLabelText.trim() ? cfg.subtotalLabelText : 'Subtotal',
    totalLabelText: typeof cfg.totalLabelText === 'string' && cfg.totalLabelText.trim() ? cfg.totalLabelText : 'Total',
    shippingMessageText: typeof cfg.shippingMessageText === 'string' && cfg.shippingMessageText.trim() ? cfg.shippingMessageText : 'Impuestos y envío calculado al finalizar la compra',
    confirmButtonText: typeof cfg.confirmButtonText === 'string' && cfg.confirmButtonText.trim() ? cfg.confirmButtonText : 'Pagar ahora',
    paymentMethodsImage: typeof cfg.paymentMethodsImage === 'string' ? cfg.paymentMethodsImage : '',
    paymentMethodsImageAlt: typeof cfg.paymentMethodsImageAlt === 'string' && cfg.paymentMethodsImageAlt.trim() ? cfg.paymentMethodsImageAlt : 'Métodos de pago',
    style: {
      pageBg: typeof cfg?.style?.pageBg === 'string' ? cfg.style.pageBg : '#faf9f7',
      contentMaxWidthPx: clampInt(cfg?.style?.contentMaxWidthPx, 900, 1800, 1280),
      contentTopPaddingPx: clampInt(cfg?.style?.contentTopPaddingPx, 0, 240, 24),
      breadcrumbTextColor: typeof cfg?.style?.breadcrumbTextColor === 'string' ? cfg.style.breadcrumbTextColor : '#9ca3af',
      breadcrumbLinkColor: typeof cfg?.style?.breadcrumbLinkColor === 'string' ? cfg.style.breadcrumbLinkColor : '#db2777',
      titleTextColor: typeof cfg?.style?.titleTextColor === 'string' ? cfg.style.titleTextColor : '#111827',
      titleFontSizePx: clampInt(cfg?.style?.titleFontSizePx, 18, 72, 34),
      titleImageHeightPx: clampInt(cfg?.style?.titleImageHeightPx, 24, 220, 70),
      sectionCardBg: typeof cfg?.style?.sectionCardBg === 'string' ? cfg.style.sectionCardBg : '#ffffff',
      sectionCardBorderColor: typeof cfg?.style?.sectionCardBorderColor === 'string' ? cfg.style.sectionCardBorderColor : '#e5e7eb',
      sectionCardRadiusPx: clampInt(cfg?.style?.sectionCardRadiusPx, 0, 40, 14),
      sectionCardPaddingPx: clampInt(cfg?.style?.sectionCardPaddingPx, 8, 48, 24),
      textPrimaryColor: typeof cfg?.style?.textPrimaryColor === 'string' ? cfg.style.textPrimaryColor : '#111827',
      textSecondaryColor: typeof cfg?.style?.textSecondaryColor === 'string' ? cfg.style.textSecondaryColor : '#6b7280',
      accentColor: typeof cfg?.style?.accentColor === 'string' ? cfg.style.accentColor : '#ec4899',
      inputBg: typeof cfg?.style?.inputBg === 'string' ? cfg.style.inputBg : '#ffffff',
      inputBorderColor: typeof cfg?.style?.inputBorderColor === 'string' ? cfg.style.inputBorderColor : '#e2e8f0',
      inputTextColor: typeof cfg?.style?.inputTextColor === 'string' ? cfg.style.inputTextColor : '#111827',
      inputRadiusPx: clampInt(cfg?.style?.inputRadiusPx, 0, 40, 10),
      inputHeightPx: clampInt(cfg?.style?.inputHeightPx, 36, 80, 46),
      summaryBg: typeof cfg?.style?.summaryBg === 'string' ? cfg.style.summaryBg : '#ffffff',
      summaryBorderColor: typeof cfg?.style?.summaryBorderColor === 'string' ? cfg.style.summaryBorderColor : '#e5e7eb',
      summaryRadiusPx: clampInt(cfg?.style?.summaryRadiusPx, 0, 40, 14),
      subtotalTextColor: typeof cfg?.style?.subtotalTextColor === 'string' ? cfg.style.subtotalTextColor : '#374151',
      subtotalValueColor: typeof cfg?.style?.subtotalValueColor === 'string' ? cfg.style.subtotalValueColor : '#374151',
      totalTextColor: typeof cfg?.style?.totalTextColor === 'string' ? cfg.style.totalTextColor : '#111827',
      totalValueColor: typeof cfg?.style?.totalValueColor === 'string' ? cfg.style.totalValueColor : '#111827',
      confirmButtonBg: typeof cfg?.style?.confirmButtonBg === 'string' ? cfg.style.confirmButtonBg : '#ec4899',
      confirmButtonTextColor: typeof cfg?.style?.confirmButtonTextColor === 'string' ? cfg.style.confirmButtonTextColor : '#ffffff',
      confirmButtonRadiusPx: clampInt(cfg?.style?.confirmButtonRadiusPx, 0, 40, 12),
      paymentMethodsImageHeightPx: clampInt(cfg?.style?.paymentMethodsImageHeightPx, 24, 140, 96),
    },
  };
}
