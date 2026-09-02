import React, { useMemo, useState } from 'react';
import { ChevronDown, CircleDollarSign, Plus, Trash2 } from 'lucide-react';
import {
  calculateCheckoutSummary,
  paymentLabel,
  POS_DISCOUNT_APPROVAL_THRESHOLD,
} from './posCheckoutModel';

const moneyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

function money(value) {
  return moneyFormatter.format(Number(value || 0));
}

function fieldStyle(hasError = false) {
  return {
    borderColor: hasError ? '#fca5a5' : 'var(--admin-card-border)',
    color: 'var(--admin-card-text)',
    background: 'var(--admin-card-bg)',
  };
}

function FieldLabel({ children }) {
  return (
    <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-card-muted-text)' }}>
      {children}
    </label>
  );
}

function ReferenceField({ method, value, terminalId, onChange, onTerminalChange, disabled, hasError }) {
  if (!['transfer', 'card', 'other'].includes(method)) return null;

  return (
    <div className={`grid gap-3 ${method === 'card' ? 'sm:grid-cols-2' : ''}`}>
      {method === 'card' ? (
        <div>
          <FieldLabel>Terminal / datáfono</FieldLabel>
          <input
            value={terminalId}
            onChange={(event) => onTerminalChange(event.target.value)}
            disabled={disabled}
            placeholder="Ej. DATAFONO-01"
            className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-60"
            style={fieldStyle(false)}
          />
        </div>
      ) : null}
      <div>
        <FieldLabel>{method === 'card' ? 'Autorización / voucher' : method === 'transfer' ? 'Referencia bancaria' : 'Referencia del pago'}</FieldLabel>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={method === 'card' ? 'Ej. AUTH-48291' : method === 'transfer' ? 'Ej. TRX-209381' : 'Describe el soporte'}
          className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-60"
          style={fieldStyle(hasError)}
        />
      </div>
    </div>
  );
}

function MixedPaymentEditor({ splits, total, onChange, disabled, hasError }) {
  const applied = splits.reduce((sum, split) => sum + Math.max(0, Math.round(Number(split.amount || 0))), 0);
  const difference = total - applied;

  const updateSplit = (id, key, value) => {
    onChange(splits.map((split) => split.id === id ? { ...split, [key]: value } : split));
  };

  const removeSplit = (id) => onChange(splits.filter((split) => split.id !== id));

  const addSplit = () => {
    onChange([
      ...splits,
      {
        id: `split-${Date.now()}-${splits.length}`,
        method: 'transfer',
        amount: '',
        receivedAmount: '',
        reference: '',
      },
    ]);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: hasError ? '#fca5a5' : 'var(--admin-card-border)' }}>
        {splits.map((split, index) => (
          <div key={split.id} className="border-b p-3 last:border-b-0" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_38px]">
              <select
                aria-label={`Medio de pago ${index + 1}`}
                value={split.method}
                onChange={(event) => updateSplit(split.id, 'method', event.target.value)}
                disabled={disabled}
                className="rounded-xl border px-3 py-2 text-sm font-bold outline-none disabled:opacity-60"
                style={fieldStyle(false)}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta / Datáfono</option>
                <option value="other">Otro</option>
              </select>
              <input
                aria-label={`Valor del medio ${index + 1}`}
                type="number"
                min="0"
                step="1"
                value={split.amount}
                onChange={(event) => updateSplit(split.id, 'amount', event.target.value)}
                disabled={disabled}
                placeholder="Valor"
                className="rounded-xl border px-3 py-2 text-right text-sm font-bold outline-none disabled:opacity-60"
                style={fieldStyle(false)}
              />
              <button
                type="button"
                onClick={() => removeSplit(split.id)}
                disabled={disabled || splits.length <= 2}
                aria-label={`Quitar medio ${index + 1}`}
                className="flex h-[38px] w-[38px] items-center justify-center rounded-xl border disabled:cursor-not-allowed disabled:opacity-35"
                style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            {split.method === 'cash' ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <input
                  aria-label={`Efectivo recibido ${index + 1}`}
                  type="number"
                  min="0"
                  step="1"
                  value={split.receivedAmount}
                  onChange={(event) => updateSplit(split.id, 'receivedAmount', event.target.value)}
                  disabled={disabled}
                  placeholder="Efectivo recibido"
                  className="rounded-xl border px-3 py-2 text-sm font-bold outline-none disabled:opacity-60"
                  style={fieldStyle(false)}
                />
                <span className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Cambio: {money(Math.max(0, Number(split.receivedAmount || 0) - Number(split.amount || 0)))}
                </span>
              </div>
            ) : (
              <input
                aria-label={`Referencia del medio ${index + 1}`}
                value={split.reference}
                onChange={(event) => updateSplit(split.id, 'reference', event.target.value)}
                disabled={disabled}
                placeholder={split.method === 'card' ? 'Autorización / voucher' : split.method === 'transfer' ? 'Referencia bancaria' : 'Referencia del soporte'}
                className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-bold outline-none disabled:opacity-60"
                style={fieldStyle(false)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={addSplit} disabled={disabled} className="inline-flex items-center gap-2 text-xs font-black disabled:opacity-50" style={{ color: 'var(--admin-primary)' }}>
          <Plus className="h-4 w-4" />
          Agregar otro medio
        </button>
        <div className="text-right text-xs font-bold" style={{ color: difference === 0 ? '#047857' : 'var(--admin-card-muted-text)' }}>
          <span>Distribuido {money(applied)}</span>
          <span className="ml-3">{difference === 0 ? 'Completo' : difference > 0 ? `Falta ${money(difference)}` : `Excede ${money(Math.abs(difference))}`}</span>
        </div>
      </div>
    </div>
  );
}

export default function PosCheckoutPanel({
  subtotal,
  paymentMethods = [],
  paymentMethod,
  paymentDetails,
  discount,
  permissions = {},
  validationErrors = {},
  disabled = false,
  onPaymentMethodChange,
  onPaymentDetailsChange,
  onDiscountChange,
}) {
  const [discountOpen, setDiscountOpen] = useState(discount.type !== 'none');
  const summary = useMemo(() => calculateCheckoutSummary(subtotal, discount), [subtotal, discount]);
  const cashReceived = Number(paymentDetails.receivedAmount || 0);
  const change = Math.max(0, cashReceived - summary.total);

  const changeDiscountType = (type) => {
    onDiscountChange(type === 'none' ? { type: 'none', value: '', reason: '' } : { ...discount, type });
  };

  const closeDiscount = () => {
    onDiscountChange({ type: 'none', value: '', reason: '' });
    setDiscountOpen(false);
  };

  return (
    <div className="space-y-4 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-page-bg)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleDollarSign className="h-5 w-5" style={{ color: 'var(--admin-primary)' }} />
          <div>
            <h3 className="text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Preparar cobro</h3>
            <p className="mt-0.5 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Registra cómo se recibe el dinero.</p>
          </div>
        </div>
        <strong className="text-lg" style={{ color: 'var(--admin-primary)' }}>{money(summary.total)}</strong>
      </div>

      <div>
        <FieldLabel>Medio de pago</FieldLabel>
        <select
          value={paymentMethod}
          onChange={(event) => onPaymentMethodChange(event.target.value)}
          disabled={disabled}
          className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-60"
          style={fieldStyle(Boolean(validationErrors.payment))}
        >
          {paymentMethods.map((method) => <option key={method.key} value={method.key}>{method.label}</option>)}
        </select>
      </div>

      {paymentMethod === 'cash' ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <FieldLabel>Efectivo recibido</FieldLabel>
            <input
              type="number"
              min="0"
              step="1"
              value={paymentDetails.receivedAmount}
              onChange={(event) => onPaymentDetailsChange({ ...paymentDetails, receivedAmount: event.target.value })}
              disabled={disabled}
              placeholder="Ingresa el valor entregado"
              className="w-full rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-60"
              style={fieldStyle(Boolean(validationErrors.payment))}
            />
          </div>
          <div className="pb-2 text-right">
            <p className="text-[11px] font-black uppercase tracking-[0.12em]" style={{ color: 'var(--admin-card-muted-text)' }}>Cambio</p>
            <p className="mt-1 text-base font-black" style={{ color: '#047857' }}>{money(change)}</p>
          </div>
        </div>
      ) : null}

      <ReferenceField
        method={paymentMethod}
        value={paymentDetails.reference}
        terminalId={paymentDetails.terminalId}
        disabled={disabled}
        hasError={Boolean(validationErrors.payment)}
        onChange={(reference) => onPaymentDetailsChange({ ...paymentDetails, reference })}
        onTerminalChange={(terminalId) => onPaymentDetailsChange({ ...paymentDetails, terminalId })}
      />

      {paymentMethod === 'mixed' ? (
        <MixedPaymentEditor
          splits={paymentDetails.splitPayments}
          total={summary.total}
          disabled={disabled}
          hasError={Boolean(validationErrors.payment)}
          onChange={(splitPayments) => onPaymentDetailsChange({ ...paymentDetails, splitPayments })}
        />
      ) : null}

      {validationErrors.payment ? <p className="text-xs font-bold text-red-700">{validationErrors.payment}</p> : null}

      <div className="border-t pt-4" style={{ borderColor: 'var(--admin-card-border)' }}>
        <button
          type="button"
          onClick={() => setDiscountOpen((open) => !open)}
          disabled={disabled || permissions.canDiscount !== true}
          className="flex w-full items-center justify-between gap-3 text-left disabled:cursor-not-allowed disabled:opacity-55"
        >
          <span>
            <span className="block text-sm font-black" style={{ color: 'var(--admin-card-text)' }}>Descuento comercial</span>
            <span className="mt-0.5 block text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
              {permissions.canDiscount === true ? (summary.discount > 0 ? `${money(summary.discount)} aplicado` : 'Opcional, con motivo y autorización') : 'No habilitado para tu perfil'}
            </span>
          </span>
          <ChevronDown className={`h-4 w-4 transition-transform ${discountOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--admin-card-muted-text)' }} />
        </button>

        {discountOpen && permissions.canDiscount === true ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
              <select
                value={discount.type}
                onChange={(event) => changeDiscountType(event.target.value)}
                disabled={disabled}
                className="rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-60"
                style={fieldStyle(Boolean(validationErrors.discount))}
              >
                <option value="none">Sin descuento</option>
                <option value="percent">Porcentaje</option>
                <option value="amount">Valor fijo</option>
              </select>
              <input
                type="number"
                min="0"
                max={discount.type === 'percent' ? 100 : undefined}
                step="1"
                value={discount.value}
                onChange={(event) => onDiscountChange({ ...discount, value: event.target.value })}
                disabled={disabled || discount.type === 'none'}
                placeholder={discount.type === 'percent' ? 'Porcentaje (%)' : 'Valor del descuento'}
                className="rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-50"
                style={fieldStyle(Boolean(validationErrors.discount))}
              />
            </div>
            <textarea
              value={discount.reason}
              onChange={(event) => onDiscountChange({ ...discount, reason: event.target.value })}
              disabled={disabled || discount.type === 'none'}
              rows="2"
              maxLength="240"
              placeholder="Motivo comercial obligatorio"
              className="w-full resize-none rounded-xl border px-3 py-2.5 text-sm font-bold outline-none disabled:opacity-50"
              style={fieldStyle(Boolean(validationErrors.discount))}
            />
            <div className="flex items-start justify-between gap-3">
              <p className="text-[11px] font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>
                Más del {POS_DISCOUNT_APPROVAL_THRESHOLD}% exige permiso de aprobación.
              </p>
              <button type="button" onClick={closeDiscount} disabled={disabled} className="shrink-0 text-xs font-black" style={{ color: 'var(--admin-primary)' }}>Quitar</button>
            </div>
          </div>
        ) : null}

        {validationErrors.discount ? <p className="mt-3 text-xs font-bold text-red-700">{validationErrors.discount}</p> : null}
      </div>
    </div>
  );
}
