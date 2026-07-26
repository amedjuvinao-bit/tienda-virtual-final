import React from 'react';
import FactusNumberingRangesBlock from './FactusNumberingRangesBlock';
import { billingSoftPanelStyle } from './billingTheme';

export default function DianResolutionBlock({
  value = {},
  billing = {},
  onChange,
  onSaved,
  onActivated,
  credentialStatus = {},
}) {
  void credentialStatus;

  return (
    <div className="grid gap-4">
      <FactusNumberingRangesBlock
        value={value}
        billing={billing}
        onChange={onChange}
        onSaved={onSaved}
        onActivated={onActivated}
      />

      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={billingSoftPanelStyle}
      >
        <strong className="block">Ambiente fiscal</strong>
        {value.environment === '1' ? 'Producción' : 'Pruebas / habilitación'}.
        El ambiente se controla únicamente desde el paso Tipo de emisión y los
        rangos seleccionados deben pertenecer exactamente a ese ambiente.
      </div>
    </div>
  );
}
