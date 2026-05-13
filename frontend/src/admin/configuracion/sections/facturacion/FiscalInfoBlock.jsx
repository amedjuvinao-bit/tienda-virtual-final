import React from 'react';
import BillingField from './BillingField';

export default function FiscalInfoBlock({ value = {}, onChange }) {
  const updateField = (field, newValue) => {
    if (typeof onChange !== 'function') return;

    onChange({
      ...value,
      [field]: newValue,
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BillingField label="NIT / identificación tributaria">
        <input
          value={value.nit || ''}
          onChange={(e) => updateField('nit', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: 900123456-7"
        />
      </BillingField>

      <BillingField label="Régimen tributario">
        <input
          value={value.taxRegime || ''}
          onChange={(e) => updateField('taxRegime', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: Responsable de IVA"
        />
      </BillingField>

      <BillingField label="Representante legal">
        <input
          value={value.legalRepresentative || ''}
          onChange={(e) => updateField('legalRepresentative', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Nombre del representante"
        />
      </BillingField>

      <BillingField label="Correo de facturación">
        <input
          type="email"
          value={value.billingEmail || ''}
          onChange={(e) => updateField('billingEmail', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="facturacion@mitienda.com"
        />
      </BillingField>
    </div>
  );
}