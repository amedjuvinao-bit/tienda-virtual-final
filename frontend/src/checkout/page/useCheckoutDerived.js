import { useEffect, useMemo } from 'react';
import { calculateStoreCreditApplication } from '../storeCreditCheckout';
import {
  getItemLineTotal,
  getItemQuantity,
  getPaymentProviderMeta,
  normalizeText,
} from './checkoutPageModel';

export default function useCheckoutDerived({ state, cart }) {
  const {
    cartView,
    checkoutConfig,
    checkoutQuote,
    customerAddress,
    customerCity,
    customerCityCode,
    customerCountry,
    customerEmailOrPhone,
    customerId,
    customerLastname,
    customerName,
    customerPhone,
    customerPostalCode,
    deliveryType,
    dianCustomer,
    countries,
    paymentsConfig,
    quoteLoading,
    regions,
    sameAddress,
    selectedRegion,
    serverSummary,
    shippingConfig,
    shippingConfigLoading,
    storeCreditAmount,
    storeCreditPreview,
    useStoreCredit,
    setDeliveryType,
  } = state;

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
        if (['digital', 'service'].includes(productType)) return true;
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
  }, [cartRequiresShipping, deliveryType, setDeliveryType]);

  const cssVars = useMemo(
    () => ({
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
    }),
    [checkoutConfig]
  );

  const localSubtotal = (currentCart || []).reduce(
    (sum, item) => sum + getItemLineTotal(item),
    0
  );
  const subtotal = Number(serverSummary?.subtotal ?? localSubtotal);
  const itemCount = (currentCart || []).reduce(
    (sum, item) => sum + getItemQuantity(item),
    0
  );
  const selectedCountry = useMemo(
    () =>
      countries.find(
        (country) =>
          country.name?.toLowerCase() === String(customerCountry).toLowerCase()
      ),
    [countries, customerCountry]
  );
  const matchedZone = useMemo(() => {
    const zones = Array.isArray(shippingConfig?.zones) ? shippingConfig.zones : [];
    const countryNorm = normalizeText(customerCountry);
    const departmentNorm = normalizeText(
      selectedCountry?.code === 'CO' ? selectedRegion : ''
    );
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
  }, [
    shippingConfig,
    customerCountry,
    selectedCountry?.code,
    selectedRegion,
    customerCity,
  ]);

  const shipping = useMemo(() => {
    if (!cartRequiresShipping || deliveryType === 'retiro') return 0;
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
  }, [
    cartRequiresShipping,
    deliveryType,
    shippingConfig,
    shippingConfigLoading,
    matchedZone,
    subtotal,
  ]);

  const quotePricing = checkoutQuote?.pricing || null;
  const quotedSubtotal = Number(quotePricing?.subtotal ?? subtotal);
  const productDiscount = Number(quotePricing?.productDiscount || 0);
  const shippingDiscount = Number(quotePricing?.shippingDiscount || 0);
  const finalShipping = Number(quotePricing?.shipping ?? shipping);
  const taxAmount = Number(quotePricing?.tax?.amount || 0);
  const taxPercent = Number(quotePricing?.tax?.percent || 0);
  const total = Number(
    quotePricing?.total ??
      quotedSubtotal - productDiscount + finalShipping + taxAmount
  );
  const storeCreditCalculation = useMemo(
    () =>
      calculateStoreCreditApplication({
        enabled: useStoreCredit,
        eligible: storeCreditPreview.eligible,
        balance: storeCreditPreview.balance,
        requestedAmount: storeCreditAmount,
        orderTotal: total,
      }),
    [storeCreditAmount, storeCreditPreview, total, useStoreCredit]
  );
  const appliedStoreCreditAmount = storeCreditCalculation.appliedAmount;
  const amountDue = storeCreditCalculation.amountDue;

  const shippingEta = useMemo(() => {
    if (!cartRequiresShipping) return 'Sin envío físico';
    if (deliveryType === 'retiro') return 'Retiro disponible en tienda';
    if (finalShipping === 0) {
      return (
        matchedZone?.eta ||
        shippingConfig?.estimatedTime ||
        shippingConfig?.fallback?.eta ||
        'Envío gratis aplicado'
      );
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
  }, [
    paymentsConfig.active,
    paymentsConfig.provider,
    paymentsConfig.successMessage,
    paymentProviderMeta.checkoutMessage,
  ]);
  const paymentEnvironmentLabel =
    paymentsConfig.mode === 'production' ? 'Producción' : 'Pruebas';
  const paymentCanProceed =
    paymentsConfig.active !== false && Boolean(paymentsConfig.provider);

  const resolvedDianCustomer = useMemo(() => {
    const emailFromContact = String(customerEmailOrPhone || '').includes('@')
      ? String(customerEmailOrPhone || '').trim()
      : '';
    const countryCode = String(selectedCountry?.code || '').trim().toUpperCase();
    const selectedDepartment = regions.find(
      (region) =>
        String(region?.code || '').trim() === String(selectedRegion || '').trim()
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

  let disableReason = '';
  if (!paymentCanProceed) disableReason = 'No hay un método de pago activo o configurado.';
  else if (!currentCart || currentCart.length === 0 || itemCount === 0) disableReason = 'El carrito está vacío.';
  else if (quoteLoading) disableReason = 'Verificando IVA, descuentos y total...';
  else if (!quotePricing) disableReason = 'No se pudo verificar el total final.';
  else if (subtotal <= 0) disableReason = 'El subtotal debe ser mayor a 0.';
  else if (total <= 0) disableReason = 'El total debe ser mayor a 0.';

  return {
    currentCart,
    cartRequiresShipping,
    cartNeedsElectronicDelivery,
    cssVars,
    subtotal,
    itemCount,
    selectedCountry,
    matchedZone,
    shipping,
    quotePricing,
    quotedSubtotal,
    productDiscount,
    shippingDiscount,
    finalShipping,
    taxAmount,
    taxPercent,
    total,
    appliedStoreCreditAmount,
    amountDue,
    shippingEta,
    shippingLabel,
    paymentProviderMeta,
    paymentBlockTitle,
    paymentBlockMessage,
    paymentEnvironmentLabel,
    paymentCanProceed,
    resolvedDianCustomer,
    disableReason,
  };
}
