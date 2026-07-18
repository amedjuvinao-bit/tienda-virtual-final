// backend/scripts/testAdminPosBootstrap.js

require('dotenv').config();

const jwt = require('jsonwebtoken');

const BASE_URL = String(process.env.TEST_BASE_URL || process.env.API_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no está configurado en backend/.env.');
  }

  return secret;
}

function createAdminToken() {
  return jwt.sign(
    {
      role: 'admin',
      username: 'script-pos-bootstrap',
      authType: 'legacy',
      adminRole: 'admin',
    },
    getJwtSecret(),
    {
      expiresIn: '10m',
    }
  );
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

async function main() {
  console.log('🧪 Test POS bootstrap');
  console.log(`Base URL: ${BASE_URL}`);

  const token = createAdminToken();
  const result = await requestJson(`${BASE_URL}/api/admin/pos/bootstrap`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  console.log('HTTP:', result.status);
  console.log('Respuesta:', JSON.stringify(result.data, null, 2));

  assert(result.status === 200, `Esperado HTTP 200, recibido HTTP ${result.status}.`);
  assert(result.data?.ok === true, 'La respuesta debe traer ok: true.');
  assert(Array.isArray(result.data?.branches), 'branches debe ser un arreglo.');
  assert(Array.isArray(result.data?.paymentMethods), 'paymentMethods debe ser un arreglo.');
  assert(result.data.paymentMethods.some((method) => method.key === 'cash'), 'Debe incluir método cash.');
  assert(result.data.paymentMethods.some((method) => method.key === 'transfer'), 'Debe incluir método transfer.');
  assert(result.data.paymentMethods.some((method) => method.key === 'card'), 'Debe incluir método card.');
  assert(result.data.paymentMethods.some((method) => method.key === 'mixed'), 'Debe incluir método mixed.');
  assert(result.data?.permissions?.canView === true, 'El token admin debe poder ver POS.');
  assert(result.data?.permissions?.canSell === true, 'El token admin debe poder vender en POS.');

  console.log('✅ Bootstrap POS responde correctamente.');

  if (result.data.branches.length === 0) {
    console.log('ℹ️ No hay sedes habilitadas para POS. No es error para esta prueba.');
  } else {
    console.log(`✅ Sedes POS disponibles: ${result.data.branches.length}`);
  }
}

main().catch((error) => {
  console.error('❌ Error probando bootstrap POS:', error.message);
  process.exitCode = 1;
});
