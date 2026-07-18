// backend/scripts/testAdminPosPermissions.js

const {
  canonicalPermission,
  getPermissionsByModule,
  isKnownPermission,
} = require('../security/adminPermissionCatalog');

const REQUIRED_POS_PERMISSIONS = [
  'pos:view',
  'pos:sell',
  'pos:discount',
  'pos:receipt',
];

const EXPECTED_ALIASES = {
  'pos:create': 'pos:sell',
  'pos:sale': 'pos:sell',
  'pos:print': 'pos:receipt',
};

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function main() {
  console.log('🧪 Test permisos administrativos POS');

  const posPermissions = getPermissionsByModule('pos');
  const posKeys = posPermissions.map((permission) => permission.key);

  console.log('Permisos POS encontrados:', posKeys.join(', '));

  REQUIRED_POS_PERMISSIONS.forEach((permission) => {
    assert(
      isKnownPermission(permission),
      `Falta permiso requerido en catálogo: ${permission}`
    );
  });

  Object.entries(EXPECTED_ALIASES).forEach(([alias, expected]) => {
    assert(
      canonicalPermission(alias) === expected,
      `Alias POS inválido: ${alias} debería mapear a ${expected}`
    );
  });

  assert(
    posPermissions.some((permission) => permission.key === 'pos:sell' && permission.audit === true),
    'pos:sell debe ser auditable.'
  );

  assert(
    posPermissions.some((permission) => permission.key === 'pos:discount' && permission.sensitive === true),
    'pos:discount debe ser sensible.'
  );

  assert(
    posPermissions.some((permission) => permission.key === 'pos:receipt'),
    'pos:receipt debe existir para comprobantes POS.'
  );

  console.log('✅ Permisos administrativos POS correctos.');
}

try {
  main();
} catch (error) {
  console.error('❌ Error validando permisos POS:', error.message);
  process.exitCode = 1;
}
