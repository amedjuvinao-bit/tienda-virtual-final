// frontend/src/admin/configuracion/roles/rolesHelpers.js

/* ============================================================
 * HELPERS DEL MÓDULO DE PERFILES / ROLES
 * ------------------------------------------------------------
 * Este archivo NO llama al backend.
 * Solo organiza datos, valida formularios y prepara payloads.
 * ============================================================ */

export const ROLE_SCOPE_OPTIONS = [
  {
    value: 'global',
    label: 'Global',
    description: 'Puede operar sobre todo el sistema.',
  },
  {
    value: 'branch',
    label: 'Por sede',
    description: 'Su alcance principal depende de la sede asignada.',
  },
  {
    value: 'own',
    label: 'Propio',
    description: 'Solo puede gestionar información relacionada con su usuario.',
  },
];

export const ROLE_STATUS_OPTIONS = [
  {
    value: 'active',
    label: 'Activo',
  },
  {
    value: 'inactive',
    label: 'Inactivo',
  },
];

export const PERMISSION_MODULE_LABELS = {
  dashboard: 'Panel principal',
  orders: 'Órdenes',
  pos: 'Ventas manuales / POS',
  products: 'Productos',
  inventory: 'Inventario',
  customers: 'Clientes',
  billing: 'Facturación electrónica',
  'admin-users': 'Usuarios administrativos',
  roles: 'Perfiles y permisos',
  branches: 'Sedes',
  settings: 'Configuración',
  reports: 'Reportes',
};

export const PERMISSION_ACTION_LABELS = {
  view: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  disable: 'Activar / desactivar',
  cancel: 'Cancelar',
  refund: 'Reembolsar',
  export: 'Exportar',
  discount: 'Aplicar descuento',
  transfer: 'Transferir',
  adjust: 'Ajustar',
  retry: 'Reintentar',
  'credit-note': 'Nota crédito',
  download: 'Descargar',
};

export const EMPTY_ROLE_FORM = {
  name: '',
  code: '',
  description: '',
  permissions: [],
  scope: 'branch',
  level: '50',
  status: 'active',
  active: true,
  isDefault: false,
  color: '',
  icon: '',
  notes: '',
};

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

export function normalizeRoleCode(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

export function normalizePermission(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ':');
}

export function normalizePermissions(input) {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const permissions = [];

  input.forEach((item) => {
    const permission = normalizePermission(item);

    if (!permission) return;
    if (permission.length < 3) return;
    if (permission.length > 80) return;
    if (seen.has(permission)) return;

    seen.add(permission);
    permissions.push(permission);
  });

  return permissions;
}

export function createEmptyRoleForm() {
  return {
    ...EMPTY_ROLE_FORM,
    permissions: [],
  };
}

export function buildRoleFormFromRole(role) {
  if (!role) {
    return createEmptyRoleForm();
  }

  const status = cleanLower(role.status || 'active');

  return {
    name: cleanText(role.name),
    code: normalizeRoleCode(role.code),
    description: cleanText(role.description),
    permissions: normalizePermissions(role.permissions),
    scope: cleanLower(role.scope || 'branch'),
    level: String(role.level || 50),
    status,
    active: role.active !== false && status === 'active',
    isDefault: role.isDefault === true,
    color: cleanText(role.color),
    icon: cleanText(role.icon),
    notes: cleanText(role.notes),
  };
}

export function validateRoleForm(form = {}) {
  const name = cleanText(form.name);
  const code = normalizeRoleCode(form.code || form.name);
  const level = Number(form.level);
  const scope = cleanLower(form.scope || 'branch');
  const status = cleanLower(form.status || 'active');
  const permissions = normalizePermissions(form.permissions);

  if (!name) {
    return 'El nombre del perfil es obligatorio.';
  }

  if (!code) {
    return 'El código del perfil es obligatorio.';
  }

  if (code.length < 2) {
    return 'El código del perfil debe tener mínimo 2 caracteres.';
  }

  if (!/^[a-z0-9._-]+$/.test(code)) {
    return 'El código solo puede contener letras, números, punto, guion y guion bajo.';
  }

  if (!['global', 'branch', 'own'].includes(scope)) {
    return 'Debes seleccionar un alcance válido.';
  }

  if (!Number.isFinite(level) || level < 1 || level > 100) {
    return 'El nivel del perfil debe estar entre 1 y 100.';
  }

  if (!['active', 'inactive'].includes(status)) {
    return 'Debes seleccionar un estado válido.';
  }

  if (permissions.length === 0) {
    return 'Debes seleccionar al menos un permiso para el perfil.';
  }

  return '';
}

export function buildRolePayload(form = {}) {
  const status = cleanLower(form.status || 'active');
  const active = status === 'active' && form.active !== false;

  return {
    name: cleanText(form.name),
    code: normalizeRoleCode(form.code || form.name),
    description: cleanText(form.description),
    permissions: normalizePermissions(form.permissions),
    scope: cleanLower(form.scope || 'branch'),
    level: Number(form.level || 50),
    status: active ? 'active' : 'inactive',
    active,
    isDefault: form.isDefault === true,
    color: cleanText(form.color),
    icon: cleanText(form.icon),
    notes: cleanText(form.notes),
  };
}

export function getPermissionModule(permission) {
  const cleanPermission = normalizePermission(permission);
  const [moduleName] = cleanPermission.split(':');

  return moduleName || 'otros';
}

export function getPermissionAction(permission) {
  const cleanPermission = normalizePermission(permission);
  const parts = cleanPermission.split(':');

  return parts.slice(1).join(':') || 'usar';
}

export function getPermissionModuleLabel(moduleName) {
  return PERMISSION_MODULE_LABELS[moduleName] || moduleName || 'Otros';
}

export function getPermissionActionLabel(actionName) {
  return PERMISSION_ACTION_LABELS[actionName] || actionName || 'Usar';
}

export function formatPermissionLabel(permission) {
  const moduleName = getPermissionModule(permission);
  const actionName = getPermissionAction(permission);

  return `${getPermissionActionLabel(actionName)} ${getPermissionModuleLabel(
    moduleName
  ).toLowerCase()}`;
}

export function groupPermissionsByModule(permissions = []) {
  const normalizedPermissions = normalizePermissions(permissions);

  return normalizedPermissions.reduce((groups, permission) => {
    const moduleName = getPermissionModule(permission);

    if (!groups[moduleName]) {
      groups[moduleName] = {
        module: moduleName,
        label: getPermissionModuleLabel(moduleName),
        permissions: [],
      };
    }

    groups[moduleName].permissions.push({
      value: permission,
      label: formatPermissionLabel(permission),
      action: getPermissionAction(permission),
      actionLabel: getPermissionActionLabel(getPermissionAction(permission)),
    });

    return groups;
  }, {});
}

export function getPermissionGroupsArray(permissions = []) {
  return Object.values(groupPermissionsByModule(permissions)).sort((a, b) =>
    a.label.localeCompare(b.label, 'es')
  );
}

export function togglePermission(currentPermissions = [], permission) {
  const cleanPermission = normalizePermission(permission);
  const normalizedPermissions = normalizePermissions(currentPermissions);

  if (!cleanPermission) {
    return normalizedPermissions;
  }

  if (normalizedPermissions.includes(cleanPermission)) {
    return normalizedPermissions.filter((item) => item !== cleanPermission);
  }

  return [...normalizedPermissions, cleanPermission];
}

export function togglePermissionGroup(
  currentPermissions = [],
  groupPermissions = []
) {
  const normalizedCurrent = normalizePermissions(currentPermissions);
  const normalizedGroup = normalizePermissions(groupPermissions);

  const allSelected = normalizedGroup.every((permission) =>
    normalizedCurrent.includes(permission)
  );

  if (allSelected) {
    return normalizedCurrent.filter(
      (permission) => !normalizedGroup.includes(permission)
    );
  }

  const merged = [...normalizedCurrent];

  normalizedGroup.forEach((permission) => {
    if (!merged.includes(permission)) {
      merged.push(permission);
    }
  });

  return normalizePermissions(merged);
}

export function isPermissionSelected(currentPermissions = [], permission) {
  const cleanPermission = normalizePermission(permission);

  return normalizePermissions(currentPermissions).includes(cleanPermission);
}

export function isPermissionGroupSelected(
  currentPermissions = [],
  groupPermissions = []
) {
  const normalizedCurrent = normalizePermissions(currentPermissions);
  const normalizedGroup = normalizePermissions(groupPermissions);

  if (normalizedGroup.length === 0) return false;

  return normalizedGroup.every((permission) =>
    normalizedCurrent.includes(permission)
  );
}

export function getRoleScopeLabel(scope) {
  const option = ROLE_SCOPE_OPTIONS.find(
    (item) => item.value === cleanLower(scope)
  );

  return option?.label || scope || 'Sin alcance';
}

export function getRoleStatusLabel(status) {
  const option = ROLE_STATUS_OPTIONS.find(
    (item) => item.value === cleanLower(status)
  );

  return option?.label || status || 'Sin estado';
}

export function getRoleStatusBadge(role) {
  if (!role) {
    return {
      label: 'Sin estado',
      tone: 'neutral',
    };
  }

  if (role.active === false || role.status === 'inactive') {
    return {
      label: 'Inactivo',
      tone: 'danger',
    };
  }

  return {
    label: 'Activo',
    tone: 'success',
  };
}

export function getRoleTypeLabel(role) {
  if (role?.isSystem) {
    return 'Sistema';
  }

  return 'Personalizado';
}

export function canEditRole(role, currentAdminRole = '') {
  if (!role) return false;

  const isOwner = cleanLower(currentAdminRole) === 'owner';

  if (role.code === 'owner' && !isOwner) {
    return false;
  }

  if (role.isSystem && !isOwner) {
    return false;
  }

  return true;
}

export function canDeleteRole(role, currentAdminRole = '') {
  if (!role) return false;

  const isOwner = cleanLower(currentAdminRole) === 'owner';

  if (role.isSystem) {
    return false;
  }

  if (role.code === 'owner' && !isOwner) {
    return false;
  }

  return true;
}

export function canDisableRole(role, currentAdminRole = '') {
  if (!role) return false;

  const isOwner = cleanLower(currentAdminRole) === 'owner';

  if (role.isDefault) {
    return false;
  }

  if (role.code === 'owner' && !isOwner) {
    return false;
  }

  if (role.isSystem && !isOwner) {
    return false;
  }

  return true;
}