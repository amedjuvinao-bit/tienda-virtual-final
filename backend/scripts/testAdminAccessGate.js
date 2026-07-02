// backend/scripts/testAdminAccessGate.js

const {
  ADMIN_ROUTE_PERMISSIONS,
} = require('../security/adminRoutePermissionMap');

const BASE_URL = process.env.ADMIN_GATE_BASE_URL || 'http://localhost:5000';

const TEST_TOKEN = process.env.ADMIN_GATE_TEST_TOKEN || '';

const TOKEN_ALLOWED_PERMISSIONS = String(
  process.env.ADMIN_GATE_TEST_TOKEN_PERMISSIONS || ''
)
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

const SAMPLE_ID = process.env.ADMIN_GATE_SAMPLE_ID || '6a03d9eac4076626f257b69d';

const SAMPLE_PARAMS = {
  id: process.env.ADMIN_GATE_ORDER_ID || SAMPLE_ID,
  orderId: process.env.ADMIN_GATE_ORDER_ID || SAMPLE_ID,
  productId: process.env.ADMIN_GATE_PRODUCT_ID || SAMPLE_ID,
  userId: process.env.ADMIN_GATE_USER_ID || SAMPLE_ID,
  roleId: process.env.ADMIN_GATE_ROLE_ID || SAMPLE_ID,
  branchId: process.env.ADMIN_GATE_BRANCH_ID || SAMPLE_ID,
  reviewId: process.env.ADMIN_GATE_REVIEW_ID || SAMPLE_ID,
  noteId: process.env.ADMIN_GATE_NOTE_ID || SAMPLE_ID,
};

function buildUrl(pattern) {
  let url = pattern;

  for (const [key, value] of Object.entries(SAMPLE_PARAMS)) {
    url = url.replace(new RegExp(`:${key}\\b`, 'g'), value);
  }

  url = url.replace(/:[a-zA-Z0-9_]+/g, SAMPLE_ID);

  return `${BASE_URL}${url}`;
}

function shouldSendBody(method) {
  return !['GET', 'HEAD'].includes(String(method || '').toUpperCase());
}

function getTestBody(rule) {
  const permission = String(rule.permission || '');

  if (permission === 'orders:tags') {
    return { tags: ['test'] };
  }

  if (permission === 'orders:notes') {
    return { text: 'Prueba automática de permisos' };
  }

  if (permission === 'orders:status') {
    return { status: 'pending' };
  }

  if (permission === 'orders:mark_printed') {
    return { printed: true };
  }

  if (permission === 'orders:archive') {
    return { archived: true };
  }

  return {};
}

async function requestRule(rule, token = '') {
  const url = buildUrl(rule.path);

  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const options = {
    method: rule.method,
    headers,
  };

  if (shouldSendBody(rule.method)) {
    options.body = JSON.stringify(getTestBody(rule));
  }

  const response = await fetch(url, options);

  let data = null;

  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  return {
    status: response.status,
    data,
  };
}

function printTitle(title) {
  console.log('\n==================================================');
  console.log(title);
  console.log('==================================================');
}

function printResult({ ok, rule, expected, received, phase }) {
  const icon = ok ? '✅' : '❌';

  console.log(
    `${icon} [${phase}] ${rule.method} ${rule.path} | ${rule.permission} | esperado ${expected}, recibido ${received}`
  );
}

async function testWithoutToken() {
  printTitle('PRUEBA 1: rutas protegidas sin token deben responder 401');

  let passed = 0;
  let failed = 0;

  for (const rule of ADMIN_ROUTE_PERMISSIONS) {
    const result = await requestRule(rule);

    const ok = result.status === 401;

    printResult({
      ok,
      rule,
      expected: 401,
      received: result.status,
      phase: 'SIN TOKEN',
    });

    if (ok) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  return { passed, failed };
}

async function testWithTokenWithoutPermission() {
  printTitle('PRUEBA 2: usuario autenticado sin permiso debe responder 403');

  if (!TEST_TOKEN) {
    console.log(
      '⚠️  No se ejecuta esta prueba porque falta ADMIN_GATE_TEST_TOKEN.'
    );

    return { passed: 0, failed: 0, skipped: ADMIN_ROUTE_PERMISSIONS.length };
  }

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const rule of ADMIN_ROUTE_PERMISSIONS) {
    if (TOKEN_ALLOWED_PERMISSIONS.includes(rule.permission)) {
      console.log(
        `⏭️  [OMITIDA] ${rule.method} ${rule.path} | ${rule.permission} | el usuario sí tiene este permiso`
      );

      skipped += 1;
      continue;
    }

    const result = await requestRule(rule, TEST_TOKEN);

    const ok = result.status === 403;

    printResult({
      ok,
      rule,
      expected: 403,
      received: result.status,
      phase: 'SIN PERMISO',
    });

    if (ok) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  return { passed, failed, skipped };
}

async function main() {
  console.log('🔐 Test automático de adminAccessGate');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Rutas registradas: ${ADMIN_ROUTE_PERMISSIONS.length}`);

  const unknownRoutes = ADMIN_ROUTE_PERMISSIONS.filter(
    (rule) => !rule.knownPermission
  );

  if (unknownRoutes.length > 0) {
    printTitle('ERROR: rutas con permisos inexistentes en el catálogo');

    for (const rule of unknownRoutes) {
      console.log(`❌ ${rule.method} ${rule.path} => ${rule.permission}`);
    }

    process.exitCode = 1;
    return;
  }

  const noTokenResult = await testWithoutToken();
  const noPermissionResult = await testWithTokenWithoutPermission();

  printTitle('RESUMEN');

  console.log('Sin token:');
  console.log(`✅ Correctas: ${noTokenResult.passed}`);
  console.log(`❌ Fallidas: ${noTokenResult.failed}`);

  console.log('\nSin permiso:');
  console.log(`✅ Correctas: ${noPermissionResult.passed}`);
  console.log(`❌ Fallidas: ${noPermissionResult.failed}`);
  console.log(`⏭️  Omitidas: ${noPermissionResult.skipped || 0}`);

  if (noTokenResult.failed > 0 || noPermissionResult.failed > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('\n✅ Todas las pruebas automáticas pasaron.');
}

main().catch((error) => {
  console.error('❌ Error ejecutando pruebas:', error);
  process.exitCode = 1;
});