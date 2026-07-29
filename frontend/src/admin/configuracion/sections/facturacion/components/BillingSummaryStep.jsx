import React from 'react';
import BillingProductionReadiness from '../BillingProductionReadiness';
import {
  billingDangerButtonStyle,
  billingMessageStyle,
  billingPanelStyle,
  billingSecondaryButtonStyle,
  billingSoftPanelStyle,
} from '../billingTheme';

export default function BillingSummaryStep({ controller }) {
  const {
    billing,
    billingRevision,
    connectionChanged,
    finalStepResults,
    handleRestoreVersion,
    history,
    historyLoading,
    historyMeta,
    mode,
    providerLabel,
    readiness,
    restoreCandidate,
    saving,
  } = controller;

  return (
    <div
      className="grid gap-3 text-sm"
      style={{ color: 'var(--admin-card-text)' }}
    >
      <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
        <strong className="block">Proveedor:</strong>
        {providerLabel}
      </div>
      <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
        <strong className="block">Tipo de emisión:</strong>
        {mode === 'internal'
          ? 'Solo comprobante interno'
          : mode === 'production'
            ? 'Facturación electrónica en producción'
            : 'Facturación electrónica en pruebas / habilitación'}
      </div>
      <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
        <strong className="block">Ambiente:</strong>
        {mode === 'internal'
          ? 'Interno'
          : mode === 'production'
            ? 'Producción'
            : 'Pruebas / habilitación'}
      </div>
      <div className="rounded-xl border p-4" style={billingSoftPanelStyle}>
        <strong className="block">Resolución:</strong>
        {billing.dianResolution?.resolutionNumber || 'No configurada'}
      </div>
      <BillingProductionReadiness
        readiness={readiness}
        connectionChanged={connectionChanged}
      />
      <div className="rounded-xl border p-4" style={billingPanelStyle}>
        <strong className="block">Validación final del proceso</strong>
        <div className="mt-3 grid gap-2">
          {finalStepResults.map((item) => {
            const valid = item.errors.length === 0;
            return (
              <div
                key={item.id}
                className="rounded-xl border px-3 py-2"
                style={billingMessageStyle(valid ? 'success' : 'warning')}
              >
                <span className="font-semibold">
                  Paso {item.index + 1} · {item.label}:{' '}
                </span>
                {valid ? 'completo' : item.errors.join(' ')}
              </div>
            );
          })}
        </div>
      </div>
      <div className="rounded-xl border p-4" style={billingPanelStyle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="block">Historial protegido</strong>
            <span
              className="text-xs"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Revisión actual {billingRevision}. Se conservan hasta 25 versiones
              cifradas.
            </span>
            {historyMeta.updatedAt ? (
              <span
                className="mt-1 block text-xs"
                style={{ color: 'var(--admin-card-muted-text)' }}
              >
                Último cambio:{' '}
                {new Date(historyMeta.updatedAt).toLocaleString('es-CO')}
                {historyMeta.updatedBy ? ` · ${historyMeta.updatedBy}` : ''}
              </span>
            ) : null}
          </div>
          {historyLoading ? (
            <span
              className="text-xs"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              Cargando...
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2">
          {history.slice(0, 5).map((version) => (
            <div
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              style={billingSoftPanelStyle}
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  Revisión {version.revision} · {version.mode}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  {version.changedBy || 'sistema'}
                  {version.changedAt
                    ? ` · ${new Date(version.changedAt).toLocaleString('es-CO')}`
                    : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRestoreVersion(version)}
                disabled={saving}
                className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
                style={
                  restoreCandidate === version.id
                    ? billingDangerButtonStyle
                    : billingSecondaryButtonStyle
                }
              >
                {restoreCandidate === version.id
                  ? 'Confirmar restauración'
                  : 'Restaurar'}
              </button>
            </div>
          ))}
          {!historyLoading && history.length === 0 ? (
            <p
              className="text-xs"
              style={{ color: 'var(--admin-card-muted-text)' }}
            >
              El historial aparecerá después del primer cambio guardado.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
