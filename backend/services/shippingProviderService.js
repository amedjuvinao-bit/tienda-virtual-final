'use strict';

const {
  createEnviaProvider,
  ShippingProviderError,
} = require('./enviaShippingProvider');
const {
  getRuntimeShippingConfiguration,
  publicWebhookUrl,
  readiness,
} = require('./shippingConfigurationService');

async function getShippingProviderStatus(dependencies = {}) {
  const runtime = await getRuntimeShippingConfiguration(dependencies);
  const envia = createEnviaProvider({ config: runtime.envia });
  const state = readiness(runtime.settings, runtime);
  const verifiedForMode =
    envia.mode === 'production'
      ? state.canActivateProduction
      : state.canActivateSandbox;
  const selected = runtime.defaultProvider === 'envia';
  const active = selected && envia.configured && verifiedForMode;
  return {
    defaultProvider: runtime.defaultProvider,
    manual: {
      key: 'manual',
      name: 'Operación manual',
      enabled: true,
      configured: true,
      mode: 'internal',
    },
    envia: {
      key: envia.key,
      name: envia.name,
      enabled: active,
      configured: envia.configured,
      webhookConfigured: envia.webhookConfigured,
      webhookRegistered: state.webhookRegistered,
      webhookVerified: state.webhookVerified,
      webhookUrlReady: state.webhookUrlReady,
      webhookUrlPermanent: state.webhookUrlPermanent,
      webhookUrl: publicWebhookUrl(),
      mode: envia.mode,
      message: active
        ? `Envia ${envia.mode === 'sandbox' ? 'Sandbox' : 'Producción'} activo.`
        : selected && envia.configured && !verifiedForMode
          ? `Envia ${envia.mode === 'sandbox' ? 'Sandbox' : 'Producción'} está seleccionado, pero el webhook todavía no fue comprobado por Envia.`
        : envia.configured
          ? `Envia ${envia.mode === 'sandbox' ? 'Sandbox' : 'Producción'} configurado, pero la operación manual continúa activa.`
        : `Envia ${envia.mode === 'sandbox' ? 'Sandbox' : 'Producción'} pendiente de token; no se realizarán llamadas externas.`,
    },
  };
}

async function resolveShippingProvider(providerKey = 'envia', dependencies = {}) {
  const key = String(providerKey || '').trim().toLowerCase();
  if (key !== 'envia') {
    throw new ShippingProviderError(
      'La transportadora solicitada no está soportada.',
      'SHIPPING_PROVIDER_UNSUPPORTED',
      400,
      { provider: key }
    );
  }
  const runtime = dependencies.provider
    ? null
    : await getRuntimeShippingConfiguration(dependencies);
  const provider = dependencies.provider || createEnviaProvider({
    config: runtime.envia,
    fetchImpl: dependencies.fetchImpl,
  });
  if (!provider.configured) {
    throw new ShippingProviderError(
      `Envia ${provider.mode === 'production' ? 'Producción' : 'Sandbox'} está preparado, pero falta guardar un token desde Configuración → Envíos.`,
      'SHIPPING_PROVIDER_NOT_CONFIGURED',
      409,
      { provider: 'envia', mode: provider.mode }
    );
  }
  if (runtime && runtime.defaultProvider !== 'envia') {
    throw new ShippingProviderError(
      'Envia está configurado, pero todavía no fue probado y activado desde Configuración → Envíos.',
      'SHIPPING_PROVIDER_INACTIVE',
      409,
      { provider: 'envia', mode: provider.mode }
    );
  }
  if (runtime) {
    const state = readiness(runtime.settings, runtime);
    const verifiedForMode =
      provider.mode === 'production'
        ? state.canActivateProduction
        : state.canActivateSandbox;
    if (!verifiedForMode) {
      throw new ShippingProviderError(
        `Envia ${provider.mode === 'production' ? 'Producción' : 'Sandbox'} está seleccionado, pero exige una prueba real del webhook antes de operar.`,
        'SHIPPING_PROVIDER_VERIFICATION_REQUIRED',
        409,
        { provider: 'envia', mode: provider.mode, readiness: state }
      );
    }
  }
  return provider;
}

module.exports = {
  getShippingProviderStatus,
  resolveShippingProvider,
};
