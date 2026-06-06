// backend/scripts/testAdminInventoryHttp.js

require('dotenv').config();

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000';

const TOKEN =
  process.env.TEST_ADMIN_TOKEN ||
  process.env.ADMIN_TEST_TOKEN ||
  process.env.ADMIN_TOKEN ||
  '';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();

  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function printTitle(title) {
  console.log('\n==================================================');
  console.log(title);
  console.log('==================================================');
}

function getAdminToken() {
  const cleanToken = String(TOKEN || '').trim();

  if (!cleanToken) {
    throw new Error(
      'Falta TEST_ADMIN_TOKEN en backend/.env. Copia un token válido del login admin y guárdalo como TEST_ADMIN_TOKEN.'
    );
  }

  return cleanToken;
}

async function testProtectedRoute(token, method, path) {
  const result = await requestJson(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const success = result.ok && result.data?.ok !== false;

  console.log(success ? '✅ Ruta HTTP respondió correctamente' : '❌ Ruta HTTP falló');
  console.log({
    method,
    path,
    status: result.status,
    ok: result.ok,
    response: result.data,
  });

  if (!success) {
    throw new Error(`Falló la ruta ${method} ${path}`);
  }
}

async function main() {
  printTitle('🧪 PRUEBA HTTP REAL CON TOKEN - INVENTARIO ADMIN');

  const token = getAdminToken();

  console.log('✅ Token admin cargado desde .env');

  await testProtectedRoute(token, 'GET', '/api/admin/inventory/meta');
  await testProtectedRoute(token, 'GET', '/api/admin/inventory/stock');
  await testProtectedRoute(token, 'GET', '/api/admin/inventory/movements');

  printTitle('✅ PRUEBA HTTP FINALIZADA CORRECTAMENTE');
}

main().catch((error) => {
  console.error('\n❌ ERROR EN PRUEBA HTTP DE INVENTARIO');
  console.error(error.message || error);
  process.exit(1);
});