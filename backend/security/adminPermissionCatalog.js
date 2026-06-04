'use strict';

// backend/security/adminPermissionCatalog.js
// Catálogo canónico de permisos administrativos.
// Fuente oficial para backend, perfiles, frontend y auditoría.
// Regla principal:
// - recurso:accion
// - las acciones compuestas se escriben en snake_case.
// - se mantienen alias para no romper permisos viejos ya usados en el proyecto.

const ADMIN_PERMISSION_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Vista general del panel administrativo.',
    permissions: [
      {
        key: 'dashboard:view',
        label: 'Ver dashboard',
        description: 'Permite ver indicadores generales, accesos rápidos y resumen del panel.',
        audit: false,
        sensitive: false,
      },
    ],
  },

  {
    key: 'products',
    label: 'Productos',
    description: 'Gestión del catálogo de productos de la tienda.',
    permissions: [
      {
        key: 'products:view',
        label: 'Ver productos',
        description: 'Permite ver listado y detalle administrativo de productos.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'products:create',
        label: 'Crear productos',
        description: 'Permite registrar nuevos productos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'products:update',
        label: 'Editar productos',
        description:
          'Permite modificar nombre, precio, imágenes, colores, tallas, categorías, descripción, estado y datos comerciales del producto.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'products:delete',
        label: 'Eliminar productos',
        description: 'Permite eliminar productos y sus imágenes asociadas.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'products:reviews',
        label: 'Moderar reseñas',
        description: 'Permite ver, aprobar, rechazar o eliminar reseñas de productos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'products:export',
        label: 'Exportar productos',
        description: 'Permite descargar reportes o listados del catálogo.',
        audit: true,
        sensitive: false,
      },
    ],
  },

  {
    key: 'inventory',
    label: 'Inventario',
    description: 'Control de existencias, variantes, ajustes, importaciones y traslados.',
    permissions: [
      {
        key: 'inventory:view',
        label: 'Ver inventario',
        description: 'Permite consultar stock general y stock por variante.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'inventory:update',
        label: 'Editar inventario',
        description: 'Permite actualizar cantidades desde formularios administrativos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'inventory:adjust',
        label: 'Ajustar inventario',
        description: 'Permite realizar ajustes manuales de inventario.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'inventory:transfer',
        label: 'Trasladar inventario',
        description: 'Permite mover inventario entre sedes cuando el flujo esté disponible.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'inventory:import',
        label: 'Importar inventario',
        description:
          'Permite cargar inventario de forma masiva desde archivos, si se habilita importación por CSV, Excel u otro formato.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'inventory:export',
        label: 'Exportar inventario',
        description: 'Permite descargar reportes de inventario.',
        audit: true,
        sensitive: false,
      },
    ],
  },

  {
    key: 'orders',
    label: 'Órdenes',
    description: 'Administración de pedidos, estados, notas, correos, documentos y reembolsos.',
    permissions: [
      {
        key: 'orders:view',
        label: 'Ver órdenes',
        description:
          'Permite listar órdenes, abrir detalle, ver cliente, productos, totales, estado, historial y documentos asociados.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'orders:create',
        label: 'Crear órdenes',
        description: 'Permite crear órdenes manuales desde el panel o desde POS.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:update',
        label: 'Editar órdenes',
        description: 'Permite modificar información general de una orden.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:status',
        label: 'Cambiar estado',
        description: 'Permite cambiar el estado operativo de una orden.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:mark_printed',
        label: 'Marcar impresa',
        description: 'Permite marcar o quitar la marca de orden impresa.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:archive',
        label: 'Archivar órdenes',
        description: 'Permite archivar o desarchivar órdenes.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:tags',
        label: 'Editar etiquetas',
        description: 'Permite agregar, quitar o modificar etiquetas internas de una orden.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:customer_data',
        label: 'Editar datos del cliente',
        description: 'Permite modificar datos del cliente o datos de facturación asociados a la orden.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:notes',
        label: 'Gestionar notas',
        description: 'Permite crear, editar, fijar o eliminar notas internas de una orden.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:email',
        label: 'Enviar correos de orden',
        description:
          'Permite reenviar confirmaciones, facturas o comunicaciones relacionadas con una orden.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'orders:refund',
        label: 'Reembolsar órdenes',
        description: 'Permite registrar reembolsos o devoluciones asociadas a una orden.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'orders:delete',
        label: 'Eliminar órdenes',
        description:
          'Permiso reservado para eliminación de órdenes. No debe usarse salvo que exista un flujo formal de superadministrador.',
        audit: true,
        sensitive: true,
        danger: true,
        reserved: true,
      },
      {
        key: 'orders:export',
        label: 'Exportar órdenes',
        description: 'Permite descargar reportes o archivos CSV de órdenes.',
        audit: true,
        sensitive: false,
      },
      {
        key: 'orders:bulk',
        label: 'Acciones masivas',
        description: 'Permite aplicar acciones masivas sobre varias órdenes.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'carts',
    label: 'Carritos',
    description: 'Consulta y gestión administrativa de carritos activos o abandonados.',
    permissions: [
      {
        key: 'carts:view',
        label: 'Ver carritos',
        description: 'Permite consultar carritos guardados por sesión o usuario.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'carts:export',
        label: 'Exportar carritos',
        description: 'Permite descargar reportes de carritos.',
        audit: true,
        sensitive: false,
      },
      {
        key: 'carts:delete',
        label: 'Eliminar carritos',
        description: 'Permite eliminar o vaciar carritos desde administración.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'carts:recover',
        label: 'Recuperar carritos',
        description: 'Permite ejecutar acciones comerciales para recuperación de carritos.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'favorites',
    label: 'Favoritos',
    description: 'Consulta comercial de productos favoritos guardados por clientes o sesiones.',
    permissions: [
      {
        key: 'favorites:view',
        label: 'Ver favoritos',
        description: 'Permite consultar productos favoritos registrados por sesión.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'favorites:export',
        label: 'Exportar favoritos',
        description: 'Permite exportar información de favoritos.',
        audit: true,
        sensitive: false,
      },
      {
        key: 'favorites:delete',
        label: 'Eliminar favoritos',
        description: 'Permite eliminar registros de favoritos desde administración.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'customers',
    label: 'Clientes',
    description: 'Gestión de clientes y datos comerciales.',
    permissions: [
      {
        key: 'customers:view',
        label: 'Ver clientes',
        description: 'Permite consultar información de clientes.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'customers:create',
        label: 'Crear clientes',
        description: 'Permite registrar clientes manualmente.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'customers:update',
        label: 'Editar clientes',
        description: 'Permite actualizar datos de clientes.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'customers:delete',
        label: 'Eliminar clientes',
        description: 'Permite eliminar o desactivar clientes.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'customers:export',
        label: 'Exportar clientes',
        description: 'Permite exportar reportes de clientes.',
        audit: true,
        sensitive: false,
      },
    ],
  },

  {
    key: 'billing',
    label: 'Facturación electrónica',
    description: 'Gestión de factura electrónica, documentos, proveedor DIAN/Factus, XML, PDF y notas crédito.',
    permissions: [
      {
        key: 'billing:view',
        label: 'Ver facturación electrónica',
        description: 'Permite consultar estado de factura electrónica.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'billing:create',
        label: 'Generar factura electrónica',
        description: 'Permite generar o enviar facturas electrónicas.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'billing:retry',
        label: 'Reintentar facturación electrónica',
        description: 'Permite reintentar facturas rechazadas o con error.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'billing:credit_note',
        label: 'Crear nota crédito electrónica',
        description: 'Permite crear notas crédito electrónicas.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'billing:download',
        label: 'Descargar soportes electrónicos',
        description: 'Permite descargar PDF, XML, CUFE y soportes relacionados.',
        audit: true,
        sensitive: false,
      },
      {
        key: 'billing:settings',
        label: 'Configurar proveedor de facturación',
        description:
          'Permite modificar proveedor, ambiente, resolución, credenciales, certificados y parámetros técnicos de facturación electrónica.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'payments',
    label: 'Pagos',
    description: 'Consulta, sincronización y configuración de pagos o pasarelas.',
    permissions: [
      {
        key: 'payments:view',
        label: 'Ver pagos',
        description: 'Permite consultar transacciones y estados de pago.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'payments:sync',
        label: 'Sincronizar pagos',
        description: 'Permite consultar o sincronizar estados con la pasarela.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'payments:refund',
        label: 'Reembolsar pagos',
        description: 'Permite ejecutar o registrar reembolsos desde pasarela.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'payments:settings',
        label: 'Configurar proveedor de pagos',
        description:
          'Permite modificar llaves, ambientes, webhooks y parámetros técnicos de la pasarela de pago.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'pos',
    label: 'POS / ventas manuales',
    description: 'Operación de ventas manuales o punto de venta.',
    permissions: [
      {
        key: 'pos:view',
        label: 'Ver POS',
        description: 'Permite acceder al módulo de ventas manuales.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'pos:create',
        label: 'Crear venta POS',
        description: 'Permite registrar ventas manuales.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'pos:discount',
        label: 'Aplicar descuentos POS',
        description: 'Permite aplicar descuentos en ventas manuales.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'pos:cancel',
        label: 'Cancelar venta POS',
        description: 'Permite cancelar ventas manuales.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'pages',
    label: 'Páginas',
    description: 'Gestión de páginas personalizadas y páginas fijas del sistema.',
    permissions: [
      {
        key: 'pages:view',
        label: 'Ver páginas',
        description: 'Permite consultar páginas creadas y configuraciones.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'pages:create',
        label: 'Crear páginas',
        description: 'Permite crear páginas personalizadas.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'pages:update',
        label: 'Editar páginas',
        description: 'Permite modificar páginas, bloques y configuraciones.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'pages:delete',
        label: 'Eliminar páginas',
        description: 'Permite eliminar páginas personalizadas no protegidas del sistema.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'pages:system',
        label: 'Editar páginas del sistema',
        description: 'Permite modificar páginas críticas como carrito, checkout, gracias, favoritos y not found.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'appearance',
    label: 'Apariencia / diseño',
    description: 'Personalización visual de tienda, home, banner, secciones, header, footer y menús.',
    permissions: [
      {
        key: 'appearance:view',
        label: 'Ver apariencia',
        description: 'Permite consultar configuración visual de la tienda.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'appearance:update',
        label: 'Editar apariencia',
        description: 'Permite modificar tema, colores, banner, header, footer y elementos visuales.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'appearance:sections',
        label: 'Editar secciones',
        description: 'Permite modificar secciones dinámicas del home o páginas visuales.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'appearance:menus',
        label: 'Editar menús',
        description: 'Permite modificar menús del header, footer y redes sociales.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'appearance:admin',
        label: 'Editar apariencia admin',
        description: 'Permite modificar la apariencia del panel administrativo.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'settings',
    label: 'Configuración',
    description: 'Configuraciones generales, tienda, envíos, correo, pagos, login y panel.',
    permissions: [
      {
        key: 'settings:view',
        label: 'Ver configuración',
        description: 'Permite consultar configuración general del sistema.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'settings:store',
        label: 'Editar datos de tienda / empresa',
        description: 'Permite modificar datos generales de la tienda o empresa.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'settings:billing',
        label: 'Editar datos fiscales generales',
        description:
          'Permite modificar datos fiscales generales de la empresa, distintos a la configuración técnica del proveedor de facturación electrónica.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'settings:payments',
        label: 'Editar datos generales de pagos',
        description:
          'Permite modificar ajustes generales de pagos, distintos a las credenciales técnicas del proveedor de pago.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'settings:shipping',
        label: 'Editar configuración de envíos',
        description: 'Permite modificar reglas o parámetros de envío.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'settings:mail',
        label: 'Editar configuración de correo',
        description: 'Permite modificar configuración SMTP y remitentes.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'settings:mail_test',
        label: 'Enviar prueba de correo',
        description: 'Permite enviar correos de prueba desde configuración.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'settings:login',
        label: 'Editar login admin',
        description: 'Permite modificar configuración o apariencia del login administrativo.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'settings:panel',
        label: 'Editar panel admin',
        description: 'Permite modificar configuración del panel administrativo.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'admin-users',
    label: 'Usuarios administrativos',
    description: 'Gestión de usuarios que ingresan al panel administrativo.',
    permissions: [
      {
        key: 'admin-users:view',
        label: 'Ver usuarios admin',
        description: 'Permite listar y consultar usuarios administrativos.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'admin-users:create',
        label: 'Crear usuarios admin',
        description: 'Permite crear usuarios administrativos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'admin-users:update',
        label: 'Editar usuarios admin',
        description: 'Permite modificar datos de usuarios administrativos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'admin-users:disable',
        label: 'Desactivar usuarios admin',
        description: 'Permite desactivar, activar o eliminar lógicamente usuarios administrativos.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'admin-users:password',
        label: 'Resetear contraseña',
        description: 'Permite asignar nueva contraseña a un usuario administrativo.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'admin-users:assign_role',
        label: 'Asignar perfil',
        description: 'Permite cambiar el perfil o rol asignado a un usuario administrativo.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'roles',
    label: 'Perfiles / roles',
    description: 'Gestión de perfiles y asignación de permisos.',
    permissions: [
      {
        key: 'roles:view',
        label: 'Ver perfiles',
        description: 'Permite consultar perfiles administrativos.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'roles:create',
        label: 'Crear perfiles',
        description: 'Permite crear nuevos perfiles administrativos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'roles:update',
        label: 'Editar perfiles',
        description: 'Permite modificar permisos y datos de perfiles administrativos.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'roles:disable',
        label: 'Desactivar perfiles',
        description: 'Permite desactivar o eliminar perfiles administrativos.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'branches',
    label: 'Sedes',
    description: 'Gestión de sedes físicas, online, fiscales y operativas.',
    permissions: [
      {
        key: 'branches:view',
        label: 'Ver sedes',
        description: 'Permite consultar sedes administrativas.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'branches:create',
        label: 'Crear sedes',
        description: 'Permite crear nuevas sedes.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'branches:update',
        label: 'Editar sedes',
        description: 'Permite modificar datos, configuración y marcaciones de sedes.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'branches:disable',
        label: 'Desactivar sedes',
        description: 'Permite desactivar o eliminar sedes.',
        audit: true,
        sensitive: true,
        danger: true,
      },
      {
        key: 'branches:fiscal',
        label: 'Editar datos fiscales de sede',
        description: 'Permite modificar información fiscal propia de la sede.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'reports',
    label: 'Reportes',
    description: 'Reportes administrativos, ventas, inventario, clientes y facturación.',
    permissions: [
      {
        key: 'reports:view',
        label: 'Ver reportes',
        description: 'Permite consultar reportes del sistema.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'reports:export',
        label: 'Exportar reportes',
        description: 'Permite exportar reportes administrativos.',
        audit: true,
        sensitive: false,
      },
    ],
  },

  {
    key: 'media',
    label: 'Archivos / media',
    description: 'Carga y administración de imágenes o archivos usados por productos, páginas y apariencia.',
    permissions: [
      {
        key: 'media:view',
        label: 'Ver archivos',
        description: 'Permite consultar archivos o galería de medios.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'media:upload',
        label: 'Subir archivos',
        description: 'Permite subir imágenes o documentos al sistema.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'media:delete',
        label: 'Eliminar archivos',
        description: 'Permite eliminar archivos o imágenes del sistema.',
        audit: true,
        sensitive: true,
        danger: true,
      },
    ],
  },

  {
    key: 'geo',
    label: 'Geografía',
    description: 'Consulta y mantenimiento de países, departamentos y ciudades.',
    permissions: [
      {
        key: 'geo:view',
        label: 'Ver geografía',
        description: 'Permite consultar datos geográficos administrativos.',
        audit: false,
        sensitive: false,
      },
      {
        key: 'geo:update',
        label: 'Editar geografía',
        description: 'Permite modificar catálogos geográficos cuando exista administración de estos datos.',
        audit: true,
        sensitive: true,
      },
    ],
  },

  {
    key: 'logs',
    label: 'Logs / auditoría',
    description: 'Consulta de logs de seguridad y trazabilidad administrativa.',
    permissions: [
      {
        key: 'logs:view',
        label: 'Ver logs',
        description: 'Permite consultar registros de auditoría y eventos administrativos.',
        audit: true,
        sensitive: true,
      },
      {
        key: 'logs:export',
        label: 'Exportar logs',
        description: 'Permite exportar registros de auditoría.',
        audit: true,
        sensitive: true,
      },
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
    module.permissions.map((permission) => ({
      ...permission,
      key: canonicalPermission(permission.key),
      module: module.key,
      moduleLabel: module.label,
      moduleDescription: module.description,
    }))
  );
}

const ADMIN_PERMISSIONS = flattenPermissions();

const ADMIN_PERMISSION_KEYS = ADMIN_PERMISSIONS.map((permission) => permission.key);

const ADMIN_PERMISSION_SET = new Set(ADMIN_PERMISSION_KEYS);

const ADMIN_PERMISSION_MAP = ADMIN_PERMISSIONS.reduce((acc, permission) => {
  acc[permission.key] = permission;
  return acc;
}, {});

function isKnownPermission(permission) {
  const canonical = canonicalPermission(permission);
  return ADMIN_PERMISSION_SET.has(canonical);
}

function getPermissionMeta(permission) {
  const canonical = canonicalPermission(permission);
  return ADMIN_PERMISSION_MAP[canonical] || null;
}

function getPermissionsByModule(moduleKey) {
  const key = String(moduleKey || '').trim().toLowerCase();
  return ADMIN_PERMISSIONS.filter((permission) => permission.module === key);
}

function getAuditablePermissions() {
  return ADMIN_PERMISSIONS.filter((permission) => permission.audit === true);
}

function getSensitivePermissions() {
  return ADMIN_PERMISSIONS.filter((permission) => permission.sensitive === true);
}

function getDangerPermissions() {
  return ADMIN_PERMISSIONS.filter((permission) => permission.danger === true);
}

function getReservedPermissions() {
  return ADMIN_PERMISSIONS.filter((permission) => permission.reserved === true);
}

function getPublicPermissionCatalog() {
  return ADMIN_PERMISSION_MODULES.map((module) => ({
    key: module.key,
    label: module.label,
    description: module.description,
    permissions: module.permissions.map((permission) => ({
      ...permission,
      key: canonicalPermission(permission.key),
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