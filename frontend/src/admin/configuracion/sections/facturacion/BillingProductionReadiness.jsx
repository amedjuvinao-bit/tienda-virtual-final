import React from 'react';
import {
  billingMessageStyle,
  billingSoftPanelStyle,
} from './billingTheme';

function formatDate(value) {
  if (!value) return 'Sin verificar';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin verificar';

  return date.toLocaleString('es-CO');
}

export default function BillingProductionReadiness({
  readiness,
  connectionChanged = false,
}) {
  if (!readiness) {
    return (
      <div
        className="rounded-xl border px-4 py-3 text-sm"
        style={billingSoftPanelStyle}
      >
        El estado de preparación para producción se calculará con la configuración guardada.
      </div>
    );
  }

  const blockers = Array.isArray(readiness.blockers)
    ? readiness.blockers
    : [];
  const ready = readiness.readyForProduction === true && !connectionChanged;
  const connection = readiness.connection || {};
  const company = connection.company || {};

  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={billingMessageStyle(ready ? 'success' : 'warning')}
    >
      <strong className="block">
        {ready
          ? 'Configuración técnica lista para activar producción'
          : 'Producción permanece bloqueada'}
      </strong>

      {connectionChanged ? (
        <p className="mt-1">
          Cambiaste datos fiscales, credenciales o ambiente. Debes probar nuevamente la conexión real con Factus.
        </p>
      ) : null}

      {!ready && blockers.length > 0 ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {blockers.map((blocker) => (
            <li key={blocker}>{blocker}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 grid gap-2 border-t border-current/10 pt-3 md:grid-cols-2">
        <span>
          <strong>Conexión:</strong>{' '}
          {connection.status === 'success' ? 'Verificada' : 'Pendiente'}
        </span>
        <span>
          <strong>Ambiente verificado:</strong>{' '}
          {connection.environment || 'Ninguno'}
        </span>
        <span>
          <strong>Empresa:</strong>{' '}
          {company.name || company.tradeName || 'Sin identificar'}
        </span>
        <span>
          <strong>NIT:</strong>{' '}
          {company.nit
            ? `${company.nit}${company.dv ? `-${company.dv}` : ''}`
            : 'Sin identificar'}
        </span>
        <span className="md:col-span-2">
          <strong>Última verificación:</strong>{' '}
          {formatDate(connection.verifiedAt)}
        </span>
      </div>
    </div>
  );
}
