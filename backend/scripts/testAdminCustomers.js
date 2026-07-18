// backend/scripts/testAdminCustomers.js

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
      username: 'script-admin-customers',
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

function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

async function main() {
  console.log('🧪 Test rutas admin clientes');
  console.log(`Base URL: ${BASE_URL}`);

  const token = createAdminToken();
  const headers = buildHeaders(token);
  const stamp = Date.now();

  const createPayload = {
    fullName: `Cliente Prueba POS ${stamp}`,
    phone: `300${String(stamp).slice(-7)}`,
    email: `cliente.pos.${stamp}@example.com`,
    documentType: 'CC',
    documentNumber: String(stamp).slice(-10),
    address: 'Calle de prueba 123',
    city: 'Zona Bananera',
    department: 'Magdalena',
    country: 'CO',
    source: 'pos',
    notes: 'Cliente creado por prueba automatizada del módulo clientes.',
  };

  const created = await requestJson(`${BASE_URL}/api/admin/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(createPayload),
  });

  console.log('POST /api/admin/customers HTTP:', created.status);
  console.log('Cliente creado:', JSON.stringify(created.data?.customer || created.data, null, 2));

  assert(created.status === 201, `Esperado HTTP 201 al crear cliente, recibido HTTP ${created.status}.`);
  assert(created.data?.ok === true, 'La creación debe responder ok: true.');
  assert(created.data?.customer?.id, 'La creación debe retornar customer.id.');
  assert(created.data.customer.fullName === createPayload.fullName, 'El nombre creado no coincide.');

  const customerId = created.data.customer.id;
  const q = encodeURIComponent(createPayload.phone);

  const listed = await requestJson(`${BASE_URL}/api/admin/customers?q=${q}&limit=10`, {
    method: 'GET',
    headers,
  });

  console.log('GET /api/admin/customers HTTP:', listed.status);
  console.log('Total encontrados:', listed.data?.total);

  assert(listed.status === 200, `Esperado HTTP 200 al listar clientes, recibido HTTP ${listed.status}.`);
  assert(listed.data?.ok === true, 'El listado debe responder ok: true.');
  assert(Array.isArray(listed.data?.customers), 'customers debe ser un arreglo.');
  assert(listed.data.customers.some((customer) => customer.id === customerId), 'El cliente creado debe aparecer en el listado.');

  const detail = await requestJson(`${BASE_URL}/api/admin/customers/${customerId}`, {
    method: 'GET',
    headers,
  });

  console.log('GET /api/admin/customers/:id HTTP:', detail.status);

  assert(detail.status === 200, `Esperado HTTP 200 al consultar cliente, recibido HTTP ${detail.status}.`);
  assert(detail.data?.ok === true, 'El detalle debe responder ok: true.');
  assert(detail.data?.customer?.id === customerId, 'El detalle debe retornar el mismo cliente.');

  const updatePayload = {
    fullName: `${createPayload.fullName} Editado`,
    phone: createPayload.phone,
    email: createPayload.email,
    documentType: createPayload.documentType,
    documentNumber: createPayload.documentNumber,
    address: 'Carrera de prueba 456',
    city: 'Santa Marta',
    department: 'Magdalena',
    country: 'CO',
    source: 'pos',
    notes: 'Cliente editado por prueba automatizada del módulo clientes.',
  };

  const updated = await requestJson(`${BASE_URL}/api/admin/customers/${customerId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updatePayload),
  });

  console.log('PUT /api/admin/customers/:id HTTP:', updated.status);
  console.log('Cliente editado:', JSON.stringify(updated.data?.customer || updated.data, null, 2));

  assert(updated.status === 200, `Esperado HTTP 200 al editar cliente, recibido HTTP ${updated.status}.`);
  assert(updated.data?.ok === true, 'La edición debe responder ok: true.');
  assert(updated.data?.customer?.id === customerId, 'La edición debe retornar el mismo cliente.');
  assert(updated.data.customer.fullName === updatePayload.fullName, 'El nombre editado no coincide.');
  assert(updated.data.customer.city === updatePayload.city, 'La ciudad editada no coincide.');

  console.log('✅ Rutas admin de clientes correctas.');
}

main().catch((error) => {
  console.error('❌ Error probando clientes admin:', error.message);
  process.exitCode = 1;
});
