import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../../../lib/api';

export default function useOrderDocuments({
  order,
  open,
  canDownloadBilling = false,
  showToast,
}) {
  const normalizedOrderId = String(order?._id || '');
  const orderIdRef = useRef(normalizedOrderId);
  const openRef = useRef(open);
  const requestRef = useRef(0);
  const [loading, setLoading] = useState(false);
  orderIdRef.current = normalizedOrderId;
  openRef.current = open;

  useEffect(() => {
    requestRef.current += 1;
    setLoading(false);
  }, [normalizedOrderId, open]);

  const electronicInvoiceUrl = useMemo(() => {
    const factusLinks = order?.factusLinks || {};
    return (
      factusLinks?.pdfUrl ||
      factusLinks?.publicUrl ||
      order?.electronicInvoice?.provider?.links?.public_url ||
      order?.electronicInvoice?.provider?.links?.pdf_url ||
      ''
    );
  }, [order]);

  const openPdf = useCallback(async () => {
    const targetOrderId = orderIdRef.current;
    if (!canDownloadBilling || !targetOrderId || !openRef.current) return;
    const requestId = ++requestRef.current;

    try {
      setLoading(true);
      const response = await api.get(`/api/orders/${targetOrderId}/receipt-pdf`, {
        responseType: 'blob',
      });
      if (
        requestRef.current !== requestId ||
        orderIdRef.current !== targetOrderId ||
        !openRef.current
      ) return;

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      if (
        requestRef.current === requestId &&
        orderIdRef.current === targetOrderId &&
        openRef.current
      ) {
        showToast({
          type: 'error',
          title: 'No se pudo abrir el PDF',
          message: 'No fue posible generar o abrir el documento de la orden.',
        });
      }
    } finally {
      if (
        requestRef.current === requestId &&
        orderIdRef.current === targetOrderId &&
        openRef.current
      ) setLoading(false);
    }
  }, [canDownloadBilling, showToast]);

  const openElectronicInvoice = useCallback(() => {
    if (!canDownloadBilling) return;
    if (!electronicInvoiceUrl) {
      showToast({
        type: 'warning',
        title: 'Factura no disponible',
        message: 'Esta orden aún no tiene enlace de factura electrónica.',
      });
      return;
    }
    window.open(electronicInvoiceUrl, '_blank', 'noopener,noreferrer');
  }, [canDownloadBilling, electronicInvoiceUrl, showToast]);

  return {
    loading,
    openPdf,
    openElectronicInvoice,
  };
}
