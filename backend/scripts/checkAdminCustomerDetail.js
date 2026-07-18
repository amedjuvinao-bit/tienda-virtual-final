// backend/scripts/checkAdminCustomerDetail.js

require('dotenv').config();

const jwt = require('jsonwebtoken');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function token() {
  return jwt.sign(
    { role: 'admin', username: 'script-detalle-clientes', authType: 'legacy', adminRole: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function api(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  return { status: response.status, data };
}

async function main() {
  console.log('Test detalle comercial de cliente');
  console.log('Base URL:', BASE_URL);

  assert(process.env.JWT_SECRET, 'Falta JWT_SECRET.');

  const list = await api('/api/admin/customers?status=active&source=all&segment=all&page=1&limit=1');
  console.log('GET clientes HTTP:', list.status);
  assert(list.status === 200, `Esperado HTTP 200 listado clientes, recibido ${list.status}.`);
  assert(Array.isArray(list.data.customers), 'La respuesta debe traer customers[].');
  assert(list.data.customers.length > 0, 'No hay clientes activos para probar el detalle.');

  const customer = list.data.customers[0];
  const detail = await api(`/api/admin/customers/${customer.id}?ordersLimit=10`);
  console.log('GET detalle HTTP:', detail.status);
  assert(detail.status === 200, `Esperado HTTP 200 detalle cliente, recibido ${detail.status}.`);
  assert(detail.data.customer?.id === customer.id, 'El detalle debe corresponder al cliente solicitado.');
  assert(Array.isArray(detail.data.recentOrders), 'El detalle debe traer recentOrders[].');

  console.log('Cliente:', detail.data.customer.fullName || detail.data.customer.displayName);
  console.log('Compras registradas:', detail.data.customer.stats?.ordersCount || 0);
  console.log('Ordenes recientes:', detail.data.recentOrders.length);
  console.log('Detalle comercial de cliente correcto.');
}

main().catch((error) => {
  console.error('Error probando detalle cliente:', error.message);
  process.exitCode = 1;
});
