// backend/scripts/testEnvConfig.js
const { assertEnv, getSafeEnvSummary, EnvConfigError } = require('../config/env');

let okCount = 0;
let warnCount = 0;

function ok(message) {
  okCount += 1;
  console.log(`OK  ${message}`);
}

function info(message) {
  console.log(`INFO ${message}`);
}

function warn(message) {
  warnCount += 1;
  console.warn(`WARN ${message}`);
}

try {
  console.log('\n=== Validacion de entorno Backend ===');
  assertEnv();

  const summary = getSafeEnvSummary();

  ok('Configuracion obligatoria valida');
  ok(`MongoDB configurado desde ${summary.mongo.source}`);
  ok(`Puerto backend: ${summary.port}`);
  info(`Ambiente: ${summary.nodeEnv}`);

  if (!summary.frontendUrlConfigured) {
    warn('FRONTEND_URL no esta configurado. No bloquea el inicio, pero es recomendable para produccion.');
  } else {
    ok('FRONTEND_URL configurado');
  }

  if (!summary.jwtConfigured) {
    warn('JWT_SECRET no esta configurado. Revisa autenticacion si el proyecto lo requiere en produccion.');
  } else {
    ok('JWT_SECRET configurado');
  }

  if (!summary.billingEncryptionConfigured) {
    warn('BILLING_ENCRYPTION_KEY no esta configurado. La facturacion electronica externa permanecera bloqueada hasta definir una llave de al menos 32 caracteres.');
  } else {
    ok('Cifrado de credenciales fiscales configurado');
  }

  if (!summary.cloudinary.backendConfigured) {
    warn('Cloudinary backend no esta completamente configurado. Para subir imagenes desde el backend se requieren CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY y CLOUDINARY_API_SECRET.');
  } else {
    ok(`Cloudinary backend configurado desde ${summary.cloudinary.cloudNameSource}`);
    info(`Cloudinary folder: ${summary.cloudinary.folder} (${summary.cloudinary.folderSource})`);
  }

  if (!summary.cloudinary.uploadPresetConfigured) {
    info('Cloudinary upload preset no configurado en backend. No es obligatorio para subidas firmadas desde backend.');
  } else {
    ok(`Cloudinary upload preset configurado desde ${summary.cloudinary.uploadPresetSource}`);
  }

  if (!summary.smtpConfigured) {
    warn('SMTP no esta completamente configurado por variables de entorno. Si el correo se maneja desde configuracion del panel, este aviso puede ser normal.');
  } else {
    ok('SMTP configurado');
  }

  info(`Reservas inventario: ${summary.inventoryReservation.enabled ? 'activadas' : 'desactivadas'} | intervalo ${summary.inventoryReservation.intervalMs}ms | limite ${summary.inventoryReservation.limit}`);

  console.log('\n=== Resultado final ===');
  console.log(`OK: ${okCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log('FAIL: 0');
  process.exit(0);
} catch (error) {
  console.log('\n=== Resultado final ===');

  if (error instanceof EnvConfigError) {
    console.error(`FAIL ${error.message}`);
  } else {
    console.error(`FAIL Error inesperado validando entorno: ${error.message}`);
  }

  console.log(`OK: ${okCount}`);
  console.log(`WARN: ${warnCount}`);
  console.log('FAIL: 1');
  process.exit(1);
}