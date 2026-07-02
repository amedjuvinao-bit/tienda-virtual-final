// backend/scripts/testAdminUsersBranchesFlow.js

const BASE_URL = process.env.ADMIN_USERS_BRANCH_TEST_BASE_URL || 'http://localhost:5000';

function cleanToken(value) {
  return String(value || '')
    .trim()
    .replace(/^Bearer\s+/i, '')
    .replace(/^"|"$/g, '')
    .replace(/^'|'$/g, '')
    .trim();
}

const TOKEN = cleanToken(
  process.env.ADMIN_USERS_BRANCH_TEST_TOKEN ||
    process.env.ADMIN_BRANCH_TEST_TOKEN ||
    process.env.ADMIN_GATE_TEST_TOKEN ||
    process.argv[2]
);

const REQUEST_DELAY_MS = Number(process.env.ADMIN_USERS_BRANCH_TEST_DELAY_MS || 350);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertToken() {
  if (!TOKEN) {
    console.error('');
    console.error('❌ Falta token admin.');
    console.error('');
    console.error('Primero define el token:');
    console.error('');
    console.error('set ADMIN_USERS_BRANCH_TEST_TOKEN=TU_TOKEN');
    console.error('node scripts/testAdminUsersBranchesFlow.js');
    console.error('');
    process.exit(1);
  }
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || '').split('.')[1];

    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');

    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getCurrentAdminIdFromToken() {
  const payload = decodeJwtPayload(TOKEN);

  return payload?.adminUserId || payload?.id || '';
}

function buildUniqueCode() {
  return Date.now().toString(36).toLowerCase();
}

function getUserId(user) {
  return user?._id || user?.id || '';
}

function getBranchId(branch) {
  return branch?._id || branch?.id || '';
}

function getRoleCode(role) {
  return String(role?.code || role?.role || '').trim().toLowerCase();
}

function getResponseData(response) {
  return response?.data || response?.user || response?.item || response;
}

function getUsersFromResponse(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.users)) return response.users;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.data?.users)) return response.data.users;
  if (Array.isArray(response?.data?.items)) return response.data.items;

  return [];
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

async function getMeta() {
  const response = await request('GET', '/api/admin/users/meta', null, [200]);
  return response.data?.data || response.data || {};
}

async function listUsers() {
  const response = await request(
    'GET',
    '/api/admin/users?page=1&limit=100&sort=-createdAt',
    null,
    [200]
  );

  return getUsersFromResponse(response.data);
}

async function getUser(userId, expectedStatuses = [200]) {
  return request('GET', `/api/admin/users/${userId}`, null, expectedStatuses);
}

async function createUser(payload) {
  const response = await request('POST', '/api/admin/users', payload, [201]);
  return getResponseData(response.data);
}

async function updateUser(userId, payload) {
  const response = await request('PUT', `/api/admin/users/${userId}`, payload, [200]);
  return getResponseData(response.data);
}

async function updatePassword(userId, payload) {
  const response = await request(
    'PATCH',
    `/api/admin/users/${userId}/password`,
    payload,
    [200]
  );

  return getResponseData(response.data);
}

async function updateStatus(userId, payload, expectedStatuses = [200]) {
  const response = await request(
    'PATCH',
    `/api/admin/users/${userId}/status`,
    payload,
    expectedStatuses
  );

  return getResponseData(response.data);
}

async function deleteUser(userId, expectedStatuses = [200]) {
  return request('DELETE', `/api/admin/users/${userId}`, null, expectedStatuses);
}

function findTestRole(roles = []) {
  return (
    roles.find((role) => getRoleCode(role) === 'cashier') ||
    roles.find((role) => getRoleCode(role) === 'seller') ||
    roles.find((role) => getRoleCode(role) === 'manager') ||
    roles.find((role) => getRoleCode(role) !== 'owner') ||
    roles[0]
  );
}

function findSecondBranch(branches = [], firstBranchId = '') {
  return (
    branches.find((branch) => String(getBranchId(branch)) !== String(firstBranchId)) ||
    branches[0]
  );
}

function buildUserPayload({ username, email, roleCode, branchId, password, status = 'active' }) {
  return {
    firstName: 'Usuario',
    lastName: 'QA',
    displayName: `Usuario QA ${username}`,
    username,
    email,
    phone: '3000000000',
    documentType: 'CC',
    documentNumber: `QA-${buildUniqueCode()}`,
    password,
    role: roleCode,
    status,
    active: status === 'active',
    mustChangePassword: true,
    defaultBranch: branchId,
    branches: [
      {
        branch: branchId,
        isDefault: true,
        canSell: true,
        canManageInventory: ['owner', 'admin', 'manager', 'warehouse'].includes(roleCode),
        canInvoice: ['owner', 'admin', 'manager', 'billing'].includes(roleCode),
      },
    ],
    notes: 'Usuario temporal creado por prueba automática. Debe eliminarse al finalizar.',
  };
}

function extractDefaultBranchId(user) {
  const defaultBranch = user?.defaultBranch;

  if (typeof defaultBranch === 'object' && defaultBranch !== null) {
    return defaultBranch._id || defaultBranch.id || '';
  }

  if (defaultBranch) return String(defaultBranch);

  const assignedBranches = Array.isArray(user?.branches) ? user.branches : [];
  const selected = assignedBranches.find((item) => item.isDefault) || assignedBranches[0];

  const branchValue = selected?.branch;

  if (typeof branchValue === 'object' && branchValue !== null) {
    return branchValue._id || branchValue.id || '';
  }

  return branchValue ? String(branchValue) : '';
}

function assertUserBranch(user, expectedBranchId, contextLabel) {
  const assignedBranches = Array.isArray(user?.branches) ? user.branches : [];
  const defaultBranchId = extractDefaultBranchId(user);

  const hasAssignedBranch = assignedBranches.some((item) => {
    const branchValue = item?.branch;

    if (typeof branchValue === 'object' && branchValue !== null) {
      return String(branchValue._id || branchValue.id || '') === String(expectedBranchId);
    }

    return String(branchValue || '') === String(expectedBranchId);
  });

  if (!hasAssignedBranch) {
    throw new Error(`${contextLabel}: el usuario no quedó asignado a la sede esperada.`);
  }

  if (String(defaultBranchId) !== String(expectedBranchId)) {
    throw new Error(`${contextLabel}: defaultBranch no coincide con la sede esperada.`);
  }
}

async function safeCleanup(testUserId) {
  if (!testUserId) return;

  try {
    console.log('🧹 Eliminando usuario temporal...');
    await deleteUser(testUserId, [200, 404]);
  } catch (error) {
    console.warn('⚠️ No se pudo eliminar el usuario temporal:', error.message);
  }
}

async function main() {
  assertToken();

  console.log('');
  console.log('🧪 Test automático de Usuarios administrativos ↔ Sedes');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  let testUserId = '';

  try {
    console.log('1️⃣ Consultando metadata de usuarios...');
    const meta = await getMeta();

    const roles = Array.isArray(meta.roles) ? meta.roles : [];
    const branches = Array.isArray(meta.branches) ? meta.branches : [];

    if (!roles.length) {
      throw new Error('No hay perfiles administrativos activos disponibles.');
    }

    if (!branches.length) {
      throw new Error('No hay sedes activas disponibles.');
    }

    const role = findTestRole(roles);
    const roleCode = getRoleCode(role);

    if (!roleCode) {
      throw new Error('No se pudo determinar un perfil válido para la prueba.');
    }

    const firstBranch = branches.find((branch) => branch.isMain) || branches[0];
    const firstBranchId = getBranchId(firstBranch);

    if (!firstBranchId) {
      throw new Error('No se pudo determinar una sede inicial válida.');
    }

    const secondBranch = findSecondBranch(branches, firstBranchId);
    const secondBranchId = getBranchId(secondBranch);

    console.log(`✅ Roles cargados: ${roles.length}`);
    console.log(`✅ Sedes cargadas: ${branches.length}`);
    console.log(`✅ Perfil de prueba: ${role?.name || roleCode} (${roleCode})`);
    console.log(`✅ Sede inicial: ${firstBranch?.name || firstBranchId}`);

    const unique = buildUniqueCode();
    const username = `qauser${unique}`.slice(0, 38);
    const email = `${username}@test.local`;
    const password = `Qa-${unique}-2026!`;

    console.log('');
    console.log('2️⃣ Creando usuario temporal asignado a una sede...');
    const createdUser = await createUser(
      buildUserPayload({
        username,
        email,
        roleCode,
        branchId: firstBranchId,
        password,
      })
    );

    testUserId = getUserId(createdUser);

    if (!testUserId) {
      throw new Error('El usuario fue creado, pero no se recibió ID.');
    }

    assertUserBranch(createdUser, firstBranchId, 'Creación');

    console.log(`✅ Usuario creado: ${createdUser.username} (${testUserId})`);
    console.log('✅ Usuario quedó asignado a su sede inicial.');

    console.log('');
    console.log('3️⃣ Consultando detalle del usuario creado...');
    const detailResponse = await getUser(testUserId, [200]);
    const detailedUser = getResponseData(detailResponse.data);

    assertUserBranch(detailedUser, firstBranchId, 'Detalle');

    console.log('✅ Detalle consultado correctamente.');
    console.log('✅ La sede asignada se conserva en el detalle.');

    console.log('');
    console.log('4️⃣ Editando usuario y cambiando sede asignada...');
    const targetBranchId = secondBranchId || firstBranchId;

    const updatedUser = await updateUser(
      testUserId,
      buildUserPayload({
        username,
        email,
        roleCode,
        branchId: targetBranchId,
        password,
        status: 'active',
      })
    );

    assertUserBranch(updatedUser, targetBranchId, 'Actualización');

    console.log(
      `✅ Usuario actualizado. Sede actual: ${
        secondBranch?.name || firstBranch?.name || targetBranchId
      }`
    );

    console.log('');
    console.log('5️⃣ Cambiando contraseña del usuario temporal...');
    await updatePassword(testUserId, {
      password: `Qa-${unique}-Nueva-2026!`,
      newPassword: `Qa-${unique}-Nueva-2026!`,
      mustChangePassword: true,
    });

    console.log('✅ Contraseña actualizada correctamente.');

    console.log('');
    console.log('6️⃣ Desactivando usuario temporal...');
    const inactiveUser = await updateStatus(testUserId, {
      status: 'inactive',
      active: false,
    });

    if (inactiveUser?.status !== 'inactive' || inactiveUser?.active !== false) {
      throw new Error('El usuario no quedó inactivo después del cambio de estado.');
    }

    console.log('✅ Usuario desactivado correctamente.');

    console.log('');
    console.log('7️⃣ Reactivando usuario temporal...');
    const activeUser = await updateStatus(testUserId, {
      status: 'active',
      active: true,
    });

    if (activeUser?.status !== 'active' || activeUser?.active !== true) {
      throw new Error('El usuario no quedó activo después de reactivarlo.');
    }

    console.log('✅ Usuario reactivado correctamente.');

    console.log('');
    console.log('8️⃣ Probando protección contra eliminar el usuario autenticado...');
    const currentAdminId = getCurrentAdminIdFromToken();

    if (currentAdminId) {
      const selfDeleteResponse = await deleteUser(currentAdminId, [400, 403]);

      console.log(
        `✅ Protección correcta. Respuesta esperada: ${
          selfDeleteResponse.data?.message ||
          'No se permite eliminar o modificar indebidamente el usuario autenticado.'
        }`
      );
    } else {
      console.log('⚠️ No se pudo leer adminUserId del token. Se omite esta validación.');
    }

    console.log('');
    console.log('9️⃣ Eliminando usuario temporal...');
    await deleteUser(testUserId, [200]);
    console.log('✅ Usuario temporal eliminado.');

    console.log('');
    console.log('🔎 Verificando que el usuario temporal ya no exista...');
    await getUser(testUserId, [404]);
    console.log('✅ Verificación correcta: usuario temporal no encontrado.');

    console.log('');
    console.log('===============================================');
    console.log('✅ TEST USUARIOS ↔ SEDES APROBADO');
    console.log('===============================================');
    console.log('');
    console.log('Validado:');
    console.log('- Metadata de usuarios');
    console.log('- Carga de roles');
    console.log('- Carga de sedes');
    console.log('- Creación de usuario con sede asignada');
    console.log('- Consulta de detalle con sede');
    console.log('- Cambio de sede asignada');
    console.log('- Cambio de contraseña');
    console.log('- Desactivación de usuario');
    console.log('- Reactivación de usuario');
    console.log('- Protección contra eliminar usuario autenticado');
    console.log('- Eliminación limpia del usuario temporal');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('===============================================');
    console.error('❌ TEST USUARIOS ↔ SEDES FALLÓ');
    console.error('===============================================');
    console.error(error.message);
    console.error('');

    await safeCleanup(testUserId);

    process.exit(1);
  }
}

main();