import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../../lib/api';
import {
  canConfirmManualPaymentForOrder,
  createManualPaymentForm,
  getManualPaymentErrorMessage,
  validateManualPaymentForm,
} from '../manualPaymentConfirmationModel';

const EDITABLE_FIELDS = new Set(['method', 'reference', 'reason', 'verified']);

export default function useOrderManualPaymentConfirmation({
  open,
  order,
  canConfirmManualPayment = false,
  synchronizeAfterMutation,
  fetchTimeline,
  showToast,
}) {
  const orderId = String(order?._id || '');
  const expectedAmount = Number(order?.payment?.amount || 0);
  const expectedCurrency = String(order?.payment?.currency || '').toUpperCase();
  const activeRef = useRef({ open, orderId });
  const requestRef = useRef(0);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(() => createManualPaymentForm(order));

  activeRef.current = { open, orderId };

  useEffect(() => {
    requestRef.current += 1;
    submittingRef.current = false;
    setSubmitting(false);
    setForm(createManualPaymentForm(order));
  }, [open, orderId]);

  useEffect(() => {
    if (submittingRef.current) return;
    setForm((current) => ({
      ...current,
      amount: expectedAmount,
      currency: expectedCurrency,
    }));
  }, [expectedAmount, expectedCurrency, orderId]);

  const eligible = canConfirmManualPaymentForOrder(
    order,
    canConfirmManualPayment
  );
  const validation = useMemo(
    () => validateManualPaymentForm(form, order),
    [form, order]
  );

  const setField = useCallback((field, value) => {
    if (!EDITABLE_FIELDS.has(field)) return;
    setForm((current) => ({ ...current, [field]: value }));
  }, []);

  const isCurrent = useCallback((targetOrderId, requestId) => (
    activeRef.current.open &&
    activeRef.current.orderId === targetOrderId &&
    requestRef.current === requestId
  ), []);

  const submit = useCallback(async () => {
    if (!eligible || !orderId || submittingRef.current) return null;
    const currentValidation = validateManualPaymentForm(form, order);
    if (!currentValidation.valid) return { validation: currentValidation.errors };

    const requestId = ++requestRef.current;
    const targetOrderId = orderId;
    submittingRef.current = true;
    setSubmitting(true);

    try {
      const { data } = await api.post(
        `/api/orders/${targetOrderId}/payments/manual-confirmation`,
        currentValidation.request
      );
      if (!isCurrent(targetOrderId, requestId)) return { ignored: true };

      await synchronizeAfterMutation?.(
        data?.order || null,
        typeof fetchTimeline === 'function' ? [fetchTimeline] : []
      );
      if (!isCurrent(targetOrderId, requestId)) return { ignored: true };

      const postCommitWarning = data?.postCommitWarning?.message;
      showToast?.({
        type: postCommitWarning ? 'warning' : data?.duplicate ? 'info' : 'success',
        title: data?.duplicate ? 'Pago ya confirmado' : 'Pago manual confirmado',
        message: postCommitWarning || (data?.duplicate
          ? 'La misma evidencia ya estaba registrada; no se duplicó ninguna operación.'
          : 'La evidencia quedó registrada y la orden fue actualizada.'),
      });
      setForm((current) => ({ ...current, verified: false }));
      return data;
    } catch (error) {
      if (!isCurrent(targetOrderId, requestId)) return { ignored: true };
      showToast?.({
        type: 'error',
        title: 'No se confirmó el pago',
        message: getManualPaymentErrorMessage(error),
      });
      return { error };
    } finally {
      if (isCurrent(targetOrderId, requestId)) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }, [eligible, fetchTimeline, form, isCurrent, order, orderId, showToast, synchronizeAfterMutation]);

  return {
    eligible,
    form,
    setField,
    submit,
    submitting,
    validation,
  };
}
