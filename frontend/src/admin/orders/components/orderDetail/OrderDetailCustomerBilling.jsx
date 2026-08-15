// frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx

import { useEffect, useMemo, useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  cleanText,
  getBillingName,
  getCustomerName,
} from './orderDetailUtils';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

function firstValidText(...values) {
  const found = values
    .map((value) => String(value || '').trim())
    .find((value) => value && value !== '—');

  return found || '—';
}

function getEmailFromCustomer(customer, order) {
  const emailDirect = firstValidText(
    customer.email,
    customer.customerEmail,
    customer.emailAddress,
    order?.customerEmail
  );

  if (emailDirect !== '—') return emailDirect;

  const emailOrPhone = String(customer.emailOrPhone || '').trim();

  if (emailOrPhone.includes('@')) {
    return emailOrPhone;
  }

  return '—';
}

function getEditableForm(order = {}) {
  const customer = order.customer || {};
  const billing = order.billing || {};

  return {
    customer: {
      name: customer.name || '',
      lastname: customer.lastname || '',
      documentType: customer.documentType || billing.documentType || '',
      id: customer.id || billing.documentNumber || billing.id || '',
      email:
        customer.email ||
        (String(customer.emailOrPhone || '').includes('@')
          ? customer.emailOrPhone
          : ''),
      phone:
        customer.phone ||
        (!String(customer.emailOrPhone || '').includes('@')
          ? customer.emailOrPhone
          : '') ||
        billing.phone ||
        '',
      address: customer.address || billing.address || '',
      city: customer.city || billing.city || '',
      department: customer.department || billing.department || '',
      country: customer.country || billing.country || 'Colombia',
      postalCode: customer.postalCode || billing.postalCode || '',
    },
    billing: {
      personType: billing.personType || '',
      businessName: billing.businessName || '',
      firstName: billing.firstName || billing.name || customer.name || '',
      lastName: billing.lastName || billing.lastname || customer.lastname || '',
      documentType: billing.documentType || customer.documentType || '',
      documentNumber: billing.documentNumber || billing.id || customer.id || '',
      email: billing.email || customer.email || '',
      phone: billing.phone || customer.phone || '',
      address: billing.address || customer.address || '',
      city: billing.city || customer.city || '',
      department: billing.department || customer.department || '',
      country: billing.country || customer.country || 'Colombia',
      postalCode: billing.postalCode || customer.postalCode || '',
    },
  };
}

function isDemoOrder(order = {}) {
  const tags = (Array.isArray(order.tags) ? order.tags : [])
    .map((tag) => String(tag || '').trim().toLowerCase());
  const email = String(
    order?.customer?.email || order?.billing?.email || ''
  ).toLowerCase();

  return (
    tags.includes('demo') ||
    tags.includes('orders-trace') ||
    (
      String(order.source || '').toLowerCase() === 'system' &&
      email.endsWith('@example.com')
    )
  );
}

const fieldStyle = {
  width: '100%',
  minWidth: 0,
  border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
  borderRadius: 12,
  background: ORDER_DETAIL_THEME.cardBg,
  color: ORDER_DETAIL_THEME.cardText,
  padding: '10px 11px',
  fontSize: 12,
  fontWeight: 700,
  outline: 'none',
};

function EditField({ label, value, onChange, type = 'text', children }) {
  return (
    <label style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <span
        style={{
          color: ORDER_DETAIL_THEME.mutedText,
          fontSize: 10,
          fontWeight: 900,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {children || (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={fieldStyle}
        />
      )}
    </label>
  );
}

export default function OrderDetailCustomerBilling({
  order,
  onSaveCustomerData,
  saving = false,
}) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};
  const [editing, setEditing] = useState(false);
  const [syncCustomer, setSyncCustomer] = useState(false);
  const [form, setForm] = useState(() => getEditableForm(order));
  const [formError, setFormError] = useState('');
  const demoOrder = useMemo(() => isDemoOrder(order), [order]);

  useEffect(() => {
    setEditing(false);
    setSyncCustomer(false);
    setForm(getEditableForm(order));
    setFormError('');
  }, [order?._id]);

  const setPartyField = (party, field, value) => {
    setForm((current) => ({
      ...current,
      [party]: {
        ...current[party],
        [field]: value,
      },
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');

    const phoneDigits = String(form.customer.phone || '').replace(/\D/g, '');
    if (form.customer.phone && phoneDigits.length < 10) {
      setFormError('El celular debe tener al menos 10 dígitos.');
      return;
    }

    try {
      await onSaveCustomerData?.({
        customer: form.customer,
        billing: form.billing,
        syncCustomer: demoOrder ? false : syncCustomer,
      });
      setEditing(false);
    } catch {
      // El modal presenta el error del servidor; el formulario conserva los datos.
    }
  };

  const customerName = getCustomerName(order);
  const billingName = getBillingName(order);

  const customerDocument = firstValidText(
    customer.document,
    customer.documentNumber,
    customer.identification,
    customer.idNumber,
    customer.id,
    customer.cedula,
    customer.cc,
    customer.legalId,
    customer.legal_id,
    order?.customerDocument,
    order?.customerId
  );

  const billingDocument = firstValidText(
    billing.document,
    billing.documentNumber,
    billing.identification,
    billing.idNumber,
    billing.id,
    billing.cedula,
    billing.cc,
    billing.legalId,
    billing.legal_id,
    customerDocument
  );
  const billingDocumentType = firstValidText(
    billing.documentType,
    customer.documentType
  );
  const billingPersonType = String(billing.personType || '').trim().toLowerCase();
  const billingPersonLabel =
    billingPersonType === 'juridica'
      ? 'Persona jurídica'
      : billingPersonType === 'natural'
        ? 'Persona natural'
        : '—';
  const billingDocumentWithDv =
    billingDocumentType === 'NIT' && billing.dv
      ? `${billingDocument}-${billing.dv}`
      : billingDocument;

  const customerAddress = firstValidText(
    customer.address,
    customer.shippingAddress,
    customer.addressLine,
    customer.deliveryAddress,
    order?.customerAddress
  );

  const billingAddress = firstValidText(
    billing.address,
    billing.billingAddress,
    billing.addressLine,
    billing.deliveryAddress,
    customerAddress
  );

  const customerCity = firstValidText(
    customer.city,
    customer.municipality,
    customer.town,
    customer.customerCity,
    order?.customerCity
  );

  const billingCity = firstValidText(
    billing.city,
    billing.municipality,
    billing.town,
    billing.billingCity,
    customerCity
  );

  const customerEmail = getEmailFromCustomer(customer, order);
  const billingEmail = firstValidText(
    billing.email,
    customerEmail
  );

  const customerPhone = firstValidText(
    customer.phone,
    customer.customerPhone,
    customer.phoneNumber,
    customer.mobile,
    customer.cellphone,
    customer.emailOrPhone && !String(customer.emailOrPhone).includes('@')
      ? customer.emailOrPhone
      : '',
    order?.customerPhone
  );

  const billingDepartment = firstValidText(
    billing.department,
    billing.state,
    billing.region,
    customer.department,
    customer.state,
    customer.region
  );

  const billingCountry = firstValidText(
    billing.country,
    customer.country,
    'Colombia'
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 14,
      }}
    >
      <OrderDetailPanel
        style={{
          padding: 18,
        }}
      >
        <SectionTitle
          icon={OrderDetailIcons.User}
          title="Cliente"
          subtitle="Información principal de contacto"
          action={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SoftBadge variant="primary">Comprador</SoftBadge>
              {onSaveCustomerData ? (
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  style={{
                    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                    borderRadius: 999,
                    background: editing
                      ? ORDER_DETAIL_THEME.primary
                      : ORDER_DETAIL_THEME.cardBg,
                    color: editing ? '#fff' : ORDER_DETAIL_THEME.primary,
                    padding: '7px 11px',
                    fontSize: 10,
                    fontWeight: 950,
                    cursor: 'pointer',
                  }}
                >
                  {editing ? 'Cerrar edición' : 'Corregir datos'}
                </button>
              ) : null}
            </div>
          }
        />

        <div
          style={{
            display: 'grid',
            gap: 11,
          }}
        >
          <InfoLine label="Nombre:" value={customerName} strong />
          <InfoLine label="Documento:" value={cleanText(customerDocument)} />
          <InfoLine label="Correo:" value={cleanText(customerEmail)} />
          <InfoLine label="Teléfono:" value={cleanText(customerPhone)} />
          <InfoLine label="Dirección:" value={cleanText(customerAddress)} />
          <InfoLine label="Ciudad:" value={cleanText(customerCity)} />
        </div>
      </OrderDetailPanel>

      {editing ? (
        <OrderDetailPanel
          style={{
            padding: 18,
            gridColumn: '1 / -1',
            order: 2,
          }}
        >
          <SectionTitle
            icon={OrderDetailIcons.Settings2}
            title="Corregir datos de la orden"
            subtitle="Define el alcance antes de guardar; ningún cambio se aplica automáticamente."
          />

          <form onSubmit={submit} style={{ display: 'grid', gap: 16 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 10,
                padding: 12,
                border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
                borderRadius: 16,
                background: ORDER_DETAIL_THEME.primarySoftBg,
              }}
            >
              <button
                type="button"
                onClick={() => setSyncCustomer(false)}
                style={{
                  ...fieldStyle,
                  cursor: 'pointer',
                  borderColor: !syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardBorder,
                  color: !syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardText,
                }}
              >
                Solo esta orden
              </button>
              <button
                type="button"
                disabled={demoOrder}
                onClick={() => setSyncCustomer(true)}
                style={{
                  ...fieldStyle,
                  cursor: demoOrder ? 'not-allowed' : 'pointer',
                  opacity: demoOrder ? 0.5 : 1,
                  borderColor: syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardBorder,
                  color: syncCustomer
                    ? ORDER_DETAIL_THEME.primary
                    : ORDER_DETAIL_THEME.cardText,
                }}
              >
                Esta orden y ficha del cliente
              </button>
              {!demoOrder && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    color: ORDER_DETAIL_THEME.mutedText,
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.45,
                  }}
                >
                  {syncCustomer
                    ? 'Los datos de contacto también quedarán disponibles en el módulo Clientes.'
                    : 'La ficha maestra del cliente no será modificada.'}
                </div>
              )}
            </div>

            <div className="order-customer-edit-grid">
              <div style={{ display: 'grid', gap: 12 }}>
                <strong style={{ fontSize: 12 }}>Contacto del comprador</strong>
                <div className="order-customer-edit-fields">
                  <EditField label="Nombre" value={form.customer.name} onChange={(value) => setPartyField('customer', 'name', value)} />
                  <EditField label="Apellido" value={form.customer.lastname} onChange={(value) => setPartyField('customer', 'lastname', value)} />
                  <EditField label="Tipo documento" value={form.customer.documentType} onChange={(value) => setPartyField('customer', 'documentType', value)} />
                  <EditField label="Documento" value={form.customer.id} onChange={(value) => setPartyField('customer', 'id', value)} />
                  <EditField label="Correo" type="email" value={form.customer.email} onChange={(value) => setPartyField('customer', 'email', value)} />
                  <EditField label="Celular" type="tel" value={form.customer.phone} onChange={(value) => setPartyField('customer', 'phone', value)} />
                  <EditField label="Dirección" value={form.customer.address} onChange={(value) => setPartyField('customer', 'address', value)} />
                  <EditField label="Ciudad" value={form.customer.city} onChange={(value) => setPartyField('customer', 'city', value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <strong style={{ fontSize: 12 }}>Datos de facturación</strong>
                <div className="order-customer-edit-fields">
                  <EditField label="Tipo persona" value={form.billing.personType} onChange={(value) => setPartyField('billing', 'personType', value)} />
                  <EditField label="Razón social" value={form.billing.businessName} onChange={(value) => setPartyField('billing', 'businessName', value)} />
                  <EditField label="Tipo documento" value={form.billing.documentType} onChange={(value) => setPartyField('billing', 'documentType', value)} />
                  <EditField label="Documento fiscal" value={form.billing.documentNumber} onChange={(value) => setPartyField('billing', 'documentNumber', value)} />
                  <EditField label="Correo fiscal" type="email" value={form.billing.email} onChange={(value) => setPartyField('billing', 'email', value)} />
                  <EditField label="Teléfono fiscal" type="tel" value={form.billing.phone} onChange={(value) => setPartyField('billing', 'phone', value)} />
                  <EditField label="Dirección fiscal" value={form.billing.address} onChange={(value) => setPartyField('billing', 'address', value)} />
                  <EditField label="Ciudad fiscal" value={form.billing.city} onChange={(value) => setPartyField('billing', 'city', value)} />
                </div>
              </div>
            </div>

            {formError ? (
              <div style={{ color: '#be123c', fontSize: 11, fontWeight: 800 }}>
                {formError}
              </div>
            ) : null}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={saving}
                style={{ ...fieldStyle, width: 'auto', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{
                  ...fieldStyle,
                  width: 'auto',
                  borderColor: ORDER_DETAIL_THEME.primary,
                  background: ORDER_DETAIL_THEME.primary,
                  color: '#fff',
                  cursor: saving ? 'wait' : 'pointer',
                }}
              >
                {saving ? 'Guardando…' : 'Guardar corrección'}
              </button>
            </div>
          </form>
        </OrderDetailPanel>
      ) : null}

      <OrderDetailPanel
        style={{
          padding: 18,
        }}
      >
        <SectionTitle
          icon={OrderDetailIcons.ReceiptText}
          title="Facturación"
          subtitle="Datos usados para documento fiscal"
          action={<SoftBadge variant="neutral">Validación</SoftBadge>}
        />

        <div
          style={{
            display: 'grid',
            gap: 11,
          }}
        >
          <InfoLine
            label={billingPersonType === 'juridica' ? 'Razón social:' : 'Nombre:'}
            value={billingName}
            strong
          />
          <InfoLine label="Tipo de persona:" value={billingPersonLabel} />
          <InfoLine
            label="Documento:"
            value={cleanText(`${billingDocumentType !== '—' ? `${billingDocumentType} ` : ''}${billingDocumentWithDv}`)}
          />
          <InfoLine label="Correo fiscal:" value={cleanText(billingEmail)} />
          <InfoLine label="Dirección:" value={cleanText(billingAddress)} />
          <InfoLine label="Ciudad:" value={cleanText(billingCity)} />
          <InfoLine
            label="Departamento:"
            value={cleanText(billingDepartment)}
          />
          <InfoLine
            label="País:"
            value={cleanText(billingCountry)}
          />
        </div>
      </OrderDetailPanel>

      <style>
        {`
          @media (max-width: 900px) {
            div[style*="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)"] {
              grid-template-columns: 1fr !important;
            }
          }

          .order-customer-edit-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 18px;
          }

          .order-customer-edit-fields {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
          }

          @media (max-width: 720px) {
            .order-customer-edit-grid,
            .order-customer-edit-fields {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
    </div>
  );
}
