import React from 'react';
import BillingField from './BillingField';

export default function DianResolutionBlock({
  value = {},
  onChange,
  credentialStatus = {},
}) {
  const updateField = (field, newValue) => {
    if (typeof onChange !== 'function') return;

    onChange({
      ...value,
      [field]: newValue,
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BillingField label="Número de resolución DIAN">
        <input
          value={value.resolutionNumber || ''}
          onChange={(e) => updateField('resolutionNumber', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: 18764000000000"
        />
      </BillingField>

      <BillingField label="Prefijo autorizado">
        <input
          value={value.prefix || ''}
          onChange={(e) => updateField('prefix', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: FE"
        />
      </BillingField>

      <BillingField label="Rango inicial">
        <input
          type="number"
          value={value.rangeFrom || ''}
          onChange={(e) => updateField('rangeFrom', Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: 1"
        />
      </BillingField>

      <BillingField label="Rango final">
        <input
          type="number"
          value={value.rangeTo || ''}
          onChange={(e) => updateField('rangeTo', Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: 5000"
        />
      </BillingField>

      <BillingField label="Número actual">
        <input
          type="number"
          value={value.currentNumber || ''}
          onChange={(e) => updateField('currentNumber', Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: 1"
        />
      </BillingField>

      <BillingField label="Fecha de resolución">
        <input
          type="date"
          value={value.resolutionDate || ''}
          onChange={(e) => updateField('resolutionDate', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
      </BillingField>

      <BillingField label="Fecha de vencimiento">
        <input
          type="date"
          value={value.expirationDate || ''}
          onChange={(e) => updateField('expirationDate', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
        />
      </BillingField>

      <BillingField label="Tipo de documento">
        <select
          value={value.documentType || ''}
          onChange={(e) => updateField('documentType', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
        >
          <option value="">Selecciona tipo</option>
          <option value="factura_electronica">Factura electrónica de venta</option>
          <option value="documento_soporte">Documento soporte</option>
          <option value="nota_credito">Nota crédito</option>
          <option value="nota_debito">Nota débito</option>
        </select>
      </BillingField>

      <BillingField label="Clave técnica DIAN">
        <input
          type="password"
          value={value.technicalKey || ''}
          onChange={(e) => updateField('technicalKey', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder={
            credentialStatus['billing.dianResolution.technicalKey']
              ? 'Clave configurada; escribe para reemplazarla'
              : 'Clave técnica entregada por la DIAN'
          }
          autoComplete="new-password"
          spellCheck={false}
        />
        {credentialStatus['billing.dianResolution.technicalKey'] && !value.technicalKey ? (
          <span className="mt-1 block text-xs font-medium text-emerald-600">
            Clave configurada y protegida.
          </span>
        ) : null}
      </BillingField>

      <BillingField label="Ambiente DIAN">
        <input
          value={value.environment === '1' ? 'Producción' : 'Pruebas / habilitación'}
          readOnly
          className="w-full cursor-not-allowed rounded-xl border border-gray-200 bg-gray-100 px-3 py-2.5 text-gray-600"
        />
        <span className="mt-1 block text-xs text-gray-500">
          El ambiente se controla únicamente desde el paso Tipo de emisión.
        </span>
      </BillingField>
    </div>
  );
}
