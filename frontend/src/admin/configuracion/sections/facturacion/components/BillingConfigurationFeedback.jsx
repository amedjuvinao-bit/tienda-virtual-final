import React from 'react';
import { billingMessageStyle } from '../billingTheme';

export function BillingSaveFeedback({ feedback }) {
  if (!feedback) return null;

  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={billingMessageStyle(feedback.type)}
    >
      <strong className="block">
        {feedback.type === 'success'
          ? 'Configuración guardada'
          : 'No se guardó la configuración'}
      </strong>
      <p className="mt-1">{feedback.message}</p>
      {feedback.details?.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {feedback.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function BillingUnsavedChanges({ visible }) {
  if (!visible) return null;

  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={billingMessageStyle('warning')}
    >
      Tienes cambios sin guardar.
    </div>
  );
}
