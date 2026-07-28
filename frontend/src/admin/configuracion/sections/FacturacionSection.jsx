// src/admin/configuracion/sections/FacturacionSection.jsx
import React from 'react';
import EmptyHint from '../components/EmptyHint';
import InfoCard from '../components/InfoCard';
import {
  BillingSaveFeedback,
  BillingUnsavedChanges,
} from './facturacion/components/BillingConfigurationFeedback';
import BillingWizardNavigation from './facturacion/components/BillingWizardNavigation';
import BillingWizardProgress from './facturacion/components/BillingWizardProgress';
import BillingWizardStep from './facturacion/components/BillingWizardStep';
import {
  billingMessageStyle,
  billingSecondaryButtonStyle,
} from './facturacion/billingTheme';
import useBillingConfiguration from './facturacion/useBillingConfiguration';

export default function FacturacionSection() {
  const controller = useBillingConfiguration();
  const {
    currentStep,
    hasUnsavedChanges,
    loadError,
    loadSettings,
    loading,
    readiness,
    saveFeedback,
    setCurrentStep,
  } = controller;

  if (loading) {
    return (
      <div
        className="text-sm"
        style={{ color: 'var(--admin-card-muted-text)' }}
      >
        Cargando configuración...
      </div>
    );
  }

  if (loadError) {
    return (
      <InfoCard
        title="No se pudo cargar la configuración"
        description="El formulario permanece bloqueado para evitar sobrescribir datos fiscales con valores vacíos."
      >
        <div className="grid gap-3">
          <div
            className="rounded-xl border px-4 py-3 text-sm"
            style={billingMessageStyle('error')}
          >
            {loadError}
          </div>
          <button
            type="button"
            onClick={loadSettings}
            className="w-fit rounded-xl border px-4 py-2 text-sm font-semibold"
            style={billingSecondaryButtonStyle}
          >
            Reintentar carga
          </button>
        </div>
      </InfoCard>
    );
  }

  return (
    <div className="grid gap-4">
      <InfoCard
        title="Asistente de facturación"
        description="Configura la facturación paso a paso para evitar mezclar datos fiscales, proveedor electrónico, DIAN, impuestos y textos legales."
      >
        <div className="grid gap-6">
          <BillingSaveFeedback feedback={saveFeedback} />
          <BillingWizardProgress
            currentStep={currentStep}
            onStepChange={setCurrentStep}
          />
          <BillingWizardStep controller={controller} />
          <BillingUnsavedChanges visible={hasUnsavedChanges} />
          <BillingWizardNavigation controller={controller} />
        </div>
      </InfoCard>

      <EmptyHint
        title={
          readiness?.readyForProduction
            ? 'Configuración verificada'
            : 'Producción protegida'
        }
        text={
          readiness?.readyForProduction
            ? 'La cuenta, la empresa, los rangos y el correo cumplen los requisitos de producción.'
            : 'La emisión productiva permanece bloqueada hasta completar y verificar todos los requisitos técnicos y fiscales.'
        }
      />
    </div>
  );
}
