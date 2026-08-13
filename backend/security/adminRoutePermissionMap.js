'use strict';

// backend/security/adminRoutePermissionMap.js
// Mapa global de rutas administrativas protegidas.
// Este archivo NO autentica y NO bloquea por sí solo.
// Solo define qué permiso exige cada ruta administrativa.
// El middleware global lo usará en el siguiente paso.

const {
  canonicalPermission,
  isKnownPermission,
} = require('./adminPermissionCatalog');

const ADMIN_ROUTE_PERMISSION_RULES = [
  /* =========================================================
   * DASHBOARD / REPORTES
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/dashboard',
    permission: 'dashboard:view',
    description: 'Ver dashboard administrativo.',
  },
  {
    method: 'GET',
    path: '/api/admin/reports',
    permission: 'reports:view',
    description: 'Ver reportes administrativos.',
  },
  {
    method: 'GET',
    path: '/api/admin/reports/export',
    permission: 'reports:export',
    description: 'Exportar reportes administrativos.',
    audit: true,
  },

  /* =========================================================
   * PRODUCTOS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/products/admin/list',
    permission: 'products:view',
    description: 'Listar productos con paginación administrativa.',
  },
  {
    method: 'POST',
    path: '/api/products/admin/bulk/update',
    permission: 'products:update',
    description: 'Actualizar productos seleccionados en bloque.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/products/admin/bulk/archive',
    permission: 'products:delete',
    description: 'Retirar productos seleccionados en bloque.',
    audit: true,
    danger: true,
  },
  {
    method: 'GET',
    path: '/api/products/admin/reviews',
    permission: 'products:reviews',
    description: 'Ver reseñas administrativas de productos.',
  },
  {
    method: 'GET',
    path: '/api/products/admin/taxonomy',
    permission: 'products:view',
    description: 'Ver categorías y colecciones de productos.',
  },
  {
    method: 'POST',
    path: '/api/products/admin/taxonomy',
    permission: 'products:update',
    description: 'Crear categorías o colecciones de productos.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/products/admin/taxonomy/:taxonomyId',
    permission: 'products:update',
    description: 'Editar categorías o colecciones de productos.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/products/admin/taxonomy/:taxonomyId',
    permission: 'products:update',
    description: 'Retirar categorías o colecciones de productos.',
    audit: true,
    danger: true,
  },
  {
    method: 'GET',
    path: '/api/products/admin/:id',
    permission: 'products:view',
    description: 'Ver detalle administrativo de un producto.',
  },
  {
    method: 'PATCH',
    path: '/api/products/:id/reviews/:reviewId',
    permission: 'products:reviews',
    description: 'Moderar reseña de producto.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/products/:id/reviews/:reviewId',
    permission: 'products:reviews',
    description: 'Eliminar reseña de producto.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/products',
    permission: 'products:create',
    description: 'Crear producto.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/products/:id',
    permission: 'products:update',
    description: 'Editar producto.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/products/:id',
    permission: 'products:update',
    description: 'Editar parcialmente producto.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/products/:id',
    permission: 'products:delete',
    description: 'Eliminar producto.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * INVENTARIO POR SEDES
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/inventory/meta',
    permission: 'inventory:view',
    description: 'Ver información base del módulo de inventario por sedes.',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/stock',
    permission: 'inventory:view',
    description: 'Ver stock actual por sede, producto y variante.',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/branches/:branchId/stock',
    permission: 'inventory:view',
    description: 'Ver resumen de stock de una sede.',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/movements',
    permission: 'inventory:view',
    description: 'Ver historial de movimientos de inventario.',
  },
  {
    method: 'GET',
    path: '/api/admin/inventory/movements/:id',
    permission: 'inventory:view',
    description: 'Ver detalle de movimiento de inventario.',
  },
  {
    method: 'POST',
    path: '/api/admin/inventory/movements',
    permission: 'inventory:adjust',
    description: 'Crear movimiento de entrada, salida o ajuste de inventario.',
    audit: true,
  },

  /* =========================================================
   * ÓRDENES
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/orders/admin',
    permission: 'orders:view',
    description: 'Listar órdenes en administración.',
  },
  {
    method: 'GET',
    path: '/api/orders/admin/export',
    permission: 'orders:export',
    description: 'Exportar órdenes.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/orders/admin/export',
    permission: 'orders:export',
    description: 'Exportar órdenes con filtros avanzados.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/orders/admin/bulk',
    permission: 'orders:bulk',
    description: 'Ejecutar acciones masivas sobre órdenes.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/status',
    permission: 'orders:status',
    description: 'Cambiar estado de orden.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/fulfillment/services/:serviceId',
    permission: 'orders:update',
    description: 'Actualizar la programación y estado de una prestación.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/printed',
    permission: 'orders:mark_printed',
    description: 'Marcar o desmarcar orden como impresa.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/archived',
    permission: 'orders:archive',
    description: 'Archivar o desarchivar orden.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/customer-data',
    permission: 'orders:customer_data',
    description: 'Editar datos de cliente o facturación de la orden.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/orders/:id/tags',
    permission: 'orders:tags',
    description: 'Editar etiquetas internas de la orden.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/orders/:id/notes',
    permission: 'orders:view',
    description: 'Ver notas internas de la orden.',
  },
  {
    method: 'POST',
    path: '/api/orders/:id/notes',
    permission: 'orders:notes',
    description: 'Crear nota interna de orden.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/orders/:id/notes/:noteId',
    permission: 'orders:notes',
    description: 'Editar nota interna de orden.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/orders/:id/notes/:noteId',
    permission: 'orders:notes',
    description: 'Eliminar nota interna de orden.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/orders/:id/timeline',
    permission: 'orders:view',
    description: 'Ver historial de la orden.',
  },
  {
    method: 'POST',
    path: '/api/orders/:id/email',
    permission: 'orders:email',
    description: 'Enviar correo relacionado con la orden.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/orders/:id/pdf',
    permission: 'billing:download',
    description: 'Descargar PDF de orden/factura.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/orders/:id/invoice-xml',
    permission: 'billing:download',
    description: 'Descargar XML de factura electrónica.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/orders/:id/refund',
    permission: 'orders:refund',
    description: 'Registrar reembolso o devolución.',
    audit: true,
    danger: true,
  },
  /* =========================================================
   * CARRITOS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/cart/admin/summary',
    permission: 'carts:view',
    description: 'Consultar resumen ejecutivo de carritos.',
  },
  {
    method: 'POST',
    path: '/api/cart/admin/export',
    permission: 'carts:export',
    description: 'Exportar carritos filtrados o seleccionados.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/cart/admin/follow-ups',
    permission: 'carts:recover',
    description: 'Registrar seguimientos comerciales seleccionados.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/cart/admin',
    permission: 'carts:view',
    description: 'Listar carritos administrativos.',
  },
  {
    method: 'PATCH',
    path: '/api/cart/admin/:id/items',
    permission: 'carts:delete',
    description: 'Actualizar articulos de un carrito desde administracion.',
    audit: true,
    danger: true,
  },
  {
    method: 'PUT',
    path: '/api/cart/admin/:id',
    permission: 'carts:delete',
    description: 'Modificar o vaciar un carrito desde administración.',
    audit: true,
    danger: true,
  },
  {
    method: 'GET',
    path: '/api/cart/admin/export',
    permission: 'carts:export',
    description: 'Exportar carritos.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/cart/admin/:id/notes',
    permission: 'carts:recover',
    description: 'Agregar una nota interna a un carrito.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/cart/admin/:id/tags',
    permission: 'carts:recover',
    description: 'Actualizar etiquetas administrativas de un carrito.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/cart/admin/:id/recovery-link',
    permission: 'carts:recover',
    description: 'Generar un enlace seguro de recuperacion de carrito.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/cart/admin/:id/recoveries',
    permission: 'carts:recover',
    description: 'Enviar o registrar una recuperacion de carrito.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/cart/admin/:id',
    permission: 'carts:view',
    description: 'Consultar el detalle administrativo de un carrito.',
  },
  {
    method: 'DELETE',
    path: '/api/cart/admin/:id',
    permission: 'carts:delete',
    description: 'Eliminar carrito desde administración.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * FAVORITOS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/favorites/admin',
    permission: 'favorites:view',
    description: 'Listar favoritos administrativos.',
  },
  {
    method: 'GET',
    path: '/api/favorites/admin/export',
    permission: 'favorites:export',
    description: 'Exportar favoritos.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/favorites/admin/summary',
    permission: 'favorites:view',
    description: 'Consultar indicadores administrativos de favoritos.',
  },
  {
    method: 'GET',
    path: '/api/favorites/admin/:id',
    permission: 'favorites:view',
    description: 'Consultar detalle administrativo de favoritos.',
  },
  {
    method: 'DELETE',
    path: '/api/favorites/admin/:id/items/:itemId',
    permission: 'favorites:delete',
    description: 'Retirar un producto de favoritos desde administración.',
    audit: true,
    danger: true,
  },
  {
    method: 'DELETE',
    path: '/api/favorites/admin/:id',
    permission: 'favorites:delete',
    description: 'Eliminar favoritos desde administración.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * FACTURACIÓN ELECTRÓNICA / DIAN / FACTUS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/billing/summary',
    permission: 'billing:view',
    description: 'Consultar resumen de facturación electrónica.',
  },
  {
    method: 'GET',
    path: '/api/admin/billing/operations/health',
    permission: 'billing:view',
    description: 'Consultar monitoreo operativo de facturación electrónica.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/admin/billing/documents',
    permission: 'billing:view',
    description: 'Listar documentos de facturación electrónica.',
  },
  {
    method: 'GET',
    path: '/api/admin/billing/credit-notes',
    permission: 'billing:view',
    description: 'Listar notas crédito electrónicas.',
  },
  {
    method: 'GET',
    path: '/api/admin/billing/pending-orders',
    permission: 'billing:view',
    description: 'Listar órdenes pendientes por facturar.',
  },
  {
    method: 'POST',
    path: '/api/admin/billing/orders/:orderId/generate',
    permission: 'billing:create',
    description: 'Generar factura electrónica desde una orden.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/admin/billing/settings',
    permission: 'billing:settings',
    description: 'Consultar configuración técnica de facturación.',
  },
  {
    method: 'GET',
    path: '/api/dian-provider-test',
    permission: 'billing:view',
    description: 'Consultar estado de proveedor de facturación electrónica.',
  },
  {
    method: 'POST',
    path: '/api/dian-provider-test',
    permission: 'billing:settings',
    description: 'Probar o configurar proveedor de facturación electrónica.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/dian-provider-test/sync',
    permission: 'billing:settings',
    description: 'Sincronizar configuración de proveedor de facturación.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/dian-provider-test/send',
    permission: 'billing:create',
    description: 'Enviar factura electrónica al proveedor.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/dian-provider-test/retry',
    permission: 'billing:retry',
    description: 'Reintentar facturación electrónica.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/admin/billing/documents/:invoiceId/sync',
    permission: 'billing:retry',
    description: 'Consultar y actualizar el estado de una factura en el proveedor.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/admin/billing/credit-notes/:invoiceId/:noteId/sync',
    permission: 'billing:retry',
    description: 'Consultar y actualizar el estado de una nota crédito en el proveedor.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/payments/admin/delete-factus-invoice/:orderId',
    permission: 'billing:retry',
    description: 'Eliminar en Factus una factura todavía no validada.',
    audit: true,
    danger: true,
  },
  {
    method: 'POST',
    path: '/api/payments/admin/create-credit-note/:orderId',
    permission: 'billing:credit_note',
    description: 'Crear una nota crédito electrónica desde una factura.',
    audit: true,
    danger: true,
  },
  {
    method: 'POST',
    path: '/api/payments/admin/retry-electronic-invoice/:orderId',
    permission: 'billing:retry',
    description: 'Reintentar la emisión de una factura electrónica.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/dian-provider/test-provider',
    permission: 'billing:settings',
    description: 'Validar la configuración del proveedor electrónico.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/dian-provider/numbering-ranges/credit-note',
    permission: 'billing:settings',
    description: 'Crear un rango oficial de notas crédito en Factus.',
    audit: true,
    danger: true,
  },
  {
    method: 'GET',
    path: '/api/dian-provider-test/:id/pdf',
    permission: 'billing:download',
    description: 'Descargar PDF electrónico.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/dian-provider-test/:id/xml',
    permission: 'billing:download',
    description: 'Descargar XML electrónico.',
    audit: true,
  },

  /* =========================================================
   * PAGOS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/payments/admin',
    permission: 'payments:view',
    description: 'Ver pagos administrativos.',
  },
  {
    method: 'POST',
    path: '/api/payments/admin/sync',
    permission: 'payments:sync',
    description: 'Sincronizar pagos.',
    audit: true,
  },
  {
    method: 'POST',
    path: '/api/payments/admin/refund',
    permission: 'payments:refund',
    description: 'Reembolsar pago.',
    audit: true,
    danger: true,
  },
  {
    method: 'PUT',
    path: '/api/payments/admin/settings',
    permission: 'payments:settings',
    description: 'Configurar proveedor de pagos.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * PÁGINAS
   * ======================================================= */
  {
    method: 'POST',
    path: '/api/pages',
    permission: 'pages:create',
    description: 'Crear página.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/pages/:id',
    permission: 'pages:update',
    description: 'Editar página.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/pages/:id',
    permission: 'pages:update',
    description: 'Editar parcialmente página.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/pages/:id',
    permission: 'pages:delete',
    description: 'Eliminar página.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * CONFIGURACIÓN / APARIENCIA / SITE SETTINGS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/site-settings/admin',
    permission: 'settings:view',
    description: 'Consultar configuración administrativa sin exponer secretos.',
  },
  {
    method: 'PUT',
    path: '/api/site-settings',
    permission: 'settings:view',
    description:
      'Ruta global de configuración. El middleware avanzado validará permisos específicos según el payload.',
    audit: true,
    dynamic: true,
  },
  {
    method: 'PATCH',
    path: '/api/site-settings',
    permission: 'settings:view',
    description:
      'Ruta global de configuración parcial. El middleware avanzado validará permisos específicos según el payload.',
    audit: true,
    dynamic: true,
  },

  /* =========================================================
   * CORREO ADMINISTRATIVO
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/mail-settings',
    permission: 'settings:mail',
    description: 'Ver configuración de correo.',
  },
  {
    method: 'PUT',
    path: '/api/admin/mail-settings',
    permission: 'settings:mail',
    description: 'Editar configuración de correo.',
    audit: true,
    danger: true,
  },
  {
    method: 'POST',
    path: '/api/admin/mail-settings/test',
    permission: 'settings:mail_test',
    description: 'Enviar correo de prueba.',
    audit: true,
  },

  /* =========================================================
   * USUARIOS ADMINISTRATIVOS
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/users',
    permission: 'admin-users:view',
    description: 'Listar usuarios administrativos.',
  },
  {
    method: 'GET',
    path: '/api/admin/users/:id',
    permission: 'admin-users:view',
    description: 'Ver usuario administrativo.',
  },
  {
    method: 'POST',
    path: '/api/admin/users',
    permission: 'admin-users:create',
    description: 'Crear usuario administrativo.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/admin/users/:id',
    permission: 'admin-users:update',
    description: 'Editar usuario administrativo.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/users/:id',
    permission: 'admin-users:update',
    description: 'Editar parcialmente usuario administrativo.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/users/:id/password',
    permission: 'admin-users:password',
    description: 'Resetear contraseña de usuario administrativo.',
    audit: true,
    danger: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/users/:id/role',
    permission: 'admin-users:assign_role',
    description: 'Asignar perfil a usuario administrativo.',
    audit: true,
    danger: true,
  },
  {
    method: 'DELETE',
    path: '/api/admin/users/:id',
    permission: 'admin-users:disable',
    description: 'Desactivar o eliminar usuario administrativo.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * PERFILES / ROLES
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/roles',
    permission: 'roles:view',
    description: 'Listar perfiles administrativos.',
  },
  {
    method: 'GET',
    path: '/api/admin/roles/:id',
    permission: 'roles:view',
    description: 'Ver perfil administrativo.',
  },
  {
    method: 'POST',
    path: '/api/admin/roles',
    permission: 'roles:create',
    description: 'Crear perfil administrativo.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/admin/roles/:id',
    permission: 'roles:update',
    description: 'Editar perfil administrativo.',
    audit: true,
    danger: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/roles/:id',
    permission: 'roles:update',
    description: 'Editar parcialmente perfil administrativo.',
    audit: true,
    danger: true,
  },
  {
    method: 'DELETE',
    path: '/api/admin/roles/:id',
    permission: 'roles:disable',
    description: 'Desactivar o eliminar perfil administrativo.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * SEDES
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/branches',
    permission: 'branches:view',
    description: 'Listar sedes.',
  },
  {
    method: 'GET',
    path: '/api/admin/branches/meta',
    permission: 'branches:view',
    description: 'Ver información base de sedes.',
  },
  {
    method: 'GET',
    path: '/api/admin/branches/:id',
    permission: 'branches:view',
    description: 'Ver sede.',
  },
  {
    method: 'POST',
    path: '/api/admin/branches',
    permission: 'branches:create',
    description: 'Crear sede.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/admin/branches/:id',
    permission: 'branches:update',
    description: 'Editar sede.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/branches/:id/main',
    permission: 'branches:update',
    description: 'Marcar sede como principal.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/branches/:id/online-default',
    permission: 'branches:update',
    description: 'Marcar sede como predeterminada para pedidos online.',
    audit: true,
  },
  {
    method: 'PATCH',
    path: '/api/admin/branches/:id/status',
    permission: 'branches:disable',
    description: 'Activar o desactivar sede.',
    audit: true,
    danger: true,
  },
  {
    method: 'DELETE',
    path: '/api/admin/branches/:id',
    permission: 'branches:disable',
    description: 'Eliminar sede.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * MEDIA / UPLOADS
   * ======================================================= */
  {
    method: 'POST',
    path: '/api/uploads',
    permission: 'media:upload',
    description: 'Subir archivo o imagen.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/uploads/:id',
    permission: 'media:delete',
    description: 'Eliminar archivo o imagen.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * GEO ADMINISTRATIVO
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/geo/admin',
    permission: 'geo:view',
    description: 'Ver datos geográficos administrativos.',
  },
  {
    method: 'POST',
    path: '/api/geo/admin',
    permission: 'geo:update',
    description: 'Crear dato geográfico administrativo.',
    audit: true,
  },
  {
    method: 'PUT',
    path: '/api/geo/admin/:id',
    permission: 'geo:update',
    description: 'Editar dato geográfico administrativo.',
    audit: true,
  },
  {
    method: 'DELETE',
    path: '/api/geo/admin/:id',
    permission: 'geo:update',
    description: 'Eliminar dato geográfico administrativo.',
    audit: true,
    danger: true,
  },

  /* =========================================================
   * LOGS / AUDITORÍA
   * ======================================================= */
  {
    method: 'GET',
    path: '/api/admin/audit-logs',
    permission: 'logs:view',
    description: 'Ver logs de auditoría.',
    audit: true,
  },
  {
    method: 'GET',
    path: '/api/admin/audit-logs/export',
    permission: 'logs:export',
    description: 'Exportar logs de auditoría.',
    audit: true,
  },
];

function normalizeMethod(method) {
  return String(method || '').trim().toUpperCase();
}

function normalizePath(pathname) {
  const clean = String(pathname || '')
    .split('?')[0]
    .replace(/\/+$/g, '')
    .trim();

  return clean || '/';
}

function splitPath(pathname) {
  return normalizePath(pathname)
    .split('/')
    .filter(Boolean);
}

function isParamSegment(segment) {
  return String(segment || '').startsWith(':');
}

function isWildcardSegment(segment) {
  return segment === '*';
}

function matchRoutePath(rulePath, requestPath) {
  const ruleSegments = splitPath(rulePath);
  const requestSegments = splitPath(requestPath);

  if (ruleSegments.length !== requestSegments.length) {
    return false;
  }

  for (let index = 0; index < ruleSegments.length; index += 1) {
    const ruleSegment = ruleSegments[index];
    const requestSegment = requestSegments[index];

    if (isWildcardSegment(ruleSegment)) {
      return true;
    }

    if (isParamSegment(ruleSegment)) {
      continue;
    }

    if (ruleSegment !== requestSegment) {
      return false;
    }
  }

  return true;
}

function normalizeRule(rule) {
  const permission = canonicalPermission(rule.permission);

  return {
    ...rule,
    method: normalizeMethod(rule.method),
    path: normalizePath(rule.path),
    permission,
    knownPermission: isKnownPermission(permission),
  };
}

const ADMIN_ROUTE_PERMISSIONS = ADMIN_ROUTE_PERMISSION_RULES.map(normalizeRule);

function findAdminRoutePermission(method, pathname) {
  const requestMethod = normalizeMethod(method);
  const requestPath = normalizePath(pathname);

  return (
    ADMIN_ROUTE_PERMISSIONS.find((rule) => {
      return (
        rule.method === requestMethod &&
        matchRoutePath(rule.path, requestPath)
      );
    }) || null
  );
}

function getRoutesByPermission(permission) {
  const canonical = canonicalPermission(permission);

  return ADMIN_ROUTE_PERMISSIONS.filter((rule) => rule.permission === canonical);
}

function getRoutesByModule(moduleName) {
  const prefix = `${String(moduleName || '').trim().toLowerCase()}:`;

  return ADMIN_ROUTE_PERMISSIONS.filter((rule) =>
    String(rule.permission || '').startsWith(prefix)
  );
}

function getUnknownPermissionRoutes() {
  return ADMIN_ROUTE_PERMISSIONS.filter((rule) => !rule.knownPermission);
}

function getAuditableRoutes() {
  return ADMIN_ROUTE_PERMISSIONS.filter((rule) => rule.audit === true);
}

function getDangerRoutes() {
  return ADMIN_ROUTE_PERMISSIONS.filter((rule) => rule.danger === true);
}

module.exports = {
  ADMIN_ROUTE_PERMISSION_RULES,
  ADMIN_ROUTE_PERMISSIONS,

  normalizeMethod,
  normalizePath,
  matchRoutePath,

  findAdminRoutePermission,
  getRoutesByPermission,
  getRoutesByModule,
  getUnknownPermissionRoutes,
  getAuditableRoutes,
  getDangerRoutes,
};
