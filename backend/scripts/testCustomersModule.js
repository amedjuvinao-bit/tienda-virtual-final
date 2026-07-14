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
  createdCustomerIds: [],
  createdFollowUpIds: [],
  duplicateReport: null,
};

function printTitle(title) {
  console.log(`\n=== ${title} ===`);
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

function getAdminToken() {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error('JWT_SECRET no esta configurado en backend/.env');
  }

  return jwt.sign(
    {
      role: 'admin',
      username: 'customers-module-test',
      authType: 'legacy',
      adminRole: 'owner',
    },
    secret,
    { expiresIn: '30m' }
  );
}

const TOKEN = getAdminToken();

async function api(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  let data = null;
  const text = await response.text();

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
    warn('MONGODB_URI no esta configurado. Se omite auditoria directa de duplicados y limpieza por base de datos.');
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
  }
}

async function auditDuplicates() {
  const connected = await connectDb();
  if (!connected) return null;

  const baseMatch = { deletedAt: null, status: 'active' };

  const duplicateBy = async (field, label, extraGroup = {}) => {
    const pipeline = [
      {
        $match: {
          ...baseMatch,
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
    ];

    const rows = await Customer.aggregate(pipeline);
    return { label, field, totalGroups: rows.length, rows };
  };

  const report = {
    document: await duplicateBy('normalizedDocument', 'Documento', { documentType: '$documentType' }),
    phone: await duplicateBy('normalizedPhone', 'Celular'),
    email: await duplicateBy('normalizedEmail', 'Correo'),
  };

  state.duplicateReport = report;
  return report;
}

function printDuplicateReport(report) {
  if (!report) return;

  printTitle('Auditoria de duplicados existentes');

  Object.values(report).forEach((section) => {
    if (!section.totalGroups) {
      pass(`Sin duplicados por ${section.label}.`);
      return;
    }

    warn(`Se encontraron ${section.totalGroups} grupo(s) duplicados por ${section.label}.`);

    section.rows.slice(0, 5).forEach((group, index) => {
      const value = typeof group._id === 'object' ? JSON.stringify(group._id) : String(group._id || '');
      console.log(`   ${index + 1}. ${section.label}: ${value} | cantidad: ${group.count}`);
      group.examples.slice(0, 3).forEach((example) => {
        console.log(`      - ${example.name || 'Sin nombre'} | ${example.code || 'Sin codigo'} | ${example.phone || '-'} | ${example.email || '-'} | ${example.documentType || ''} ${example.documentNumber || ''}`);
      });
    });
  });
}

async function runStep(name, fn) {
  try {
    await fn();
    pass(name);
  } catch (error) {
    fail(name, error);
  }
}

async function main() {
  printTitle('Prueba general modulo Clientes');
  console.log(`Backend: ${BASE_URL}`);
  console.log(`Run ID: ${RUN_ID}`);

  await cleanupTestData();

  let createdCustomer = null;
  let updatedCustomer = null;
  let followUp = null;

  const baseCustomerPayload = {
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

  await runStep('GET /api/admin/customers lista clientes', async () => {
    const data = await api('/api/admin/customers?status=active&page=1&limit=5');
    assert(data?.ok === true, 'La respuesta no trae ok=true');
    assert(Array.isArray(data.customers), 'customers no es un arreglo');
    assert(typeof data.total === 'number', 'total no es numerico');
  });

  await runStep('POST /api/admin/customers crea cliente admin', async () => {
    const data = await api('/api/admin/customers', {
      method: 'POST',
      body: baseCustomerPayload,
    });

    createdCustomer = data.customer;
    state.createdCustomerIds.push(createdCustomer.id);

    assert(data?.ok === true, 'La respuesta no trae ok=true');
    assert(createdCustomer?.id, 'No devolvio id del cliente');
    assert(createdCustomer.fullName === baseCustomerPayload.fullName, 'El nombre guardado no coincide');
    assert(createdCustomer.customerCode, 'No genero customerCode');
  });

  await runStep('GET /api/admin/customers busca cliente por codigo/nombre', async () => {
    const q = encodeURIComponent(createdCustomer.customerCode || createdCustomer.fullName);
    const data = await api(`/api/admin/customers?q=${q}&status=active&page=1&limit=10`);
    assert(data?.ok === true, 'La busqueda no trae ok=true');
    assert(data.customers.some((item) => item.id === createdCustomer.id), 'El cliente creado no aparece en busqueda');
  });

  await runStep('GET /api/admin/customers/:id carga ficha comercial', async () => {
    const data = await api(`/api/admin/customers/${createdCustomer.id}`);
    assert(data?.ok === true, 'El detalle no trae ok=true');
    assert(data.customer?.id === createdCustomer.id, 'El detalle no corresponde al cliente creado');
    assert(Array.isArray(data.recentOrders), 'recentOrders no es arreglo');
  });

  await runStep('PUT /api/admin/customers/:id edita cliente', async () => {
    const data = await api(`/api/admin/customers/${createdCustomer.id}`, {
      method: 'PUT',
      body: {
        ...baseCustomerPayload,
        fullName: `${baseCustomerPayload.fullName} Editado`,
        displayName: `${baseCustomerPayload.fullName} Editado`,
        notes: 'Cliente actualizado por prueba automatica.',
        tags: [TEST_TAG],
      },
    });

    updatedCustomer = data.customer;
    assert(data?.ok === true, 'La actualizacion no trae ok=true');
    assert(updatedCustomer.fullName.includes('Editado'), 'No actualizo el nombre');
    assert(updatedCustomer.notes.includes('actualizado'), 'No actualizo notas');
  });

  await runStep('Filtros de clientes por origen y segmento', async () => {
    const bySource = await api('/api/admin/customers?source=admin&status=active&page=1&limit=20');
    assert(bySource?.ok === true, 'Filtro por source no trae ok=true');
    assert(Array.isArray(bySource.customers), 'Filtro por source no devuelve arreglo');

    const withEmail = await api('/api/admin/customers?segment=with-email&status=active&page=1&limit=20');
    assert(withEmail?.ok === true, 'Filtro with-email no trae ok=true');
    assert(Array.isArray(withEmail.customers), 'Filtro with-email no devuelve arreglo');
  });

  await runStep('POST /api/admin/customer-follow-ups crea seguimiento', async () => {
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
    state.createdFollowUpIds.push(followUp.id);

    assert(data?.ok === true, 'Crear seguimiento no trae ok=true');
    assert(followUp?.id, 'No devolvio id de seguimiento');
    assert(followUp.status === 'pending', 'El seguimiento no quedo pendiente');
  });

  await runStep('GET /api/admin/customer-follow-ups lista seguimiento', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}?status=all&limit=20`);
    assert(data?.ok === true, 'Listar seguimiento no trae ok=true');
    assert(Array.isArray(data.followUps), 'followUps no es arreglo');
    assert(data.followUps.some((item) => item.id === followUp.id), 'El seguimiento creado no aparece listado');
  });

  await runStep('PUT /api/admin/customer-follow-ups marca realizado', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}/${followUp.id}`, {
      method: 'PUT',
      body: {
        ...followUp,
        status: 'done',
      },
    });

    assert(data?.ok === true, 'Actualizar seguimiento no trae ok=true');
    assert(data.followUp?.status === 'done', 'El seguimiento no quedo realizado');
  });

  await runStep('DELETE /api/admin/customer-follow-ups elimina seguimiento', async () => {
    const data = await api(`/api/admin/customer-follow-ups/${createdCustomer.id}/${followUp.id}`, {
      method: 'DELETE',
    });

    assert(data?.ok === true, 'Eliminar seguimiento no trae ok=true');
  });

  await runStep('Validacion de nombre obligatorio', async () => {
    try {
      await api('/api/admin/customers', {
        method: 'POST',
        body: {
          ...baseCustomerPayload,
          fullName: '',
          displayName: '',
          phone: `301${String(Date.now()).slice(-7)}`,
          email: `sin.nombre.${RUN_ID.toLowerCase()}@example.com`,
          documentNumber: `88${String(Date.now()).slice(-8)}`,
          tags: [TEST_TAG],
        },
      });

      throw new Error('El backend permitio crear cliente sin nombre');
    } catch (error) {
      if (error.message === 'El backend permitio crear cliente sin nombre') throw error;
      assert([400, 422, 500].includes(Number(error.status)), `Estado inesperado: ${error.status}`);
    }
  });

  await runStep('Prueba de politica de duplicados', async () => {
    let duplicateCreated = null;

    try {
      const data = await api('/api/admin/customers', {
        method: 'POST',
        body: {
          ...baseCustomerPayload,
          fullName: `${baseCustomerPayload.fullName} Duplicado`,
          displayName: `${baseCustomerPayload.fullName} Duplicado`,
          tags: [TEST_TAG],
        },
      });

      duplicateCreated = data.customer;
      if (duplicateCreated?.id) state.createdCustomerIds.push(duplicateCreated.id);
    } catch (error) {
      if ([400, 409, 422].includes(Number(error.status))) {
        pass('El backend bloqueo duplicado de documento/celular/correo.');
        return;
      }
      throw error;
    }

    if (duplicateCreated?.id) {
      const message = 'El backend permitio crear un cliente duplicado con mismo documento/celular/correo.';
      if (STRICT_DUPLICATES) throw new Error(message);
      warn(`${message} Pendiente definir si se bloquea o se muestra advertencia.`);
    }
  });

  const duplicates = await auditDuplicates();
  printDuplicateReport(duplicates);

  await cleanupTestData();

  printTitle('Resultado final');
  console.log(`OK: ${state.passed}`);
  console.log(`WARN: ${state.warnings}`);
  console.log(`FAIL: ${state.failed}`);

  if (state.failed > 0) {
    process.exitCode = 1;
  }

  if (STRICT_DUPLICATES && state.warnings > 0) {
    process.exitCode = 1;
  }
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
