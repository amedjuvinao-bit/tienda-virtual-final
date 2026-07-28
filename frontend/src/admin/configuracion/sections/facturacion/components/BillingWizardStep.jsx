import React from 'react';
import EmptyHint from '../../../components/EmptyHint';
import BillingProductionReadiness from '../BillingProductionReadiness';
import DianResolutionBlock from '../DianResolutionBlock';
import ElectronicProviderBlock from '../ElectronicProviderBlock';
import FiscalInfoBlock from '../FiscalInfoBlock';
import LegalTextsBlock from '../LegalTextsBlock';
import TaxConfigBlock from '../TaxConfigBlock';
import { BILLING_STEPS } from '../billingConfiguration';
import {
  billingFieldStyle,
  billingMessageStyle,
  billingPanelStyle,
  billingSoftPanelStyle,
} from '../billingTheme';
import BillingSummaryStep from './BillingSummaryStep';

export default function BillingWizardStep({ controller }) {
  const {
    billing,
    connectionChanged,
    connectionFeedback,
    credentialStatus,
    currentStep,
    handleClearCredentials,
    handleDianEnabledChange,
    handleDianModeChange,
    handleDianResolutionChange,
    handleFiscalInfoChange,
    handleLegalTextsChange,
    handleNumberingRangesSaved,
    handleProductionActivated,
    handleProviderChange,
    handleTaxesChange,
    handleTestConnection,
    isDianActive,
    mode,
    providerLabel,
    readiness,
    step,
    testingConnection,
  } = controller;

  return (
    <section className="rounded-2xl border p-5" style={billingPanelStyle}>
      <div className="mb-5">
        <p
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--admin-primary)' }}
        >
          Paso {currentStep + 1} de {BILLING_STEPS.length}
        </p>
        <h3
          className="mt-1 text-lg font-semibold"
          style={{ color: 'var(--admin-card-text)' }}
        >
          {step.label}
        </h3>
      </div>

      {step.id === 'fiscal' && (
        <FiscalInfoBlock
          value={billing.fiscalInfo}
          onChange={handleFiscalInfoChange}
        />
      )}

      {step.id === 'provider' && (
        <div className="grid gap-4">
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={billingMessageStyle('info')}
          >
            Factus es el único proveedor externo habilitado. La prueba autentica
            las credenciales y confirma que la empresa vinculada coincida con el
            NIT fiscal configurado.
          </div>
          <ElectronicProviderBlock
            value={billing.electronicProvider}
            credentialStatus={credentialStatus}
            mode={mode}
            testing={testingConnection}
            connectionFeedback={connectionFeedback}
            connectionChanged={connectionChanged}
            onTestConnection={handleTestConnection}
            onClearCredentials={handleClearCredentials}
            onChange={handleProviderChange}
          />
        </div>
      )}

      {step.id === 'control' && (
        <div className="grid gap-4">
          <div
            className="grid gap-4 rounded-2xl border p-4 md:grid-cols-2"
            style={billingSoftPanelStyle}
          >
            <label
              className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
              style={billingPanelStyle}
            >
              <input
                type="checkbox"
                checked={isDianActive}
                onChange={(event) =>
                  handleDianEnabledChange(event.target.checked)
                }
                className="h-4 w-4"
              />
              <span
                className="text-sm"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Activar facturación electrónica
              </span>
            </label>
            <div>
              <label
                className="mb-1 block text-sm font-medium"
                style={{ color: 'var(--admin-card-text)' }}
              >
                Ambiente de emisión
              </label>
              <select
                value={mode}
                onChange={(event) => handleDianModeChange(event.target.value)}
                className="w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2"
                style={billingFieldStyle}
              >
                <option value="internal">Solo comprobante interno</option>
                <option value="habilitacion">Pruebas / habilitación</option>
                <option value="production">Producción</option>
              </select>
            </div>
            <div
              className="rounded-xl border px-4 py-3 text-sm md:col-span-2"
              style={billingMessageStyle('warning')}
            >
              <strong className="mb-1 block">Selección actual:</strong>
              {mode === 'internal'
                ? 'Solo comprobantes internos: no se envía información a Factus.'
                : mode === 'production'
                  ? 'Producción seleccionada. Solo se activará al guardar cuando el backend valide conexión, empresa, rangos, correo y credenciales.'
                  : `Habilitación seleccionada con proveedor: ${providerLabel}.`}
            </div>
          </div>
          <BillingProductionReadiness
            readiness={readiness}
            connectionChanged={connectionChanged}
          />
        </div>
      )}

      {step.id === 'resolution' &&
        (isDianActive ? (
          <DianResolutionBlock
            value={billing.dianResolution}
            billing={billing}
            credentialStatus={credentialStatus}
            onChange={handleDianResolutionChange}
            onSaved={handleNumberingRangesSaved}
            onActivated={handleProductionActivated}
          />
        ) : (
          <EmptyHint
            title="Resolución no requerida en modo interno"
            text="Activa la facturación electrónica en el paso anterior para configurar resolución, ambiente, CUFE, XML y numeración."
          />
        ))}

      {step.id === 'taxes' && (
        <TaxConfigBlock
          value={billing.taxes}
          onChange={handleTaxesChange}
        />
      )}

      {step.id === 'legal' && (
        <LegalTextsBlock
          value={billing.legalTexts}
          onChange={handleLegalTextsChange}
        />
      )}

      {step.id === 'summary' && (
        <BillingSummaryStep controller={controller} />
      )}
    </section>
  );
}
