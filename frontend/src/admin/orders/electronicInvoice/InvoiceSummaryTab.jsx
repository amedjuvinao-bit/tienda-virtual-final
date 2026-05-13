// src/admin/orders/electronicInvoice/InvoiceSummaryTab.jsx

import { useEffect, useState } from 'react';
import api from '../../../lib/api';

import {
  getInvoiceStatusInfo,
  getInvoiceNumber,
  getInvoiceCufe,
  formatMoneyCOP,
  shortText,
} from './invoiceStatusUtils';

export default function InvoiceSummaryTab({ order, invoice }) {
  const statusInfo = getInvoiceStatusInfo(invoice);

  const invoiceNumber = getInvoiceNumber(invoice);
  const cufe = getInvoiceCufe(invoice);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
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

  useEffect(() => {
    const customer = order?.customer || {};

    setForm({
      name: customer.name || '',
      lastname: customer.lastname || '',
      id: customer.id || '',
      email: customer.email || '',
      emailOrPhone: customer.emailOrPhone || '',
      phone: customer.phone || '',
      address: customer.address || '',
      city: customer.city || '',
      department: customer.department || '',
      country: customer.country || '',
    });
  }, [order]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
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

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card
          title="Estado DIAN"
          value={statusInfo.label}
          badgeClass={statusInfo.className}
        />

        <Card
          title="Factura"
          value={invoiceNumber}
        />

        <Card
          title="CUFE"
          value={shortText(cufe, 30)}
        />

        <Card
          title="Total"
          value={formatMoneyCOP(order?.total)}
        />
      </div>

      <section
        className="rounded-3xl border p-5"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
          boxShadow:
            'var(--admin-card-shadow, 0 18px 40px rgba(15, 23, 42, 0.06))',
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3
            className="text-base font-bold"
            style={{
              color: 'var(--admin-card-text)',
            }}
          >
            Información del cliente / facturación
          </h3>

          <div className="flex flex-wrap items-center gap-2">
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'var(--admin-button-soft-bg)',
                  color: 'var(--admin-button-soft-text)',
                  borderColor: 'var(--admin-button-soft-border)',
                }}
              >
                Cancelar
              </button>
            )}

            {editing ? (
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
                style={{
                  background: 'var(--admin-button-bg)',
                  color: 'var(--admin-button-text)',
                  borderColor: 'var(--admin-button-bg)',
                }}
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(true);
                  setMessage('');
                  setError('');
                }}
                className="rounded-xl border px-4 py-2 text-sm font-semibold transition"
                style={{
                  background: 'var(--admin-button-soft-bg)',
                  color: 'var(--admin-button-soft-text)',
                  borderColor: 'var(--admin-button-soft-border)',
                }}
              >
                Corregir datos
              </button>
            )}
          </div>
        </div>

        {message && (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{
              background: 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
              borderColor: 'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
              color: 'var(--admin-success-text, #16a34a)',
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="mt-4 rounded-xl border px-4 py-3 text-sm font-semibold"
            style={{
              background: 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))',
              borderColor: 'var(--admin-danger-border, rgba(239, 68, 68, 0.25))',
              color: 'var(--admin-danger-text, #dc2626)',
            }}
          >
            {error}
          </div>
        )}

        {editing ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <EditField
              label="Nombre"
              value={form.name}
              onChange={(value) => handleChange('name', value)}
            />

            <EditField
              label="Apellido"
              value={form.lastname}
              onChange={(value) => handleChange('lastname', value)}
            />

            <EditField
              label="Documento / NIT"
              value={form.id}
              onChange={(value) => handleChange('id', value)}
            />

            <EditField
              label="Correo"
              value={form.email || form.emailOrPhone}
              onChange={(value) => {
                handleChange('email', value);
                handleChange('emailOrPhone', value);
              }}
            />

            <EditField
              label="Teléfono"
              value={form.phone}
              onChange={(value) => handleChange('phone', value)}
            />

            <EditField
              label="Dirección"
              value={form.address}
              onChange={(value) => handleChange('address', value)}
            />

            <EditField
              label="Ciudad"
              value={form.city}
              onChange={(value) => handleChange('city', value)}
            />

            <EditField
              label="Departamento"
              value={form.department}
              onChange={(value) => handleChange('department', value)}
            />

            <EditField
              label="País"
              value={form.country}
              onChange={(value) => handleChange('country', value)}
            />
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Info
              label="Cliente"
              value={`${form.name || ''} ${form.lastname || ''}`}
            />

            <Info
              label="Documento"
              value={form.id}
            />

            <Info
              label="Correo"
              value={form.email || form.emailOrPhone}
            />

            <Info
              label="Teléfono"
              value={form.phone}
            />

            <Info
              label="Dirección"
              value={form.address}
            />

            <Info
              label="Ciudad"
              value={form.city}
            />

            <Info
              label="Departamento"
              value={form.department}
            />

            <Info
              label="País"
              value={form.country}
            />
          </div>
        )}
      </section>

      <section
        className="rounded-3xl border p-5"
        style={{
          background: 'var(--admin-card-bg)',
          borderColor: 'var(--admin-card-border)',
          color: 'var(--admin-card-text)',
          boxShadow:
            'var(--admin-card-shadow, 0 18px 40px rgba(15, 23, 42, 0.06))',
        }}
      >
        <h3
          className="text-base font-bold"
          style={{
            color: 'var(--admin-card-text)',
          }}
        >
          Resumen económico
        </h3>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Info
            label="Subtotal"
            value={formatMoneyCOP(order?.subtotal)}
          />

          <Info
            label="IVA"
            value={formatMoneyCOP(order?.taxes?.iva?.amount)}
          />

          <Info
            label="Envío"
            value={formatMoneyCOP(order?.shipping)}
          />

          <Info
            label="Total pagado"
            value={formatMoneyCOP(order?.total)}
          />

          <Info
            label="Método pago"
            value={
              order?.payment?.providerLabel ||
              order?.payment?.provider
            }
          />

          <Info
            label="Moneda"
            value={order?.payment?.currency || 'COP'}
          />
        </div>
      </section>
    </div>
  );
}

function Card({ title, value, badgeClass }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--admin-primary-soft-bg)',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{
          color: 'var(--admin-card-muted-text)',
        }}
      >
        {title}
      </p>

      <div className="mt-3">
        {badgeClass ? (
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}
          >
            {value}
          </span>
        ) : (
          <p
            className="text-sm font-bold"
            style={{
              color: 'var(--admin-card-text)',
            }}
          >
            {value || '—'}
          </p>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--admin-button-soft-bg, var(--admin-primary-soft-bg))',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p
        className="text-xs font-semibold uppercase tracking-wide"
        style={{
          color: 'var(--admin-card-muted-text)',
        }}
      >
        {label}
      </p>

      <p
        className="mt-2 break-words text-sm font-medium"
        style={{
          color: 'var(--admin-card-text)',
        }}
      >
        {value || '—'}
      </p>
    </div>
  );
}

function EditField({ label, value, onChange }) {
  return (
    <label
      className="rounded-2xl border p-4"
      style={{
        background: 'var(--admin-button-soft-bg, var(--admin-primary-soft-bg))',
        borderColor: 'var(--admin-card-border)',
        color: 'var(--admin-card-text)',
      }}
    >
      <span
        className="text-xs font-semibold uppercase tracking-wide"
        style={{
          color: 'var(--admin-card-muted-text)',
        }}
      >
        {label}
      </span>

      <input
        type="text"
        value={value || ''}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-xl border px-3 py-2 text-sm outline-none"
        style={{
          background: 'var(--admin-input-bg)',
          borderColor: 'var(--admin-input-border)',
          color: 'var(--admin-input-text)',
        }}
      />
    </label>
  );
}