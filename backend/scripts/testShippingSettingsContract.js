'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

process.env.INTEGRATIONS_ENCRYPTION_KEY =
  process.env.INTEGRATIONS_ENCRYPTION_KEY ||
  'shipping-settings-contract-key-32-characters';

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

const projectRoot = path.join(__dirname, '..', '..');
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const checks = [];
function ok(message) {
  checks.push(message);
  console.log(`OK  ${message}`);
}

function main() {
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
  assert.match(model, /webhookSecretEncrypted[\s\S]*?select:\s*false/);
  assert.match(model, /delete settings\.enviaTokenEncrypted/);
  assert.match(model, /delete settings\.webhookSecretEncrypted/);
  assert.match(model, /SHIPPING_SETTINGS_KEY = 'main'/);
  ok('el modelo es singleton y excluye secretos de consultas y respuestas');

  const expectedRoutes = [
    ['GET', '/api/admin/shipping-settings'],
    ['PUT', '/api/admin/shipping-settings'],
    ['POST', '/api/admin/shipping-settings/test'],
    ['POST', '/api/admin/shipping-settings/webhook/register'],
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
  ok('las seis operaciones administrativas exigen sesión y permiso de envíos');

  const service = read('backend/services/shippingConfigurationService.js');
  assert.match(service, /SHIPPING_PRODUCTION_CONFIRMATION_REQUIRED/);
  assert.match(service, /canActivateProduction/);
  assert.match(service, /webhookRegistered/);
  assert.match(service, /publicHttpsUrl/);
  assert.match(service, /resetVerification/);
  ok('producción exige confirmación, prueba vigente, HTTPS y webhook registrado');

  const frontend = read(
    'frontend/src/admin/configuracion/sections/envios/ShippingProvidersCard.jsx'
  );
  assert.match(frontend, /type="password"/);
  assert.match(frontend, /autoComplete="new-password"/);
  assert.match(frontend, /Probar conexión/);
  assert.match(frontend, /Registrar webhook/);
  assert.match(frontend, /confirmProduction/);
  assert.doesNotMatch(frontend, /localStorage/);
  ok('el panel trata credenciales como escritura única y separa prueba, webhook y activación');

  const envExample = read('backend/.env.example');
  assert.match(envExample, /^INTEGRATIONS_ENCRYPTION_KEY=/m);
  assert.doesNotMatch(envExample, /INTEGRATIONS_ENCRYPTION_KEY=.{8,}/);
  ok('la plantilla documenta la llave maestra sin incluir secretos reales');

  console.log(`\n${checks.length} verificaciones de configuración de transportadoras completadas.`);
}

main();
