// frontend/src/admin/security/adminPermissions.js

const PRIVILEGED_ROLES = new Set(['owner', 'admin']);

export const ADMIN_ROUTE_PERMISSIONS = {
  dashboard: [],

  productos: ['products:view'],
  'productos/nuevo': ['products:create'],
  'productos/editar': ['products:update'],

  inventario: ['inventory:view'],
  carritos: ['carts:view'],
  favoritos: ['favorites:view'],
  ordenes: ['orders:view'],

  apariencia: ['appearance:view'],

  paginas: ['pages:view'],
  'paginas/editor': ['pages:update'],
  catalogo: ['pages:update'],
  'product-detail': ['pages:update'],
  'cart-page': ['pages:update'],
  'checkout-page': ['pages:update'],
  'thanks-page': ['pages:update'],
  'favorites-page': ['pages:update'],
  'notfound-page': ['pages:update'],

  configuracion: ['settings:view'],
  'configuracion/empresa': ['settings:store'],
  'configuracion/sedes': ['branches:view'],
  'configuracion/facturacion': ['settings:billing'],
  'configuracion/pagos': ['settings:payments'],
  'configuracion/envios': ['settings:shipping'],
  'configuracion/correo': ['settings:mail'],
  'configuracion/login-admin': ['settings:login'],
  'configuracion/panel-admin': ['settings:panel'],
  'configuracion/usuarios': ['admin-users:view'],
  'configuracion/perfiles': ['roles:view'],
  'configuracion/logs': ['logs:view'],
};

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePath(pathname) {
  const cleanPath = String(pathname || '')
    .split('?')[0]
    .split('#')[0]
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!cleanPath) return '';

  return cleanPath.startsWith('admin/')
    ? cleanPath.replace(/^admin\//, '')
    : cleanPath;
}

function normalizePermission(permission) {
  return normalizeText(permission).replace(/\s+/g, ':');
}

function normalizeRole(role) {
  return normalizeText(role).replace(/\s+/g, '-');
}

export function getAdminUserRole(user) {
  return (
    normalizeRole(user?.adminRole) ||
    normalizeRole(user?.actualRole) ||
    normalizeRole(user?.role) ||
    normalizeRole(user?.profile?.role)
  );
}

export function isPrivilegedAdmin(user) {
  const role = getAdminUserRole(user);

  return PRIVILEGED_ROLES.has(role);
}

export function getAdminUserPermissions(user) {
  const permissions = new Set();

  if (Array.isArray(user?.permissions)) {
    user.permissions.forEach((permission) => {
      const normalizedPermission = normalizePermission(permission);

      if (normalizedPermission) {
        permissions.add(normalizedPermission);
      }
    });
  }

  if (Array.isArray(user?.roleRef?.permissions)) {
    user.roleRef.permissions.forEach((permission) => {
      const normalizedPermission = normalizePermission(permission);

      if (normalizedPermission) {
        permissions.add(normalizedPermission);
      }
    });
  }

  if (Array.isArray(user?.profile?.permissions)) {
    user.profile.permissions.forEach((permission) => {
      const normalizedPermission = normalizePermission(permission);

      if (normalizedPermission) {
        permissions.add(normalizedPermission);
      }
    });
  }

  return permissions;
}

export function hasAdminPermission(user, permission) {
  if (!permission) return true;

  if (isPrivilegedAdmin(user)) {
    return true;
  }

  const normalizedPermission = normalizePermission(permission);
  const permissions = getAdminUserPermissions(user);

  if (permissions.has(normalizedPermission)) {
    return true;
  }

  const [moduleName] = normalizedPermission.split(':');

  if (moduleName && permissions.has(`${moduleName}:*`)) {
    return true;
  }

  if (permissions.has('*') || permissions.has('*:*')) {
    return true;
  }

  return false;
}

export function hasAnyAdminPermission(user, requiredPermissions = []) {
  if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
    return true;
  }

  if (isPrivilegedAdmin(user)) {
    return true;
  }

  return requiredPermissions.some((permission) =>
    hasAdminPermission(user, permission)
  );
}

export function getRequiredPermissionsForAdminPath(pathname) {
  const path = normalizePath(pathname);

  if (!path) {
    return [];
  }

  if (ADMIN_ROUTE_PERMISSIONS[path]) {
    return ADMIN_ROUTE_PERMISSIONS[path];
  }

  if (path.startsWith('productos/editar/')) {
    return ADMIN_ROUTE_PERMISSIONS['productos/editar'];
  }

  if (path.startsWith('paginas/')) {
    return ADMIN_ROUTE_PERMISSIONS['paginas/editor'];
  }

  if (path.startsWith('catalogo/')) {
    return ADMIN_ROUTE_PERMISSIONS.catalogo;
  }

  if (path.startsWith('product-detail/')) {
    return ADMIN_ROUTE_PERMISSIONS['product-detail'];
  }

  if (path.startsWith('cart-page/')) {
    return ADMIN_ROUTE_PERMISSIONS['cart-page'];
  }

  if (path.startsWith('checkout-page/')) {
    return ADMIN_ROUTE_PERMISSIONS['checkout-page'];
  }

  if (path.startsWith('thanks-page/')) {
    return ADMIN_ROUTE_PERMISSIONS['thanks-page'];
  }

  if (path.startsWith('favorites-page/')) {
    return ADMIN_ROUTE_PERMISSIONS['favorites-page'];
  }

  if (path.startsWith('notfound-page/')) {
    return ADMIN_ROUTE_PERMISSIONS['notfound-page'];
  }

  return [];
}

export function canAccessAdminPath(user, pathname) {
  if (!user) return false;

  if (isPrivilegedAdmin(user)) {
    return true;
  }

  const requiredPermissions = getRequiredPermissionsForAdminPath(pathname);

  return hasAnyAdminPermission(user, requiredPermissions);
}