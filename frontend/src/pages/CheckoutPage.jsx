// src/pages/CheckoutPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import FooterSection from '../components/FooterSection';
import WhatsAppButton from '../components/WhatsAppButton';
import { useCart } from '../context/CartContext';
import api, { setSessionId as setApiSessionId } from '../lib/api';
import { fetchSiteSettings } from '../lib/siteSettingsApi';
import { getSessionId } from '../utils/getSessionId';
import { useNavigate } from 'react-router-dom';
import ModalReembolso from '../components/ModalReembolso';
import ModalEnvio from '../components/ModalEnvio';
import ModalPrivacidad from '../components/ModalPrivacidad';
import ModalTerminos from '../components/ModalTerminos';
import ModalContacto from '../components/ModalContacto';
import { redirectToPayU } from '../lib/payuRedirect';
import CheckoutDianCustomerFields from '../checkout/dian/CheckoutDianCustomerFields';
import { dianCustomerDefaults } from '../checkout/dian/dianCustomerDefaults';
import { validateDianCustomer } from '../checkout/dian/dianCustomerValidators';


const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const WOMPI_WIDGET_URL = 'https://checkout.wompi.co/widget.js';

/* ─── helpers ─── */
function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function getFirstFiniteNumber(...values) {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function getItemQuantity(item) {
  return getFirstFiniteNumber(item?.quantity, item?.qty, item?.amount, 0);
}

function getItemUnitPrice(item) {
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

function getItemLineTotal(item) {
  const explicitTotal = getFirstFiniteNumber(
    item?.lineTotal,
    item?.total,
    item?.subtotal,
    item?.amountTotal,
    NaN
  );

  if (explicitTotal > 0) return explicitTotal;

  const qty = getItemQuantity(item);
  const unitPrice = getItemUnitPrice(item);
  return unitPrice * qty;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizePaymentProvider(value) {
  const safe = String(value || '').trim().toLowerCase();
  const allowed = ['bold', 'wompi', 'mercado-pago', 'payu', 'manual'];
  return allowed.includes(safe) ? safe : '';
}

function buildSafePaymentsConfig(raw) {
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

function getPaymentProviderMeta(provider) {
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

function buildSafeCheckoutPageConfig(raw) {
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

function loadWompiWidgetScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Wompi solo puede cargarse en el navegador.'));
  }

  if (typeof window.WidgetCheckout === 'function') {
    return Promise.resolve(window.WidgetCheckout);
  }

  const existing = document.querySelector(`script[src="${WOMPI_WIDGET_URL}"]`);

  if (existing) {
    return new Promise((resolve, reject) => {
      if (typeof window.WidgetCheckout === 'function') {
        resolve(window.WidgetCheckout);
        return;
      }

      const handleLoad = () => {
        if (typeof window.WidgetCheckout === 'function') {
          resolve(window.WidgetCheckout);
        } else {
          reject(new Error('El script de Wompi cargó, pero WidgetCheckout no está disponible.'));
        }
      };

      const handleError = () => reject(new Error('No se pudo cargar el script de Wompi.'));

      existing.addEventListener('load', handleLoad, { once: true });
      existing.addEventListener('error', handleError, { once: true });
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = WOMPI_WIDGET_URL;
    script.async = true;
    script.onload = () => {
      if (typeof window.WidgetCheckout === 'function') {
        resolve(window.WidgetCheckout);
      } else {
        reject(new Error('El script de Wompi cargó, pero WidgetCheckout no quedó disponible.'));
      }
    };
    script.onerror = () => reject(new Error('No se pudo cargar el widget de Wompi.'));
    document.head.appendChild(script);
  });
}

function normalizePhoneDigits(value) {
  return String(value || '').replace(/\D+/g, '');
}

function inferPhonePrefixFromCountryCode(countryCode) {
  const safe = String(countryCode || '').trim().toUpperCase();
  if (safe === 'CO') return '+57';
  return '';
}

function buildWompiCustomerData(customerData, selectedCountryCode) {
  const raw = customerData && typeof customerData === 'object' ? customerData : {};
  const phoneNumber = normalizePhoneDigits(raw.phone_number);
  const phonePrefix = inferPhonePrefixFromCountryCode(selectedCountryCode);

  const result = {
    email: typeof raw.email === 'string' && raw.email.trim() ? raw.email.trim() : undefined,
    fullName:
      typeof raw.full_name === 'string' && raw.full_name.trim()
        ? raw.full_name.trim()
        : undefined,
    legalId:
      typeof raw.legal_id === 'string' && raw.legal_id.trim()
        ? raw.legal_id.trim()
        : undefined,
    legalIdType:
      typeof raw.legal_id_type === 'string' && raw.legal_id_type.trim()
        ? raw.legal_id_type.trim()
        : undefined,
  };

  if (phoneNumber && phonePrefix) {
    result.phoneNumber = phoneNumber;
    result.phoneNumberPrefix = phonePrefix;
  }

  return Object.fromEntries(
    Object.entries(result).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
}

function buildWompiShippingAddress({
  deliveryType,
  customerAddress,
  customerCity,
  customerPhone,
  selectedCountryCode,
  selectedRegion,
  customerName,
  customerLastname,
  customerPostalCode,
}) {
  if (deliveryType !== 'envio') return undefined;

  const addressLine1 = String(customerAddress || '').trim();
  const city = String(customerCity || '').trim();
  const phoneNumber = normalizePhoneDigits(customerPhone);
  const region = String(selectedRegion || '').trim();
  const country = String(selectedCountryCode || '').trim().toUpperCase() || 'CO';
  const name = [customerName, customerLastname].filter(Boolean).join(' ').trim();
  const postalCode = String(customerPostalCode || '').trim();

  if (!addressLine1 || !city || !phoneNumber || !region || !country) {
    return undefined;
  }

  const shippingAddress = {
    addressLine1,
    city,
    phoneNumber,
    region,
    country,
  };

  if (name) shippingAddress.name = name;
  if (postalCode) shippingAddress.postalCode = postalCode;

  return shippingAddress;
}

function getWompiStatusMessage(status) {
  switch (String(status || '').toUpperCase()) {
    case 'APPROVED':
      return 'El pago fue aprobado correctamente.';
    case 'DECLINED':
      return 'El pago fue rechazado por Wompi.';
    case 'VOIDED':
      return 'El pago fue anulado.';
    case 'ERROR':
      return 'Wompi reportó un error al procesar el pago.';
    case 'PENDING':
      return 'El pago quedó pendiente de confirmación.';
    default:
      return 'No fue posible confirmar el estado final del pago.';
  }
}

/* ─── estilos globales ─── */
const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap');

  .co-page * { box-sizing: border-box; }

  .co-page {
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }

  .co-input {
    display: block;
    width: 100%;
    border: 1.5px solid var(--co-input-border);
    border-radius: var(--co-input-radius);
    padding: 0 14px;
    height: var(--co-input-h);
    background: var(--co-input-bg);
    color: var(--co-input-text);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    transition: border-color 0.18s, box-shadow 0.18s;
    outline: none;
    appearance: none;
    -webkit-appearance: none;
  }
  .co-input::placeholder { color: #b0b8c4; }
  .co-input:focus {
    border-color: var(--co-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--co-accent) 12%, transparent);
  }

  select.co-input {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%239ca3af' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }

  .co-card {
    background: var(--co-card-bg);
    border: 1.5px solid var(--co-card-border);
    border-radius: var(--co-card-radius);
    padding: var(--co-card-padding);
    margin-bottom: 20px;
    box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    transition: box-shadow 0.2s;
  }
  .co-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.07); }

  .co-card-title {
    font-family: 'DM Serif Display', serif;
    font-size: 18px;
    font-weight: 400;
    color: var(--co-text-primary);
    margin: 0 0 16px 0;
    letter-spacing: -0.01em;
  }

  .co-radio-option {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1.5px solid var(--co-card-border);
    border-radius: 10px;
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    color: var(--co-text-primary);
    transition: border-color 0.18s, background 0.18s;
  }
  .co-radio-option:has(input:checked) {
    border-color: var(--co-accent);
    background: color-mix(in srgb, var(--co-accent) 5%, transparent);
  }
  .co-radio-option input[type="radio"] {
    accent-color: var(--co-accent);
    width: 16px; height: 16px;
    cursor: pointer;
  }

  .co-btn-primary {
    width: 100%;
    padding: 15px 24px;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: none;
    cursor: pointer;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .co-btn-primary:not(:disabled):hover {
    opacity: 0.92;
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(236,72,153,0.28);
  }
  .co-btn-primary:not(:disabled):active { transform: translateY(0); }
  .co-btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .co-summary-card {
    border-radius: var(--co-summary-radius);
    border: 1.5px solid var(--co-summary-border);
    background: var(--co-summary-bg);
    padding: 24px;
    box-shadow: 0 1px 6px rgba(0,0,0,0.05);
  }

  .co-summary-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 12px 0;
    border-bottom: 1px solid #f3f4f6;
  }
  .co-summary-item:last-child { border-bottom: none; }

  .co-product-img {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 10px;
    flex-shrink: 0;
    border: 1px solid #f3f4f6;
  }

  .co-qty-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    background: #1f2937;
    color: #fff;
    font-size: 10px;
    font-weight: 600;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #fff;
  }

  .co-discount-row {
    display: flex;
    gap: 10px;
    margin-top: 20px;
  }
  .co-discount-row .co-input { flex: 1; }

  .co-btn-secondary {
    padding: 0 18px;
    height: var(--co-input-h);
    background: #f3f4f6;
    color: #374151;
    border: 1.5px solid #e5e7eb;
    border-radius: var(--co-input-radius);
    font-family: 'DM Sans', sans-serif;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .co-btn-secondary:hover { background: #e5e7eb; }

  .co-totals { margin-top: 20px; }
  .co-totals-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
    font-size: 14px;
  }
  .co-totals-divider {
    border: none;
    border-top: 1.5px solid #f3f4f6;
    margin: 10px 0;
  }
  .co-totals-total {
    font-size: 17px;
    font-weight: 600;
  }

  .co-shipping-box {
    background: linear-gradient(135deg, #fdf2f8 0%, #fff7ed 100%);
    border: 1.5px solid #fce7f3;
    border-radius: 10px;
    padding: 14px 16px;
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .co-payment-redirect {
    background: #f9fafb;
    border: 1.5px dashed #e5e7eb;
    border-radius: 10px;
    padding: 20px;
    text-align: center;
    font-size: 13px;
    color: #6b7280;
    line-height: 1.6;
  }

  .co-payment-provider-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    border-radius: 999px;
    border: 1px solid #fbcfe8;
    background: #fdf2f8;
    color: #be185d;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 6px 12px;
  }

  .co-payment-icon {
    width: 64px;
    height: 44px;
    margin: 0 auto 12px;
    background: #fff;
    border: 1.5px solid #e5e7eb;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .co-policies {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 16px;
    margin-top: 20px;
    padding-bottom: 8px;
  }

  .co-policy-link {
    font-size: 11px;
    color: #ec4899;
    text-decoration: underline;
    background: none;
    border: none;
    cursor: pointer;
    padding: 2px 0;
    transition: color 0.15s;
    font-family: 'DM Sans', sans-serif;
  }
  .co-policy-link:hover { color: #be185d; }

  .co-secure-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 11px;
    color: #9ca3af;
    margin-top: 10px;
  }

  .co-error-banner {
    border: 1.5px solid #fca5a5;
    background: linear-gradient(135deg, #fff1f2, #fff5f7);
    border-radius: 12px;
    padding: 16px 20px;
    font-size: 13px;
    color: #9f1239;
  }
  .co-error-banner strong { display: block; margin-bottom: 8px; font-size: 14px; }
  .co-error-banner ul { margin: 0; padding-left: 18px; }
  .co-error-banner li { margin-bottom: 4px; }

  .co-field-label {
    display: block;
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 6px;
    letter-spacing: 0.01em;
  }

  .co-breadcrumb {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    margin-bottom: 24px;
    flex-wrap: wrap;
  }

  .co-layout {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    align-items: start;
  }

  @media (min-width: 1024px) {
    .co-layout {
      grid-template-columns: 1fr 420px;
      gap: 40px;
      align-items: stretch;
    }
    .co-form-col { order: 1; }
    .co-summary-col {
      order: 2;
      min-height: 100%;
    }
  }

  @media (min-width: 1024px) {
    .co-summary-sticky {
      position: sticky;
      top: 120px;
      align-self: start;
    }
  }

  @media (min-width: 1024px) {
    .co-summary-col {
      border-left: 1.5px solid #f3f4f6;
      padding-left: 40px;
      align-self: start;
    }
  }

  .co-grid-2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .co-grid-2 { grid-template-columns: 1fr; }
  }

  .co-mt-3 { margin-top: 12px; }
  .co-mt-4 { margin-top: 16px; }
  .co-mt-5 { margin-top: 20px; }

  .co-newsletter {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #6b7280;
    margin-top: 10px;
    cursor: pointer;
    user-select: none;
  }
  .co-newsletter input[type="checkbox"] {
    accent-color: var(--co-accent);
    width: 15px; height: 15px;
    cursor: pointer;
    flex-shrink: 0;
  }

  .co-step-indicator {
    display: flex;
    align-items: center;
    gap: 0;
    margin-bottom: 28px;
    font-size: 12px;
    font-weight: 500;
  }
  .co-step {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #d1d5db;
  }
  .co-step.active { color: var(--co-accent); }
  .co-step.done { color: #374151; }
  .co-step-num {
    width: 22px; height: 22px;
    border-radius: 50%;
    border: 1.5px solid currentColor;
    display: flex; align-items: center; justify-content: center;
    font-size: 11px;
    flex-shrink: 0;
  }
  .co-step.active .co-step-num {
    background: var(--co-accent);
    border-color: var(--co-accent);
    color: #fff;
  }
  .co-step-sep {
    width: 28px;
    height: 1.5px;
    background: #e5e7eb;
    margin: 0 4px;
    flex-shrink: 0;
  }
  @media (max-width: 480px) {
    .co-step-sep { width: 14px; }
  }
`;

function CheckoutPage() {
  const [deliveryType, setDeliveryType] = useState('envio');
  const [discountCode, setDiscountCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponError, setCouponError] = useState('');
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [sameAddress, setSameAddress] = useState(true);
  const [wantsNewsletter, setWantsNewsletter] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [showPrivacidadModal, setShowPrivacidadModal] = useState(false);
  const [showTerminosModal, setShowTerminosModal] = useState(false);
  const [showContactoModal, setShowContactoModal] = useState(false);
  const [errors, setErrors] = useState([]);

  const [checkoutPageData, setCheckoutPageData] = useState(null);
  const [checkoutConfig, setCheckoutConfig] = useState(buildSafeCheckoutPageConfig({}));
  const [checkoutConfigLoading, setCheckoutConfigLoading] = useState(true);

  const [shippingConfig, setShippingConfig] = useState(null);
  const [shippingConfigLoading, setShippingConfigLoading] = useState(true);

  const [paymentsConfig, setPaymentsConfig] = useState(buildSafePaymentsConfig({}));
  const [paymentsConfigLoading, setPaymentsConfigLoading] = useState(true);

  const [cartView, setCartView] = useState(null);
  const [serverSummary, setServerSummary] = useState(null);

  const [countries, setCountries] = useState([]);
  const [countriesLoading, setCountriesLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('');
  const [citiesList, setCitiesList] = useState([]);
  const [citiesLoading, setCitiesLoading] = useState(false);
  const [billingRegions, setBillingRegions] = useState([]);
  const [billingRegionsLoading, setBillingRegionsLoading] = useState(false);
  const [billingCities, setBillingCities] = useState([]);
  const [billingCitiesLoading, setBillingCitiesLoading] = useState(false);

  const [customerName, setCustomerName] = useState('');
  const [customerLastname, setCustomerLastname] = useState('');
  const [customerEmailOrPhone, setCustomerEmailOrPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerCityCode, setCustomerCityCode] = useState('');
  const [customerPostalCode, setCustomerPostalCode] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerCountry, setCustomerCountry] = useState('Colombia');
  const [dianCustomer, setDianCustomer] = useState(dianCustomerDefaults);

  const { cart, clearCart } = useCart();
  const currentCart = cartView ?? cart;
  const cartRequiresShipping = useMemo(
    () =>
      (currentCart || []).some(
        (item) =>
          item?.requiresShipping !== false &&
          item?.product?.requiresShipping !== false
      ),
    [currentCart]
  );
  const cartNeedsElectronicDelivery = useMemo(
    () =>
      (currentCart || []).some((item) => {
        const productType = String(
          item?.productType || item?.product?.productType || ''
        ).toLowerCase();

        if (['digital', 'service'].includes(productType)) {
          return true;
        }

        if (productType !== 'bundle') return false;

        return (
          item?.fulfillment?.bundle?.components ||
          item?.product?.fulfillment?.bundle?.components ||
          []
        ).some((component) =>
          ['digital', 'service'].includes(
            String(component?.productType || '').toLowerCase()
          )
        );
      }),
    [currentCart]
  );

  useEffect(() => {
    if (!cartRequiresShipping && deliveryType !== 'digital') {
      setDeliveryType('digital');
      return;
    }

    if (cartRequiresShipping && deliveryType === 'digital') {
      setDeliveryType('envio');
    }
  }, [cartRequiresShipping, deliveryType]);

  const cssVars = useMemo(() => ({
    '--co-accent': checkoutConfig.style.accentColor,
    '--co-input-bg': checkoutConfig.style.inputBg,
    '--co-input-border': checkoutConfig.style.inputBorderColor,
    '--co-input-text': checkoutConfig.style.inputTextColor,
    '--co-input-radius': `${checkoutConfig.style.inputRadiusPx}px`,
    '--co-input-h': `${checkoutConfig.style.inputHeightPx}px`,
    '--co-card-bg': checkoutConfig.style.sectionCardBg,
    '--co-card-border': checkoutConfig.style.sectionCardBorderColor,
    '--co-card-radius': `${checkoutConfig.style.sectionCardRadiusPx}px`,
    '--co-card-padding': `${checkoutConfig.style.sectionCardPaddingPx}px`,
    '--co-summary-bg': checkoutConfig.style.summaryBg,
    '--co-summary-border': checkoutConfig.style.summaryBorderColor,
    '--co-summary-radius': `${checkoutConfig.style.summaryRadiusPx}px`,
    '--co-text-primary': checkoutConfig.style.textPrimaryColor,
    '--co-text-secondary': checkoutConfig.style.textSecondaryColor,
    backgroundColor: checkoutConfig.style.pageBg,
  }), [checkoutConfig]);

  const localSubtotal = (currentCart || []).reduce(
    (sum, item) => sum + getItemLineTotal(item),
    0
  );
  const subtotal = Number(serverSummary?.subtotal ?? localSubtotal);
  const itemCount = (currentCart || []).reduce((sum, it) => sum + getItemQuantity(it), 0);

  const selectedCountry = useMemo(
    () =>
      countries.find(
        (c) => c.name?.toLowerCase() === String(customerCountry).toLowerCase()
      ),
    [countries, customerCountry]
  );

  const matchedZone = useMemo(() => {
    const zones = Array.isArray(shippingConfig?.zones) ? shippingConfig.zones : [];
    const countryNorm = normalizeText(customerCountry);
    const departmentNorm = normalizeText(selectedCountry?.code === 'CO' ? selectedRegion : '');
    const cityNorm = normalizeText(customerCity);

    if (!countryNorm || !cityNorm) return null;

    return (
      zones.find((zone) => {
        const zoneCountry = normalizeText(zone?.country);
        const zoneDepartment = normalizeText(zone?.department);
        const zoneCity = normalizeText(zone?.city);

        if (zoneCountry && zoneCountry !== countryNorm) return false;
        if (zoneDepartment && zoneDepartment !== departmentNorm) return false;
        if (!zoneCity || zoneCity !== cityNorm) return false;

        return true;
      }) || null
    );
  }, [shippingConfig, customerCountry, selectedCountry?.code, selectedRegion, customerCity]);

  const shipping = useMemo(() => {
    if (!cartRequiresShipping) return 0;
    if (deliveryType === 'retiro') return 0;

    const envios = shippingConfig;
    if (!envios || shippingConfigLoading) return 20000;
    if (envios.active === false) return 0;

    const freeEnabled = envios?.freeShipping?.enabled === true;
    const freeMinimum = Number(envios?.freeShipping?.minimum || 0);

    if (freeEnabled && Number.isFinite(freeMinimum) && subtotal >= freeMinimum) {
      return 0;
    }

    const mode = String(envios.mode || '').toLowerCase();

    if (mode === 'fixed') {
      const fixedPrice = Number(envios.fixedPrice);
      return Number.isFinite(fixedPrice) ? fixedPrice : 0;
    }

    if (mode === 'zones') {
      const zonePrice = Number(matchedZone?.price);
      if (Number.isFinite(zonePrice)) return zonePrice;

      const fallbackPrice = Number(envios?.fallback?.price);
      return Number.isFinite(fallbackPrice) ? fallbackPrice : 0;
    }

    return 20000;
  }, [cartRequiresShipping, deliveryType, shippingConfig, shippingConfigLoading, matchedZone, subtotal]);

  const quotePricing = checkoutQuote?.pricing || null;
  const quotedSubtotal = Number(quotePricing?.subtotal ?? subtotal);
  const productDiscount = Number(quotePricing?.productDiscount || 0);
  const shippingDiscount = Number(quotePricing?.shippingDiscount || 0);
  const finalShipping = Number(quotePricing?.shipping ?? shipping);
  const taxAmount = Number(quotePricing?.tax?.amount || 0);
  const taxPercent = Number(quotePricing?.tax?.percent || 0);
  const total = Number(
    quotePricing?.total ?? quotedSubtotal - productDiscount + finalShipping + taxAmount
  );

  const shippingEta = useMemo(() => {
    if (!cartRequiresShipping) {
      return 'Sin envío físico';
    }
    if (deliveryType === 'retiro') return 'Retiro disponible en tienda';
    if (finalShipping === 0) {
      return matchedZone?.eta || shippingConfig?.estimatedTime || shippingConfig?.fallback?.eta || 'Envío gratis aplicado';
    }
    return (
      matchedZone?.eta ||
      shippingConfig?.fallback?.eta ||
      shippingConfig?.estimatedTime ||
      'Tiempo no configurado'
    );
  }, [cartRequiresShipping, deliveryType, finalShipping, matchedZone, shippingConfig]);

  const shippingLabel = useMemo(() => {
    if (!cartRequiresShipping) return 'Entrega digital o coordinación';
    if (deliveryType === 'retiro') return 'Retiro en tienda';
    if (matchedZone?.city) return `Envío a ${matchedZone.city}`;
    if (customerCity) return `Envío a ${customerCity}`;
    return 'Envío configurado';
  }, [cartRequiresShipping, deliveryType, matchedZone, customerCity]);

  const paymentProviderMeta = useMemo(
    () => getPaymentProviderMeta(paymentsConfig.provider),
    [paymentsConfig.provider]
  );

  const paymentBlockTitle = useMemo(() => {
    if (!paymentsConfig.active) return 'Pagos temporalmente desactivados';
    return paymentsConfig.checkoutLabel || paymentProviderMeta.label;
  }, [paymentsConfig.active, paymentsConfig.checkoutLabel, paymentProviderMeta.label]);

  const paymentBlockMessage = useMemo(() => {
    if (!paymentsConfig.active) {
      return 'La tienda no tiene un método de pago activo en este momento. Contacta al comercio para continuar la compra.';
    }

    if (!paymentsConfig.provider) {
      return 'La tienda aún no tiene una pasarela de pago configurada correctamente.';
    }

    if (paymentsConfig.provider === 'manual' && paymentsConfig.successMessage) {
      return paymentsConfig.successMessage;
    }

    return paymentProviderMeta.checkoutMessage;
  }, [paymentsConfig.active, paymentsConfig.provider, paymentsConfig.successMessage, paymentProviderMeta.checkoutMessage]);

  const paymentEnvironmentLabel = useMemo(() => {
    return paymentsConfig.mode === 'production' ? 'Producción' : 'Pruebas';
  }, [paymentsConfig.mode]);

  const paymentCanProceed = useMemo(() => {
    return paymentsConfig.active !== false && !!paymentsConfig.provider;
  }, [paymentsConfig.active, paymentsConfig.provider]);

  const navigate = useNavigate();
  const [isPlacing, setIsPlacing] = useState(false);

  const buildQuoteRequestPayload = (couponCode = '') => ({
    sessionId: getSessionId(),
    items: (currentCart || []).map((item) => ({
      productId: String(item.productId || item._id || item.id || item?.product?._id || ''),
      title: item.title || item?.product?.title || '',
      image: item.image || item?.product?.image || '',
      color: item.color || '',
      size: item.size || '',
      variantId: item.variantId || item.variantKey || '',
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
    const code = String(discountCode || '').trim().toUpperCase().replace(/\s+/g, '');

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
        const { data } = await api.post('/api/orders/quote', buildQuoteRequestPayload(couponCode));
        if (cancelled) return;

        setCheckoutQuote(data || null);

        if (couponCode && data?.coupon) {
          setCouponError('');
          setAppliedCoupon(data.coupon);
          setDiscountCode(data.coupon.code || couponCode);
          setCouponMessage(data.coupon.message || 'Cupón aplicado correctamente.');
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
            response.message || error?.userMessage || 'No se pudo aplicar el cupón.'
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

  useEffect(() => {
    let cancel = false;
    const loadCheckoutConfig = async () => {
      try {
        setCheckoutConfigLoading(true);
        const res = await fetch(`${API_BASE}/api/pages/checkout`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancel) return;
        setCheckoutPageData(data);
        setCheckoutConfig(buildSafeCheckoutPageConfig(data?.checkoutPageConfig));
      } catch (error) {
        if (!cancel) {
          setCheckoutPageData(null);
          setCheckoutConfig(buildSafeCheckoutPageConfig({}));
        }
      } finally {
        if (!cancel) setCheckoutConfigLoading(false);
      }
    };
    loadCheckoutConfig();
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    let cancel = false;

    const loadSiteConfig = async () => {
      try {
        setShippingConfigLoading(true);
        setPaymentsConfigLoading(true);

        const data = await fetchSiteSettings();
        if (cancel) return;

        const envios = data?.theme?.global?.envios || null;
        const payments = data?.theme?.global?.payments || {};

        setShippingConfig(envios);
        setPaymentsConfig(buildSafePaymentsConfig(payments));
      } catch (error) {
        if (!cancel) {
          console.error('Error cargando configuración global:', error);
          setShippingConfig(null);
          setPaymentsConfig(buildSafePaymentsConfig({}));
        }
      } finally {
        if (!cancel) {
          setShippingConfigLoading(false);
          setPaymentsConfigLoading(false);
        }
      }
    };

    loadSiteConfig();

    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    const sid = getSessionId();
    try { setApiSessionId(sid); } catch { }
  }, []);

  useEffect(() => {
    if (paymentsConfig.provider !== 'wompi' || paymentsConfig.active === false) return;
    loadWompiWidgetScript().catch(() => { });
  }, [paymentsConfig.provider, paymentsConfig.active]);

  useEffect(() => {
    let cancel = false;
    setCountriesLoading(true);
    api.get('/api/geo/countries')
      .then((res) => {
        if (cancel) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setCountries(list);
        const hasCurrent = list.some(c => c.name?.toLowerCase() === String(customerCountry).toLowerCase());
        if (!hasCurrent) {
          const co = list.find(c => c.code === 'CO');
          setCustomerCountry(co ? co.name : '');
        }
      })
      .catch(() => setCountries([]))
      .finally(() => !cancel && setCountriesLoading(false));
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (!selectedCountry || selectedCountry.code !== 'CO') {
      setRegions([]);
      setSelectedRegion('');
      setCitiesList([]);
      return;
    }
    let cancel = false;
    setRegionsLoading(true);
    api.get('/api/geo/regions', { params: { country: 'CO' } })
      .then(res => { if (!cancel) setRegions(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (!cancel) setRegions([]); })
      .finally(() => { if (!cancel) setRegionsLoading(false); });
    return () => { cancel = true; };
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedCountry?.code !== 'CO' || !selectedRegion) {
      setCitiesList([]);
      return;
    }
    let cancel = false;
    setCitiesLoading(true);
    api.get('/api/geo/cities', { params: { country: 'CO', region: selectedRegion, limit: 10000 } })
      .then(res => { if (!cancel) setCitiesList(Array.isArray(res.data) ? res.data : []); })
      .catch(() => { if (!cancel) setCitiesList([]); })
      .finally(() => { if (!cancel) setCitiesLoading(false); });
    return () => { cancel = true; };
  }, [selectedCountry?.code, selectedRegion]);

  useEffect(() => {
    const countryCode = String(dianCustomer.country || '').trim().toUpperCase();

    if (sameAddress || countryCode !== 'CO') {
      setBillingRegions([]);
      setBillingCities([]);
      return;
    }

    let cancel = false;
    setBillingRegionsLoading(true);

    api.get('/api/geo/regions', { params: { country: 'CO' } })
      .then((res) => {
        if (!cancel) setBillingRegions(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancel) setBillingRegions([]);
      })
      .finally(() => {
        if (!cancel) setBillingRegionsLoading(false);
      });

    return () => { cancel = true; };
  }, [sameAddress, dianCustomer.country]);

  useEffect(() => {
    const countryCode = String(dianCustomer.country || '').trim().toUpperCase();
    const departmentCode = String(dianCustomer.departmentCode || '').trim();

    if (sameAddress || countryCode !== 'CO' || !departmentCode) {
      setBillingCities([]);
      return;
    }

    let cancel = false;
    setBillingCitiesLoading(true);

    api.get('/api/geo/cities', {
      params: { country: 'CO', region: departmentCode, limit: 10000 },
    })
      .then((res) => {
        if (!cancel) setBillingCities(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancel) setBillingCities([]);
      })
      .finally(() => {
        if (!cancel) setBillingCitiesLoading(false);
      });

    return () => { cancel = true; };
  }, [sameAddress, dianCustomer.country, dianCustomer.departmentCode]);

  const resolvedDianCustomer = useMemo(() => {
    const emailFromContact = String(customerEmailOrPhone || '').includes('@')
      ? String(customerEmailOrPhone || '').trim()
      : '';
    const countryCode = String(selectedCountry?.code || '').trim().toUpperCase();
    const selectedDepartment = regions.find(
      (region) => String(region?.code || '').trim() === String(selectedRegion || '').trim()
    );

    return {
      ...dianCustomer,
      personType: dianCustomer.personType || 'natural',
      documentType: dianCustomer.documentType || 'CC',
      documentNumber: String(dianCustomer.documentNumber || customerId || '').trim(),
      firstName: dianCustomer.firstName || customerName,
      lastName: dianCustomer.lastName || customerLastname,
      email: dianCustomer.email || emailFromContact,
      phone: dianCustomer.phone || customerPhone,
      tributeCode: dianCustomer.tributeCode || 'ZZ',
      ...(sameAddress
        ? {
            address: customerAddress,
            extra: '',
            city: customerCity,
            cityCode: customerCityCode,
            municipalityCode: customerCityCode,
            department: selectedDepartment?.name || selectedRegion,
            departmentCode: selectedRegion,
            postalCode: customerPostalCode,
            country: countryCode,
            countryName: selectedCountry?.name || customerCountry,
          }
        : {}),
    };
  }, [
    dianCustomer,
    sameAddress,
    customerId,
    customerName,
    customerLastname,
    customerEmailOrPhone,
    customerPhone,
    customerAddress,
    customerCity,
    customerCityCode,
    customerPostalCode,
    customerCountry,
    selectedCountry,
    selectedRegion,
    regions,
  ]);

  const validateCheckout = () => {
    const errs = [];
    const isBlank = (v) => !v || String(v).trim() === '';

    if (!paymentCanProceed) {
      errs.push('La tienda no tiene un método de pago activo o configurado correctamente.');
    }

    if (isBlank(customerName)) errs.push('El nombre es obligatorio.');
    if (isBlank(customerLastname)) errs.push('El apellido es obligatorio.');
    if (isBlank(customerEmailOrPhone)) errs.push('Email o teléfono es obligatorio.');
    if (isBlank(customerId)) errs.push('La cédula es obligatoria.');
    if (
      cartNeedsElectronicDelivery &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        String(resolvedDianCustomer.email || '').trim()
      )
    ) {
      errs.push(
        'Los productos digitales y servicios necesitan un correo válido para la entrega.'
      );
    }

    if (cartRequiresShipping && deliveryType === 'envio') {
      if (isBlank(customerAddress)) errs.push('La dirección de envío es obligatoria.');
      if (isBlank(customerCountry)) errs.push('El país es obligatorio.');
      if (selectedCountry?.code === 'CO' && isBlank(selectedRegion)) errs.push('El departamento es obligatorio para Colombia.');
      if (isBlank(customerCity)) errs.push('La ciudad es obligatoria.');
    }

    if (checkoutConfig.showBillingSection) {
      errs.push(...validateDianCustomer(resolvedDianCustomer));
    }

    if (!currentCart || currentCart.length === 0 || itemCount === 0) errs.push('El carrito está vacío.');
    if (quoteLoading) errs.push('Espera mientras verificamos IVA, descuentos y total.');
    if (!quoteLoading && currentCart?.length > 0 && !quotePricing) {
      errs.push('No fue posible verificar el total final con el servidor.');
    }
    if (subtotal <= 0) errs.push('El subtotal debe ser mayor a 0.');
    if (total <= 0) errs.push('El total debe ser mayor a 0.');

    setErrors(errs);
    return errs;
  };

  const formatAdjustments = (adjustments = []) => {
    if (!Array.isArray(adjustments) || !adjustments.length) return [];
    const byId = new Map((currentCart || []).map(it => [String(it._id || it.productId || it.id || ''), it.title || 'Producto']));
    const msgs = [];
    for (const a of adjustments) {
      const pid = String(a?.productId || a?._id || '');
      const name = byId.get(pid) || 'Producto';
      const fromQty = Number(a?.requestedQty ?? a?.originalQty ?? a?.qty ?? 0);
      const toQty = Number(a?.finalQty ?? 0);
      const note = a?.note ? String(a.note) : '';
      if (toQty === 0) msgs.push(`Sin stock para "${name}" (eliminado).`);
      else if (toQty < fromQty) msgs.push(`Stock limitado para "${name}": ${fromQty} → ${toQty}.`);
      if (note && !/sin stock|limitado|ajustada/i.test(note)) msgs.push(`Actualización para "${name}": ${note}.`);
    }
    return msgs;
  };

  const formatOrderConflictDetails = (details = []) => {
    if (!Array.isArray(details) || details.length === 0) return [];
    const byId = new Map((currentCart || []).map(it => [String(it._id || it.productId || it.id || ''), it.title || 'Producto']));
    const msgs = [];
    for (const d of details) {
      const name = d?.title || byId.get(String(d?.productId || d?._id || '')) || 'Producto';
      const reason = d?.reason || 'Conflicto de stock';
      const requested = d?.requested ?? d?.qty ?? d?.quantity ?? null;
      msgs.push(`${reason} en "${name}"${requested != null ? ` (pedido: ${requested})` : ''}.`);
    }
    return msgs;
  };

  const openWompiCheckout = async ({
    orderId,
    orderNumber,
    orderSubtotal,
    orderDiscount,
    orderTax,
    orderShipping,
    orderTotal,
    lineItemCount,
  }) => {
    console.log('Entrando a openWompiCheckout');
    console.log('ORDER ID:', orderId);

    const selectedCountryCode = selectedCountry?.code || 'CO';

    const { data } = await api.post('/api/payments/wompi/checkout-data', { orderId });

    console.log('WOMPI BACKEND DATA:', data);

    if (!data) {
      throw new Error(data?.message || 'No se pudo preparar el checkout de Wompi.');
    }

    await loadWompiWidgetScript();

    if (typeof window === 'undefined' || typeof window.WidgetCheckout !== 'function') {
      throw new Error('El widget de Wompi no está disponible en este navegador.');
    }

    const wompiCustomerData = buildWompiCustomerData(data.customerData, selectedCountryCode);

    const wompiShippingAddress = buildWompiShippingAddress({
      deliveryType,
      customerAddress,
      customerCity,
      customerPhone,
      selectedCountryCode,
      selectedRegion,
      customerName,
      customerLastname,
      customerPostalCode,
    });

    console.log('DATA COMPLETA WOMPI:', data);
    console.log('PUBLIC KEY DESDE BACKEND:', data.publicKey);

    const widgetConfig = {
      currency: data.currency,
      amountInCents: data.amountInCents,
      reference: data.reference,
      publicKey: data.publicKey,
      acceptanceToken: data.acceptanceToken,
      redirectUrl: data.redirectUrl,
      personalDataAcceptanceToken: data.personalDataAcceptanceToken,
      signature: {
        integrity: data.signature,
      },
    };

    if (Object.keys(wompiCustomerData).length > 0) {
      widgetConfig.customerData = wompiCustomerData;
    }

    if (wompiShippingAddress) {
      widgetConfig.shippingAddress = wompiShippingAddress;
    }

    console.log('WOMPI WIDGET CONFIG:', widgetConfig);
    console.log('REDIRECT URL BACKEND:', data.redirectUrl);
    console.log('WidgetCheckout disponible:', typeof window.WidgetCheckout);
    console.log('CONFIG FINAL EXACTA:', JSON.stringify(widgetConfig, null, 2));

    const checkout = new window.WidgetCheckout(widgetConfig);

    setIsPlacing(false);
    checkout.open(async (result) => {
      console.log('Resultado Wompi:', result);

      const tx = result?.transaction || null;
      const txStatus = String(tx?.status || '').toUpperCase();

      if (txStatus === 'APPROVED') {
        await clearCart();

        navigate('/gracias', {
          state: {
            orderId,
            orderNumber,
            customerName,
            subtotal: orderSubtotal,
            discount: orderDiscount,
            tax: orderTax,
            shipping: orderShipping,
            total: orderTotal,
            itemCount: lineItemCount,
            transactionId: tx?.id || '',
          },
        });

        return;
      }

      if (txStatus === 'DECLINED') {
        setErrors(['El pago fue rechazado por Wompi.']);
        return;
      }

      if (txStatus === 'ERROR') {
        setErrors(['Wompi reportó un error al procesar el pago.']);
        return;
      }

      if (txStatus === 'PENDING') {
        setErrors(['El pago quedó pendiente de confirmación.']);
        return;
      }
    });
    
  };
  const handlePlaceOrder = async () => {
    if (isPlacing) return;
      setIsPlacing(true);
      setErrors([]);

      const errs = validateCheckout();
      if (errs.length > 0) {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
        setIsPlacing(false);
        return;
    }

    const sessionId = getSessionId();
    try { setApiSessionId(sessionId); } catch { }
    
    let val;
    let serverItems = null;
    let putSummary = null;

    try {
      const { data } = await api.post('/api/cart/validate', { sessionId, mode: 'strict' });
      val = data;

      if (Array.isArray(val?.items)) {
        try {
          const putRes = await api.put(`/api/cart/${sessionId}`, { items: val.items });
          serverItems = putRes?.data?.cart?.items ?? null;
          putSummary = putRes?.data?.cart?.summary ?? null;
        } catch (_) { }
      }

      const filteredFromServer = (serverItems || []).filter(i => Number(i?.quantity ?? i?.qty ?? 0) > 0);
      const filteredFromVal = (val?.items || []).filter(i => Number(i?.quantity ?? i?.qty ?? 0) > 0);
      const uiItems = filteredFromServer.length ? filteredFromServer : filteredFromVal;

      const adjMsgs = formatAdjustments(val?.adjustments);
      const nonZero = uiItems.length;

      if (val?.code === 'NO_STOCK' || nonZero === 0) {
        setErrors(['No hay stock disponible para los artículos del carrito.', ...adjMsgs]);
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
        setIsPlacing(false);
        return;
      }

      if (adjMsgs.length) {
        setErrors(['Se ajustó tu carrito por disponibilidad/precio. Revisa el resumen y confirma nuevamente.', ...adjMsgs]);
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
        setIsPlacing(false);
        return;
      }

      if (filteredFromServer.length) {
        setCartView(filteredFromServer);
      }
      if (putSummary ?? val?.summary) {
        setServerSummary(putSummary ?? val?.summary ?? null);
      }
    } catch (e) {
      setErrors(['No pudimos validar tu carrito en este momento. Intenta nuevamente.']);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
      setIsPlacing(false);
      return;
    }

    const validatedRaw = Array.isArray(serverItems) ? serverItems : (Array.isArray(val?.items) ? val.items : []);
    const finalItems = validatedRaw
      .map(it => ({
        _id: String(it._id || it.productId || it?.product?._id || it?.product?.id || ''),
        title: it.title || it?.product?.title || '',
        image: it.image || it?.product?.image || '',
        color: it.color || '',
        size: it.size || '',
        variantId: it.variantId || it.variantKey || '',
        quantity: Number(it.quantity ?? it.qty ?? 0) || 0,
        price: Number(it.price ?? it?.product?.price ?? 0) || 0,
        productType: it.productType || it?.product?.productType || 'physical',
        requiresShipping:
          it.requiresShipping ?? it?.product?.requiresShipping ?? true,
        fulfillment: it.fulfillment || it?.product?.fulfillment || null,
      }))
      .filter(it => it._id && it.quantity > 0);

    const finalSummary = putSummary ?? val?.summary ?? {
      subtotal: finalItems.reduce((s, x) => s + x.price * x.quantity, 0)
    };

    const customer = {
      name: customerName,
      lastname: customerLastname,
      id: String(customerId).trim(),
      emailOrPhone: customerEmailOrPhone,
      phone: customerPhone,
      address: customerAddress,
      city: customerCity,
      postalCode: customerPostalCode,
      country: customerCountry,
      countryCode: selectedCountry?.code || '',
      municipalityId: customerCityCode,
      department: selectedCountry?.code === 'CO' ? selectedRegion : undefined,
      departmentCode: selectedCountry?.code === 'CO' ? selectedRegion : undefined,
      deliveryType,
      wantsNewsletter
    };

    const billing = {
      useSameAddress: sameAddress,
      personType: resolvedDianCustomer.personType,
      documentType: resolvedDianCustomer.documentType,
      documentNumber: resolvedDianCustomer.documentNumber,
      id: resolvedDianCustomer.documentNumber,
      dv: resolvedDianCustomer.documentType === 'NIT' ? resolvedDianCustomer.dv : '',
      firstName: resolvedDianCustomer.firstName,
      lastName: resolvedDianCustomer.lastName,
      name: resolvedDianCustomer.firstName,
      lastname: resolvedDianCustomer.lastName,
      businessName: resolvedDianCustomer.businessName,
      email: resolvedDianCustomer.email,
      phone: resolvedDianCustomer.phone,
      address: resolvedDianCustomer.address,
      extra: resolvedDianCustomer.extra,
      city: resolvedDianCustomer.city,
      cityCode: resolvedDianCustomer.cityCode,
      municipalityCode: resolvedDianCustomer.municipalityCode,
      department: resolvedDianCustomer.department,
      departmentCode: resolvedDianCustomer.departmentCode,
      postalCode: resolvedDianCustomer.postalCode,
      country: resolvedDianCustomer.countryName || resolvedDianCustomer.country,
      countryCode: resolvedDianCustomer.country,
      tributeCode: resolvedDianCustomer.tributeCode || 'ZZ',
    };

    const payment = {
      active: paymentsConfig.active,
      provider: paymentsConfig.provider,
      providerLabel: paymentProviderMeta.label,
      mode: paymentsConfig.mode,
      currency: paymentsConfig.currency,
      checkoutLabel: paymentsConfig.checkoutLabel,
      enableWebhook: paymentsConfig.enableWebhook,
      status: paymentsConfig.provider === 'manual' ? 'pending_manual' : 'pending_gateway',
    };

    const order = {
      sessionId,
      cart: finalItems,
      subtotal: Number(finalSummary.subtotal || 0),
      shipping,
      total,
      couponCode: appliedCoupon?.code || '',
      customer,
      billing: checkoutConfig.showBillingSection ? billing : undefined,
      payment
    };

    try {
      const idempKey =
        typeof window !== 'undefined' &&
        window.crypto &&
        typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      
          const response = await api.post('/api/orders', order, {
        headers: { 'Idempotency-Key': idempKey }
      });

      const createdOrderId = response.data?._id || response.data?.order?._id || '';
      const createdOrderNumber = response.data?.orderNumber || response.data?.order?.code || '';
      const createdPricing = response.data?.pricing || {};
      const createdSubtotal = Number(response.data?.subtotal ?? createdPricing.subtotal ?? order.subtotal);
      const createdDiscount = Number(
        createdPricing.totalDiscount ?? response.data?.coupon?.totalDiscountAmount ?? 0
      );
      const createdTax = Number(response.data?.taxes?.iva?.amount ?? createdPricing.taxAmount ?? 0);
      const createdShipping = Number(response.data?.shipping ?? createdPricing.shipping ?? 0);
      const createdTotal = Number(response.data?.total ?? createdPricing.total ?? order.total);

      if (!(response.status === 201 || response.status === 200) || !createdOrderId) {
        setErrors(['Ocurrió un problema al procesar tu orden. Intenta nuevamente.']);
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
        setIsPlacing(false);
        return;
      }
      console.log('PROVIDER ACTUAL:', paymentsConfig.provider);
      if (paymentsConfig.provider === 'manual') {
        await clearCart();
        navigate('/gracias', {
          state: {
            orderId: createdOrderId,
            orderNumber: createdOrderNumber,
            customerName,
            subtotal: createdSubtotal,
            discount: createdDiscount,
            tax: createdTax,
            shipping: createdShipping,
            total: createdTotal,
            itemCount: finalItems.length,
          }
        });
        return;
      }
      if (paymentsConfig.provider === 'wompi') {
        try {
          await openWompiCheckout({
            orderId: createdOrderId,
            orderNumber: createdOrderNumber,
            orderSubtotal: createdSubtotal,
            orderDiscount: createdDiscount,
            orderTax: createdTax,
            orderShipping: createdShipping,
            orderTotal: createdTotal,
            lineItemCount: finalItems.length,
          });
          return;
        } catch (gatewayError) {
          setErrors([
            gatewayError?.response?.data?.message ||
            gatewayError?.message ||
            'No fue posible iniciar el checkout de Wompi.',
          ]);
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
          setIsPlacing(false);
          return;
        }
      }
      
      if (paymentsConfig.provider === 'payu') {
        try {
          const { data } = await api.post('/api/payments/payu/checkout-data', {
            orderId: createdOrderId,
          });

          console.log('PAYU CHECKOUT DATA:', data);

          // 👉 REDIRECCIÓN (USANDO TU ARCHIVO payuRedirect.js)
          redirectToPayU(data);

          return;
        } catch (gatewayError) {
          setErrors([
            gatewayError?.response?.data?.message ||
            gatewayError?.message ||
            'No fue posible preparar el checkout de PayU.',
          ]);

          try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch {}

          setIsPlacing(false);
          return;
        }
      }


      setErrors(['La pasarela activa aún no tiene flujo frontend implementado en esta pantalla.']);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
    } catch (error) {
      if (error?.response?.status === 409) {
        const data = error.response.data || {};

        if (data?.error === 'IDEMPOTENT_IN_PROGRESS') {
          setErrors([
            'Ya hay un intento de pago en proceso.',
            'Espera unos segundos y vuelve a intentarlo una sola vez.',
          ]);
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
          setIsPlacing(false);
          return;
        }

        if (data?.error === 'DUPLICATE_ORDER') {
          setErrors([
            'Esta orden ya había sido creada.',
            'No vuelvas a pulsar el botón varias veces. Revisa el panel o el estado del pago.',
          ]);
          try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
          setIsPlacing(false);
          return;
        }

  const msgs = formatOrderConflictDetails(data.details);
  const header =
    data.message ||
    (data.code === 'NO_STOCK'
      ? 'No hay stock suficiente para uno o más artículos.'
      : 'Conflicto al crear la orden.');

  setErrors([header, ...msgs]);
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
  setIsPlacing(false);
  return; 
      }

      setErrors([error?.response?.data?.message || error.userMessage || 'Error al enviar la orden. Intenta nuevamente.']);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
    } finally {
      setIsPlacing(false);
    }
  };

  let disableReason = '';
  if (!paymentCanProceed) disableReason = 'No hay un método de pago activo o configurado.';
  else if (!currentCart || currentCart.length === 0 || itemCount === 0) disableReason = 'El carrito está vacío.';
  else if (quoteLoading) disableReason = 'Verificando IVA, descuentos y total...';
  else if (!quotePricing) disableReason = 'No se pudo verificar el total final.';
  else if (subtotal <= 0) disableReason = 'El subtotal debe ser mayor a 0.';
  else if (total <= 0) disableReason = 'El total debe ser mayor a 0.';

  return (
    <>
      <style>{GLOBAL_STYLES}</style>

      <div className="co-page" style={cssVars}>
        {checkoutConfig.showHeader && <Header />}

        {errors.length > 0 && (
          <div
            style={{
              maxWidth: `${checkoutConfig.style.contentMaxWidthPx}px`,
              margin: '0 auto',
              padding: '0 16px',
            }}
          >
            <div className="co-error-banner" style={{ marginTop: '88px', marginBottom: '0' }}>
              <strong>Por favor corrige los siguientes puntos:</strong>
              <ul>
                {errors.map((msg, i) => <li key={i}>{msg}</li>)}
              </ul>
            </div>
          </div>
        )}

        <div
          style={{
            maxWidth: `${checkoutConfig.style.contentMaxWidthPx}px`,
            margin: '0 auto',
            padding: `${errors.length > 0 ? 20 : Math.max(checkoutConfig.style.contentTopPaddingPx, 88)}px 16px 40px`,
          }}
        >
          {checkoutConfig.showBreadcrumb && (
            <div className="co-breadcrumb" style={{ color: checkoutConfig.style.breadcrumbTextColor }}>
              <a
                href="/"
                style={{ color: checkoutConfig.style.breadcrumbLinkColor, fontWeight: 500 }}
              >
                {checkoutConfig.breadcrumbHomeText}
              </a>
              <span style={{ color: '#d1d5db' }}>›</span>
              <span>{checkoutConfig.breadcrumbCurrentText}</span>
            </div>
          )}

          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            {checkoutConfig.titleMode === 'image' && checkoutConfig.titleImage ? (
              <img
                src={checkoutConfig.titleImage}
                alt={checkoutConfig.titleImageAlt || 'Checkout'}
                style={{
                  height: `${checkoutConfig.style.titleImageHeightPx}px`,
                  objectFit: 'contain',
                  margin: '0 auto',
                  display: 'block'
                }}
              />
            ) : (
              <h1
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: `${checkoutConfig.style.titleFontSizePx}px`,
                  fontWeight: 400,
                  color: checkoutConfig.style.titleTextColor,
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                {checkoutConfig.titleText}
              </h1>
            )}
          </div>

          <div className="co-step-indicator" style={{ justifyContent: 'center' }}>
            <div className="co-step done">
              <div className="co-step-num">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </div>
              <span>Carrito</span>
            </div>
            <div className="co-step-sep" />
            <div className="co-step active">
              <div className="co-step-num">2</div>
              <span>Datos</span>
            </div>
            <div className="co-step-sep" />
            <div className="co-step">
              <div className="co-step-num">3</div>
              <span>Confirmación</span>
            </div>
          </div>

          <div className="co-layout">
            <div className="co-form-col">
              {checkoutConfig.showContactSection && (
                <div className="co-card">
                  <h2 className="co-card-title">{checkoutConfig.contactSectionTitle}</h2>

                  <label className="co-field-label">{checkoutConfig.emailLabelText}</label>
                  <input
                    type="text"
                    className="co-input"
                    placeholder="tu@email.com o +57 300..."
                    value={customerEmailOrPhone}
                    onChange={(e) => setCustomerEmailOrPhone(e.target.value)}
                    autoComplete="email"
                    name="contact"
                  />

                  {checkoutConfig.showNewsletterCheckbox && (
                    <label className="co-newsletter">
                      <input
                        type="checkbox"
                        checked={wantsNewsletter}
                        onChange={(e) => setWantsNewsletter(e.target.checked)}
                      />
                      {checkoutConfig.newsletterText}
                    </label>
                  )}

                  <div className="co-mt-4">
                    <label className="co-field-label">{checkoutConfig.documentLabelText}</label>
                    <input
                      type="text"
                      className="co-input"
                      placeholder="12345678"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      autoComplete="off"
                      name="customerId"
                    />
                  </div>

                  <div className="co-grid-2 co-mt-4">
                    <div>
                      <label className="co-field-label">{checkoutConfig.nameLabelText}</label>
                      <input
                        type="text"
                        className="co-input"
                        placeholder="María"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        autoComplete="given-name"
                        name="firstName"
                      />
                    </div>
                    <div>
                      <label className="co-field-label">Apellidos</label>
                      <input
                        type="text"
                        className="co-input"
                        placeholder="García"
                        value={customerLastname}
                        onChange={(e) => setCustomerLastname(e.target.value)}
                        autoComplete="family-name"
                        name="lastName"
                      />
                    </div>
                  </div>
                </div>
              )}

              {checkoutConfig.showDeliverySection && cartRequiresShipping && (
                <div className="co-card">
                  <h2 className="co-card-title">{checkoutConfig.deliverySectionTitle}</h2>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    <label className="co-radio-option">
                      <input type="radio" name="delivery" value="envio" checked={deliveryType === 'envio'} onChange={() => setDeliveryType('envio')} />
                      <span>🚚</span>
                      <span style={{ fontWeight: 500 }}>Envío a domicilio</span>
                    </label>
                    <label className="co-radio-option">
                      <input type="radio" name="delivery" value="retiro" checked={deliveryType === 'retiro'} onChange={() => setDeliveryType('retiro')} />
                      <span>🏪</span>
                      <span style={{ fontWeight: 500 }}>Retiro en tienda</span>
                    </label>
                  </div>

                  <label className="co-field-label">País / Región</label>
                  <select
                    className="co-input"
                    value={customerCountry}
                    onChange={(e) => {
                      setCustomerCountry(e.target.value);
                      setSelectedRegion('');
                      setCustomerCity('');
                      setCustomerCityCode('');
                      setCitiesList([]);
                    }}
                    disabled={countriesLoading}
                    name="country"
                    autoComplete="country-name"
                  >
                    <option value="">{countriesLoading ? 'Cargando países...' : 'Selecciona país'}</option>
                    {countries.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                  </select>

                  {selectedCountry?.code === 'CO' && (
                    <div className="co-mt-3">
                      <label className="co-field-label">Departamento</label>
                      <select
                        className="co-input"
                        value={selectedRegion}
                        onChange={(e) => {
                          setSelectedRegion(e.target.value);
                          setCustomerCity('');
                          setCustomerCityCode('');
                          setCitiesList([]);
                        }}
                        disabled={regionsLoading}
                        name="region"
                      >
                        <option value="">{regionsLoading ? 'Cargando departamentos...' : 'Selecciona departamento'}</option>
                        {regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="co-mt-3">
                    <label className="co-field-label">{checkoutConfig.cityLabelText}</label>
                    {selectedCountry?.code === 'CO' ? (
                      <select
                        className="co-input"
                        value={customerCityCode}
                        onChange={(e) => {
                          const selectedCode = e.target.value;

                          setCustomerCityCode(selectedCode);

                          const selectedCity = citiesList.find(
                            (c) => c.code === selectedCode
                          );

                          setCustomerCity(selectedCity?.name || '');
                        }}
                        disabled={!selectedRegion || citiesLoading}
                        name="city"
                        autoComplete="address-level2"
                      >
                        <option value="">
                          {!selectedRegion
                            ? 'Selecciona un departamento primero'
                            : (citiesLoading
                                ? 'Cargando ciudades...'
                                : 'Selecciona ciudad')}
                        </option>

                        {citiesList.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="co-input"
                        placeholder="Tu ciudad"
                        value={customerCity}
                        onChange={(e) => setCustomerCity(e.target.value)}
                        name="city"
                        autoComplete="address-level2"
                      />
                    )}
                  </div>

                  <div className="co-mt-3">
                    <label className="co-field-label">{checkoutConfig.addressLabelText}</label>
                    <input
                      type="text"
                      className="co-input"
                      placeholder="Calle 10 # 20-30, Apto 5"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      name="address"
                      autoComplete="address-line1"
                    />
                  </div>

                  <div className="co-grid-2 co-mt-3">
                    <div>
                      <label className="co-field-label">Código Postal</label>
                      <input
                        type="text"
                        className="co-input"
                        placeholder="110111"
                        value={customerPostalCode}
                        onChange={(e) => setCustomerPostalCode(e.target.value)}
                        name="postalCode"
                        autoComplete="postal-code"
                      />
                    </div>
                    <div>
                      <label className="co-field-label">{checkoutConfig.phoneLabelText}</label>
                      <input
                        type="tel"
                        className="co-input"
                        placeholder="+57 300 000 0000"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        name="phone"
                        autoComplete="tel"
                      />
                    </div>
                  </div>

                  <div className="co-shipping-box">
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                        {shippingLabel}
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                        {shippingEta}
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: checkoutConfig.style.accentColor }}>
                      {finalShipping === 0 ? 'Gratis' : `$ ${finalShipping.toLocaleString('es-CO')}`}
                    </div>
                  </div>
                </div>
              )}

              {!cartRequiresShipping && (
                <div className="co-card">
                  <h2 className="co-card-title">Entrega de la compra</h2>
                  <div className="co-shipping-box">
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                        Sin envío físico
                      </div>
                      <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px' }}>
                        Recibirás por correo los enlaces digitales o las instrucciones para coordinar el servicio después de confirmar el pago.
                      </div>
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: checkoutConfig.style.accentColor }}>
                      Gratis
                    </div>
                  </div>
                </div>
              )}

              <div className="co-card">
                <h2 className="co-card-title">Pago</h2>
                <p style={{ fontSize: '13px', color: checkoutConfig.style.textSecondaryColor, marginBottom: '16px' }}>
                  Todas las transacciones son seguras y están encriptadas.
                </p>

                {checkoutConfig.showPaymentMethodsImage && (
                  <div style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                      Métodos de pago aceptados
                    </span>
                    <div style={{ marginTop: '10px' }}>
                      <img
                        src={checkoutConfig.paymentMethodsImage || '/src/assets/LogosMetodosDePago.png'}
                        alt={checkoutConfig.paymentMethodsImageAlt || 'Métodos de pago'}
                        style={{ height: `${checkoutConfig.style.paymentMethodsImageHeightPx}px`, objectFit: 'contain' }}
                      />
                    </div>
                  </div>
                )}

                <div className="co-payment-redirect">
                  <div className="co-payment-provider-badge">
                    {paymentsConfigLoading ? 'Cargando pago...' : paymentBlockTitle}
                  </div>

                  <div className="co-payment-icon">
                    <svg width="32" height="20" viewBox="0 0 32 20" fill="none">
                      <rect width="32" height="20" rx="4" fill="#f3f4f6" />
                      <rect x="0" y="5" width="32" height="5" fill="#e5e7eb" />
                    </svg>
                  </div>

                  <div style={{ marginBottom: '8px', fontSize: '12px', color: '#9ca3af' }}>
                    Ambiente: <strong>{paymentEnvironmentLabel}</strong> · Moneda: <strong>{paymentsConfig.currency}</strong>
                  </div>

                  <div>
                    {paymentBlockMessage}
                  </div>
                </div>
              </div>

              {checkoutConfig.showBillingSection && (
                <CheckoutDianCustomerFields
                  value={resolvedDianCustomer}
                  onChange={(nextValue, changedFields) => {
                    setDianCustomer((current) => ({
                      ...current,
                      ...(changedFields || nextValue),
                    }));
                  }}
                  useSameAddress={sameAddress}
                  onUseSameAddressChange={setSameAddress}
                  countries={countries}
                  countriesLoading={countriesLoading}
                  regions={billingRegions}
                  regionsLoading={billingRegionsLoading}
                  cities={billingCities}
                  citiesLoading={billingCitiesLoading}
                  title={checkoutConfig.billingSectionTitle || 'Datos para facturación electrónica'}
                  differentAddressLabel={checkoutConfig.billingToggleText}
                />
              )}

              {checkoutConfig.showConfirmButton && (
                <button
                  className="co-btn-primary"
                  style={{
                    backgroundColor: checkoutConfig.style.confirmButtonBg,
                    color: checkoutConfig.style.confirmButtonTextColor,
                    borderRadius: `${checkoutConfig.style.confirmButtonRadiusPx}px`,
                    marginTop: '8px',
                  }}
                  onClick={handlePlaceOrder}
                  disabled={
                    isPlacing ||
                    !currentCart ||
                    currentCart.length === 0 ||
                    itemCount === 0 ||
                    quoteLoading ||
                    !quotePricing ||
                    subtotal <= 0 ||
                    total <= 0 ||
                    !paymentCanProceed
                  }
                >
                  {isPlacing ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
                        <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="25" strokeLinecap="round" />
                      </svg>
                      Procesando...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M13 5H3a1 1 0 00-1 1v6a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M5 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      {paymentsConfig.provider === 'manual' ? 'Confirmar pedido' : checkoutConfig.confirmButtonText}
                    </>
                  )}
                </button>
              )}

              {disableReason && !isPlacing && (
                <p style={{ marginTop: '8px', fontSize: '12px', textAlign: 'center', color: '#ec4899' }}>
                  {disableReason}
                </p>
              )}

              {checkoutConfig.showPoliciesText && (
                <div className="co-secure-badge">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L2 2.5v4C2 8.5 3.8 10.5 6 11c2.2-.5 4-2.5 4-4.5v-4L6 1z" stroke="#9ca3af" strokeWidth="1.2" />
                    <path d="M4 6l1.5 1.5L8 4.5" stroke="#9ca3af" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  {checkoutConfig.policiesText}
                </div>
              )}

              <div className="co-policies">
                <button type="button" className="co-policy-link" onClick={() => setShowModal(true)}>Políticas de reembolso</button>
                <button type="button" className="co-policy-link" onClick={() => setShowEnvioModal(true)}>Política de Envío</button>
                <button type="button" className="co-policy-link" onClick={() => setShowPrivacidadModal(true)}>Privacidad</button>
                <button type="button" className="co-policy-link" onClick={() => setShowTerminosModal(true)}>Términos del servicio</button>
                <button type="button" className="co-policy-link" onClick={() => setShowContactoModal(true)}>Contacto</button>
              </div>
            </div>

            {checkoutConfig.showOrderSummary && (
              <div className="co-summary-col">
                <div className="co-summary-sticky">
                  <div className="co-summary-card">
                    <h2
                      style={{
                        fontFamily: "'DM Serif Display', serif",
                        fontSize: '18px',
                        fontWeight: 400,
                        margin: '0 0 16px 0',
                        color: checkoutConfig.style.textPrimaryColor,
                      }}
                    >
                      {checkoutConfig.orderSummaryTitle}
                    </h2>

                    <div>
                      {(currentCart || []).map((item, index) => {
                        const itemQty = getItemQuantity(item);
                        const itemTotal = getItemLineTotal(item);
                        return (
                          <div key={index} className="co-summary-item">
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <img src={item.image} alt={item.title} className="co-product-img" />
                              <span className="co-qty-badge">{itemQty}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 4px', lineHeight: 1.3, color: checkoutConfig.style.textPrimaryColor }}>
                                {item.title}
                              </p>
                              <p style={{ fontSize: '12px', color: checkoutConfig.style.textSecondaryColor, margin: 0 }}>
                                {[item.color, item.size].filter(Boolean).join(' / ')}
                              </p>
                            </div>
                            <div style={{ fontSize: '14px', fontWeight: 600, flexShrink: 0, color: checkoutConfig.style.textPrimaryColor }}>
                              ${itemTotal.toLocaleString('es-CO')}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="co-discount-row">
                      <input
                        type="text"
                        className="co-input"
                        placeholder="Código de descuento"
                        value={discountCode}
                        onChange={(e) => {
                          const nextValue = e.target.value;
                          setDiscountCode(nextValue);
                          setCouponError('');
                          if (
                            appliedCoupon?.code &&
                            String(nextValue || '').trim().toUpperCase().replace(/\s+/g, '') !== appliedCoupon.code
                          ) {
                            setAppliedCoupon(null);
                            setCouponMessage('');
                          }
                        }}
                        autoComplete="off"
                        name="discountCode"
                      />
                      <button
                        className="co-btn-secondary"
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={quoteLoading}
                      >
                        {quoteLoading && appliedCoupon?.code ? 'Validando...' : 'Aplicar'}
                      </button>
                    </div>

                    {(couponMessage || couponError) && (
                      <div
                        role={couponError ? 'alert' : 'status'}
                        style={{
                          marginTop: '8px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: couponError ? '#be123c' : '#047857',
                        }}
                      >
                        {couponError || couponMessage}
                      </div>
                    )}

                    <hr className="co-totals-divider" style={{ marginTop: '20px' }} />
                    <div className="co-totals">
                      <div className="co-totals-row">
                        <span style={{ color: checkoutConfig.style.subtotalTextColor }}>
                          {checkoutConfig.subtotalLabelText}
                        </span>
                        <span style={{ color: checkoutConfig.style.subtotalValueColor, fontWeight: 500 }}>
                          ${quotedSubtotal.toLocaleString('es-CO')}
                        </span>
                      </div>
                      {productDiscount > 0 && (
                        <div className="co-totals-row">
                          <span style={{ color: '#047857' }}>
                            Descuento{appliedCoupon?.code ? ` · ${appliedCoupon.code}` : ''}
                          </span>
                          <span style={{ fontWeight: 600, color: '#047857' }}>
                            -${productDiscount.toLocaleString('es-CO')}
                          </span>
                        </div>
                      )}
                      {(taxPercent > 0 || taxAmount > 0) && (
                        <div className="co-totals-row">
                          <span style={{ color: '#6b7280' }}>IVA ({taxPercent}%)</span>
                          <span style={{ fontWeight: 500 }}>
                            ${taxAmount.toLocaleString('es-CO')}
                          </span>
                        </div>
                      )}
                      <div className="co-totals-row">
                        <span style={{ color: '#6b7280' }}>Envío</span>
                        <span style={{ fontWeight: 500 }}>
                          {shipping === 0 ? 'Gratis' : `$${shipping.toLocaleString('es-CO')}`}
                        </span>
                      </div>
                      {shippingDiscount > 0 && (
                        <div className="co-totals-row">
                          <span style={{ color: '#047857' }}>Descuento de envío</span>
                          <span style={{ fontWeight: 600, color: '#047857' }}>
                            -${shippingDiscount.toLocaleString('es-CO')}
                          </span>
                        </div>
                      )}
                      <hr className="co-totals-divider" />
                      <div className="co-totals-row co-totals-total">
                        <span style={{ color: checkoutConfig.style.totalTextColor }}>
                          {checkoutConfig.totalLabelText}
                        </span>
                        <span style={{ color: checkoutConfig.style.accentColor }}>
                          {paymentsConfig.currency} ${total.toLocaleString('es-CO')}
                        </span>
                      </div>
                    </div>

                    {checkoutConfig.shippingMessageText && (
                      <p style={{ fontSize: '11px', color: checkoutConfig.style.textSecondaryColor, marginTop: '12px', lineHeight: 1.5 }}>
                        {checkoutConfig.shippingMessageText}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {showModal && <ModalReembolso visible={true} onClose={() => setShowModal(false)} />}
        <ModalEnvio visible={showEnvioModal} onClose={() => setShowEnvioModal(false)} />
        <ModalPrivacidad visible={showPrivacidadModal} onClose={() => setShowPrivacidadModal(false)} />
        <ModalTerminos visible={showTerminosModal} onClose={() => setShowTerminosModal(false)} />
        <ModalContacto visible={showContactoModal} onClose={() => setShowContactoModal(false)} />
        {checkoutConfig.showFooter && <FooterSection />}
        {checkoutConfig.showWhatsAppButton && <WhatsAppButton />}
      </div>
    </>
  );
}

export default CheckoutPage;
