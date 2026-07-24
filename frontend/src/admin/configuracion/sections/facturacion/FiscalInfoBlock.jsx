import React from 'react';
import BillingField from './BillingField';
import { billingFieldClass, billingFieldStyle } from './billingTheme';

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
      <BillingField label="Razón social">
        <input
          value={value.businessName || ''}
          onChange={(e) => updateField('businessName', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Razón social registrada en el RUT"
        />
      </BillingField>

      <BillingField label="NIT / identificación tributaria">
        <input
          value={value.nit || ''}
          onChange={(e) => updateField('nit', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Ej: 900123456"
        />
      </BillingField>

      <BillingField label="Dígito de verificación">
        <input
          value={value.dv || ''}
          onChange={(e) => updateField('dv', e.target.value)}
          maxLength={1}
          inputMode="numeric"
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Ej: 7"
        />
      </BillingField>

      <BillingField label="Régimen tributario">
        <input
          value={value.taxRegime || ''}
          onChange={(e) => updateField('taxRegime', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Ej: Responsable de IVA"
        />
      </BillingField>

      <BillingField label="Representante legal">
        <input
          value={value.legalRepresentative || ''}
          onChange={(e) => updateField('legalRepresentative', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Nombre del representante"
        />
      </BillingField>

      <BillingField label="Correo de facturación">
        <input
          type="email"
          value={value.billingEmail || ''}
          onChange={(e) => updateField('billingEmail', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="facturacion@mitienda.com"
        />
      </BillingField>

      <BillingField label="Dirección fiscal">
        <input
          value={value.address || ''}
          onChange={(e) => updateField('address', e.target.value)}
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Dirección registrada en el RUT"
        />
      </BillingField>

      <BillingField label="Código DANE del municipio">
        <input
          value={value.municipalityCode || value.cityCode || ''}
          onChange={(e) => {
            updateField('municipalityCode', e.target.value);
          }}
          inputMode="numeric"
          className={billingFieldClass}
          style={billingFieldStyle}
          placeholder="Ej: 47980"
        />
        <span
          className="mt-1 block text-xs"
          style={{ color: 'var(--admin-card-muted-text)' }}
        >
          Se reutiliza automáticamente el código de ciudad guardado anteriormente cuando existe.
        </span>
      </BillingField>
    </div>
  );
}
