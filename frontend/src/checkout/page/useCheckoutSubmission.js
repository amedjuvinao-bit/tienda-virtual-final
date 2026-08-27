import { useNavigate } from 'react-router-dom';
import api, { setSessionId as setApiSessionId } from '../../lib/api';
import { redirectToPayU } from '../../lib/payuRedirect';
import { buildCartAccessHeaders } from '../../utils/cartAccess';
import {
  buildOrderPaymentAccessHeaders,
  storeOrderPaymentAccess,
} from '../../utils/orderPaymentAccess';
import {
  buildOrderDraft,
  buildValidatedOrderItems,
  createCheckoutIdempotencyKey,
  formatCartAdjustments,
  formatOrderConflictDetails,
  scrollCheckoutToTop,
  validateCheckoutState,
} from './checkoutSubmissionModel';
import useWompiCheckout from './useWompiCheckout';

export function createOrderFromAuthorizedCart({
  order,
  cartAccess,
  idempotencyKey,
}) {
  return api.post('/api/orders', order, {
    headers: {
      ...buildCartAccessHeaders(cartAccess),
      'Idempotency-Key': idempotencyKey,
    },
  });
}

export default function useCheckoutSubmission({
  state,
  derived,
  clearCart,
  ensureCartReady,
  renewCartAccess,
  validateCart,
}) {
  const navigate = useNavigate();
  const { openWompiCheckout } = useWompiCheckout({
    state,
    derived,
    clearCart,
    navigate,
  });

  const handlePlaceOrder = async () => {
    if (state.isPlacing) return;
    state.setIsPlacing(true);
    state.setErrors([]);

    const validationErrors = validateCheckoutState({ state, derived });
    state.setErrors(validationErrors);
    if (validationErrors.length > 0) {
      scrollCheckoutToTop();
      state.setIsPlacing(false);
      return;
    }

    let cartAccess;
    let validation;
    let serverItems = null;
    let serverSummary = null;

    try {
      cartAccess = await ensureCartReady();
      validation = await validateCart('strict');
      serverItems = Array.isArray(validation?.items) ? validation.items : null;
      serverSummary = validation?.summary || null;
      if (!validation?.ok) throw new Error('CART_VALIDATION_FAILED');

      const filteredFromServer = (serverItems || []).filter(
        (item) => Number(item?.quantity ?? item?.qty ?? 0) > 0
      );
      const filteredFromValidation = (validation?.items || []).filter(
        (item) => Number(item?.quantity ?? item?.qty ?? 0) > 0
      );
      const visibleItems = filteredFromServer.length
        ? filteredFromServer
        : filteredFromValidation;
      const adjustmentMessages = formatCartAdjustments(
        derived.currentCart,
        validation?.adjustments
      );

      if (validation?.code === 'NO_STOCK' || visibleItems.length === 0) {
        state.setErrors([
          'No hay stock disponible para los artículos del carrito.',
          ...adjustmentMessages,
        ]);
        scrollCheckoutToTop();
        state.setIsPlacing(false);
        return;
      }
      if (adjustmentMessages.length) {
        state.setErrors([
          'Se ajustó tu carrito por disponibilidad/precio. Revisa el resumen y confirma nuevamente.',
          ...adjustmentMessages,
        ]);
        scrollCheckoutToTop();
        state.setIsPlacing(false);
        return;
      }
      if (filteredFromServer.length) state.setCartView(filteredFromServer);
      if (serverSummary ?? validation?.summary) {
        state.setServerSummary(
          serverSummary ?? validation?.summary ?? null
        );
      }
    } catch {
      state.setErrors([
        'No pudimos validar tu carrito en este momento. Intenta nuevamente.',
      ]);
      scrollCheckoutToTop();
      state.setIsPlacing(false);
      return;
    }

    const sessionId = cartAccess.sessionId;
    try {
      setApiSessionId(sessionId);
    } catch {
      // La autorización explícita del carrito sigue viajando en el request.
    }
    const finalItems = buildValidatedOrderItems(
      serverItems,
      validation?.items
    );
    const finalSummary = serverSummary ?? validation?.summary ?? {
      subtotal: finalItems.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    };
    const order = buildOrderDraft({
      state,
      derived,
      sessionId,
      finalItems,
      finalSummary,
    });

    try {
      const idempotencyKey = createCheckoutIdempotencyKey();
      let response;
      try {
        response = await createOrderFromAuthorizedCart({
          order,
          cartAccess,
          idempotencyKey,
        });
      } catch (orderError) {
        const accessExpired =
          orderError?.response?.status === 404 &&
          orderError?.response?.data?.error === 'CART_ACCESS_NOT_FOUND';
        if (!accessExpired) throw orderError;
        cartAccess = await renewCartAccess();
        order.sessionId = cartAccess.sessionId;
        try {
          setApiSessionId(cartAccess.sessionId);
        } catch {
          // El header renovado sigue siendo la autoridad para este reintento.
        }
        response = await createOrderFromAuthorizedCart({
          order,
          cartAccess,
          idempotencyKey,
        });
      }

      const createdOrderId =
        response.data?._id || response.data?.order?._id || '';
      const createdOrderNumber =
        response.data?.orderNumber || response.data?.order?.code || '';
      const createdPricing = response.data?.pricing || {};
      const createdSubtotal = Number(
        response.data?.subtotal ?? createdPricing.subtotal ?? order.subtotal
      );
      const createdDiscount = Number(
        createdPricing.totalDiscount ??
          response.data?.coupon?.totalDiscountAmount ??
          0
      );
      const createdTax = Number(
        response.data?.taxes?.iva?.amount ?? createdPricing.taxAmount ?? 0
      );
      const createdShipping = Number(
        response.data?.shipping ?? createdPricing.shipping ?? 0
      );
      const createdTotal = Number(
        response.data?.total ?? createdPricing.total ?? order.total
      );
      const createdAmountDue = Number(
        response.data?.amountDue ?? createdTotal
      );
      const createdStoreCredit = response.data?.storeCredit || {
        applied: false,
        amount: 0,
      };
      const paymentAccess = response.data?.paymentAccess || null;

      if (
        !(response.status === 201 || response.status === 200) ||
        !createdOrderId
      ) {
        state.setErrors([
          'Ocurrió un problema al procesar tu orden. Intenta nuevamente.',
        ]);
        scrollCheckoutToTop();
        state.setIsPlacing(false);
        return;
      }
      if (!storeOrderPaymentAccess(paymentAccess)) {
        state.setErrors([
          'No fue posible conservar el acceso seguro de esta orden.',
        ]);
        state.setIsPlacing(false);
        return;
      }

      if (state.paymentsConfig.provider === 'manual') {
        await clearCart();
        navigate('/gracias', {
          state: {
            orderId: createdOrderId,
            orderNumber: createdOrderNumber,
            customerName: state.customerName,
            subtotal: createdSubtotal,
            discount: createdDiscount,
            tax: createdTax,
            shipping: createdShipping,
            total: createdTotal,
            itemCount: finalItems.length,
          },
        });
        return;
      }

      if (state.paymentsConfig.provider === 'wompi') {
        if (createdStoreCredit.applied === true && createdAmountDue <= 0) {
          await clearCart();
          state.setIsPlacing(false);
          navigate('/gracias', {
            state: {
              orderId: createdOrderId,
              orderNumber: createdOrderNumber,
              customerName: state.customerName,
              subtotal: createdSubtotal,
              discount: createdDiscount,
              tax: createdTax,
              shipping: createdShipping,
              total: createdTotal,
              itemCount: finalItems.length,
              storeCreditApplied: Number(createdStoreCredit.amount || 0),
            },
          });
          return;
        }
        try {
          await openWompiCheckout({
            orderId: createdOrderId,
            orderNumber: createdOrderNumber,
            orderSubtotal: createdSubtotal,
            orderDiscount: createdDiscount,
            orderTax: createdTax,
            orderShipping: createdShipping,
            orderTotal: createdTotal,
            storeCreditApplied: Number(createdStoreCredit.amount || 0),
            lineItemCount: finalItems.length,
            paymentAccess,
          });
          return;
        } catch (gatewayError) {
          state.setErrors([
            gatewayError?.response?.data?.message ||
              gatewayError?.message ||
              'No fue posible iniciar el checkout de Wompi.',
          ]);
          scrollCheckoutToTop();
          state.setIsPlacing(false);
          return;
        }
      }

      if (state.paymentsConfig.provider === 'payu') {
        try {
          const { data } = await api.post(
            '/api/payments/payu/checkout-data',
            { orderId: createdOrderId },
            { headers: buildOrderPaymentAccessHeaders(paymentAccess) }
          );
          redirectToPayU(data);
          return;
        } catch (gatewayError) {
          state.setErrors([
            gatewayError?.response?.data?.message ||
              gatewayError?.message ||
              'No fue posible preparar el checkout de PayU.',
          ]);
          scrollCheckoutToTop();
          state.setIsPlacing(false);
          return;
        }
      }

      state.setErrors([
        'La pasarela activa aún no tiene flujo frontend implementado en esta pantalla.',
      ]);
      scrollCheckoutToTop();
    } catch (error) {
      if (error?.response?.status === 409) {
        const data = error.response.data || {};
        if (data?.error === 'IDEMPOTENT_IN_PROGRESS') {
          state.setErrors([
            'Ya hay un intento de pago en proceso.',
            'Espera unos segundos y vuelve a intentarlo una sola vez.',
          ]);
          scrollCheckoutToTop();
          state.setIsPlacing(false);
          return;
        }
        if (data?.error === 'DUPLICATE_ORDER') {
          state.setErrors([
            'Esta orden ya había sido creada.',
            'No vuelvas a pulsar el botón varias veces. Revisa el panel o el estado del pago.',
          ]);
          scrollCheckoutToTop();
          state.setIsPlacing(false);
          return;
        }
        const messages = formatOrderConflictDetails(
          derived.currentCart,
          data.details
        );
        const header =
          data.message ||
          (data.code === 'NO_STOCK'
            ? 'No hay stock suficiente para uno o más artículos.'
            : 'Conflicto al crear la orden.');
        state.setErrors([header, ...messages]);
        scrollCheckoutToTop();
        state.setIsPlacing(false);
        return;
      }
      state.setErrors([
        error?.response?.data?.message ||
          error.userMessage ||
          'Error al enviar la orden. Intenta nuevamente.',
      ]);
      scrollCheckoutToTop();
    } finally {
      state.setIsPlacing(false);
    }
  };

  return { handlePlaceOrder };
}
