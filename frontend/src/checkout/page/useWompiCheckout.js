import api from '../../lib/api';
import { buildOrderPaymentAccessHeaders } from '../../utils/orderPaymentAccess';
import { EMPTY_STORE_CREDIT_PREVIEW } from './checkoutPageModel';
import {
  buildWompiCustomerData,
  buildWompiShippingAddress,
  loadWompiWidgetScript,
} from './checkoutWompi';

export default function useWompiCheckout({
  state,
  derived,
  clearCart,
  navigate,
}) {
  const openWompiCheckout = async ({
    orderId,
    orderNumber,
    orderSubtotal,
    orderDiscount,
    orderTax,
    orderShipping,
    orderTotal,
    storeCreditApplied = 0,
    lineItemCount,
    paymentAccess,
  }) => {
    const selectedCountryCode = derived.selectedCountry?.code || 'CO';
    const { data } = await api.post(
      '/api/payments/wompi/checkout-data',
      { orderId },
      { headers: buildOrderPaymentAccessHeaders(paymentAccess) }
    );
    if (!data) {
      throw new Error(
        data?.message || 'No se pudo preparar el checkout de Wompi.'
      );
    }
    await loadWompiWidgetScript();
    if (
      typeof window === 'undefined' ||
      typeof window.WidgetCheckout !== 'function'
    ) {
      throw new Error('El widget de Wompi no está disponible en este navegador.');
    }

    const wompiCustomerData = buildWompiCustomerData(
      {
        email: String(state.customerEmailOrPhone || '').includes('@')
          ? String(state.customerEmailOrPhone || '').trim()
          : '',
        full_name: [state.customerName, state.customerLastname]
          .filter(Boolean)
          .join(' ')
          .trim(),
        phone_number: state.customerPhone,
      },
      selectedCountryCode
    );
    const wompiShippingAddress = buildWompiShippingAddress({
      deliveryType: state.deliveryType,
      customerAddress: state.customerAddress,
      customerCity: state.customerCity,
      customerPhone: state.customerPhone,
      selectedCountryCode,
      selectedRegion: state.selectedRegion,
      customerName: state.customerName,
      customerLastname: state.customerLastname,
      customerPostalCode: state.customerPostalCode,
    });
    const widgetConfig = {
      currency: data.currency,
      amountInCents: data.amountInCents,
      reference: data.reference,
      publicKey: data.publicKey,
      acceptanceToken: data.acceptanceToken,
      redirectUrl: data.redirectUrl,
      personalDataAcceptanceToken: data.personalDataAcceptanceToken,
      signature: { integrity: data.signature },
    };
    if (Object.keys(wompiCustomerData).length > 0) {
      widgetConfig.customerData = wompiCustomerData;
    }
    if (wompiShippingAddress) {
      widgetConfig.shippingAddress = wompiShippingAddress;
    }

    const checkout = new window.WidgetCheckout(widgetConfig);
    state.setIsPlacing(false);
    checkout.open(async (result) => {
      const transaction = result?.transaction || null;
      const status = String(transaction?.status || '').toUpperCase();
      if (status === 'APPROVED') {
        await clearCart();
        navigate('/gracias', {
          state: {
            orderId,
            orderNumber,
            customerName: state.customerName,
            subtotal: orderSubtotal,
            discount: orderDiscount,
            tax: orderTax,
            shipping: orderShipping,
            total: orderTotal,
            storeCreditApplied,
            itemCount: lineItemCount,
            transactionId: transaction?.id || '',
          },
        });
        return;
      }
      if (status === 'DECLINED') {
        state.setUseStoreCredit(false);
        state.setStoreCreditPreview({ ...EMPTY_STORE_CREDIT_PREVIEW });
        state.setStoreCreditAmount('');
        state.setErrors([
          'El pago fue rechazado por Wompi.',
          'Si habías usado saldo a favor, ya volvió a quedar disponible.',
        ]);
        return;
      }
      if (status === 'ERROR') {
        state.setUseStoreCredit(false);
        state.setStoreCreditPreview({ ...EMPTY_STORE_CREDIT_PREVIEW });
        state.setStoreCreditAmount('');
        state.setErrors([
          'Wompi reportó un error al procesar el pago.',
          'Si habías usado saldo a favor, ya volvió a quedar disponible.',
        ]);
        return;
      }
      if (status === 'PENDING') {
        state.setErrors(['El pago quedó pendiente de confirmación.']);
      }
    });
  };

  return { openWompiCheckout };
}
