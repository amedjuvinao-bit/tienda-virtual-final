import React from 'react';
import FactusNumberingRangesBlock from './FactusNumberingRangesBlock';

export default function DianResolutionBlock({
  value = {},
  billing = {},
  onChange,
  credentialStatus = {},
}) {
  void credentialStatus;

  return (
    <div className="grid gap-4">
      <FactusNumberingRangesBlock
        value={value}
        billing={billing}
        onChange={onChange}
      />

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
        <strong className="block text-gray-900">Ambiente fiscal</strong>
        {value.environment === '1' ? 'Producción' : 'Pruebas / habilitación'}.
        El ambiente se controla únicamente desde el paso Tipo de emisión y los
        rangos seleccionados deben pertenecer exactamente a ese ambiente.
      </div>
    </div>
  );
}
