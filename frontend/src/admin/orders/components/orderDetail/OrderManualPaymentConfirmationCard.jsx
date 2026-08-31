import { useEffect, useId, useState } from 'react';
import { ORDER_DETAIL_THEME } from './orderDetailTheme';
import {
  canConfirmManualPaymentForOrder,
  MANUAL_PAYMENT_METHODS,
} from './manualPaymentConfirmationModel';

const FIELD_STYLE = {
  width: '100%',
  minHeight: 42,
  border: `1px solid ${ORDER_DETAIL_THEME.inputBorder}`,
  background: ORDER_DETAIL_THEME.cardBg,
  color: ORDER_DETAIL_THEME.inputText,
  borderRadius: 12,
  padding: '9px 11px',
  fontSize: 12,
  fontWeight: 750,
};

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <span id={id} role="alert" style={{ color: ORDER_DETAIL_THEME.danger, fontSize: 11 }}>
      {children}
    </span>
  );
}

export default function OrderManualPaymentConfirmationCard({
  canConfirmManualPayment = false,
  controller,
  order,
}) {
  const prefix = useId();
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState({});
  const { eligible, form, setField, submit, submitting, validation } = controller || {};

  useEffect(() => {
    setAttempted(false);
    setTouched({});
  }, [order?._id]);

  if (
    !canConfirmManualPaymentForOrder(order, canConfirmManualPayment) ||
    !eligible ||
    !form
  ) return null;

  const errorFor = (field) => (
    attempted || touched[field] ? validation?.errors?.[field] : ''
  );
  const touch = (field) => setTouched((current) => ({ ...current, [field]: true }));
  const handleSubmit = async (event) => {
    event.preventDefault();
    setAttempted(true);
    if (!validation?.valid || submitting) return;
    await submit?.();
  };

  return (
    <form
      aria-label="Confirmación manual de pago"
      aria-busy={submitting ? 'true' : 'false'}
      onSubmit={handleSubmit}
      style={{
        marginTop: 16,
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        background: ORDER_DETAIL_THEME.inputBg,
        borderRadius: 20,
        padding: 16,
      }}
    >
      <strong style={{ display: 'block', fontSize: 13, fontWeight: 900 }}>
        Confirmar pago recibido
      </strong>
      <p style={{ margin: '4px 0 14px', color: ORDER_DETAIL_THEME.mutedText, fontSize: 11 }}>
        Solo para pagos verificados fuera de una pasarela. La evidencia quedará auditada.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <label htmlFor={`${prefix}-method`} style={{ fontSize: 11, fontWeight: 850 }}>
          Método
          <select
            id={`${prefix}-method`}
            value={form.method}
            onChange={(event) => setField('method', event.target.value)}
            onBlur={() => touch('method')}
            aria-invalid={Boolean(errorFor('method'))}
            aria-describedby={`${prefix}-method-error`}
            disabled={submitting}
            required
            style={FIELD_STYLE}
          >
            {MANUAL_PAYMENT_METHODS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <FieldError id={`${prefix}-method-error`}>{errorFor('method')}</FieldError>
        </label>

        <label htmlFor={`${prefix}-reference`} style={{ fontSize: 11, fontWeight: 850 }}>
          Referencia del comprobante
          <input
            id={`${prefix}-reference`}
            value={form.reference}
            onChange={(event) => setField('reference', event.target.value)}
            onBlur={() => touch('reference')}
            aria-invalid={Boolean(errorFor('reference'))}
            aria-describedby={`${prefix}-reference-error`}
            autoComplete="off"
            disabled={submitting}
            minLength={4}
            maxLength={160}
            required
            style={FIELD_STYLE}
          />
          <FieldError id={`${prefix}-reference-error`}>{errorFor('reference')}</FieldError>
        </label>

        <label htmlFor={`${prefix}-amount`} style={{ fontSize: 11, fontWeight: 850 }}>
          Monto exacto
          <input
            id={`${prefix}-amount`}
            value={String(form.amount)}
            readOnly
            aria-readonly="true"
            aria-describedby={`${prefix}-amount-help`}
            style={{ ...FIELD_STYLE, cursor: 'not-allowed' }}
          />
          <span id={`${prefix}-amount-help`} style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 10 }}>
            Se toma directamente del pago pendiente de la orden.
          </span>
          <FieldError id={`${prefix}-amount-error`}>{errorFor('amount')}</FieldError>
        </label>

        <label htmlFor={`${prefix}-currency`} style={{ fontSize: 11, fontWeight: 850 }}>
          Moneda
          <input
            id={`${prefix}-currency`}
            value={form.currency}
            readOnly
            aria-readonly="true"
            style={{ ...FIELD_STYLE, cursor: 'not-allowed' }}
          />
          <FieldError id={`${prefix}-currency-error`}>{errorFor('currency')}</FieldError>
        </label>
      </div>

      <label htmlFor={`${prefix}-reason`} style={{ display: 'block', marginTop: 12, fontSize: 11, fontWeight: 850 }}>
        Motivo de la confirmación
        <textarea
          id={`${prefix}-reason`}
          value={form.reason}
          onChange={(event) => setField('reason', event.target.value)}
          onBlur={() => touch('reason')}
          aria-invalid={Boolean(errorFor('reason'))}
          aria-describedby={`${prefix}-reason-error`}
          rows={3}
          disabled={submitting}
          minLength={8}
          maxLength={500}
          required
          style={{ ...FIELD_STYLE, resize: 'vertical' }}
        />
        <FieldError id={`${prefix}-reason-error`}>{errorFor('reason')}</FieldError>
      </label>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12, fontSize: 11, fontWeight: 750 }}>
        <input
          type="checkbox"
          checked={form.verified === true}
          onChange={(event) => setField('verified', event.target.checked)}
          disabled={submitting}
          required
        />
        <span>Confirmo que verifiqué el comprobante, la referencia y el monto recibido.</span>
      </label>
      <FieldError id={`${prefix}-verified-error`}>
        {attempted ? validation?.errors?.verified : ''}
      </FieldError>

      <button
        type="submit"
        disabled={submitting || form.verified !== true}
        style={{
          width: '100%',
          minHeight: 44,
          marginTop: 14,
          border: 'none',
          borderRadius: 14,
          background: ORDER_DETAIL_THEME.primary,
          color: ORDER_DETAIL_THEME.primaryText,
          fontSize: 12,
          fontWeight: 950,
          cursor: submitting || !form.verified ? 'not-allowed' : 'pointer',
          opacity: submitting || !form.verified ? 0.58 : 1,
        }}
      >
        {submitting ? 'Confirmando de forma segura…' : 'Confirmar pago manual'}
      </button>
    </form>
  );
}
