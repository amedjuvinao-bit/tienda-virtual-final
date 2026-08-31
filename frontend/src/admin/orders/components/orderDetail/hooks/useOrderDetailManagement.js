import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../../../../lib/api';

export default function useOrderDetailManagement({
  open,
  order,
  savingId,
  onSaveTags,
  canEditCustomerData = false,
  onCustomerDataUpdated,
  fetchTimeline,
  showToast,
}) {
  const normalizedOrderId = String(order?._id || '');
  const orderIdRef = useRef(normalizedOrderId);
  const openRef = useRef(open);
  const [statusLocal, setStatusLocal] = useState(order?.status || 'pending');
  const [tagsStr, setTagsStr] = useState((order?.tags || []).join(', '));
  const [savingTags, setSavingTags] = useState(false);
  const [savingCustomerData, setSavingCustomerData] = useState(false);

  orderIdRef.current = normalizedOrderId;
  openRef.current = open;

  useEffect(() => {
    if (!open) return;
    setStatusLocal(order?.status || 'pending');
    setTagsStr((Array.isArray(order?.tags) ? order.tags : []).join(', '));
    setSavingTags(false);
    setSavingCustomerData(false);
  }, [normalizedOrderId, open]);

  useEffect(() => {
    if (open) setStatusLocal(order?.status || 'pending');
  }, [open, order?.status]);

  const saveTags = useCallback(async (orderId, tags) => {
    if (!onSaveTags) return;
    const targetOrderId = String(orderId || orderIdRef.current || '');

    try {
      setSavingTags(true);
      await onSaveTags(orderId, tags);
      if (orderIdRef.current !== targetOrderId || !openRef.current) return;
      showToast({
        type: 'success',
        title: 'Etiquetas guardadas',
        message: 'Las etiquetas internas quedaron actualizadas.',
      });
    } catch {
      if (orderIdRef.current === targetOrderId && openRef.current) {
        showToast({
          type: 'error',
          title: 'No se guardaron las etiquetas',
          message: 'Revisa los datos e intenta nuevamente.',
        });
      }
    } finally {
      if (orderIdRef.current === targetOrderId && openRef.current) setSavingTags(false);
    }
  }, [onSaveTags, showToast]);

  const saveCustomerData = useCallback(async (payload) => {
    const targetOrderId = orderIdRef.current;
    if (!canEditCustomerData || !targetOrderId || !openRef.current) return null;

    try {
      setSavingCustomerData(true);
      const { data } = await api.patch(
        `/api/orders/${targetOrderId}/customer-data`,
        payload
      );
      if (orderIdRef.current !== targetOrderId || !openRef.current) return null;

      const updatedOrder = data?.order || {
        ...order,
        customer: data?.customer || order.customer,
        billing: data?.billing || order.billing,
        customerRelationship:
          data?.customerRelationship || order.customerRelationship,
      };

      onCustomerDataUpdated?.(updatedOrder);
      showToast({
        type: 'success',
        title: 'Datos actualizados',
        message: payload?.syncCustomer
          ? 'La orden y la ficha del cliente quedaron sincronizadas.'
          : 'El cambio quedó guardado únicamente en esta orden.',
      });
      await fetchTimeline(targetOrderId);
      return updatedOrder;
    } catch (error) {
      if (orderIdRef.current === targetOrderId && openRef.current) {
        showToast({
          type: 'error',
          title: 'No se pudieron actualizar los datos',
          message:
            error?.response?.data?.message ||
            'Revisa la información e intenta nuevamente.',
          persist: true,
        });
      }
      throw error;
    } finally {
      if (orderIdRef.current === targetOrderId && openRef.current) {
        setSavingCustomerData(false);
      }
    }
  }, [canEditCustomerData, fetchTimeline, onCustomerDataUpdated, order, showToast]);

  return {
    statusLocal,
    setStatusLocal,
    tagsStr,
    setTagsStr,
    savingTags,
    saveTags,
    savingCustomerData,
    saveCustomerData,
    printed: !!order?.printed,
    archived: !!order?.archived,
    disabled: savingId === order?._id,
  };
}
