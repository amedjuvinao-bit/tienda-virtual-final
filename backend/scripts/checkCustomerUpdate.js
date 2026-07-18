// backend/scripts/checkCustomerUpdate.js

require('dotenv').config();

const jwt = require('jsonwebtoken');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function authToken() {
  return jwt.sign(
    { role: 'admin', username: 'script-cliente-update', authType: 'legacy', adminRole: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${authToken()}`,
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
  console.log('Test actualizacion de cliente');
  console.log('Base URL:', BASE_URL);

  assert(process.env.JWT_SECRET, 'Falta JWT_SECRET.');

  const stamp = Date.now();
  const createRes = await request('/api/admin/customers', {
    method: 'POST',
    body: JSON.stringify({
      fullName: `Cliente Update ${stamp}`,
      phone: '3000000000',
      documentType: 'CC',
      documentNumber: String(stamp).slice(-10),
      source: 'admin',
      status: 'active',
      notes: 'Cliente de prueba update.',
    }),
  });

  console.log('POST HTTP:', createRes.status);
  assert(createRes.status === 201, 'No se pudo crear cliente de prueba.');

  const id = createRes.data.customer.id;
  const editedName = `Cliente Actualizado ${stamp}`;

  const updateRes = await request(`/api/admin/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      fullName: editedName,
      phone: '3010000000',
      documentType: 'CC',
      documentNumber: String(stamp).slice(-10),
      address: 'Direccion actualizada',
      city: 'Santa Marta',
      department: 'Magdalena',
      source: 'admin',
      status: 'active',
      notes: 'Cliente actualizado por prueba.',
    }),
  });

  console.log('PUT HTTP:', updateRes.status);
  assert(updateRes.status === 200, 'No se pudo actualizar cliente.');
  assert(updateRes.data.customer.fullName === editedName, 'El nombre no se actualizo.');
  assert(updateRes.data.customer.phone === '3010000000', 'El telefono no se actualizo.');

  const detailRes = await request(`/api/admin/customers/${id}`);
  console.log('GET detalle HTTP:', detailRes.status);
  assert(detailRes.status === 200, 'No se pudo consultar el detalle actualizado.');
  assert(detailRes.data.customer.fullName === editedName, 'El detalle no refleja el cambio.');

  console.log('Cliente:', detailRes.data.customer.fullName);
  console.log('Actualizacion de cliente correcta.');
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exitCode = 1;
});
