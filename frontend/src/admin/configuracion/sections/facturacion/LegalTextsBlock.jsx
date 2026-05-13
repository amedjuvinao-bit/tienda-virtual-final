import React from 'react';
import BillingField from './BillingField';

export default function LegalTextsBlock({ value = {}, onChange }) {
  const updateField = (field, newValue) => {
    if (typeof onChange !== 'function') return;

    onChange({
      ...value,
      [field]: newValue,
    });
  };

  return (
    <div className="grid gap-4">
      <BillingField label="Texto legal para factura">
        <textarea
          rows={4}
          value={value.invoiceLegalText || ''}
          onChange={(e) => updateField('invoiceLegalText', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Texto legal, observaciones o leyenda tributaria"
        />
      </BillingField>

      <BillingField label="Nota para comprobantes o documentos internos">
        <textarea
          rows={3}
          value={value.internalReceiptNote || ''}
          onChange={(e) => updateField('internalReceiptNote', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Mensaje interno o nota adicional para comprobantes"
        />
      </BillingField>
    </div>
  );
}