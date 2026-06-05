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

export default function OrderDetailCustomerBilling({ order }) {
  const customer = order?.customer || {};
  const billing = order?.billing || {};

  const customerName = getCustomerName(order);
  const billingName = getBillingName(order);

  const customerDocument =
    customer.document ||
    customer.documentNumber ||
    customer.identification ||
    customer.idNumber ||
    '—';

  const billingDocument =
    billing.document ||
    billing.documentNumber ||
    billing.identification ||
    billing.idNumber ||
    customerDocument ||
    '—';

  const customerAddress =
    customer.address ||
    customer.shippingAddress ||
    customer.addressLine ||
    '—';

  const billingAddress =
    billing.address ||
    billing.billingAddress ||
    billing.addressLine ||
    customerAddress ||
    '—';

  const customerCity =
    customer.city ||
    customer.municipality ||
    customer.town ||
    '—';

  const billingCity =
    billing.city ||
    billing.municipality ||
    billing.town ||
    customerCity ||
    '—';

  const customerEmail =
    customer.email ||
    customer.customerEmail ||
    order?.customerEmail ||
    '—';

  const customerPhone =
    customer.phone ||
    customer.customerPhone ||
    customer.phoneNumber ||
    order?.customerPhone ||
    '—';

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
          <InfoLine label="Nombre:" value={billingName} strong />
          <InfoLine label="Documento:" value={cleanText(billingDocument)} />
          <InfoLine label="Dirección:" value={cleanText(billingAddress)} />
          <InfoLine label="Ciudad:" value={cleanText(billingCity)} />
          <InfoLine
            label="Departamento:"
            value={cleanText(
              billing.department ||
                billing.state ||
                customer.department ||
                customer.state
            )}
          />
          <InfoLine
            label="País:"
            value={cleanText(billing.country || customer.country || 'Colombia')}
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