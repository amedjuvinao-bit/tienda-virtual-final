'use strict';

// backend/security/adminPermissionCatalog.js
// Catálogo canónico de permisos administrativos.
// Fuente oficial para backend, perfiles, frontend y auditoría.

function permission(key, label, description, options = {}) {
  return {
    key,
    label,
    description,
    audit: options.audit === true,
    sensitive: options.sensitive === true,
    danger: options.danger === true,
    reserved: options.reserved === true,
  };
}

const ADMIN_PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Vista general del panel administrativo.',
    permissions: [
      permission(
        'dashboard:view',
        'Ver dashboard',
        'Permite ver indicadores generales, accesos rápidos y resumen del panel.'
      ),
    ],
  },

  {
    key: 'products',
    label: 'Productos',
    description: 'Gestión del catálogo de productos de la tienda.',
    permissions: [
      permission('products:view', 'Ver productos', 'Permite ver listado y detalle administrativo de productos.'),
      permission('products:create', 'Crear productos', 'Permite registrar nuevos productos.', { audit: true, sensitive: true }),
      permission('products:update', 'Editar productos', 'Permite modificar datos comerciales, precios, imágenes, variantes y estado del producto.', { audit: true, sensitive: true }),
      permission('products:delete', 'Eliminar productos', 'Permite eliminar productos y sus imágenes asociadas.', { audit: true, sensitive: true, danger: true }),
      permission('products:reviews', 'Moderar reseñas', 'Permite ver, aprobar, rechazar o eliminar reseñas de productos.', { audit: true, sensitive: true }),
      permission('products:export', 'Exportar productos', 'Permite descargar reportes o listados del catálogo.', { audit: true }),
    ],
  },

  {
    key: 'inventory',
    label: 'Inventario',
    description: 'Control de existencias, variantes, ajustes, importaciones y traslados.',
    permissions: [
      permission('inventory:view', 'Ver inventario', 'Permite consultar stock general, stock por sede y stock por variante.'),
      permission('inventory:update', 'Editar inventario', 'Permite actualizar cantidades desde formularios administrativos.', { audit: true, sensitive: true }),
      permission('inventory:adjust', 'Ajustar inventario', 'Permite realizar ajustes manuales de inventario.', { audit: true, sensitive: true }),
      permission('inventory:transfer', 'Trasladar inventario', 'Permite mover inventario entre sedes.', { audit: true, sensitive: true }),
      permission('inventory:import', 'Importar inventario', 'Permite cargar inventario de forma masiva.', { audit: true, sensitive: true }),
      permission('inventory:export', 'Exportar inventario', 'Permite descargar reportes de inventario.', { audit: true }),
    ],
  },

  {
    key: 'orders',
    label: 'Órdenes',
    description: 'Administración de pedidos, estados, notas, correos, documentos y reembolsos.',
    permissions: [
      permission('orders:view', 'Ver órdenes', 'Permite listar órdenes, abrir detalle, ver cliente, productos, totales, estado, historial y documentos asociados.'),
      permission('orders:create', 'Crear órdenes', 'Permite crear órdenes manuales desde el panel o desde POS.', { audit: true, sensitive: true }),
      permission('orders:update', 'Editar órdenes', 'Permite modificar información general de una orden.', { audit: true, sensitive: true }),
      permission('orders:status', 'Cambiar estado', 'Permite cambiar el estado operativo de una orden.', { audit: true, sensitive: true }),
      permission('orders:mark_printed', 'Marcar impresa', 'Permite marcar o quitar la marca de orden impresa.', { audit: true, sensitive: true }),
      permission('orders:archive', 'Archivar órdenes', 'Permite archivar o desarchivar órdenes.', { audit: true, sensitive: true }),
      permission('orders:tags', 'Editar etiquetas', 'Permite agregar, quitar o modificar etiquetas internas de una orden.', { audit: true, sensitive: true }),
      permission('orders:customer_data', 'Editar datos del cliente', 'Permite modificar datos del cliente o datos de facturación asociados a la orden.', { audit: true, sensitive: true }),
      permission('orders:notes', 'Gestionar notas', 'Permite crear, editar, fijar o eliminar notas internas de una orden.', { audit: true, sensitive: true }),
      permission('orders:email', 'Enviar correos de orden', 'Permite reenviar confirmaciones, facturas o comunicaciones relacionadas con una orden.', { audit: true, sensitive: true }),
      permission('orders:refund', 'Reembolsar órdenes', 'Permite registrar reembolsos o devoluciones asociadas a una orden.', { audit: true, sensitive: true, danger: true }),
      permission('orders:delete', 'Eliminar órdenes', 'Permiso reservado para eliminación de órdenes.', { audit: true, sensitive: true, danger: true, reserved: true }),
      permission('orders:export', 'Exportar órdenes', 'Permite descargar reportes o archivos CSV de órdenes.', { audit: true }),
      permission('orders:bulk', 'Acciones masivas', 'Permite aplicar acciones masivas sobre varias órdenes.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'carts',
    label: 'Carritos',
    description: 'Consulta y gestión administrativa de carritos activos o abandonados.',
    permissions: [
      permission('carts:view', 'Ver carritos', 'Permite consultar carritos guardados por sesión o usuario.'),
      permission('carts:export', 'Exportar carritos', 'Permite descargar reportes de carritos.', { audit: true }),
      permission('carts:delete', 'Eliminar carritos', 'Permite eliminar o vaciar carritos desde administración.', { audit: true, sensitive: true, danger: true }),
      permission('carts:recover', 'Recuperar carritos', 'Permite ejecutar acciones comerciales para recuperación de carritos.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'favorites',
    label: 'Favoritos',
    description: 'Consulta comercial de productos favoritos guardados por clientes o sesiones.',
    permissions: [
      permission('favorites:view', 'Ver favoritos', 'Permite consultar productos favoritos registrados por sesión.'),
      permission('favorites:export', 'Exportar favoritos', 'Permite exportar información de favoritos.', { audit: true }),
      permission('favorites:delete', 'Eliminar favoritos', 'Permite eliminar registros de favoritos desde administración.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'customers',
    label: 'Clientes',
    description: 'Gestión de clientes y datos comerciales.',
    permissions: [
      permission('customers:view', 'Ver clientes', 'Permite consultar información de clientes.'),
      permission('customers:create', 'Crear clientes', 'Permite registrar clientes manualmente.', { audit: true, sensitive: true }),
      permission('customers:update', 'Editar clientes', 'Permite actualizar datos de clientes.', { audit: true, sensitive: true }),
      permission('customers:delete', 'Eliminar clientes', 'Permite eliminar o desactivar clientes.', { audit: true, sensitive: true, danger: true }),
      permission('customers:export', 'Exportar clientes', 'Permite exportar reportes de clientes.', { audit: true }),
    ],
  },

  {
    key: 'billing',
    label: 'Facturación electrónica',
    description: 'Gestión de factura electrónica, documentos, proveedor DIAN/Factus, XML, PDF y notas crédito.',
    permissions: [
      permission('billing:view', 'Ver facturación electrónica', 'Permite consultar estado de factura electrónica.'),
      permission('billing:create', 'Generar factura electrónica', 'Permite generar o enviar facturas electrónicas.', { audit: true, sensitive: true }),
      permission('billing:retry', 'Reintentar facturación electrónica', 'Permite reintentar facturas rechazadas o con error.', { audit: true, sensitive: true }),
      permission('billing:credit_note', 'Crear nota crédito electrónica', 'Permite crear notas crédito electrónicas.', { audit: true, sensitive: true, danger: true }),
      permission('billing:download', 'Descargar soportes electrónicos', 'Permite descargar PDF, XML, CUFE y soportes relacionados.', { audit: true }),
      permission('billing:settings', 'Configurar proveedor de facturación', 'Permite modificar proveedor, ambiente, resolución, credenciales y parámetros técnicos de facturación electrónica.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'payments',
    label: 'Pagos',
    description: 'Consulta, sincronización y configuración de pagos o pasarelas.',
    permissions: [
      permission('payments:view', 'Ver pagos', 'Permite consultar transacciones y estados de pago.'),
      permission('payments:sync', 'Sincronizar pagos', 'Permite consultar o sincronizar estados con la pasarela.', { audit: true, sensitive: true }),
      permission('payments:refund', 'Reembolsar pagos', 'Permite ejecutar o registrar reembolsos desde pasarela.', { audit: true, sensitive: true, danger: true }),
      permission('payments:settings', 'Configurar proveedor de pagos', 'Permite modificar llaves, ambientes, webhooks y parámetros técnicos de la pasarela de pago.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'finance',
    label: 'Finanzas',
    description: 'Ingresos, gastos, caja, costos, utilidad y reportes financieros de la tienda.',
    permissions: [
      permission('finance:view', 'Ver finanzas', 'Permite consultar resumen financiero, ventas, caja, costos y utilidad.'),
      permission('finance:expenses', 'Gestionar gastos', 'Permite crear, editar o anular gastos operativos.', { audit: true, sensitive: true }),
      permission('finance:export', 'Exportar finanzas', 'Permite descargar reportes financieros.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'pos',
    label: 'POS / ventas físicas',
    description: 'Operación de ventas físicas desde punto de venta.',
    permissions: [
      permission('pos:view', 'Ver POS', 'Permite acceder al módulo de ventas físicas.', { audit: false }),
      permission('pos:sell', 'Realizar ventas POS', 'Permite registrar ventas físicas desde el punto de venta.', { audit: true, sensitive: true }),
      permission('pos:discount', 'Aplicar descuentos POS', 'Permite aplicar descuentos dentro del límite autorizado.', { audit: true, sensitive: true }),
      permission('pos:discount:approve', 'Aprobar descuentos POS', 'Permite aprobar descuentos superiores al límite del cajero.', { audit: true, sensitive: true, danger: true }),
      permission('pos:receipt', 'Emitir comprobantes POS', 'Permite generar, imprimir o reenviar comprobantes de venta física.', { audit: true }),
      permission('pos:cancel', 'Cancelar venta POS', 'Permite cancelar ventas físicas según reglas administrativas.', { audit: true, sensitive: true, danger: true }),
      permission('pos:refund', 'Devoluciones POS', 'Permite registrar devoluciones o cambios de ventas físicas cuando el flujo esté disponible.', { audit: true, sensitive: true, danger: true }),
      permission('pos:settings', 'Configurar POS', 'Permite modificar parámetros operativos del punto de venta.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'pages',
    label: 'Páginas',
    description: 'Gestión de páginas personalizadas y páginas fijas del sistema.',
    permissions: [
      permission('pages:view', 'Ver páginas', 'Permite consultar páginas creadas y configuraciones.'),
      permission('pages:create', 'Crear páginas', 'Permite crear páginas personalizadas.', { audit: true, sensitive: true }),
      permission('pages:update', 'Editar páginas', 'Permite modificar páginas, bloques y configuraciones.', { audit: true, sensitive: true }),
      permission('pages:delete', 'Eliminar páginas', 'Permite eliminar páginas personalizadas no protegidas del sistema.', { audit: true, sensitive: true, danger: true }),
      permission('pages:system', 'Editar páginas del sistema', 'Permite modificar páginas críticas como carrito, checkout, gracias, favoritos y not found.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'appearance',
    label: 'Apariencia / diseño',
    description: 'Personalización visual de tienda, home, banner, secciones, header, footer y menús.',
    permissions: [
      permission('appearance:view', 'Ver apariencia', 'Permite consultar configuración visual de la tienda.'),
      permission('appearance:update', 'Editar apariencia', 'Permite modificar tema, colores, banner, header, footer y elementos visuales.', { audit: true, sensitive: true }),
      permission('appearance:sections', 'Editar secciones', 'Permite modificar secciones dinámicas del home o páginas visuales.', { audit: true, sensitive: true }),
      permission('appearance:menus', 'Editar menús', 'Permite modificar menús del header, footer y redes sociales.', { audit: true, sensitive: true }),
      permission('appearance:admin', 'Editar apariencia admin', 'Permite modificar la apariencia del panel administrativo.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'settings',
    label: 'Configuración',
    description: 'Configuraciones generales, tienda, envíos, correo, pagos, login y panel.',
    permissions: [
      permission('settings:view', 'Ver configuración', 'Permite consultar configuración general del sistema.'),
      permission('settings:store', 'Editar datos de tienda / empresa', 'Permite modificar datos generales de la tienda o empresa.', { audit: true, sensitive: true }),
      permission('settings:billing', 'Editar datos fiscales generales', 'Permite modificar datos fiscales generales de la empresa.', { audit: true, sensitive: true }),
      permission('settings:payments', 'Editar datos generales de pagos', 'Permite modificar ajustes generales de pagos.', { audit: true, sensitive: true, danger: true }),
      permission('settings:shipping', 'Editar configuración de envíos', 'Permite modificar reglas o parámetros de envío.', { audit: true, sensitive: true }),
      permission('settings:mail', 'Editar configuración de correo', 'Permite modificar configuración SMTP y remitentes.', { audit: true, sensitive: true, danger: true }),
      permission('settings:mail_test', 'Enviar prueba de correo', 'Permite enviar correos de prueba desde configuración.', { audit: true, sensitive: true }),
      permission('settings:login', 'Editar login admin', 'Permite modificar configuración o apariencia del login administrativo.', { audit: true, sensitive: true }),
      permission('settings:panel', 'Editar panel admin', 'Permite modificar configuración del panel administrativo.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'admin-users',
    label: 'Usuarios administrativos',
    description: 'Gestión de usuarios que ingresan al panel administrativo.',
    permissions: [
      permission('admin-users:view', 'Ver usuarios admin', 'Permite listar y consultar usuarios administrativos.'),
      permission('admin-users:create', 'Crear usuarios admin', 'Permite crear usuarios administrativos.', { audit: true, sensitive: true }),
      permission('admin-users:update', 'Editar usuarios admin', 'Permite modificar datos de usuarios administrativos.', { audit: true, sensitive: true }),
      permission('admin-users:disable', 'Desactivar usuarios admin', 'Permite desactivar, activar o eliminar lógicamente usuarios administrativos.', { audit: true, sensitive: true, danger: true }),
      permission('admin-users:password', 'Resetear contraseña', 'Permite asignar nueva contraseña a un usuario administrativo.', { audit: true, sensitive: true, danger: true }),
      permission('admin-users:assign_role', 'Asignar perfil', 'Permite cambiar el perfil o rol asignado a un usuario administrativo.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'roles',
    label: 'Perfiles / roles',
    description: 'Gestión de perfiles y asignación de permisos.',
    permissions: [
      permission('roles:view', 'Ver perfiles', 'Permite consultar perfiles administrativos.'),
      permission('roles:create', 'Crear perfiles', 'Permite crear nuevos perfiles administrativos.', { audit: true, sensitive: true }),
      permission('roles:update', 'Editar perfiles', 'Permite modificar permisos y datos de perfiles administrativos.', { audit: true, sensitive: true, danger: true }),
      permission('roles:disable', 'Desactivar perfiles', 'Permite desactivar o eliminar perfiles administrativos.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'branches',
    label: 'Sedes',
    description: 'Gestión de sedes físicas, online, fiscales y operativas.',
    permissions: [
      permission('branches:view', 'Ver sedes', 'Permite consultar sedes administrativas.'),
      permission('branches:create', 'Crear sedes', 'Permite crear nuevas sedes.', { audit: true, sensitive: true }),
      permission('branches:update', 'Editar sedes', 'Permite modificar datos, configuración y marcaciones de sedes.', { audit: true, sensitive: true }),
      permission('branches:disable', 'Desactivar sedes', 'Permite desactivar o eliminar sedes.', { audit: true, sensitive: true, danger: true }),
      permission('branches:fiscal', 'Editar datos fiscales de sede', 'Permite modificar información fiscal propia de la sede.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'reports',
    label: 'Reportes',
    description: 'Reportes administrativos, ventas, inventario, clientes y facturación.',
    permissions: [
      permission('reports:view', 'Ver reportes', 'Permite consultar reportes del sistema.'),
      permission('reports:export', 'Exportar reportes', 'Permite exportar reportes administrativos.', { audit: true }),
    ],
  },

  {
    key: 'media',
    label: 'Archivos / media',
    description: 'Carga y administración de imágenes o archivos usados por productos, páginas y apariencia.',
    permissions: [
      permission('media:view', 'Ver archivos', 'Permite consultar archivos o galería de medios.'),
      permission('media:upload', 'Subir archivos', 'Permite subir imágenes o documentos al sistema.', { audit: true, sensitive: true }),
      permission('media:delete', 'Eliminar archivos', 'Permite eliminar archivos o imágenes del sistema.', { audit: true, sensitive: true, danger: true }),
    ],
  },

  {
    key: 'geo',
    label: 'Geografía',
    description: 'Consulta y mantenimiento de países, departamentos y ciudades.',
    permissions: [
      permission('geo:view', 'Ver geografía', 'Permite consultar datos geográficos administrativos.'),
      permission('geo:update', 'Editar geografía', 'Permite modificar catálogos geográficos cuando exista administración de estos datos.', { audit: true, sensitive: true }),
    ],
  },

  {
    key: 'logs',
    label: 'Logs / auditoría',
    description: 'Consulta de logs de seguridad y trazabilidad administrativa.',
    permissions: [
      permission('logs:view', 'Ver logs', 'Permite consultar registros de auditoría y eventos administrativos.', { audit: true, sensitive: true }),
      permission('logs:export', 'Exportar logs', 'Permite exportar registros de auditoría.', { audit: true, sensitive: true }),
    ],
  },
];

const ADMIN_PERMISSION_ALIASES = {
  // Alias de nombres antiguos o inconsistentes.
  'users:view': 'admin-users:view',
  'users:create': 'admin-users:create',
  'users:update': 'admin-users:update',
  'users:disable': 'admin-users:disable',

  'settings:branches': 'branches:view',
  'settings:manage': 'settings:view',
  'admin:settings': 'settings:view',

  // Alias de nombres con guion medio que se normalizan a snake_case.
  'orders:mark-printed': 'orders:mark_printed',
  'orders:customer-data': 'orders:customer_data',
  'billing:credit-note': 'billing:credit_note',
  'admin-users:assign-role': 'admin-users:assign_role',
  'settings:mail-test': 'settings:mail_test',
  'mail:test': 'settings:mail_test',

  // Alias POS para compatibilidad con nombres usados antes de formalizar ventas físicas.
  'pos:create': 'pos:sell',
  'pos:sale': 'pos:sell',
  'pos:sales': 'pos:sell',
  'pos:print': 'pos:receipt',
  'pos:ticket': 'pos:receipt',

  // Alias financieros para reportes antiguos.
  'reports:finance': 'finance:view',
  'finance:reports': 'finance:view',
  'finance:gastos': 'finance:expenses',
};

function normalizePermission(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ':');
}

function canonicalPermission(value) {
  const permission = normalizePermission(value);
  return ADMIN_PERMISSION_ALIASES[permission] || permission;
}

function flattenPermissions() {
  return ADMIN_PERMISSION_MODULES.flatMap((module) =>
    module.permissions.map((permissionItem) => ({
      ...permissionItem,
      key: canonicalPermission(permissionItem.key),
      module: module.key,
      moduleLabel: module.label,
      moduleDescription: module.description,
    }))
  );
}

const ADMIN_PERMISSIONS = flattenPermissions();

const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSIONS.map((permissionItem) => permissionItem.key);

const ADMIN_PERMISSION_SET = new Set(ADMIN_PERMISSION_KEYS);

const ADMIN_PERMISSION_MAP = ADMIN_PERMISSIONS.reduce((acc, permissionItem) => {
  acc[permissionItem.key] = permissionItem;
  return acc;
}, {});

function isKnownPermission(permissionValue) {
  const canonical = canonicalPermission(permissionValue);
  return ADMIN_PERMISSION_SET.has(canonical);
}

function getPermissionMeta(permissionValue) {
  const canonical = canonicalPermission(permissionValue);
  return ADMIN_PERMISSION_MAP[canonical] || null;
}

function getPermissionsByModule(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  return ADMIN_PERMISSIONS.filter((permissionItem) => permissionItem.module === key);
}

function getAuditablePermissions() {
  return ADMIN_PERMISSIONS.filter((permissionItem) => permissionItem.audit === true);
}

function getSensitivePermissions() {
  return ADMIN_PERMISSIONS.filter((permissionItem) => permissionItem.sensitive === true);
}

function getDangerPermissions() {
  return ADMIN_PERMISSIONS.filter((permissionItem) => permissionItem.danger === true);
}

function getReservedPermissions() {
  return ADMIN_PERMISSIONS.filter((permissionItem) => permissionItem.reserved === true);
}

function getPublicPermissionCatalog() {
  return ADMIN_PERMISSION_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    description: module.description,
    permissions: module.permissions.map((permissionItem) => ({
      ...permissionItem,
      key: canonicalPermission(permissionItem.key),
    })),
  }));
}

module.exports = {
  ADMIN_PERMISSION_MODULES,
  ADMIN_PERMISSION_ALIASES,

  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_KEYS,
  ADMIN_PERMISSION_SET,
  ADMIN_PERMISSION_MAP,

  normalizePermission,
  canonicalPermission,
  isKnownPermission,
  getPermissionMeta,
  getPermissionsByModule,
  getAuditablePermissions,
  getSensitivePermissions,
  getDangerPermissions,
  getReservedPermissions,
  getPublicPermissionCatalog,
};
