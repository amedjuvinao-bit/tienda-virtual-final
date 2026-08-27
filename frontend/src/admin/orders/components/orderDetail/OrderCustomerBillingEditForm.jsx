import { DOCUMENT_TYPE_OPTIONS, PERSON_TYPE_OPTIONS } from './orderCustomerBillingModel';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import { OrderDetailIcons } from './OrderDetailIcons';
import { OrderDetailPanel, SectionTitle } from './OrderDetailPrimitives';

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

export default function OrderCustomerBillingEditForm({
  form,
  syncCustomer,
  onSyncCustomerChange,
  demoOrder,
  onPartyFieldChange,
  onBillingPersonTypeChange,
  regions,
  regionsLoading,
  onDepartmentChange,
  customerCities,
  customerCitiesLoading,
  billingCities,
  billingCitiesLoading,
  onMunicipalityChange,
  formError,
  geoError,
  saving,
  onCancel,
  onSubmit,
}) {
  return (
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

      <form onSubmit={onSubmit} style={{ display: 'grid', gap: 16 }}>
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
            onClick={() => onSyncCustomerChange(false)}
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
            onClick={() => onSyncCustomerChange(true)}
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
              <EditField
                label="Nombre"
                value={form.customer.name}
                onChange={(value) => onPartyFieldChange('customer', 'name', value)}
              />
              <EditField
                label="Apellido"
                value={form.customer.lastname}
                onChange={(value) =>
                  onPartyFieldChange('customer', 'lastname', value)
                }
              />
              <EditField label="Tipo documento">
                <select
                  aria-label="Tipo documento del comprador"
                  value={form.customer.documentType}
                  onChange={(event) =>
                    onPartyFieldChange(
                      'customer',
                      'documentType',
                      event.target.value
                    )
                  }
                  style={fieldStyle}
                >
                  <option value="">Selecciona tipo de documento</option>
                  {DOCUMENT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField
                label="Documento"
                value={form.customer.id}
                onChange={(value) => onPartyFieldChange('customer', 'id', value)}
              />
              <EditField
                label="Correo"
                type="email"
                value={form.customer.email}
                onChange={(value) =>
                  onPartyFieldChange('customer', 'email', value)
                }
              />
              <EditField
                label="Celular"
                type="tel"
                value={form.customer.phone}
                onChange={(value) =>
                  onPartyFieldChange('customer', 'phone', value)
                }
              />
              <EditField
                label="Dirección"
                value={form.customer.address}
                onChange={(value) =>
                  onPartyFieldChange('customer', 'address', value)
                }
              />
              <EditField label="Departamento del comprador">
                <select
                  aria-label="Departamento del comprador"
                  value={form.customer.departmentCode}
                  onChange={(event) =>
                    onDepartmentChange('customer', event.target.value)
                  }
                  disabled={regionsLoading}
                  style={fieldStyle}
                >
                  <option value="">
                    {regionsLoading
                      ? 'Cargando departamentos…'
                      : 'Selecciona departamento'}
                  </option>
                  {regions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField label="Municipio del comprador">
                <select
                  aria-label="Municipio del comprador"
                  value={form.customer.municipalityCode}
                  onChange={(event) =>
                    onMunicipalityChange('customer', event.target.value)
                  }
                  disabled={
                    !form.customer.departmentCode || customerCitiesLoading
                  }
                  style={fieldStyle}
                >
                  <option value="">
                    {customerCitiesLoading
                      ? 'Cargando municipios…'
                      : 'Selecciona municipio'}
                  </option>
                  {customerCities.map((city) => (
                    <option key={city.code} value={city.code}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </EditField>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            <strong style={{ fontSize: 12 }}>Datos de facturación</strong>
            <div className="order-customer-edit-fields">
              <EditField label="Condición del comprador">
                <select
                  aria-label="Condición del comprador"
                  value={form.billing.isFinalConsumer ? 'final' : 'identified'}
                  onChange={(event) =>
                    onPartyFieldChange(
                      'billing',
                      'isFinalConsumer',
                      event.target.value === 'final'
                    )
                  }
                  style={fieldStyle}
                >
                  <option value="identified">Comprador identificado</option>
                  <option value="final">Consumidor final</option>
                </select>
              </EditField>
              <EditField label="Tipo persona">
                <select
                  aria-label="Tipo de persona"
                  value={form.billing.personType}
                  onChange={(event) =>
                    onBillingPersonTypeChange(event.target.value)
                  }
                  style={fieldStyle}
                >
                  <option value="">Selecciona tipo de persona</option>
                  {PERSON_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField
                label="Razón social"
                value={form.billing.businessName}
                onChange={(value) =>
                  onPartyFieldChange('billing', 'businessName', value)
                }
              />
              <EditField label="Tipo documento">
                <select
                  aria-label="Tipo documento fiscal"
                  value={form.billing.documentType}
                  onChange={(event) =>
                    onPartyFieldChange(
                      'billing',
                      'documentType',
                      event.target.value
                    )
                  }
                  style={fieldStyle}
                >
                  <option value="">Selecciona tipo de documento</option>
                  {DOCUMENT_TYPE_OPTIONS.filter(
                    (option) =>
                      form.billing.personType !== 'juridica' ||
                      option.value === 'NIT'
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField
                label="Documento fiscal"
                value={form.billing.documentNumber}
                onChange={(value) =>
                  onPartyFieldChange('billing', 'documentNumber', value)
                }
              />
              <EditField
                label="Correo fiscal"
                type="email"
                value={form.billing.email}
                onChange={(value) =>
                  onPartyFieldChange('billing', 'email', value)
                }
              />
              <EditField
                label="Teléfono fiscal"
                type="tel"
                value={form.billing.phone}
                onChange={(value) =>
                  onPartyFieldChange('billing', 'phone', value)
                }
              />
              <EditField
                label="Dirección fiscal"
                value={form.billing.address}
                onChange={(value) =>
                  onPartyFieldChange('billing', 'address', value)
                }
              />
              <EditField label="Departamento fiscal">
                <select
                  aria-label="Departamento fiscal"
                  value={form.billing.departmentCode}
                  onChange={(event) =>
                    onDepartmentChange('billing', event.target.value)
                  }
                  disabled={regionsLoading}
                  style={fieldStyle}
                >
                  <option value="">
                    {regionsLoading
                      ? 'Cargando departamentos…'
                      : 'Selecciona departamento'}
                  </option>
                  {regions.map((region) => (
                    <option key={region.code} value={region.code}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </EditField>
              <EditField label="Municipio fiscal">
                <select
                  aria-label="Municipio fiscal"
                  value={form.billing.municipalityCode}
                  onChange={(event) =>
                    onMunicipalityChange('billing', event.target.value)
                  }
                  disabled={!form.billing.departmentCode || billingCitiesLoading}
                  style={fieldStyle}
                >
                  <option value="">
                    {billingCitiesLoading
                      ? 'Cargando municipios…'
                      : 'Selecciona municipio'}
                  </option>
                  {billingCities.map((city) => (
                    <option key={city.code} value={city.code}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </EditField>
            </div>
          </div>
        </div>

        {formError ? (
          <div style={{ color: '#be123c', fontSize: 11, fontWeight: 800 }}>
            {formError}
          </div>
        ) : null}

        {geoError ? (
          <div style={{ color: '#be123c', fontSize: 11, fontWeight: 800 }}>
            {geoError}
          </div>
        ) : null}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 9 }}>
          <button
            type="button"
            onClick={onCancel}
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
  );
}
