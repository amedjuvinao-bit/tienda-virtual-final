import React from 'react';
import BillingField from './BillingField';

export default function TaxConfigBlock({ value = {}, onChange }) {
  const TAX_INFO = {
    '01': {
      name: 'IVA',
      description:
        'Impuesto sobre las ventas aplicado a la mayoría de bienes y servicios en Colombia.',
    },
    '04': {
      name: 'INC',
      description:
        'Impuesto nacional al consumo aplicado a ciertos bienes y servicios como restaurantes o telefonía.',
    },
    '03': {
      name: 'ICA',
      description:
        'Impuesto de industria y comercio aplicado a actividades comerciales, industriales o de servicios.',
    },
    ZZ: {
      name: 'Otro',
      description:
        'Impuesto no estándar o no clasificado dentro de los códigos principales DIAN.',
    },
  };

  const iva = value.iva || {
    enabled: true,
    percent: 19,
    code: '01',
    name: 'IVA',
  };

  const currentTax = TAX_INFO[iva.code] || TAX_INFO['01'];

  const updateIva = (field, newValue) => {
    if (typeof onChange !== 'function') return;

    // 🔥 Si cambia el código, actualiza automáticamente el nombre
    if (field === 'code') {
      const taxData = TAX_INFO[newValue] || {};
      onChange({
        ...value,
        iva: {
          ...iva,
          code: newValue,
          name: taxData.name || 'IVA',
        },
      });
      return;
    }

    onChange({
      ...value,
      iva: {
        ...iva,
        [field]: newValue,
      },
    });
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <BillingField label="Aplicar IVA">
        <label className="flex items-center gap-3 rounded-xl border border-gray-300 px-3 py-2.5">
          <input
            type="checkbox"
            checked={iva.enabled !== false}
            onChange={(e) => updateIva('enabled', e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700">
            Activar impuesto en facturación
          </span>
        </label>
      </BillingField>

      <BillingField label="Porcentaje">
        <input
          type="number"
          min="0"
          step="0.01"
          value={iva.percent ?? 19}
          onChange={(e) => updateIva('percent', Number(e.target.value))}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
          placeholder="Ej: 19"
        />
      </BillingField>

      <BillingField label="Código DIAN">
        <select
          value={iva.code || '01'}
          onChange={(e) => updateIva('code', e.target.value)}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-pink-400"
        >
          <option value="01">01 - IVA</option>
          <option value="04">04 - INC</option>
          <option value="03">03 - ICA</option>
          <option value="ZZ">ZZ - Otro / No aplica</option>
        </select>
      </BillingField>

      <BillingField label="Nombre del impuesto">
        <input
          value={currentTax.name}
          readOnly
          className="w-full rounded-xl border border-gray-300 bg-gray-100 px-3 py-2.5 text-gray-500"
        />
      </BillingField>

      {/* 🔥 DESCRIPCIÓN / RESEÑA */}
      <div className="md:col-span-2">
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-gray-700">
          <strong className="block mb-1 text-gray-900">
            Descripción del impuesto:
          </strong>
          {currentTax.description}
        </div>
      </div>
    </div>
  );
}