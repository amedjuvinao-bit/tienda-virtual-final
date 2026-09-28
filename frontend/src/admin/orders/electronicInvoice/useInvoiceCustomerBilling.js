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
  const billing = order?.billing || {};
  const form = Object.fromEntries(
    Object.keys(EMPTY_CUSTOMER_BILLING).map((field) => [
      field,
      customer[field] || '',
    ])
  );
  return {
    ...form,
    name: billing.firstName || billing.name || form.name,
    lastname: billing.lastName || billing.lastname || form.lastname,
    id: billing.documentNumber || billing.id || form.id,
    email: billing.email || form.email,
    emailOrPhone: billing.email || form.emailOrPhone,
    phone: billing.phone || form.phone,
    address: billing.address || form.address,
    city: billing.city || form.city,
    department: billing.department || form.department,
    country: billing.country || form.country,
  };
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
        customer: {
          name: form.name,
          lastname: form.lastname,
          id: form.id,
          email: form.email,
          emailOrPhone: form.emailOrPhone,
          phone: form.phone,
          address: form.address,
          city: form.city,
          department: form.department,
          country: form.country,
        },
        billing: {
          firstName: form.name,
          lastName: form.lastname,
          documentNumber: form.id,
          email: form.email,
          phone: form.phone,
          address: form.address,
          city: form.city,
          department: form.department,
          country: form.country,
        },
      });
      setMessage('Datos actuales de la orden guardados. La factura emitida conserva sus datos originales.');
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
