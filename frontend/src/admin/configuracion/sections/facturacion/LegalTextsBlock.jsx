import React from 'react';
import BillingField from './BillingField';
import { billingFieldClass, billingFieldStyle } from './billingTheme';

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
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Texto legal, observaciones o leyenda tributaria"
        />
      </BillingField>

      <BillingField label="Nota para comprobantes o documentos internos">
        <textarea
          rows={3}
          value={value.internalReceiptNote || ''}
          onChange={(e) => updateField('internalReceiptNote', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Mensaje interno o nota adicional para comprobantes"
        />
      </BillingField>
    </div>
  );
}
