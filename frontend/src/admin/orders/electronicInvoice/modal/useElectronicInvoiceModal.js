import { useState } from 'react';

import api from '../../../../lib/api';
import {
  createBillingCreditNote,
  downloadBillingCreditNotePdf,
  downloadBillingCreditNoteXml,
  downloadBlob,
  getDownloadErrorMessage,
  syncBillingDocument,
} from '../../../billing/api/adminBillingApi';
import useAdminPermissions from '../../../security/useAdminPermissions';

import {
  createCreditNoteRequestKey,
  getCreditNoteIdentifier,
  getInvoiceSyncIdentifier,
  getItemKey,
  getItemQuantity,
  getOrderId,
  getOrderItems,
  invoiceIsAlreadyValidated,
} from './electronicInvoiceModalUtils';

export default function useElectronicInvoiceModal({ order, invoice }) {
  const { can } = useAdminPermissions();
  const canSync = can('billing:retry');
  const canDelete = can('billing:retry');
  const canCreateCreditNote = can('billing:credit_note');
  const canDownload = can('billing:download');
  const [activeTab, setActiveTab] = useState('summary');
  const [currentInvoice, setCurrentInvoice] = useState(invoice);

  const [retrying, setRetrying] = useState(false);
  const [deletingInvoice, setDeletingInvoice] = useState(false);
  const [creatingCreditNote, setCreatingCreditNote] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [noteDocumentLoading, setNoteDocumentLoading] = useState('');

  const [retryMessage, setRetryMessage] = useState('');
  const [retryError, setRetryError] = useState('');

  const [showCreditNoteForm, setShowCreditNoteForm] = useState(false);
  const [creditNoteType, setCreditNoteType] = useState('total');
  const [creditNoteReasonCode, setCreditNoteReasonCode] = useState('2');
  const [creditNoteObservation, setCreditNoteObservation] = useState('');
  const [selectedCreditNoteItems, setSelectedCreditNoteItems] = useState({});
  const [creditNoteRequestKey, setCreditNoteRequestKey] = useState(
    createCreditNoteRequestKey
  );

  const alreadyValidated = invoiceIsAlreadyValidated(currentInvoice);
  const orderItems = getOrderItems(order);
  const creditNotes = Array.isArray(currentInvoice?.creditNotes)
    ? currentInvoice.creditNotes
    : [];

  const clearMessages = () => {
    setRetryMessage('');
    setRetryError('');
  };

  const handleSyncInvoice = async () => {
    const identifier = getInvoiceSyncIdentifier(currentInvoice);

    if (!identifier) {
      setRetryMessage('');
      setRetryError('No se encontró la factura que se debe sincronizar.');
      return;
    }

    try {
      setSyncing(true);
      clearMessages();
      const data = await syncBillingDocument(identifier);

      if (data?.invoice) {
        setCurrentInvoice((previous) => ({
          ...previous,
          ...data.invoice,
          creditNotes: previous?.creditNotes || data.invoice?.creditNotes || [],
        }));
      }

      setRetryMessage(
        data?.message || 'Estado de la factura sincronizado correctamente.'
      );
    } catch (error) {
      setRetryMessage('');
      setRetryError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          error?.message ||
          'No fue posible sincronizar la factura.'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryInvoice = async () => {
    const orderId = getOrderId(order, currentInvoice, invoice);

    if (alreadyValidated) {
      setRetryMessage('');
      setRetryError(
        'Esta factura ya está validada. No se debe reenviar para evitar duplicados.'
      );
      return;
    }

    if (!orderId) {
      setRetryError('No se encontró el ID de la orden.');
      return;
    }

    try {
      setRetrying(true);
      clearMessages();

      const response = await api.post(
        `/api/payments/admin/retry-electronic-invoice/${orderId}`
      );

      if (response?.data?.invoice) {
        setCurrentInvoice(response.data.invoice);
      }

      if (response?.data?.success) {
        setRetryMessage('Factura reenviada correctamente al proveedor.');
      } else {
        setRetryError(
          response?.data?.error ||
            'El proveedor respondió, pero no confirmó el reintento.'
        );
      }
    } catch (error) {
      console.error('Error reintentando factura electrónica:', error);

      setRetryError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'No fue posible reintentar la factura electrónica.'
      );
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteInvoice = async () => {
    const orderId = getOrderId(order, currentInvoice, invoice);

    if (!orderId) {
      setRetryError('No se encontró el ID de la orden.');
      return;
    }

    try {
      setDeletingInvoice(true);
      clearMessages();

      const response = await api.post(
        `/api/payments/admin/delete-factus-invoice/${orderId}`
      );

      if (response?.data?.success) {
        setRetryMessage(
          'Factura no validada eliminada correctamente en Factus.'
        );

        setCurrentInvoice((previous) => ({
          ...previous,
          status: 'pending',
        }));
      } else {
        setRetryError(
          response?.data?.deleteResult?.error ||
            response?.data?.message ||
            response?.data?.error ||
            'No se pudo eliminar la factura en Factus.'
        );
      }
    } catch (error) {
      console.error('Error eliminando factura Factus:', error);

      setRetryError(
        error?.response?.data?.message ||
          error?.response?.data?.error ||
          'No fue posible eliminar la factura en Factus.'
      );
    } finally {
      setDeletingInvoice(false);
    }
  };

  const openCreditNoteForm = () => {
    if (!alreadyValidated) {
      setRetryMessage('');
      setRetryError(
        'Solo se puede crear nota crédito sobre una factura validada.'
      );
      return;
    }

    clearMessages();
    setCreditNoteRequestKey(createCreditNoteRequestKey());
    setShowCreditNoteForm(true);
  };

  const closeCreditNoteForm = () => {
    if (creatingCreditNote) return;
    setShowCreditNoteForm(false);
  };

  const handleCreditNoteTypeChange = (nextType) => {
    setCreditNoteType(nextType);
    setCreditNoteReasonCode(nextType === 'partial' ? '1' : '2');
    setSelectedCreditNoteItems({});
  };

  const handleToggleCreditNoteItem = (item, index) => {
    const key = getItemKey(item, index);
    const maxQuantity = getItemQuantity(item);

    setSelectedCreditNoteItems((previous) => {
      if (previous[key]) {
        const next = { ...previous };
        delete next[key];
        return next;
      }

      return {
        ...previous,
        [key]: {
          ...item,
          quantity: 1,
          maxQuantity,
        },
      };
    });
  };

  const handleChangeCreditNoteItemQuantity = (item, index, value) => {
    const key = getItemKey(item, index);
    const maxQuantity = getItemQuantity(item);
    const quantity = Math.max(1, Math.min(Number(value || 1), maxQuantity));

    setSelectedCreditNoteItems((previous) => ({
      ...previous,
      [key]: {
        ...(previous[key] || item),
        quantity,
        maxQuantity,
      },
    }));
  };

  const handleCreateCreditNote = async () => {
    const orderId = getOrderId(order, currentInvoice, invoice);

    if (!alreadyValidated) {
      setRetryMessage('');
      setRetryError(
        'Solo se puede crear nota crédito sobre una factura validada.'
      );
      return;
    }

    if (!orderId) {
      setRetryError('No se encontró el ID de la orden.');
      return;
    }

    if (!creditNoteObservation.trim()) {
      setRetryMessage('');
      setRetryError(
        'Debes escribir una observación explicando el motivo de la nota crédito.'
      );
      return;
    }

    const partialItems = Object.values(selectedCreditNoteItems);

    if (creditNoteType === 'partial' && !partialItems.length) {
      setRetryMessage('');
      setRetryError(
        'Para una nota crédito parcial debes seleccionar al menos un producto.'
      );
      return;
    }

    try {
      setCreatingCreditNote(true);
      clearMessages();

      const invoiceId = currentInvoice?.id || currentInvoice?._id;
      if (!invoiceId) {
        throw new Error('No se encontró la factura relacionada.');
      }

      const result = await createBillingCreditNote(invoiceId, {
        type: creditNoteType,
        reasonCode: creditNoteReasonCode,
        reason: creditNoteObservation.trim(),
        selectedItems: creditNoteType === 'partial' ? partialItems : [],
        idempotencyKey: creditNoteRequestKey,
      });

      if (result?.invoice) {
        setRetryMessage(
          result?.message || 'Nota crédito creada correctamente en Factus.'
        );
        setShowCreditNoteForm(false);
        setCurrentInvoice(result.invoice);
      } else {
        setRetryError(result?.message || 'No se pudo crear la nota crédito.');
      }
    } catch (error) {
      console.error('Error creando nota crédito:', error);

      const backendError = error?.response?.data;

      if (
        backendError?.error === 'FACTUS_PENDING_CREDIT_NOTE' ||
        backendError?.error === 'BILLING_CREDIT_NOTE_IN_PROGRESS'
      ) {
        setRetryError(
          'Factus reporta una nota crédito pendiente para esta factura. Debes sincronizar el estado antes de crear otra nota crédito.'
        );
      } else {
        setRetryError(
          backendError?.message ||
            backendError?.error ||
            'No fue posible crear la nota crédito.'
        );
      }
    } finally {
      setCreatingCreditNote(false);
    }
  };

  const handleDownloadCreditNote = async (note, type) => {
    const invoiceId = currentInvoice?.id || currentInvoice?._id;
    const noteId = getCreditNoteIdentifier(note);
    if (!invoiceId || !noteId) return;

    try {
      clearMessages();
      setNoteDocumentLoading(`${type}-${noteId}`);
      const result =
        type === 'pdf'
          ? await downloadBillingCreditNotePdf(invoiceId, noteId)
          : await downloadBillingCreditNoteXml(invoiceId, noteId);
      downloadBlob(
        result,
        `nota-credito-${note?.provider?.number || noteId}.${type}`
      );
    } catch (error) {
      setRetryError(
        await getDownloadErrorMessage(
          error,
          `No fue posible descargar el ${type.toUpperCase()} oficial de la nota crédito.`
        )
      );
    } finally {
      setNoteDocumentLoading('');
    }
  };

  return {
    activeTab, setActiveTab,
    currentInvoice,
    canSync, canDelete, canCreateCreditNote, canDownload,
    retrying, deletingInvoice, creatingCreditNote, syncing,
    noteDocumentLoading,
    retryMessage, retryError,
    showCreditNoteForm,
    creditNoteType,
    creditNoteReasonCode, setCreditNoteReasonCode,
    creditNoteObservation, setCreditNoteObservation,
    selectedCreditNoteItems,
    alreadyValidated,
    orderItems, creditNotes,
    handleSyncInvoice,
    handleRetryInvoice,
    handleDeleteInvoice,
    openCreditNoteForm,
    closeCreditNoteForm,
    handleCreditNoteTypeChange,
    handleToggleCreditNoteItem,
    handleChangeCreditNoteItemQuantity,
    handleCreateCreditNote,
    handleDownloadCreditNote,
  };
}
