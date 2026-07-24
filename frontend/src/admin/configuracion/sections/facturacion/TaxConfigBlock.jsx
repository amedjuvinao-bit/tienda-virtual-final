import React from 'react';
import BillingField from './BillingField';
import {
  billingFieldClass,
  billingFieldStyle,
  billingMessageStyle,
  billingSoftPanelStyle,
} from './billingTheme';

export default function TaxConfigBlock({ value = {}, onChange }) {
  const iva = {
    enabled: value?.iva?.enabled !== false,
    percent: value?.iva?.percent ?? 19,
    code: '01',
    name: 'IVA',
  };

  const updateIva = (field, newValue) => {
    if (typeof onChange !== 'function') return;

    onChange({
      ...value,
      iva: {
        ...iva,
        [field]: newValue,
        code: '01',
        name: 'IVA',
      },
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BillingField label="Aplicar IVA">
        <label
          className="flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2.5"
          style={billingSoftPanelStyle}
        >
          <input
            type="checkbox"
            checked={iva.enabled}
            onChange={(event) => updateIva('enabled', event.target.checked)}
            className="h-4 w-4"
            style={{ accentColor: 'var(--admin-primary)' }}
          />
          <span className="text-sm" style={{ color: 'var(--admin-card-text)' }}>
            Activar IVA en la facturación
          </span>
        </label>
      </BillingField>

      <BillingField label="Porcentaje de IVA">
        <input
          type="number"
          min="0"
          max="100"
          step="0.01"
          value={iva.percent}
          onChange={(event) => updateIva('percent', Number(event.target.value))}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Ej: 19"
        />
      </BillingField>

      <BillingField label="Código DIAN">
        <input
          value="01 - IVA"
          readOnly
          className={billingFieldClass}
          style={billingFieldStyle}
        />
      </BillingField>

      <BillingField label="Nombre del impuesto">
        <input
          value="IVA"
          readOnly
          className={billingFieldClass}
          style={billingFieldStyle}
        />
      </BillingField>

      <div
        className="rounded-xl border px-4 py-3 text-sm leading-6 md:col-span-2"
        style={billingMessageStyle('info')}
      >
        El flujo fiscal actual envía a Factus el código DIAN <strong>01</strong>.
        Otros impuestos no se ofrecen hasta que su cálculo y payload estén
        implementados de extremo a extremo.
      </div>
    </div>
  );
}
