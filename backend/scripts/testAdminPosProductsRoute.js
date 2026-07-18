// backend/scripts/testAdminPosProductsRoute.js

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
      username: 'script-pos-products',
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
  console.log('Test ruta productos POS');
  console.log(`Base URL: ${BASE_URL}`);

  const token = createAdminToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };

  const bootstrap = await requestJson(`${BASE_URL}/api/admin/pos/bootstrap`, {
    method: 'GET',
    headers,
  });

  assert(bootstrap.status === 200, `Bootstrap HTTP incorrecto: ${bootstrap.status}.`);
  assert(bootstrap.data?.ok === true, 'Bootstrap debe responder ok: true.');
  assert(Array.isArray(bootstrap.data?.branches), 'Bootstrap debe traer branches.');

  const branch = bootstrap.data.defaultBranch || bootstrap.data.branches[0];

  if (!branch?.id) {
    console.log('No hay sede POS disponible. Prueba finalizada sin error.');
    return;
  }

  const url = `${BASE_URL}/api/admin/pos/products?branchId=${encodeURIComponent(branch.id)}&limit=20`;
  const result = await requestJson(url, {
    method: 'GET',
    headers,
  });

  console.log('HTTP:', result.status);
  console.log('Sede:', branch.name);
  console.log('Productos encontrados:', result.data?.products?.length || 0);

  assert(result.status === 200, `Esperado HTTP 200, recibido HTTP ${result.status}.`);
  assert(result.data?.ok === true, 'La respuesta debe traer ok: true.');
  assert(Array.isArray(result.data?.products), 'products debe ser un arreglo.');
  assert(result.data?.branch?.id === branch.id, 'La respuesta debe corresponder a la sede consultada.');

  const firstProduct = result.data.products[0];

  if (firstProduct) {
    console.log('Primer producto:', firstProduct.title);
    console.log('Stock disponible:', firstProduct.availableStock);

    assert(firstProduct.productId, 'El producto debe traer productId.');
    assert(firstProduct.title, 'El producto debe traer title.');
    assert(Number(firstProduct.price || 0) > 0, 'El producto debe traer precio mayor a cero.');
    assert(Number(firstProduct.availableStock || 0) > 0, 'El producto debe traer stock disponible mayor a cero.');
  } else {
    console.log('La ruta respondió bien, pero no hay productos con stock disponible en la sede.');
  }

  console.log('Ruta productos POS correcta.');
}

main().catch((error) => {
  console.error('Error probando ruta productos POS:', error.message);
  process.exitCode = 1;
});
