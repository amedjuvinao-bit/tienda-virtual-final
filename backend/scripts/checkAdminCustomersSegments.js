// backend/scripts/checkAdminCustomersSegments.js

require('dotenv').config();

const jwt = require('jsonwebtoken');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function token() {
  return jwt.sign(
    { role: 'admin', username: 'script-clientes', authType: 'legacy', adminRole: 'admin' },
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
  console.log('Test resumen y filtros de clientes');
  console.log('Base URL:', BASE_URL);

  assert(process.env.JWT_SECRET, 'Falta JWT_SECRET.');

  const all = await api('/api/admin/customers?status=active&source=all&segment=all&page=1&limit=10');
  console.log('GET all HTTP:', all.status);
  assert(all.status === 200, `Esperado HTTP 200 clientes, recibido ${all.status}.`);
  assert(Array.isArray(all.data.customers), 'La respuesta debe traer customers[].');
  assert(all.data.summary && typeof all.data.summary === 'object', 'La respuesta debe traer summary.');
  assert(typeof all.data.summary.totalCustomers === 'number', 'summary.totalCustomers debe ser número.');

  const pos = await api('/api/admin/customers?status=active&source=pos&segment=all&page=1&limit=10');
  console.log('GET pos HTTP:', pos.status);
  assert(pos.status === 200, `Esperado HTTP 200 clientes POS, recibido ${pos.status}.`);
  assert(pos.data.customers.every((customer) => customer.source === 'pos'), 'El filtro POS solo debe devolver clientes POS.');

  const withEmail = await api('/api/admin/customers?status=active&source=all&segment=with-email&page=1&limit=10');
  console.log('GET with-email HTTP:', withEmail.status);
  assert(withEmail.status === 200, `Esperado HTTP 200 clientes con correo, recibido ${withEmail.status}.`);
  assert(withEmail.data.customers.every((customer) => String(customer.email || '').trim()), 'El filtro con correo solo debe devolver clientes con correo.');

  const withPurchases = await api('/api/admin/customers?status=active&source=all&segment=with-purchases&page=1&limit=10');
  console.log('GET with-purchases HTTP:', withPurchases.status);
  assert(withPurchases.status === 200, `Esperado HTTP 200 clientes con compras, recibido ${withPurchases.status}.`);
  assert(
    withPurchases.data.customers.every((customer) => Number(customer.stats?.ordersCount || 0) > 0),
    'El filtro con compras solo debe devolver clientes con compras.'
  );

  console.log('Resumen:', JSON.stringify(all.data.summary, null, 2));
  console.log('Resumen y filtros de clientes correctos.');
}

main().catch((error) => {
  console.error('Error probando clientes:', error.message);
  process.exitCode = 1;
});
