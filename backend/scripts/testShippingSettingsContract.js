'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.INTEGRATIONS_ENCRYPTION_KEY =
  process.env.INTEGRATIONS_ENCRYPTION_KEY ||
  'shipping-settings-contract-key-32-characters';
process.env.BACKEND_URL =
  process.env.BACKEND_URL || 'https://shipping-settings.test';

const {
  decryptShippingSecret,
  encryptShippingSecret,
  encryptionConfigured,
  isEncryptedShippingSecret,
  secretHint,
} = require('../lib/shipping/shippingConfigurationSecurity');
const {
  findAdminRoutePermission,
} = require('../security/adminRoutePermissionMap');
const {
  findRecentSandboxReturnShipment,
  markShippingWebhookVerified,
  permanentPublicHttpsUrl,
  readiness,
  requestShippingWebhookProof,
} = require('../services/shippingConfigurationService');
const {
  resolveShippingProvider,
} = require('../services/shippingProviderService');

const projectRoot = path.join(__dirname, '..', '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

async function main() {
  const token = 'envia-token-super-secreto-1234';
  const encrypted = encryptShippingSecret(token);
  assert.strictEqual(encryptionConfigured(), true);
  assert.strictEqual(isEncryptedShippingSecret(encrypted), true);
  assert.strictEqual(encrypted.includes(token), false);
  assert.strictEqual(decryptShippingSecret(encrypted), token);
  assert.notStrictEqual(encryptShippingSecret(token), encrypted);
  const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
  assert.throws(
    () => decryptShippingSecret(tampered),
    (error) => error.code === 'SHIPPING_SECRET_DECRYPTION_FAILED'
  );
  assert.strictEqual(secretHint(token), '••••1234');
  ok('las credenciales usan AES-256-GCM aleatorio, detectan alteraciones y solo exponen pista');

  const model = read('backend/models/ShippingSettings.js');
  assert.match(model, /enviaTokenEncrypted[\s\S]*?select:\s*false/);
  assert.match(model, /sandboxWebhookTokenEncrypted[\s\S]*?select:\s*false/);
  assert.match(model, /webhookSecretEncrypted[\s\S]*?select:\s*false/);
  assert.match(model, /webhookVerifiedAt/);
  assert.match(model, /webhookVerificationEventId/);
  assert.match(model, /delete settings\.enviaTokenEncrypted/);
  assert.match(model, /delete settings\.sandboxWebhookTokenEncrypted/);
  assert.match(model, /delete settings\.webhookSecretEncrypted/);
  assert.match(model, /SHIPPING_SETTINGS_KEY = 'main'/);
  ok('el modelo es singleton y excluye secretos de consultas y respuestas');

  const expectedRoutes = [
    ['GET', '/api/admin/shipping-settings'],
    ['PUT', '/api/admin/shipping-settings'],
    ['POST', '/api/admin/shipping-settings/test'],
    ['POST', '/api/admin/shipping-settings/webhook/confirm'],
    ['POST', '/api/admin/shipping-settings/webhook/test'],
    ['POST', '/api/admin/shipping-settings/activate'],
    ['POST', '/api/admin/shipping-settings/disable'],
  ];
  expectedRoutes.forEach(([method, route]) => {
    const entry = findAdminRoutePermission(method, route);
    assert(entry, `${method} ${route} debe estar en el mapa administrativo`);
    assert.strictEqual(entry.permission, 'settings:shipping');
  });
  const routeSource = read('backend/routes/adminShippingSettings.js');
  assert.match(routeSource, /requireAdmin/);
  assert.match(routeSource, /requirePermission\('settings:shipping'\)/);
  ok('las siete operaciones administrativas exigen sesión y permiso de envíos');

  const webhookRouteSource = read('backend/routes/shippingWebhookRoutes.js');
  assert.match(webhookRouteSource, /router\.get\('\/'[\s\S]*?ready: true/);
  assert.match(
    webhookRouteSource,
    /if \(!hasSignedHeaders && temporarySandboxTunnel\) \{[\s\S]*?res\.status\(200\)\.json\(\{ received: true \}\)[\s\S]*?setImmediate/
  );
  assert.match(webhookRouteSource, /verified\.sandboxTest === true/);
  assert.match(webhookRouteSource, /res\.status\(200\)\.json\(\{ received: true \}\)/);
  assert.match(webhookRouteSource, /setImmediate\(\(\) => \{[\s\S]*?persistVerifiedEvent/);
  assert.match(webhookRouteSource, /Solicitud aceptada/);
  assert.match(webhookRouteSource, /Solicitud rechazada/);
  assert.match(webhookRouteSource, /markShippingWebhookVerified\(verified\)/);
  const backendEntry = read('backend/index.js');
  assert.match(backendEntry, /express\.raw\(\{ type: '\*\/\*', limit: '256kb' \}\)/);
  assert.match(
    backendEntry,
    /app\.set\('trust proxy', \['loopback', 'linklocal', 'uniquelocal'\]\)/
  );
  const providerSource = read('backend/services/enviaShippingProvider.js');
  assert.match(providerSource, /data\?\.carrierName/);
  assert.match(providerSource, /payload\?\.carrierName/);
  assert.match(providerSource, /replace\(\/\^Bearer\\s\+\/i, ''\)/);
  assert.match(webhookRouteSource, /apiToken: runtime\.envia\.token/);
  assert.match(
    webhookRouteSource,
    /runtime\.envia\.mode === 'sandbox'[\s\S]*?runtime\.envia\.sandboxWebhookToken \|\| runtime\.envia\.webhookSecret/
  );
  assert.match(webhookRouteSource, /endsWith\('\.trycloudflare\.com'\)/);
  assert.doesNotMatch(webhookRouteSource, /allowLegacySandboxProbe/);
  assert.doesNotMatch(providerSource, /allowLegacySandboxProbe/);
  ok('GET responde rápido, ningún túnel aprueba sin autenticación y Sandbox admite firma vigente');

  const service = read('backend/services/shippingConfigurationService.js');
  assert.match(service, /SHIPPING_PRODUCTION_CONFIRMATION_REQUIRED/);
  assert.match(service, /canActivateProduction/);
  assert.match(service, /webhookRegistered/);
  assert.match(service, /webhookVerified/);
  assert.match(service, /permanentPublicHttpsUrl/);
  assert.match(service, /publicHttpsUrl/);
  assert.match(service, /resetVerification/);
  assert.strictEqual(
    permanentPublicHttpsUrl('https://api.tienda.test/api/shipping/webhooks/envia'),
    true
  );
  assert.strictEqual(
    permanentPublicHttpsUrl('https://temporal.trycloudflare.com/api/shipping/webhooks/envia'),
    false
  );
  ok('producción exige prueba vigente, HTTPS permanente y webhook comprobado por Envia');

  const verifiedSettings = {
    credentialRevision: 3,
    lastTestCredentialRevision: 3,
    lastTestStatus: 'success',
    lastTestMode: 'sandbox',
  };
  const sandboxReadiness = readiness(verifiedSettings, {
    envia: {
      mode: 'sandbox',
      token: 'sandbox-token',
      sandboxWebhookToken: '',
      webhookSecret: '',
    },
  });
  assert.strictEqual(sandboxReadiness.canConfirmWebhook, false);
  const sandboxWithWebhookToken = readiness(verifiedSettings, {
    envia: {
      mode: 'sandbox',
      token: 'sandbox-token',
      sandboxWebhookToken: 'sandbox-webhook-token',
      webhookSecret: '',
    },
  });
  assert.strictEqual(sandboxWithWebhookToken.canConfirmWebhook, true);

  const proofSettings = {
    managedFromPanel: true,
    defaultProvider: 'manual',
    enviaMode: 'sandbox',
    enviaTokenEncrypted: encryptShippingSecret('sandbox-api-token'),
    sandboxWebhookTokenEncrypted: encryptShippingSecret('sandbox-webhook-token'),
    credentialRevision: 1,
    lastTestStatus: 'success',
    lastTestMode: 'sandbox',
    lastTestCredentialRevision: 1,
    providerWebhookId: 'dashboard-confirmed',
    providerWebhookMode: 'sandbox',
    providerWebhookUrl: 'https://shipping-settings.test/api/shipping/webhooks/envia',
    webhookRegisteredAt: new Date(),
    async save() {
      return this;
    },
    toSafeObject() {
      return {
        defaultProvider: this.defaultProvider,
        enviaMode: this.enviaMode,
        hasEnviaToken: true,
        hasSandboxWebhookToken: true,
      };
    },
  };
  let proofRequest = null;
  const queriedPeriods = [];
  await requestShippingWebhookProof(
    {},
    '64b000000000000000000001',
    {
      SettingsModel: { getSingleton: async () => proofSettings },
      provider: {
        async listShipmentsByMonth(period) {
          queriedPeriods.push(period);
          return [{
            tracking_number: 'ACCOUNT-TRACK-2026-001',
            carrier: 'FedEx',
            created_at: '2026-08-27T15:00:00.000Z',
          }];
        },
        async testWebhook(input) {
          proofRequest = input;
          return { success: true };
        },
      },
      now: new Date('2026-08-28T12:00:00.000Z'),
    }
  );
  assert.deepStrictEqual(queriedPeriods, [{ month: '08', year: '2026' }]);
  assert.deepStrictEqual(proofRequest, {
    carrier: 'fedex',
    trackingNumber: 'ACCOUNT-TRACK-2026-001',
    status: 'Shipped',
  });
  ok('el panel usa una guía real de la cuenta y el contrato oficial carrier/trackingNumber/status');

  let returnLookupFilter = null;
  let returnLookupSort = null;
  const returnShipment = await findRecentSandboxReturnShipment({
    OrderReturnModel: {
      findOne(filter) {
        returnLookupFilter = filter;
        return {
          sort(value) {
            returnLookupSort = value;
            return this;
          },
          select() {
            return this;
          },
          async lean() {
            return {
              updatedAt: new Date('2026-08-29T20:00:00.000Z'),
              shipping: {
                carrierName: 'Coordinadora',
                trackingNumber: 'COORSBX725217',
                integration: {
                  pickup: {
                    requestedAt: new Date('2026-08-29T19:00:00.000Z'),
                  },
                },
              },
            };
          },
        };
      },
    },
  });
  assert.deepStrictEqual(returnLookupFilter.status, {
    $in: ['authorized', 'in_transit'],
  });
  assert.strictEqual(
    returnLookupFilter['shipping.integration.pickup.status'],
    'scheduled'
  );
  assert.deepStrictEqual(returnLookupSort, {
    'shipping.integration.pickup.requestedAt': -1,
    updatedAt: -1,
  });
  assert.deepStrictEqual(returnShipment, {
    carrier: 'coordinadora',
    trackingNumber: 'COORSBX725217',
    createdAt: new Date('2026-08-29T19:00:00.000Z').getTime(),
    webhookTestStatus: 'Picked Up',
    source: 'order_return',
  });
  ok('el respaldo consulta únicamente una devolución Envia Sandbox con recolección programada');

  proofRequest = null;
  await requestShippingWebhookProof(
    {},
    '64b000000000000000000001',
    {
      SettingsModel: { getSingleton: async () => proofSettings },
      provider: {
        async listShipmentsByMonth() {
          return [];
        },
        async testWebhook(input) {
          proofRequest = input;
          return { success: true };
        },
      },
      findReturnShipment: async () => ({
        carrier: 'coordinadora',
        trackingNumber: 'COORSBX725217',
        webhookTestStatus: 'Picked Up',
        source: 'order_return',
      }),
      now: new Date('2026-08-28T12:00:00.000Z'),
    }
  );
  assert.deepStrictEqual(proofRequest, {
    carrier: 'coordinadora',
    trackingNumber: 'COORSBX725217',
    status: 'Picked Up',
  });
  ok('si Envia omite la guía inversa del historial, el panel usa la devolución Sandbox programada');

  await assert.rejects(
    () => requestShippingWebhookProof(
      {},
      '64b000000000000000000001',
      {
        SettingsModel: { getSingleton: async () => proofSettings },
        provider: {
          async listShipmentsByMonth() {
            return [];
          },
          async testWebhook() {
            throw new Error('No debe solicitar la prueba sin una guía de la cuenta');
          },
        },
        findReturnShipment: async () => null,
        now: new Date('2026-08-28T12:00:00.000Z'),
      }
    ),
    (error) => error.code === 'SHIPPING_WEBHOOK_TEST_SHIPMENT_REQUIRED'
  );
  ok('sin una guía de la cuenta la prueba falla cerrada y no usa números de ejemplo');

  const productionSettings = {
    ...verifiedSettings,
    lastTestMode: 'production',
  };
  const productionWithoutSecret = readiness(productionSettings, {
    envia: { mode: 'production', token: 'production-token', webhookSecret: '' },
  });
  assert.strictEqual(productionWithoutSecret.canConfirmWebhook, false);
  const productionWithSecret = readiness(productionSettings, {
    envia: {
      mode: 'production',
      token: 'production-token',
      webhookSecret: 'production-webhook-secret',
    },
  });
  assert.strictEqual(productionWithSecret.canConfirmWebhook, true);
  assert.strictEqual(productionWithSecret.canActivateProduction, false);

  const productionVerified = readiness(
    {
      ...productionSettings,
      providerWebhookId: 'evt-production-proof',
      providerWebhookMode: 'production',
      providerWebhookUrl:
        'https://shipping-settings.test/api/shipping/webhooks/envia',
      webhookRegisteredAt: new Date(),
      webhookVerifiedAt: new Date(),
      webhookVerificationMode: 'production',
      webhookVerificationUrl:
        'https://shipping-settings.test/api/shipping/webhooks/envia',
    },
    {
      envia: {
        mode: 'production',
        token: 'production-token',
        webhookSecret: 'production-webhook-secret',
      },
    }
  );
  assert.strictEqual(productionVerified.webhookVerified, true);
  assert.strictEqual(productionVerified.webhookUrlPermanent, true);
  assert.strictEqual(productionVerified.canActivateProduction, true);
  ok('Sandbox exige su credencial Bearer exclusiva y Producción conserva HMAC obligatorio');

  const storedSettings = {
    managedFromPanel: true,
    enviaMode: 'production',
    providerWebhookId: 'dashboard-confirmed',
    providerWebhookMode: 'production',
    providerWebhookUrl:
      'https://shipping-settings.test/api/shipping/webhooks/envia',
    webhookRegisteredAt: new Date('2026-08-22T12:00:00.000Z'),
    async save() {
      return this;
    },
  };
  const verifiedAt = new Date('2026-08-22T12:05:00.000Z');
  const verification = await markShippingWebhookVerified(
    { eventId: 'evt-real-provider-proof', sandboxTest: false },
    {
      SettingsModel: {
        getSingleton: async () => storedSettings,
      },
      now: verifiedAt,
    }
  );
  assert.strictEqual(verification.verified, true);
  assert.strictEqual(storedSettings.webhookVerifiedAt, verifiedAt);
  assert.strictEqual(
    storedSettings.webhookVerificationEventId,
    'evt-real-provider-proof'
  );
  assert.strictEqual(storedSettings.webhookVerificationMode, 'production');
  ok('un evento auténtico recibido desde Envia deja evidencia durable de la conexión');

  const guardedSettings = {
    managedFromPanel: true,
    defaultProvider: 'envia',
    enviaMode: 'production',
    enviaTokenEncrypted: encryptShippingSecret('production-token'),
    webhookSecretEncrypted: encryptShippingSecret('production-webhook-secret'),
    credentialRevision: 1,
    lastTestStatus: 'success',
    lastTestMode: 'production',
    lastTestCredentialRevision: 1,
    providerWebhookId: 'dashboard-confirmed',
    providerWebhookMode: 'production',
    providerWebhookUrl:
      'https://shipping-settings.test/api/shipping/webhooks/envia',
    webhookRegisteredAt: new Date(),
  };
  const guardedModel = {
    getSingleton: async () => guardedSettings,
  };
  await assert.rejects(
    () => resolveShippingProvider('envia', { SettingsModel: guardedModel }),
    (error) => error.code === 'SHIPPING_PROVIDER_VERIFICATION_REQUIRED'
  );
  guardedSettings.webhookVerifiedAt = new Date();
  guardedSettings.webhookVerificationMode = 'production';
  guardedSettings.webhookVerificationUrl =
    'https://shipping-settings.test/api/shipping/webhooks/envia';
  const guardedProvider = await resolveShippingProvider('envia', {
    SettingsModel: guardedModel,
  });
  assert.strictEqual(guardedProvider.configured, true);
  ok('las operaciones reales permanecen bloqueadas hasta comprobar el webhook');

  const frontend = read(
    'frontend/src/admin/configuracion/sections/envios/ShippingProvidersCard.jsx'
  );
  assert.match(frontend, /type="password"/);
  assert.match(frontend, /autoComplete="new-password"/);
  assert.match(frontend, /Probar conexión/);
  assert.match(frontend, /Abrir portal de Envia/);
  assert.match(frontend, /Ya registré la URL/);
  assert.match(frontend, /Enviar prueba oficial desde Envia/);
  assert.match(frontend, /Prueba recibida desde Envia/);
  assert.match(frontend, /trycloudflare\.com es temporal/);
  assert.match(frontend, /confirmProduction/);
  assert.match(frontend, /¿Qué queda automático\?/);
  assert.match(frontend, /El webhook es el aviso/);
  assert.match(frontend, /Credencial de autorización del webhook Sandbox/);
  assert.doesNotMatch(frontend, /localStorage/);
  ok('el panel protege credenciales y explica la automatización, el webhook y la activación');

  const envExample = read('backend/.env.example');
  assert.match(envExample, /^INTEGRATIONS_ENCRYPTION_KEY=/m);
  assert.doesNotMatch(envExample, /INTEGRATIONS_ENCRYPTION_KEY=.{8,}/);
  ok('la plantilla documenta la llave maestra sin incluir secretos reales');

  console.log(`\n${checks.length} verificaciones de configuración de transportadoras completadas.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
