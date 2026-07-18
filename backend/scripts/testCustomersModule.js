// backend/scripts/testCustomersModule.js
/* eslint-disable no-console */

/**
 * Prueba general del modulo Clientes.
 *
 * Requisitos:
 * 1. Backend encendido: npm start
 * 2. Ejecutar desde backend: npm run test:customers
 *
 * Variables opcionales:
 * - CUSTOMER_TEST_BASE_URL=http://localhost:5000
 * - CUSTOMER_TEST_STRICT_DUPLICATES=true  -> falla si el backend permite duplicados
 * - CUSTOMER_TEST_KEEP_DATA=true          -> no borra los clientes de prueba
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');

const BASE_URL = String(process.env.CUSTOMER_TEST_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const STRICT_DUPLICATES = String(process.env.CUSTOMER_TEST_STRICT_DUPLICATES || 'false').toLowerCase() === 'true';
const KEEP_DATA = String(process.env.CUSTOMER_TEST_KEEP_DATA || 'false').toLowerCase() === 'true';
const TEST_TAG = '__test_customers_module__';
const RUN_ID = Date.now().toString(36).toUpperCase();

const state = {
  passed: 0,
  failed: 0,
  warnings: 0,
};

function title(text) {
  console.log(`\n=== ${text} ===`);
}

function pass(message) {
  state.passed += 1;
  console.log(`OK   ${message}`);
}

function warn(message) {
  state.warnings += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  state.failed += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function adminToken() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no esta configurado en backend/.env');
  }

  return jwt.sign(
    {
      role: 'admin',
      username: 'customers-module-test',
      authType: 'legacy',
      adminRole: 'owner',
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

const TOKEN = adminToken();

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  let data = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch (_error) {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

async function connectDb() {
  if (!process.env.MONGODB_URI) {
    warn('MONGODB_URI no esta configurado. No se puede auditar duplicados ni limpiar datos de prueba.');
    return false;
  }

  if (mongoose.connection.readyState === 1) return true;

  await mongoose.connect(process.env.MONGODB_URI);
  return true;
}

async function cleanupTestData() {
  if (KEEP_DATA) {
    warn('CUSTOMER_TEST_KEEP_DATA=true. No se borran datos de prueba.');
    return;
  }

  const connected = await connectDb();
  if (!connected) return;

  const testCustomers = await Customer.find({ tags: TEST_TAG }).select('_id').lean();
  const ids = testCustomers.map((item) => item._id);

  if (ids.length > 0) {
    await CustomerFollowUp.deleteMany({ customer: { $in: ids } });
    await Customer.deleteMany({ _id: { $in: ids } });
    console.log(`Limpieza: ${ids.length} cliente(s) de prueba eliminado(s).`);
  }
}

async function duplicateGroups(field, label, extraGroup = {}) {
  const rows = await Customer.aggregate([
    {
      $match: {
        deletedAt: null,
        status: 'active',
        tags: { $ne: TEST_TAG },
        [field]: { $exists: true, $type: 'string', $ne: '' },
      },
    },
    {
      $group: {
        _id: { value: `$${field}`, ...extraGroup },
        count: { $sum: 1 },
        examples: {
          $push: {
            id: '$_id',
            name: '$fullName',
            code: '$customerCode',
            phone: '$phone',
            email: '$email',
            documentType: '$documentType',
            documentNumber: '$documentNumber',
          },
        },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 },
  ]);

  return { label, field, rows };
}

async function auditDuplicates() {
  const connected = await connectDb();
  if (!connected) return null;

  return {
    document: await duplicateGroups('normalizedDocument', 'Documento', { documentType: '$documentType' }),
    phone: await duplicateGroups('normalizedPhone', 'Celular'),
    email: await duplicateGroups('normalizedEmail', 'Correo'),
  };
}

function printDuplicates(report) {
  if (!report) return;

  title('Auditoria de duplicados reales');

  Object.values(report).forEach((section) => {
    if (section.rows.length === 0) {
      pass(`Sin duplicados por ${section.label}.`);
      return;
    }

    warn(`Duplicados por ${section.label}: ${section.rows.length} grupo(s).`);

    section.rows.slice(0, 5).forEach((group, index) => {
      const value = typeof group._id === 'object' ? JSON.stringify(group._id) : String(group._id || '');
      console.log(`   ${index + 1}. ${section.label}: ${value} | cantidad: ${group.count}`);
      group.examples.slice(0, 3).forEach((example) => {
        console.log(`      - ${example.name || 'Sin nombre'} | ${example.code || 'Sin codigo'} | ${example.phone || '-'} | ${example.email || '-'} | ${example.documentType || ''} ${example.documentNumber || ''}`);
      });
    });
  });
}

async function step(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error);
  }
}

async function main() {
  title('Prueba general modulo Clientes');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Run ID: ${RUN_ID}`);

  await cleanupTestData();

  let createdCustomer = null;
  let followUp = null;

  const payload = {
    fullName: `Cliente Prueba Modulo ${RUN_ID}`,
    displayName: `Cliente Prueba Modulo ${RUN_ID}`,
    phone: `300${String(Date.now()).slice(-7)}`,
    email: `cliente.prueba.${RUN_ID.toLowerCase()}@example.com`,
    documentType: 'CC',
    documentNumber: `99${String(Date.now()).slice(-8)}`,
    address: 'Direccion de prueba modulo clientes',
    city: 'Zona Bananera',
    department: 'Magdalena',
    country: 'CO',
    source: 'admin',
    status: 'active',
    acceptsMarketing: false,
    notes: 'Cliente creado por prueba automatica del modulo clientes.',
    tags: [TEST_TAG],
  };

  await step('Listar clientes', async () => {
    const data = await api('/api/admin/customers?status=active&page=1&limit=5');
    assert(data?.ok === true, 'No trae ok=true');
    assert(Array.isArray(data.customers), 'customers no es arreglo');
    assert(typeof data.total === 'number', 'total no es numerico');
  });

  await step('Crear cliente desde admin', async () => {
    const data = await api('/api/admin/customers', { method: 'POST', body: payload });
    createdCustomer = data.customer;
    assert(data?.ok === true, 'No trae ok=true');
    assert(createdCustomer?.id, 'No devolvio id');
    assert(createdCustomer.customerCode, 'No genero customerCode');
    assert(createdCustomer.fullName === payload.fullName, 'Nombre no coincide');
  });

  await step('Buscar cliente por codigo', async () => {
    const q = encodeURIComponent(createdCustomer.customerCode);
    const data = await api(`/api/admin/customers?q=${q}&status=active&page=1&limit=10`);
    assert(data.customers.some((item) => item.id === createdCustomer.id), 'No aparece en busqueda');
  });

  await step('Cargar ficha comercial', async () => {
    const data = await api(`/api/admin/customers/${createdCustomer.id}`);
    assert(data?.ok === true, 'No trae ok=true');
    assert(data.customer?.id === createdCustomer.id, 'Detalle no corresponde');
    assert(Array.isArray(data.recentOrders), 'recentOrders no es arreglo');
  });

  await step('Editar datos del cliente', async () => {
    const data = await api(`/api/admin/customers/${createdCustomer.id}`, {
      method: 'PUT',
      body: {
        ...payload,
        fullName: `${payload.fullName} Editado`,
        displayName: `${payload.fullName} Editado`,
        notes: 'Cliente actualizado por prueba automatica.',
        tags: [TEST_TAG],
      },
    });
    assert(data?.ok === true, 'No trae ok=true');
    assert(data.customer?.fullName?.includes('Editado'), 'No actualizo nombre');
    assert(data.customer?.notes?.includes('actualizado'), 'No actualizo notas');
  });

  await step('Filtros por origen y segmento', async () => {
    const bySource = await api('/api/admin/customers?source=admin&status=active&page=1&limit=20');
    assert(bySource?.ok === true, 'Filtro source fallo');
    assert(Array.isArray(bySource.customers), 'source no devuelve arreglo');

    const withEmail = await api('/api/admin/customers?segment=with-email&status=active&page=1&limit=20');
    assert(withEmail?.ok === true, 'Filtro with-email fallo');
    assert(Array.isArray(withEmail.customers), 'with-email no devuelve arreglo');
  });

  await step('Crear seguimiento interno', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}`, {
      method: 'POST',
      body: {
        type: 'whatsapp',
        status: 'pending',
        note: `Seguimiento de prueba ${RUN_ID}`,
        nextAction: 'Validar modulo clientes',
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      },
    });
    followUp = data.followUp;
    assert(data?.ok === true, 'No trae ok=true');
    assert(followUp?.id, 'No devolvio seguimiento');
    assert(followUp.status === 'pending', 'No quedo pendiente');
  });

  await step('Listar seguimiento interno', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}?status=all&limit=20`);
    assert(data?.ok === true, 'No trae ok=true');
    assert(Array.isArray(data.followUps), 'followUps no es arreglo');
    assert(data.followUps.some((item) => item.id === followUp.id), 'Seguimiento no aparece');
  });

  await step('Marcar seguimiento como realizado', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}/${followUp.id}`, {
      method: 'PUT',
      body: { ...followUp, status: 'done' },
    });
    assert(data?.ok === true, 'No trae ok=true');
    assert(data.followUp?.status === 'done', 'No quedo realizado');
  });

  await step('Eliminar seguimiento interno', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}/${followUp.id}`, { method: 'DELETE' });
    assert(data?.ok === true, 'No trae ok=true');
  });

  await step('Validar nombre obligatorio', async () => {
    try {
      await api('/api/admin/customers', {
        method: 'POST',
        body: {
          ...payload,
          fullName: '',
          displayName: '',
          phone: `301${String(Date.now()).slice(-7)}`,
          email: `sin.nombre.${RUN_ID.toLowerCase()}@example.com`,
          documentNumber: `88${String(Date.now()).slice(-8)}`,
          tags: [TEST_TAG],
        },
      });
      throw new Error('Permitio crear cliente sin nombre');
    } catch (error) {
      if (error.message === 'Permitio crear cliente sin nombre') throw error;
      assert([400, 422, 500].includes(Number(error.status)), `Estado inesperado: ${error.status}`);
    }
  });

  await step('Revisar politica de duplicados', async () => {
    try {
      const data = await api('/api/admin/customers', {
        method: 'POST',
        body: {
          ...payload,
          fullName: `${payload.fullName} Duplicado`,
          displayName: `${payload.fullName} Duplicado`,
          tags: [TEST_TAG],
        },
      });

      if (data?.customer?.id) {
        const message = 'El backend permitio duplicar documento/celular/correo.';
        if (STRICT_DUPLICATES) throw new Error(message);
        warn(`${message} Falta decidir si se bloquea o se muestra advertencia.`);
      }
    } catch (error) {
      if ([400, 409, 422].includes(Number(error.status))) return;
      throw error;
    }
  });

  await cleanupTestData();

  const duplicateReport = await auditDuplicates();
  printDuplicates(duplicateReport);

  title('Resultado final');
  console.log(`OK: ${state.passed}`);
  console.log(`WARN: ${state.warnings}`);
  console.log(`FAIL: ${state.failed}`);

  if (state.failed > 0) process.exitCode = 1;
  if (STRICT_DUPLICATES && state.warnings > 0) process.exitCode = 1;
}

main()
  .catch(async (error) => {
    fail('Error general ejecutando pruebas', error);
    try {
      await cleanupTestData();
    } catch (cleanupError) {
      warn(`No se pudo limpiar datos de prueba: ${cleanupError.message}`);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
