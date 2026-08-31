import { useRef, useState } from 'react';

import api from '../../../lib/api';

export default function useOrdersAdminDetail({
  canArchive,
  canMarkPrinted,
  canUpdateStatus,
  canUpdateTags,
  canView,
  requireSessionAndPermission,
  setData,
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [orderSelected, setOrderSelected] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const orderDetailRequestRef = useRef(0);

  const openOrderDetail = async (order) => {
    if (!requireSessionAndPermission(
      canView,
      'No tienes permiso para consultar órdenes.'
    )) return;

    let requestId = null;
    try {
      const id = order?._id;
      if (!id) return;
      requestId = orderDetailRequestRef.current + 1;
      orderDetailRequestRef.current = requestId;
      setOrderSelected(order);
      setShowDetail(true);

      const { data } = await api.get(`/api/orders/${id}`);
      if (requestId !== orderDetailRequestRef.current) return;
      setOrderSelected(data);
    } catch {
      if (requestId == null || orderDetailRequestRef.current !== requestId) return;
      alert('No se pudo cargar el detalle completo de la orden.');
    }
  };

  const closeOrderDetail = () => {
    orderDetailRequestRef.current += 1;
    setShowDetail(false);
  };

  const handleOrderUpdated = (updatedOrder) => {
    if (!updatedOrder?._id) return;

    const mergeOrder = (current) => {
      if (!current || current._id !== updatedOrder._id) return current;
      return {
        ...current,
        ...updatedOrder,
        fulfillment: updatedOrder.fulfillment
          ? {
              ...(current.fulfillment || {}),
              ...updatedOrder.fulfillment,
            }
          : current.fulfillment,
      };
    };

    setOrderSelected(mergeOrder);
    setData((current) => current.map(mergeOrder));
  };

  const saveStatus = async (id, status) => {
    if (!requireSessionAndPermission(
      canUpdateStatus,
      'No tienes permiso para cambiar el estado de una orden.'
    )) return null;

    try {
      setSavingId(id);
      const response = await api.patch(`/api/orders/${id}/status`, { status });
      const updatedOrder = response?.data?.order || null;
      const savedStatus = updatedOrder?.status || status;
      setData((current) => current.map((order) =>
        order._id === id
          ? { ...order, ...(updatedOrder || {}), status: savedStatus }
          : order
      ));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((current) => ({
          ...current,
          ...(updatedOrder || {}),
          status: savedStatus,
        }));
      }
      return response;
    } catch (error) {
      alert(error?.response?.data?.message || 'No se pudo guardar el estado.');
      throw error;
    } finally {
      setSavingId(null);
    }
  };

  const saveTags = async (id, tags) => {
    if (!requireSessionAndPermission(
      canUpdateTags,
      'No tienes permiso para editar las etiquetas de una orden.'
    )) return null;

    try {
      setSavingId(id);
      const response = await api.put(`/api/orders/${id}/tags`, { tags });
      const savedTags = Array.isArray(response?.data?.tags) ? response.data.tags : tags;
      setData((current) => current.map((order) =>
        order._id === id ? { ...order, tags: savedTags } : order
      ));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((current) => ({ ...current, tags: savedTags }));
      }
      return response;
    } catch (error) {
      alert('No se pudieron guardar los tags.');
      throw error;
    } finally {
      setSavingId(null);
    }
  };

  const togglePrinted = async (id, printed) => {
    if (!requireSessionAndPermission(
      canMarkPrinted,
      'No tienes permiso para marcar órdenes como impresas.'
    )) return null;

    try {
      setSavingId(id);
      const response = await api.patch(`/api/orders/${id}/printed`, { printed });
      setData((current) => current.map((order) =>
        order._id === id ? { ...order, printed: Boolean(printed) } : order
      ));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((current) => ({ ...current, printed: Boolean(printed) }));
      }
      return response;
    } catch (error) {
      alert('No se pudo actualizar "impresa".');
      throw error;
    } finally {
      setSavingId(null);
    }
  };

  const toggleArchived = async (id, archived) => {
    if (!requireSessionAndPermission(
      canArchive,
      'No tienes permiso para archivar órdenes.'
    )) return null;

    try {
      setSavingId(id);
      const response = await api.patch(`/api/orders/${id}/archived`, { archived });
      setData((current) => current.map((order) =>
        order._id === id ? { ...order, archived: Boolean(archived) } : order
      ));
      if (orderSelected && orderSelected._id === id) {
        setOrderSelected((current) => ({ ...current, archived: Boolean(archived) }));
      }
      return response;
    } catch (error) {
      alert('No se pudo actualizar "archivada".');
      throw error;
    } finally {
      setSavingId(null);
    }
  };

  return {
    closeOrderDetail,
    handleOrderUpdated,
    openOrderDetail,
    orderSelected,
    saveStatus,
    saveTags,
    savingId,
    showDetail,
    toggleArchived,
    togglePrinted,
  };
}
