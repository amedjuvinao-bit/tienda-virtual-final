// backend/scripts/testAdminBranchesFlow.js

const BASE_URL = process.env.ADMIN_BRANCH_TEST_BASE_URL || 'http://localhost:5000';

const TOKEN =
  process.env.ADMIN_BRANCH_TEST_TOKEN ||
  process.env.ADMIN_GATE_TEST_TOKEN ||
  process.argv[2];

const REQUEST_DELAY_MS = Number(process.env.ADMIN_BRANCH_TEST_DELAY_MS || 350);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertToken() {
  if (!TOKEN) {
    console.error('');
    console.error('❌ Falta token admin.');
    console.error('');
    console.error('Usa una de estas opciones:');
    console.error('');
    console.error('set "ADMIN_BRANCH_TEST_TOKEN=TU_TOKEN"');
    console.error('node scripts/testAdminBranchesFlow.js');
    console.error('');
    console.error('O:');
    console.error('');
    console.error('node scripts/testAdminBranchesFlow.js TU_TOKEN');
    console.error('');
    process.exit(1);
  }
}

function getBranchId(branch) {
  return branch?._id || branch?.id || '';
}

function getBranchesFromResponse(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.branches)) return response.branches;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.branches)) return response.data.branches;
  if (Array.isArray(response?.data?.items)) return response.data.items;

  return [];
}

function getPayloadData(response) {
  return response?.data || response?.branch || response?.item || response;
}

function buildUniqueCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  return `QA-${stamp}`.slice(0, 30);
}

async function request(method, path, body = null, expectedStatuses = [200]) {
  await sleep(REQUEST_DELAY_MS);

  const url = `${BASE_URL}${path}`;

  const options = {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };

  if (body !== null && body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!expectedStatuses.includes(response.status)) {
    const message =
      data?.message ||
      data?.error ||
      response.statusText ||
      'Respuesta inesperada';

    throw new Error(
      `${method} ${path} esperaba ${expectedStatuses.join(
        '/'
      )}, recibió ${response.status}. ${message}`
    );
  }

  return {
    status: response.status,
    data,
  };
}

async function listBranches() {
  const response = await request(
    'GET',
    '/api/admin/branches?limit=100&sort=-createdAt',
    null,
    [200]
  );

  return getBranchesFromResponse(response.data);
}

async function getBranch(branchId, expectedStatuses = [200]) {
  return request('GET', `/api/admin/branches/${branchId}`, null, expectedStatuses);
}

async function createBranch(payload) {
  const response = await request('POST', '/api/admin/branches', payload, [201]);
  return getPayloadData(response.data);
}

async function updateBranch(branchId, payload) {
  const response = await request(
    'PUT',
    `/api/admin/branches/${branchId}`,
    payload,
    [200]
  );

  return getPayloadData(response.data);
}

async function markMain(branchId) {
  const response = await request(
    'PATCH',
    `/api/admin/branches/${branchId}/main`,
    null,
    [200]
  );

  return getPayloadData(response.data);
}

async function markOnline(branchId) {
  const response = await request(
    'PATCH',
    `/api/admin/branches/${branchId}/online-default`,
    null,
    [200]
  );

  return getPayloadData(response.data);
}

async function deleteBranch(branchId, expectedStatuses = [200]) {
  return request('DELETE', `/api/admin/branches/${branchId}`, null, expectedStatuses);
}

function findCurrentMainBranch(branches) {
  return branches.find(
    (branch) =>
      branch &&
      branch.isMain === true &&
      branch.active === true &&
      branch.status === 'active'
  );
}

function findCurrentOnlineBranch(branches) {
  return branches.find(
    (branch) =>
      branch &&
      branch.isDefaultForOnlineOrders === true &&
      branch.active === true &&
      branch.status === 'active'
  );
}

async function restorePreviousMarkers(previousMainId, previousOnlineId, testBranchId) {
  if (previousMainId && previousMainId !== testBranchId) {
    console.log('↩️ Restaurando sede principal anterior...');
    await markMain(previousMainId);
  }

  if (previousOnlineId && previousOnlineId !== testBranchId) {
    console.log('↩️ Restaurando sede online anterior...');
    await markOnline(previousOnlineId);
  }
}

async function safeCleanup({ testBranchId, previousMainId, previousOnlineId }) {
  if (!testBranchId) return;

  try {
    await restorePreviousMarkers(previousMainId, previousOnlineId, testBranchId);
  } catch (error) {
    console.warn('⚠️ No se pudo restaurar marcadores durante limpieza:', error.message);
  }

  try {
    console.log('🧹 Eliminando sede temporal...');
    await deleteBranch(testBranchId, [200, 404]);
  } catch (error) {
    console.warn('⚠️ No se pudo eliminar la sede temporal:', error.message);
  }
}

async function main() {
  assertToken();

  console.log('');
  console.log('🧪 Test automático de módulo Sedes');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  let testBranchId = '';
  let previousMainId = '';
  let previousOnlineId = '';

  try {
    console.log('1️⃣ Consultando sedes actuales...');
    const initialBranches = await listBranches();

    const previousMain = findCurrentMainBranch(initialBranches);
    const previousOnline = findCurrentOnlineBranch(initialBranches);

    previousMainId = getBranchId(previousMain);
    previousOnlineId = getBranchId(previousOnline);

    if (!previousMainId || !previousOnlineId) {
      throw new Error(
        'Debe existir una sede principal y una sede online activa antes de correr esta prueba.'
      );
    }

    console.log(`✅ Sede principal actual: ${previousMain?.name || previousMainId}`);
    console.log(`✅ Sede online actual: ${previousOnline?.name || previousOnlineId}`);

    const code = buildUniqueCode();

    const createPayload = {
      name: `Sede QA Automatizada ${code}`,
      code,
      type: 'pickup_point',
      status: 'active',
      active: true,
      isMain: false,
      isDefaultForOnlineOrders: false,
      contact: {
        phone: '3000000000',
        whatsapp: '3000000000',
        email: `qa-${code.toLowerCase()}@test.com`,
      },
      address: {
        country: 'Colombia',
        department: 'Magdalena',
        departmentCode: '47',
        city: 'Ciénaga',
        cityCode: '47189',
        addressLine: 'Dirección temporal de prueba',
        neighborhood: 'Centro',
        postalCode: '',
      },
      fiscal: {
        useCompanyFiscalInfo: true,
        legalName: '',
        nit: '',
        dv: '',
        billingEmail: '',
        dianResolutionPrefix: '',
      },
      settings: {
        allowPosSales: true,
        allowManualOrders: true,
        allowInventoryMovements: true,
        allowElectronicInvoice: true,
        requireCashSessionForPos: true,
        allowNegativeStock: false,
        defaultPaymentMethod: 'cash',
        defaultCustomerName: 'Consumidor final',
      },
      notes: 'Sede temporal creada por prueba automática. Debe eliminarse al finalizar.',
    };

    console.log('');
    console.log('2️⃣ Creando sede temporal...');
    const createdBranch = await createBranch(createPayload);
    testBranchId = getBranchId(createdBranch);

    if (!testBranchId) {
      throw new Error('La sede fue creada, pero no se recibió ID.');
    }

    console.log(`✅ Sede creada: ${createdBranch.name} (${testBranchId})`);

    console.log('');
    console.log('3️⃣ Consultando detalle de sede creada...');
    await getBranch(testBranchId, [200]);
    console.log('✅ Detalle consultado correctamente.');

    console.log('');
    console.log('4️⃣ Editando sede temporal...');
    const updatedPayload = {
      ...createPayload,
      name: `${createPayload.name} Editada`,
      notes: 'Sede temporal editada por prueba automática.',
      address: {
        ...createPayload.address,
        addressLine: 'Dirección temporal editada',
      },
    };

    const updatedBranch = await updateBranch(testBranchId, updatedPayload);

    if (!String(updatedBranch?.name || '').includes('Editada')) {
      throw new Error('La sede no reflejó el cambio de nombre después de editar.');
    }

    console.log('✅ Sede editada correctamente.');

    console.log('');
    console.log('5️⃣ Marcando sede temporal como principal...');
    await markMain(testBranchId);
    const branchesAfterMain = await listBranches();
    const mainAfterTest = findCurrentMainBranch(branchesAfterMain);

    if (getBranchId(mainAfterTest) !== testBranchId) {
      throw new Error('La sede temporal no quedó como principal.');
    }

    console.log('✅ Marcador principal funciona.');

    console.log('');
    console.log('6️⃣ Marcando sede temporal como online...');
    await markOnline(testBranchId);
    const branchesAfterOnline = await listBranches();
    const onlineAfterTest = findCurrentOnlineBranch(branchesAfterOnline);

    if (getBranchId(onlineAfterTest) !== testBranchId) {
      throw new Error('La sede temporal no quedó como online predeterminada.');
    }

    console.log('✅ Marcador online funciona.');

    console.log('');
    console.log('7️⃣ Probando protección: no debe eliminar sede principal/online...');
    const protectedDeleteResult = await deleteBranch(testBranchId, [400]);

    console.log(
      `✅ Protección correcta. Respuesta esperada: ${
        protectedDeleteResult.data?.message || 'No se puede eliminar sede protegida.'
      }`
    );

    console.log('');
    console.log('8️⃣ Restaurando sede principal y online anteriores...');
    await restorePreviousMarkers(previousMainId, previousOnlineId, testBranchId);
    console.log('✅ Marcadores anteriores restaurados.');

    console.log('');
    console.log('9️⃣ Eliminando sede temporal...');
    await deleteBranch(testBranchId, [200]);
    console.log('✅ Sede temporal eliminada.');

    console.log('');
    console.log('🔎 Verificando que la sede temporal ya no exista...');
    await getBranch(testBranchId, [404]);
    console.log('✅ Verificación correcta: sede temporal no encontrada.');

    console.log('');
    console.log('===============================================');
    console.log('✅ TEST DE SEDES APROBADO');
    console.log('===============================================');
    console.log('');
    console.log('Validado:');
    console.log('- Listado de sedes');
    console.log('- Creación de sede');
    console.log('- Consulta de detalle');
    console.log('- Edición de sede');
    console.log('- Marcar como principal');
    console.log('- Marcar como online');
    console.log('- Protección contra eliminación de sede principal/online');
    console.log('- Restauración de marcadores');
    console.log('- Eliminación limpia de sede temporal');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('===============================================');
    console.error('❌ TEST DE SEDES FALLÓ');
    console.error('===============================================');
    console.error(error.message);
    console.error('');

    await safeCleanup({
      testBranchId,
      previousMainId,
      previousOnlineId,
    });

    process.exit(1);
  }
}

main();