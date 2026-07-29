// frontend/src/admin/orders/components/orderDetail/OrderDetailCustomerBilling.jsx

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

export default function OrderDetailCustomerBilling({ order }) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};

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
          action={<SoftBadge variant="primary">Comprador</SoftBadge>}
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
        `}
      </style>
    </div>
  );
}
