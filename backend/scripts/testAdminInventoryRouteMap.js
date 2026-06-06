// backend/scripts/testAdminInventoryRouteMap.js

const {
  findAdminRoutePermission,
  getUnknownPermissionRoutes,
} = require('../security/adminRoutePermissionMap');

const TEST_ROUTES = [
  {
    method: 'GET',
    path: '/api/admin/inventory/meta',
    expectedPermission: 'inventory:view',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/stock',
    expectedPermission: 'inventory:view',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/branches/6a1637aebcd698bcc1d5cd80/stock',
    expectedPermission: 'inventory:view',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/movements',
    expectedPermission: 'inventory:view',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/movements/6a234a330e0f5781679fbfe0',
    expectedPermission: 'inventory:view',
  },
  {
    method: 'POST',
    path: '/api/admin/inventory/movements',
    expectedPermission: 'inventory:adjust',
  },
];

function printTitle(title) {
  console.log('\n==================================================');
  console.log(title);
  console.log('==================================================');
}

function main() {
  printTitle('🧪 PRUEBA DE MAPA DE PERMISOS - INVENTARIO ADMIN');

  let hasError = false;

  for (const route of TEST_ROUTES) {
    const rule = findAdminRoutePermission(route.method, route.path);

    if (!rule) {
      hasError = true;

      console.log('❌ Ruta no encontrada en adminRoutePermissionMap');
      console.log(route);
      continue;
    }

    const isCorrectPermission = rule.permission === route.expectedPermission;
    const isKnownPermission = rule.knownPermission === true;

    if (!isCorrectPermission || !isKnownPermission) {
      hasError = true;

      console.log('❌ Ruta encontrada, pero con problema de permiso');
      console.log({
        method: route.method,
        path: route.path,
        expectedPermission: route.expectedPermission,
        foundPermission: rule.permission,
        knownPermission: rule.knownPermission,
        routePattern: rule.path,
      });

      continue;
    }

    console.log('✅ Ruta protegida correctamente');
    console.log({
      method: route.method,
      path: route.path,
      permission: rule.permission,
      routePattern: rule.path,
    });
  }

  printTitle('🔎 REVISANDO PERMISOS DESCONOCIDOS');

  const unknownRoutes = getUnknownPermissionRoutes();

  if (unknownRoutes.length > 0) {
    hasError = true;

    console.log('❌ Hay rutas con permisos que no existen en adminPermissionCatalog');
    console.log(
      unknownRoutes.map((route) => ({
        method: route.method,
        path: route.path,
        permission: route.permission,
      }))
    );
  } else {
    console.log('✅ No hay permisos desconocidos en el mapa de rutas');
  }

  if (hasError) {
    printTitle('❌ PRUEBA FINALIZADA CON ERRORES');
    process.exit(1);
  }

  printTitle('✅ PRUEBA FINALIZADA CORRECTAMENTE');
}

main();