// backend/scripts/checkAdminCustomerEdit.js

require('dotenv').config();

const jwt = require('jsonwebtoken');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function token() {
  return jwt.sign(
    { role: 'admin', username: 'script-editar-clientes', authType: 'legacy', adminRole: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
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
  console.log('Test edicion admin de cliente');
  console.log('Base URL:', BASE_URL);

  assert(process.env.JWT_SECRET, 'Falta JWT_SECRET.');

  const list = await api('/api/admin/customers?status=active&source=all&segment=all&page=1&limit=1');
  console.log('GET clientes HTTP:', list.status);
  assert(list.status === 200, `Esperado HTTP 200 listado clientes, recibido ${list.status}.`);
  assert(Array.isArray(list.data.customers), 'La respuesta debe traer customers[].');
  assert(list.data.customers.length > 0, 'No hay clientes activos para probar edicion.');

  const customer = list.data.customers[0];
  const stamp = Date.now();
  const newNotes = `Cliente editado por prueba automatizada ${stamp}`;

  const updated = await api(`/api/admin/customers/${customer.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      ...customer,
      notes: newNotes,
      address: 'Direccion editada desde prueba admin',
      city: 'Zona Bananera',
      department: 'Magdalena',
    }),
  });

  console.log('PUT cliente HTTP:', updated.status);
  assert(updated.status === 200, `Esperado HTTP 200 editando cliente, recibido ${updated.status}.`);
  assert(updated.data.customer?.notes === newNotes, 'Las notas editadas deben persistir.');
  assert(updated.data.customer?.address === 'Direccion editada desde prueba admin', 'La direccion editada debe persistir.');

  const detail = await api(`/api/admin/customers/${customer.id}`);
  console.log('GET detalle HTTP:', detail.status);
  assert(detail.status === 200, `Esperado HTTP 200 detalle cliente, recibido ${detail.status}.`);
  assert(detail.data.customer?.notes === newNotes, 'El detalle debe reflejar las notas editadas.');

  console.log('Cliente:', detail.data.customer.fullName || detail.data.customer.displayName);
  console.log('Notas:', detail.data.customer.notes);
  console.log('Edicion admin de cliente correcta.');
}

main().catch((error) => {
  console.error('Error probando edicion cliente:', error.message);
  process.exitCode = 1;
});
