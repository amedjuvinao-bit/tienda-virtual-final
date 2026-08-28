import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../../../lib/api';
import { createRmaCreationIdempotency } from '../../../../../utils/rmaCreationIdempotency';
import { runOrderReturnShippingOperation } from '../../../orderReturnShippingApi';

function newShippingKey() {
  const random = globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `rma-shipping-${random}`.slice(0, 180);
}

export default function useOrderReturnActions({
  orderId,
  canManageReturns = false,
  canManageReturnPolicy = false,
  canRefund = false,
  synchronizeAfterMutation,
  fetchReturns,
  showToast,
}) {
  const normalizedOrderId = String(orderId || '');
  const orderIdRef = useRef(normalizedOrderId);
  const createAttemptRef = useRef(null);
  const shippingAttemptsRef = useRef(new Map());
  const [busyId, setBusyId] = useState('');
  if (!createAttemptRef.current) {
    createAttemptRef.current = createRmaCreationIdempotency();
  }
  orderIdRef.current = normalizedOrderId;

  useEffect(() => {
    setBusyId('');
    createAttemptRef.current.reset();
    shippingAttemptsRef.current.clear();
  }, [normalizedOrderId]);

  const isCurrent = useCallback(
    (targetOrderId) => orderIdRef.current === targetOrderId,
    []
  );

  const showReturnError = useCallback((error, fallback, targetOrderId) => {
    if (!isCurrent(targetOrderId)) return;
    showToast({
      type: 'error',
      title: 'No se pudo actualizar el RMA',
      message: error?.response?.data?.message || fallback,
      persist: true,
    });
  }, [isCurrent, showToast]);

  const createReturn = useCallback(async (payload) => {
    const targetOrderId = orderIdRef.current;
    if (!canManageReturns || !targetOrderId) return;
    const requestDescriptor = {
      endpoint: 'admin-order-return-create',
      orderId: targetOrderId,
      payload,
    };
    const idempotencyKey = createAttemptRef.current.keyFor(requestDescriptor);

    try {
      setBusyId('create');
      await api.post(`/api/orders/${targetOrderId}/returns`, payload, {
        headers: { 'Idempotency-Key': idempotencyKey },
      });
      createAttemptRef.current.complete(requestDescriptor, idempotencyKey);
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'RMA creado',
        message: 'Las unidades quedaron reservadas para el proceso posventa.',
      });
      await synchronizeAfterMutation();
    } catch (error) {
      showReturnError(
        error,
        'Revisa la elegibilidad y las cantidades seleccionadas.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canManageReturns, isCurrent, showReturnError, showToast, synchronizeAfterMutation]);

  const updateReturn = useCallback(async (returnCase, action, payload = {}) => {
    const targetOrderId = orderIdRef.current;
    if (!canManageReturns || !targetOrderId || !returnCase?._id) return;

    try {
      setBusyId(String(returnCase._id));
      await api.patch(
        `/api/orders/${targetOrderId}/returns/${returnCase._id}`,
        {
          ...payload,
          action,
          expectedRevision: returnCase.revision,
        }
      );
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'RMA actualizado',
        message: 'La etapa quedó registrada con trazabilidad.',
      });
      await synchronizeAfterMutation();
    } catch (error) {
      showReturnError(
        error,
        'Recarga el expediente y vuelve a intentar.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canManageReturns, isCurrent, showReturnError, showToast, synchronizeAfterMutation]);

  const refundReturn = useCallback(async (returnCase, amount) => {
    const targetOrderId = orderIdRef.current;
    if (!canRefund || !targetOrderId || !returnCase?._id) return;

    try {
      setBusyId(String(returnCase._id));
      await api.post(
        `/api/orders/${targetOrderId}/returns/${returnCase._id}/refund`,
        { expectedRevision: returnCase.revision, amount }
      );
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'Reembolso creado',
        message: 'La inspección RMA terminó; dinero y documento fiscal siguen visibles hasta cerrar la conciliación.',
      });
      await synchronizeAfterMutation();
    } catch (error) {
      showReturnError(
        error,
        'Verifica el monto aceptado y el estado de la inspección.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canRefund, isCurrent, showReturnError, showToast, synchronizeAfterMutation]);

  const exchangeReturn = useCallback(async (returnCase, replacementOrderId, reference) => {
    const targetOrderId = orderIdRef.current;
    if (!canManageReturns || !targetOrderId || !returnCase?._id) return;

    try {
      setBusyId(String(returnCase._id));
      await api.post(
        `/api/orders/${targetOrderId}/returns/${returnCase._id}/exchange`,
        { expectedRevision: returnCase.revision, replacementOrderId, reference }
      );
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'Cambio vinculado',
        message: 'El expediente quedó enlazado con una orden de reemplazo real.',
      });
      await synchronizeAfterMutation();
    } catch (error) {
      showReturnError(
        error,
        'Verifica la orden de reemplazo y la sede autorizada.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canManageReturns, isCurrent, showReturnError, showToast, synchronizeAfterMutation]);

  const automaticExchange = useCallback(async (returnCase, reference) => {
    const targetOrderId = orderIdRef.current;
    if (!canManageReturns || !targetOrderId || !returnCase?._id) return;

    try {
      setBusyId(String(returnCase._id));
      const response = await api.post(
        `/api/orders/${targetOrderId}/returns/${returnCase._id}/exchange/automatic`,
        { expectedRevision: returnCase.revision, reference }
      );
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'Orden de cambio creada',
        message: `Se creó la orden #${response?.data?.replacementOrder?.orderNumber || 'de reemplazo'} y su inventario quedó reservado.`,
        persist: true,
      });
      await synchronizeAfterMutation();
    } catch (error) {
      showReturnError(
        error,
        'Verifica el inventario disponible para el cambio.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canManageReturns, isCurrent, showReturnError, showToast, synchronizeAfterMutation]);

  const createStoreCredit = useCallback(async (returnCase, amount) => {
    const targetOrderId = orderIdRef.current;
    if (!canRefund || !targetOrderId || !returnCase?._id) return;

    try {
      setBusyId(String(returnCase._id));
      const response = await api.post(
        `/api/orders/${targetOrderId}/returns/${returnCase._id}/store-credit`,
        { expectedRevision: returnCase.revision, amount }
      );
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'Saldo a favor emitido',
        message: `${response?.data?.storeCredit?.creditNumber || 'El saldo'} quedó trazable y asociado al cliente.`,
        persist: true,
      });
      await synchronizeAfterMutation();
    } catch (error) {
      showReturnError(
        error,
        'Verifica el monto aceptado y la política de saldo a favor.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canRefund, isCurrent, showReturnError, showToast, synchronizeAfterMutation]);

  const savePolicy = useCallback(async (policy) => {
    const targetOrderId = orderIdRef.current;
    if (!canManageReturnPolicy || !targetOrderId) return;

    try {
      setBusyId('policy');
      await api.put('/api/orders/returns/policy', policy);
      if (!isCurrent(targetOrderId)) return;
      showToast({
        type: 'success',
        title: 'Política actualizada',
        message: 'Las próximas solicitudes usarán esta versión de la política.',
      });
      await fetchReturns(targetOrderId);
    } catch (error) {
      showReturnError(
        error,
        'Recarga la política y vuelve a intentar.',
        targetOrderId
      );
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [canManageReturnPolicy, fetchReturns, isCurrent, showReturnError, showToast]);

  const runReturnShipping = useCallback(async (returnCase, action, payload = {}) => {
    const targetOrderId = orderIdRef.current;
    if (!canManageReturns || !targetOrderId || !returnCase?._id) return null;
    const returnId = String(returnCase._id);
    const idempotentActions = new Set(['label', 'pickup', 'cancel_label']);
    const descriptor = JSON.stringify({ returnId, action, payload });
    let idempotencyKey = '';
    if (idempotentActions.has(action)) {
      idempotencyKey = shippingAttemptsRef.current.get(descriptor) || newShippingKey();
      shippingAttemptsRef.current.set(descriptor, idempotencyKey);
    }
    try {
      setBusyId(`${returnId}:shipping:${action}`);
      const data = await runOrderReturnShippingOperation(
        targetOrderId,
        returnId,
        action,
        {
          ...payload,
          expectedRevision: returnCase.revision,
          provider: 'envia',
        },
        idempotencyKey
      );
      if (idempotencyKey) shippingAttemptsRef.current.delete(descriptor);
      if (!isCurrent(targetOrderId)) return data;
      if (action !== 'quote') {
        showToast({
          type: data?.actionRequired ? 'warning' : 'success',
          title: data?.actionRequired ? 'Guía creada con revisión pendiente' : 'Logística RMA actualizada',
          message: data?.actionRequired
            ? 'Envia creó la guía, pero la recolección requiere validación antes de continuar.'
            : 'La operación quedó conciliada con la transportadora.',
          persist: data?.actionRequired === true,
        });
        await synchronizeAfterMutation();
      }
      return data;
    } catch (error) {
      if (error?.response?.data?.error === 'RETURN_REVISION_CONFLICT') {
        await fetchReturns(targetOrderId).catch(() => {});
      }
      showReturnError(
        error,
        'No fue posible completar la logística de la devolución.',
        targetOrderId
      );
      throw error;
    } finally {
      if (isCurrent(targetOrderId)) setBusyId('');
    }
  }, [
    canManageReturns,
    fetchReturns,
    isCurrent,
    showReturnError,
    showToast,
    synchronizeAfterMutation,
  ]);

  return {
    busyId,
    createReturn,
    updateReturn,
    refundReturn,
    exchangeReturn,
    automaticExchange,
    createStoreCredit,
    runReturnShipping,
    savePolicy,
  };
}
