// backend/scripts/test-admin-inventory-reservations.js

require('dotenv').config();

const API_BASE = process.env.API_BASE || 'http://localhost:5000';

const ARG_USERNAME = process.argv[2] || '';
const ARG_PASSWORD = process.argv[3] || '';

const ENV_TOKEN =
  process.env.ADMIN_TEST_TOKEN ||
  process.env.ADMIN_TOKEN ||
  '';

const ENV_USERNAME =
  process.env.ADMIN_TEST_USER ||
  '';

const ENV_PASSWORD =
  process.env.ADMIN_TEST_PASSWORD ||
  '';

function isProbablyJwt(value) {
  return String(value || '').startsWith('eyJ');
}

function buildHeaders(token = '') {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function loginAndGetToken() {
  if (ENV_TOKEN) {
    console.log('🔐 Usando token admin desde variable de entorno.');
    return ENV_TOKEN;
  }

  if (isProbablyJwt(ARG_USERNAME) && !ARG_PASSWORD) {
    console.log('🔐 Usando token admin enviado por argumento.');
    return ARG_USERNAME;
  }

  const username = ARG_USERNAME || ENV_USERNAME;
  const password = ARG_PASSWORD || ENV_PASSWORD;

  if (!username || !password) {
    console.log('\n⚠️ No hay token ni credenciales admin.');
    console.log('\nPuedes ejecutar el script de una de estas formas:');
    console.log('\n1) Con usuario y contraseña:');
    console.log('node scripts/test-admin-inventory-reservations.js "USUARIO_ADMIN" "CONTRASEÑA_ADMIN"');
    console.log('\n2) Con token admin:');
    console.log('node scripts/test-admin-inventory-reservations.js "TOKEN_ADMIN"');
    console.log('\n3) Con variables de entorno:');
    console.log('ADMIN_TEST_USER=usuario');
    console.log('ADMIN_TEST_PASSWORD=contraseña');
    console.log('\nNo pegues tus credenciales aquí en el chat.');
    return '';
  }

  console.log('🔐 Iniciando sesión admin...');

  const response = await fetch(`${API_BASE}/api/admin/auth/login`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      username,
      password,
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.token) {
    console.log('\n❌ No se pudo iniciar sesión admin.');
    console.log('STATUS:', response.status);
    console.log(JSON.stringify(data, null, 2));
    return '';
  }

  console.log('✅ Login admin correcto.');
  return data.token;
}

async function requestReservations(token, label, query = '') {
  const url = `${API_BASE}/api/admin/inventory/reservations${query}`;

  console.log('\n==================================================');
  console.log(`🔎 ${label}`);
  console.log(url);
  console.log('==================================================');

  const response = await fetch(url, {
    method: 'GET',
    headers: buildHeaders(token),
  });

  const data = await response.json().catch(() => null);

  console.log('\nSTATUS:', response.status);

  if (!response.ok) {
    console.log('\n❌ RESPUESTA ERROR:');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('\n✅ RESUMEN:');
  console.log(JSON.stringify(data?.summary || {}, null, 2));

  console.log('\n📌 PAGINACIÓN:');
  console.log({
    page: data?.page,
    limit: data?.limit,
    total: data?.total,
    totalPages: data?.totalPages,
  });

  const rows = Array.isArray(data?.data) ? data.data : [];

  console.log('\n📦 PRIMERAS RESERVAS:');
  console.log(
    rows.slice(0, 5).map((reservation) => ({
      reservationCode: reservation.reservationCode,
      orderNumber: reservation.orderNumber,
      status: reservation.status,
      totalQuantity: reservation.totalQuantity,
      expiresAt: reservation.expiresAt,
      confirmedAt: reservation.confirmedAt,
      releasedAt: reservation.releasedAt,
      expiredAt: reservation.expiredAt,
      failedAt: reservation.failedAt,
      releaseReason: reservation.releaseReason,
      items: Array.isArray(reservation.items)
        ? reservation.items.map((item) => ({
            product:
              item.productSnapshot?.title ||
              item.product?.title ||
              'Producto sin nombre',
            sku:
              item.productSnapshot?.sku ||
              item.product?.sku ||
              '—',
            branch:
              item.branchSnapshot?.name ||
              item.branch?.name ||
              'Sede no definida',
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          }))
        : [],
    }))
  );
}

async function main() {
  console.log('🧪 Prueba endpoint reservas de inventario admin');

  const token = await loginAndGetToken();

  if (!token) {
    console.log('\n❌ No se puede continuar sin token admin.');
    process.exit(1);
  }

  await requestReservations(token, 'Todas las reservas', '');
  await requestReservations(token, 'Reservas confirmadas', '?status=confirmed');
  await requestReservations(token, 'Reservas fallidas', '?status=failed');
  await requestReservations(token, 'Reservas pendientes', '?status=pending');
  await requestReservations(token, 'Reservas vencidas pendientes', '?expired=true');

  console.log('\n✅ Prueba finalizada.');
}

main().catch((error) => {
  console.error('\n❌ ERROR EN SCRIPT:', error.message);
  process.exit(1);
});