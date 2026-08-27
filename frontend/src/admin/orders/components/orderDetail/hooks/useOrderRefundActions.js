import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../../../lib/api';

export default function useOrderRefundActions({
  orderId,
  canRefund = false,
  canAutomateRefund = false,
  synchronizeAfterMutation,
  fetchRefunds,
  showToast,
}) {
  const normalizedOrderId = String(orderId || '');
  const orderIdRef = useRef(normalizedOrderId);
  const [confirmingId, setConfirmingId] = useState('');
  const [automatingId, setAutomatingId] = useState('');
  orderIdRef.current = normalizedOrderId;

  useEffect(() => {
    setConfirmingId('');
    setAutomatingId('');
  }, [normalizedOrderId]);

  const confirmPayment = useCallback(async (refund, reference) => {
    const targetOrderId = orderIdRef.current;
    if (!canRefund || !targetOrderId || !refund?._id) return;

    try {
      setConfirmingId(refund._id);
      await api.post(
        `/api/orders/${targetOrderId}/refunds/${refund._id}/confirm-payment`,
        { reference }
      );
      if (orderIdRef.current !== targetOrderId) return;
      showToast({
        type: 'success',
        title: 'Dinero conciliado',
        message: 'La devolución quedó registrada y la caja fue recalculada.',
      });
      await synchronizeAfterMutation();
    } catch (error) {
      if (orderIdRef.current === targetOrderId) {
        showToast({
          type: 'error',
          title: 'No se pudo conciliar',
          message:
            error?.response?.data?.message ||
            'Revisa la referencia del reintegro e intenta nuevamente.',
          persist: true,
        });
      }
    } finally {
      if (orderIdRef.current === targetOrderId) setConfirmingId('');
    }
  }, [canRefund, showToast, synchronizeAfterMutation]);

  const automate = useCallback(async (refund) => {
    const targetOrderId = orderIdRef.current;
    if (!canAutomateRefund || !targetOrderId || !refund?._id) return;

    try {
      setAutomatingId(refund._id);
      const response = await api.post(
        `/api/orders/${targetOrderId}/refunds/${refund._id}/automate`,
        {},
        { timeout: 90000 }
      );
      if (orderIdRef.current !== targetOrderId) return;
      const completed = response?.data?.completed === true;
      const paymentOutcome = response?.data?.outcomes?.payment || {};
      showToast({
        type: completed ? 'success' : 'info',
        title: completed ? 'Reembolso conciliado' : 'Automatización avanzada',
        message: completed
          ? 'Dinero, inventario y documento fiscal quedaron conciliados con trazabilidad.'
          : paymentOutcome.message ||
            'Se automatizaron las etapas compatibles; las acciones manuales siguen visibles.',
        persist: !completed,
      });
      await synchronizeAfterMutation();
    } catch (error) {
      if (orderIdRef.current !== targetOrderId) return;
      showToast({
        type: 'error',
        title: 'No se pudo automatizar',
        message:
          error?.response?.data?.message ||
          'No se movió ninguna etapa sin confirmación. Revisa el detalle e intenta nuevamente.',
        persist: true,
      });
      await fetchRefunds(targetOrderId);
    } finally {
      if (orderIdRef.current === targetOrderId) setAutomatingId('');
    }
  }, [canAutomateRefund, fetchRefunds, showToast, synchronizeAfterMutation]);

  return {
    confirmingId,
    confirmPayment,
    automatingId,
    automate,
  };
}
