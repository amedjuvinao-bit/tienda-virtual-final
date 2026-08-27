import { useEffect, useState } from 'react';
import api from '../../../lib/api';

const EMPTY_CUSTOMER_BILLING = Object.freeze({
  name: '',
  lastname: '',
  id: '',
  email: '',
  emailOrPhone: '',
  phone: '',
  address: '',
  city: '',
  department: '',
  country: '',
});

export function buildInvoiceCustomerBillingForm(order) {
  const customer = order?.customer || {};
  return Object.fromEntries(
    Object.keys(EMPTY_CUSTOMER_BILLING).map((field) => [
      field,
      customer[field] || '',
    ])
  );
}

export default function useInvoiceCustomerBilling(order) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_CUSTOMER_BILLING);

  useEffect(() => {
    setForm(buildInvoiceCustomerBillingForm(order));
  }, [order]);

  const changeField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const startEditing = () => {
    setEditing(true);
    setMessage('');
    setError('');
  };

  const cancelEditing = () => setEditing(false);

  const save = async () => {
    if (!order?._id) {
      setError('No se encontró el ID de la orden.');
      return;
    }

    try {
      setSaving(true);
      setMessage('');
      setError('');
      await api.patch(`/api/orders/${order._id}/customer-data`, {
        customer: form,
        billing: form,
      });
      setMessage('Datos de facturación actualizados correctamente.');
      setEditing(false);
    } catch (saveError) {
      console.error('Error actualizando datos de facturación:', saveError);
      setError(
        saveError?.response?.data?.message ||
          saveError?.response?.data?.error ||
          'No se pudieron guardar los datos de facturación.'
      );
    } finally {
      setSaving(false);
    }
  };

  return {
    cancelEditing,
    changeField,
    editing,
    error,
    form,
    message,
    save,
    saving,
    startEditing,
  };
}
