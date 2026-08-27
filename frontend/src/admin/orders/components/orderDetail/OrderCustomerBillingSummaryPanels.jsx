import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { OrderDetailIcons } from './OrderDetailIcons';
import {
  InfoLine,
  OrderDetailPanel,
  SectionTitle,
  SoftBadge,
} from './OrderDetailPrimitives';

export function CustomerSummaryPanel({
  customer,
  editing,
  onToggleEditing,
  canEdit,
}) {
  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.User}
        title="Cliente"
        subtitle="Información principal de contacto"
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <SoftBadge variant="primary">Comprador</SoftBadge>
            {canEdit ? (
              <button
                type="button"
                onClick={onToggleEditing}
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

      <div style={{ display: 'grid', gap: 11 }}>
        <InfoLine label="Nombre:" value={customer.name} strong />
        <InfoLine label="Documento:" value={customer.document} />
        <InfoLine label="Correo:" value={customer.email} />
        <InfoLine label="Teléfono:" value={customer.phone} />
        <InfoLine label="Dirección:" value={customer.address} />
        <InfoLine label="Ciudad:" value={customer.city} />
      </div>
    </OrderDetailPanel>
  );
}

export function BillingSummaryPanel({ billing }) {
  return (
    <OrderDetailPanel style={{ padding: 18 }}>
      <SectionTitle
        icon={OrderDetailIcons.ReceiptText}
        title="Facturación"
        subtitle="Datos usados para documento fiscal"
        action={<SoftBadge variant="neutral">Validación</SoftBadge>}
      />

      <div style={{ display: 'grid', gap: 11 }}>
        <InfoLine
          label={billing.personType === 'juridica' ? 'Razón social:' : 'Nombre:'}
          value={billing.name}
          strong
        />
        <InfoLine label="Tipo de persona:" value={billing.personLabel} />
        <InfoLine label="Documento:" value={billing.document} />
        <InfoLine label="Correo fiscal:" value={billing.email} />
        <InfoLine label="Dirección:" value={billing.address} />
        <InfoLine label="Ciudad:" value={billing.city} />
        <InfoLine label="Departamento:" value={billing.department} />
        <InfoLine label="País:" value={billing.country} />
      </div>
    </OrderDetailPanel>
  );
}
