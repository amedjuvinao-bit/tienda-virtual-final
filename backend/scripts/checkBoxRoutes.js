// backend/scripts/checkBoxRoutes.js

require('dotenv').config();

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');

const BASE_URL = String(process.env.TEST_BASE_URL || 'http://localhost:5000').replace(/\/+$/, '');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function token() {
  return jwt.sign(
    { role: 'admin', username: 'script-caja', authType: 'legacy', adminRole: 'admin' },
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
  console.log('Test rutas caja POS');
  console.log('Base URL:', BASE_URL);

  assert(process.env.JWT_SECRET, 'Falta JWT_SECRET.');
  assert(process.env.MONGODB_URI, 'Falta MONGODB_URI.');

  await mongoose.connect(process.env.MONGODB_URI);

  const branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
    'settings.allowPosSales': true,
  }).lean();

  assert(branch, 'No hay sede activa POS para probar caja.');

  const registerCode = `TEST-${Date.now()}`;

  console.log('Sede:', branch.name);
  console.log('Caja:', registerCode);

  const opened = await api('/api/admin/cash-sessions/open', {
    method: 'POST',
    body: JSON.stringify({
      branchId: String(branch._id),
      cashRegisterCode: registerCode,
      cashRegisterName: 'Caja de prueba POS',
      openingAmount: 50000,
      openingNotes: 'Apertura de prueba.',
    }),
  });

  console.log('POST open HTTP:', opened.status);
  assert(opened.status === 201, `Esperado HTTP 201, recibido ${opened.status}.`);
  assert(opened.data?.session?.status === 'open', 'La caja debe quedar abierta.');

  const sessionId = opened.data.session.id;

  const current = await api(
    `/api/admin/cash-sessions/current?branchId=${branch._id}&cashRegisterCode=${encodeURIComponent(registerCode)}`
  );

  console.log('GET current HTTP:', current.status);
  assert(current.status === 200, `Esperado HTTP 200, recibido ${current.status}.`);
  assert(current.data?.hasOpenSession === true, 'Debe existir caja abierta.');

  const detail = await api(`/api/admin/cash-sessions/${sessionId}`);
  console.log('GET detail HTTP:', detail.status);
  assert(detail.status === 200, `Esperado HTTP 200, recibido ${detail.status}.`);

  const listed = await api(`/api/admin/cash-sessions?branchId=${branch._id}&status=open&limit=10`);
  console.log('GET list HTTP:', listed.status);
  assert(listed.status === 200, `Esperado HTTP 200, recibido ${listed.status}.`);
  assert(Array.isArray(listed.data?.sessions), 'La lista debe traer sesiones.');

  const closed = await api(`/api/admin/cash-sessions/${sessionId}/close`, {
    method: 'POST',
    body: JSON.stringify({
      countedCash: 50000,
      closingNotes: 'Cierre de prueba.',
    }),
  });

  console.log('POST close HTTP:', closed.status);
  console.log('Estado final:', closed.data?.session?.status || '');
  console.log('Efectivo esperado:', closed.data?.session?.expectedCash ?? 0);
  console.log('Efectivo contado:', closed.data?.session?.countedCash ?? 0);
  console.log('Diferencia:', closed.data?.session?.differenceAmount ?? 0);

  assert(closed.status === 200, `Esperado HTTP 200, recibido ${closed.status}.`);
  assert(closed.data?.session?.status === 'closed', 'La caja debe quedar cerrada.');
  assert(closed.data?.session?.differenceAmount === 0, 'La diferencia debe ser cero.');

  const currentAfter = await api(
    `/api/admin/cash-sessions/current?branchId=${branch._id}&cashRegisterCode=${encodeURIComponent(registerCode)}`
  );

  console.log('GET current despues cierre HTTP:', currentAfter.status);
  assert(currentAfter.data?.hasOpenSession === false, 'No debe quedar caja abierta.');

  console.log('Rutas caja POS correctas.');
}

main()
  .catch((error) => {
    console.error('Error probando rutas caja POS:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
