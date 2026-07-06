// backend/scripts/checkBoxMovements.js

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
    { role: 'admin', username: 'script-movimientos-caja', authType: 'legacy', adminRole: 'admin' },
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
  console.log('Test movimientos manuales de caja');
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

  assert(branch, 'No hay sede POS activa.');

  const registerCode = `MOV-${Date.now()}`;

  const opened = await api('/api/admin/cash-sessions/open', {
    method: 'POST',
    body: JSON.stringify({
      branchId: String(branch._id),
      cashRegisterCode: registerCode,
      cashRegisterName: 'Caja movimientos POS',
      openingAmount: 50000,
      openingNotes: 'Apertura prueba movimientos manuales.',
    }),
  });

  console.log('POST open HTTP:', opened.status);
  assert(opened.status === 201, `Esperado HTTP 201 abriendo caja, recibido ${opened.status}.`);

  const sessionId = opened.data.session.id;

  const cashIn = await api(`/api/admin/cash-sessions/${sessionId}/movements`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'cash_in',
      amount: 20000,
      reason: 'Ingreso manual de prueba',
      reference: 'ING-TEST',
    }),
  });

  console.log('POST cash_in HTTP:', cashIn.status);
  assert(cashIn.status === 201, `Esperado HTTP 201 ingreso, recibido ${cashIn.status}.`);
  assert(cashIn.data.session.expectedCash === 70000, 'Después del ingreso el esperado debe ser 70000.');

  const expense = await api(`/api/admin/cash-sessions/${sessionId}/movements`, {
    method: 'POST',
    body: JSON.stringify({
      type: 'expense',
      amount: 10000,
      reason: 'Gasto manual de prueba',
      reference: 'GTO-TEST',
    }),
  });

  console.log('POST expense HTTP:', expense.status);
  assert(expense.status === 201, `Esperado HTTP 201 gasto, recibido ${expense.status}.`);
  assert(expense.data.session.expectedCash === 60000, 'Después del gasto el esperado debe ser 60000.');
  assert(expense.data.session.cashMovements.length >= 3, 'Debe conservar apertura, ingreso y gasto.');

  const closed = await api(`/api/admin/cash-sessions/${sessionId}/close`, {
    method: 'POST',
    body: JSON.stringify({
      countedCash: 60000,
      closingNotes: 'Cierre prueba movimientos manuales.',
    }),
  });

  console.log('POST close HTTP:', closed.status);
  console.log('Efectivo esperado:', closed.data?.session?.expectedCash ?? 0);
  console.log('Efectivo contado:', closed.data?.session?.countedCash ?? 0);
  console.log('Diferencia:', closed.data?.session?.differenceAmount ?? 0);

  assert(closed.status === 200, `Esperado HTTP 200 cerrando caja, recibido ${closed.status}.`);
  assert(closed.data.session.status === 'closed', 'La caja debe quedar cerrada.');
  assert(closed.data.session.differenceAmount === 0, 'La diferencia debe ser cero.');

  console.log('Movimientos manuales de caja correctos.');
}

main()
  .catch((error) => {
    console.error('Error probando movimientos de caja:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
