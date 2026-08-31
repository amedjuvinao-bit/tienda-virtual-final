import { validateDianCustomer } from '../dian/dianCustomerValidators';
import { buildStoreCreditOrderPayload } from '../storeCreditCheckout';

export function validateCheckoutState({ state, derived }) {
  const {
    checkoutConfig,
    customerAddress,
    customerCity,
    customerCountry,
    customerEmailOrPhone,
    customerId,
    customerLastname,
    customerName,
    deliveryType,
    quoteLoading,
  } = state;
  const {
    cartNeedsElectronicDelivery,
    cartRequiresShipping,
    currentCart,
    itemCount,
    paymentCanProceed,
    quotePricing,
    resolvedDianCustomer,
    selectedCountry,
    subtotal,
    total,
  } = derived;
  const errors = [];
  const isBlank = (value) => !value || String(value).trim() === '';

  if (!paymentCanProceed) {
    errors.push(
      'La tienda no tiene un método de pago activo o configurado correctamente.'
    );
  }
  if (isBlank(customerName)) errors.push('El nombre es obligatorio.');
  if (isBlank(customerLastname)) errors.push('El apellido es obligatorio.');
  if (isBlank(customerEmailOrPhone)) {
    errors.push('Email o teléfono es obligatorio.');
  }
  if (isBlank(customerId)) errors.push('La cédula es obligatoria.');
  if (
    cartNeedsElectronicDelivery &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      String(resolvedDianCustomer.email || '').trim()
    )
  ) {
    errors.push(
      'Los productos digitales y servicios necesitan un correo válido para la entrega.'
    );
  }
  if (cartRequiresShipping && deliveryType === 'envio') {
    if (isBlank(customerAddress)) {
      errors.push('La dirección de envío es obligatoria.');
    }
    if (isBlank(customerCountry)) errors.push('El país es obligatorio.');
    if (selectedCountry?.code === 'CO' && isBlank(state.selectedRegion)) {
      errors.push('El departamento es obligatorio para Colombia.');
    }
    if (isBlank(customerCity)) errors.push('La ciudad es obligatoria.');
  }
  if (checkoutConfig.showBillingSection) {
    errors.push(...validateDianCustomer(resolvedDianCustomer));
  }
  if (!currentCart || currentCart.length === 0 || itemCount === 0) {
    errors.push('El carrito está vacío.');
  }
  if (quoteLoading) {
    errors.push('Espera mientras verificamos IVA, descuentos y total.');
  }
  if (!quoteLoading && currentCart?.length > 0 && !quotePricing) {
    errors.push('No fue posible verificar el total final con el servidor.');
  }
  if (subtotal <= 0) errors.push('El subtotal debe ser mayor a 0.');
  if (total <= 0) errors.push('El total debe ser mayor a 0.');
  return errors;
}

function itemNames(currentCart) {
  return new Map(
    (currentCart || []).map((item) => [
      String(item._id || item.productId || item.id || ''),
      item.title || 'Producto',
    ])
  );
}

export function formatCartAdjustments(currentCart, adjustments = []) {
  if (!Array.isArray(adjustments) || !adjustments.length) return [];
  const byId = itemNames(currentCart);
  const messages = [];
  for (const adjustment of adjustments) {
    const productId = String(adjustment?.productId || adjustment?._id || '');
    const name = byId.get(productId) || 'Producto';
    const fromQuantity = Number(
      adjustment?.requestedQty ??
        adjustment?.originalQty ??
        adjustment?.qty ??
        0
    );
    const toQuantity = Number(adjustment?.finalQty ?? 0);
    const note = adjustment?.note ? String(adjustment.note) : '';
    if (toQuantity === 0) messages.push(`Sin stock para "${name}" (eliminado).`);
    else if (toQuantity < fromQuantity) {
      messages.push(
        `Stock limitado para "${name}": ${fromQuantity} → ${toQuantity}.`
      );
    }
    if (note && !/sin stock|limitado|ajustada/i.test(note)) {
      messages.push(`Actualización para "${name}": ${note}.`);
    }
  }
  return messages;
}

export function formatOrderConflictDetails(currentCart, details = []) {
  if (!Array.isArray(details) || details.length === 0) return [];
  const byId = itemNames(currentCart);
  return details.map((detail) => {
    const name =
      detail?.title ||
      byId.get(String(detail?.productId || detail?._id || '')) ||
      'Producto';
    const reason = detail?.reason || 'Conflicto de stock';
    const requested =
      detail?.requested ?? detail?.qty ?? detail?.quantity ?? null;
    return `${reason} en "${name}"${
      requested != null ? ` (pedido: ${requested})` : ''
    }.`;
  });
}

export function buildValidatedOrderItems(serverItems, validationItems) {
  const source = Array.isArray(serverItems)
    ? serverItems
    : Array.isArray(validationItems)
      ? validationItems
      : [];
  return source
    .map((item) => ({
      _id: String(
        item._id ||
          item.productId ||
          item?.product?._id ||
          item?.product?.id ||
          ''
      ),
      title: item.title || item?.product?.title || '',
      image: item.image || item?.product?.image || '',
      color: item.color || '',
      size: item.size || '',
      variantId: item.variantId || item.variantKey || '',
      quantity: Number(item.quantity ?? item.qty ?? 0) || 0,
      price: Number(item.price ?? item?.product?.price ?? 0) || 0,
      productType: item.productType || item?.product?.productType || 'physical',
      requiresShipping:
        item.requiresShipping ?? item?.product?.requiresShipping ?? true,
      fulfillment: item.fulfillment || item?.product?.fulfillment || null,
    }))
    .filter((item) => item._id && item.quantity > 0);
}

export function buildOrderDraft({
  state,
  derived,
  sessionId,
  finalItems,
  finalSummary,
}) {
  const { paymentsConfig } = state;
  const customer = {
    name: state.customerName,
    lastname: state.customerLastname,
    id: String(state.customerId).trim(),
    emailOrPhone: state.customerEmailOrPhone,
    phone: state.customerPhone,
    address: state.customerAddress,
    city: state.customerCity,
    postalCode: state.customerPostalCode,
    country: state.customerCountry,
    countryCode: derived.selectedCountry?.code || '',
    municipalityId: state.customerCityCode,
    department: state.selectedRegion || undefined,
    departmentCode: state.selectedRegion || undefined,
    deliveryType: state.deliveryType,
    wantsNewsletter: state.wantsNewsletter,
  };
  const resolved = derived.resolvedDianCustomer;
  const billing = {
    useSameAddress: state.sameAddress,
    personType: resolved.personType,
    documentType: resolved.documentType,
    documentNumber: resolved.documentNumber,
    id: resolved.documentNumber,
    dv: resolved.documentType === 'NIT' ? resolved.dv : '',
    firstName: resolved.firstName,
    lastName: resolved.lastName,
    name: resolved.firstName,
    lastname: resolved.lastName,
    businessName: resolved.businessName,
    email: resolved.email,
    phone: resolved.phone,
    address: resolved.address,
    extra: resolved.extra,
    city: resolved.city,
    cityCode: resolved.cityCode,
    municipalityCode: resolved.municipalityCode,
    department: resolved.department,
    departmentCode: resolved.departmentCode,
    postalCode: resolved.postalCode,
    country: resolved.countryName || resolved.country,
    countryCode: resolved.country,
    tributeCode: resolved.tributeCode || 'ZZ',
  };
  return {
    sessionId,
    cart: finalItems,
    subtotal: Number(finalSummary.subtotal || 0),
    shipping: derived.shipping,
    total: derived.total,
    couponCode: state.appliedCoupon?.code || '',
    customer,
    billing: state.checkoutConfig.showBillingSection ? billing : undefined,
    payment: {
      active: paymentsConfig.active,
      provider: paymentsConfig.provider,
      providerLabel: derived.paymentProviderMeta.label,
      mode: paymentsConfig.mode,
      currency: paymentsConfig.currency,
      checkoutLabel: paymentsConfig.checkoutLabel,
      enableWebhook: paymentsConfig.enableWebhook,
      status:
        paymentsConfig.provider === 'manual'
          ? 'pending_manual'
          : 'pending_gateway',
    },
    storeCredit: buildStoreCreditOrderPayload({
      amount: derived.appliedStoreCreditAmount,
      accessToken: state.storeCreditPreview.accessToken,
    }),
  };
}

export function createCheckoutIdempotencyKey() {
  return typeof window !== 'undefined' &&
    window.crypto &&
    typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function scrollCheckoutToTop() {
  try {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    // Navegadores sin scroll suave mantienen el error visible en su posición.
  }
}
