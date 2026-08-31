import { InvoiceInfo } from './InvoiceSummaryPresentation';

const PANEL_STYLE = {
  background: 'var(--admin-card-bg)',
  borderColor: 'var(--admin-card-border)',
  color: 'var(--admin-card-text)',
  boxShadow: 'var(--admin-card-shadow, 0 18px 40px rgba(15, 23, 42, 0.06))',
};

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
        style={{ color: 'var(--admin-card-muted-text)' }}
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

function InvoiceCustomerBillingEditor({ form, onChange }) {
  const field = (label, name) => (
    <EditField
      key={name}
      label={label}
      value={form[name]}
      onChange={(value) => onChange(name, value)}
    />
  );

  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {field('Nombre', 'name')}
      {field('Apellido', 'lastname')}
      {field('Documento / NIT', 'id')}
      <EditField
        label="Correo"
        value={form.email || form.emailOrPhone}
        onChange={(value) => {
          onChange('email', value);
          onChange('emailOrPhone', value);
        }}
      />
      {field('Teléfono', 'phone')}
      {field('Dirección', 'address')}
      {field('Ciudad', 'city')}
      {field('Departamento', 'department')}
      {field('País', 'country')}
    </div>
  );
}

function InvoiceCustomerBillingReadOnly({ form }) {
  return (
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      <InvoiceInfo label="Cliente" value={`${form.name || ''} ${form.lastname || ''}`} />
      <InvoiceInfo label="Documento" value={form.id} />
      <InvoiceInfo label="Correo" value={form.email || form.emailOrPhone} />
      <InvoiceInfo label="Teléfono" value={form.phone} />
      <InvoiceInfo label="Dirección" value={form.address} />
      <InvoiceInfo label="Ciudad" value={form.city} />
      <InvoiceInfo label="Departamento" value={form.department} />
      <InvoiceInfo label="País" value={form.country} />
    </div>
  );
}

function Feedback({ children, tone }) {
  const isError = tone === 'error';
  return (
    <div
      className="mt-4 rounded-xl border px-4 py-3 text-sm font-semibold"
      style={isError
        ? {
            background: 'var(--admin-danger-soft-bg, rgba(239, 68, 68, 0.12))',
            borderColor: 'var(--admin-danger-border, rgba(239, 68, 68, 0.25))',
            color: 'var(--admin-danger-text, #dc2626)',
          }
        : {
            background: 'var(--admin-success-soft-bg, rgba(34, 197, 94, 0.12))',
            borderColor: 'var(--admin-success-border, rgba(34, 197, 94, 0.25))',
            color: 'var(--admin-success-text, #16a34a)',
          }}
    >
      {children}
    </div>
  );
}

export default function InvoiceCustomerBillingSection({ controller }) {
  const {
    cancelEditing, changeField, editing, error, form,
    message, save, saving, startEditing,
  } = controller;

  return (
    <section className="rounded-3xl border p-5" style={PANEL_STYLE}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold" style={{ color: 'var(--admin-card-text)' }}>
          Información del cliente / facturación
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {editing && (
            <button
              type="button"
              onClick={cancelEditing}
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
          <button
            type="button"
            onClick={editing ? save : startEditing}
            disabled={saving}
            className="rounded-xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={editing
              ? {
                  background: 'var(--admin-button-bg)',
                  color: 'var(--admin-button-text)',
                  borderColor: 'var(--admin-button-bg)',
                }
              : {
                  background: 'var(--admin-button-soft-bg)',
                  color: 'var(--admin-button-soft-text)',
                  borderColor: 'var(--admin-button-soft-border)',
                }}
          >
            {editing ? (saving ? 'Guardando...' : 'Guardar cambios') : 'Corregir datos'}
          </button>
        </div>
      </div>
      {message && <Feedback tone="success">{message}</Feedback>}
      {error && <Feedback tone="error">{error}</Feedback>}
      {editing ? (
        <InvoiceCustomerBillingEditor form={form} onChange={changeField} />
      ) : (
        <InvoiceCustomerBillingReadOnly form={form} />
      )}
    </section>
  );
}
