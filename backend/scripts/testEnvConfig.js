// backend/scripts/testEnvConfig.js
const { env, assertEnv, getSafeEnvSummary, EnvConfigError } = require('../config/env');

function ok(message) {
  console.log(`OK  ${message}`);
}

function info(message) {
  console.log(`INFO ${message}`);
}

function warn(message) {
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

  if (!summary.cloudinaryConfigured) {
    warn('Cloudinary no esta completamente configurado. La carga de imagenes puede depender de configuracion frontend/backend.');
  } else {
    ok('Cloudinary configurado');
  }

  if (!summary.smtpConfigured) {
    warn('SMTP no esta completamente configurado. El envio de correos puede fallar si no se configura.');
  } else {
    ok('SMTP configurado');
  }

  info(`Reservas inventario: ${summary.inventoryReservation.enabled ? 'activadas' : 'desactivadas'} | intervalo ${summary.inventoryReservation.intervalMs}ms | limite ${summary.inventoryReservation.limit}`);

  console.log('\n=== Resultado final ===');
  console.log('OK: 3');
  console.log('WARN: variable segun configuracion opcional mostrada arriba');
  console.log('FAIL: 0');
  process.exit(0);
} catch (error) {
  console.log('\n=== Resultado final ===');

  if (error instanceof EnvConfigError) {
    console.error(`FAIL ${error.message}`);
  } else {
    console.error(`FAIL Error inesperado validando entorno: ${error.message}`);
  }

  console.log('OK: 0');
  console.log('FAIL: 1');
  process.exit(1);
}
