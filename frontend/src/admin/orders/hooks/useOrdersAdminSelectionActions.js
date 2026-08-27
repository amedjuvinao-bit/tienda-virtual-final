import { useEffect, useState } from 'react';

import api from '../../../lib/api';
import { parseTagsInput } from '../ordersAdminModel';

function downloadCsv(data, filename) {
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function useOrdersAdminSelectionActions({
  canBulk,
  canExport,
  data,
  params,
  requireSessionAndPermission,
  selectionEnabled,
  setData,
}) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('processing');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkMode, setBulkMode] = useState('add');

  const clearSelection = () => setSelectedIds(new Set());
  const isSelected = (id) => selectedIds.has(id);
  const toggleOne = (id) => {
    if (!selectionEnabled) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = (
    data.length > 0 && data.every((order) => selectedIds.has(order._id))
  );
  const toggleSelectAllVisible = () => {
    if (!selectionEnabled) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (allVisibleSelected) {
        data.forEach((order) => next.delete(order._id));
      } else {
        data.forEach((order) => next.add(order._id));
      }
      return next;
    });
  };

  useEffect(() => {
    setSelectedIds((previous) => {
      const visibleIds = new Set(data.map((order) => order._id));
      return new Set(Array.from(previous).filter((id) => visibleIds.has(id)));
    });
  }, [data]);

  useEffect(() => {
    if (!selectionEnabled) clearSelection();
  }, [selectionEnabled]);

  const exportCsv = async () => {
    if (!requireSessionAndPermission(
      canExport,
      'No tienes permiso para exportar órdenes.'
    )) return;

    try {
      const response = await api.get('/api/orders/admin', {
        params: { ...params, format: 'csv' },
        responseType: 'blob',
      });
      downloadCsv(response.data, 'orders.csv');
    } catch {
      alert('No se pudo exportar el CSV.');
    }
  };

  const exportSelectedCsv = async () => {
    if (!requireSessionAndPermission(
      canExport,
      'No tienes permiso para exportar órdenes.'
    )) return;

    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    try {
      const response = await api.post(
        '/api/orders/admin/export',
        { ids },
        { responseType: 'blob' }
      );
      downloadCsv(response.data, 'orders-selected.csv');
    } catch {
      alert('No se pudo exportar el CSV de seleccionadas.');
    }
  };

  const runBulkStatus = async () => {
    if (!requireSessionAndPermission(
      canBulk,
      'No tienes permiso para ejecutar acciones masivas.'
    )) return;

    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (bulkStatus === 'paid') {
      alert('El pago debe confirmarse individualmente desde el panel Pago y factura.');
      return;
    }
    try {
      setBulkBusy(true);
      const response = await api.post('/api/orders/admin/bulk', {
        ids,
        action: { type: 'status', value: bulkStatus },
      });
      const results = Array.isArray(response?.data?.results)
        ? response.data.results
        : [];
      const successful = new Map(
        results
          .filter((result) => result?.ok)
          .map((result) => [String(result.orderId), result])
      );
      const failedIds = new Set(
        results
          .filter((result) => !result?.ok)
          .map((result) => String(result.orderId))
      );

      setData((previous) => previous.map((order) => {
        const result = successful.get(String(order._id));
        if (!result) return order;
        return {
          ...order,
          status: result.status || bulkStatus,
          payment: {
            ...(order.payment || {}),
            ...(result.paymentStatus ? { status: result.paymentStatus } : {}),
          },
          fulfillmentStatus: result.fulfillmentStatus || order.fulfillmentStatus,
        };
      }));
      setSelectedIds(failedIds);

      if (Number(response?.data?.failed || 0) > 0) {
        const firstFailure = results.find((result) => !result?.ok);
        alert(
          `${response.data.modified || 0} orden(es) actualizada(s) y ` +
          `${response.data.failed} sin cambiar. ` +
          `${firstFailure?.message || 'Revisa las órdenes seleccionadas.'}`
        );
      }
    } catch (error) {
      alert(
        error?.response?.data?.message ||
        'No se pudieron aplicar los cambios de estado.'
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const runBulkTags = async () => {
    if (!requireSessionAndPermission(
      canBulk,
      'No tienes permiso para ejecutar acciones masivas.'
    )) return;

    const ids = Array.from(selectedIds);
    const tags = parseTagsInput(bulkTags);
    if (ids.length === 0 || tags.length === 0) return;
    try {
      setBulkBusy(true);
      await api.post('/api/orders/admin/bulk', {
        ids,
        action: {
          type: bulkMode === 'add' ? 'tags_add' : 'tags_remove',
          value: tags,
        },
      });
      setData((previous) => previous.map((order) => {
        if (!selectedIds.has(order._id)) return order;
        const original = Array.isArray(order.tags) ? order.tags : [];
        if (bulkMode === 'add') {
          return { ...order, tags: Array.from(new Set([...original, ...tags])) };
        }
        const next = new Set(original);
        tags.forEach((tag) => next.delete(tag));
        return { ...order, tags: Array.from(next) };
      }));
      clearSelection();
      setBulkTags('');
    } catch {
      alert('No se pudieron aplicar los cambios de tags.');
    } finally {
      setBulkBusy(false);
    }
  };

  return {
    bulkBusy,
    bulkMode,
    bulkStatus,
    bulkTags,
    clearSelection,
    exportCsv,
    exportSelectedCsv,
    isSelected,
    runBulkStatus,
    runBulkTags,
    selectedIds,
    setBulkMode,
    setBulkStatus,
    setBulkTags,
    toggleOne,
    toggleSelectAllVisible,
  };
}
