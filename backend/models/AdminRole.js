// backend/models/AdminRole.js

const mongoose = require('mongoose');

const {
  ADMIN_PERMISSION_KEYS,
  canonicalPermission,
} = require('../security/adminPermissionCatalog');

const ROLE_STATUS = ['active', 'inactive'];

const ROLE_SCOPES = [
  'global',
  'branch',
  'own',
];

const DEFAULT_PERMISSIONS = [...ADMIN_PERMISSION_KEYS];

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeCode(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
}

function normalizePermission(value) {
  return canonicalPermission(value);
}

function normalizePermissions(input) {
  if (!Array.isArray(input)) return [];

  const seen = new Set();
  const permissions = [];

  for (const item of input) {
    const permission = normalizePermission(item);

    if (!permission) continue;
    if (permission.length < 3) continue;
    if (permission.length > 80) continue;
    if (seen.has(permission)) continue;

    seen.add(permission);
    permissions.push(permission);
  }

  return permissions;
}

const AdminRoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 2,
      maxlength: 60,
      match: [
        /^[a-z0-9._-]+$/,
        'El código del rol solo puede contener letras, números, punto, guion y guion bajo.',
      ],
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },

    permissions: {
      type: [String],
      default: [],
      set: normalizePermissions,
    },

    scope: {
      type: String,
      enum: ROLE_SCOPES,
      default: 'branch',
    },

    level: {
      type: Number,
      default: 50,
      min: 1,
      max: 100,
    },

    status: {
      type: String,
      enum: ROLE_STATUS,
      default: 'active',
    },

    active: {
      type: Boolean,
      default: true,
    },

    isSystem: {
      type: Boolean,
      default: false,
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    color: {
      type: String,
      trim: true,
      maxlength: 30,
      default: '',
    },

    icon: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },

    deletedAt: {
      type: Date,
      default: null,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminUser',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ============================
 * Índices
 * ============================ */

AdminRoleSchema.index({ code: 1 }, { unique: true });
AdminRoleSchema.index({ active: 1, status: 1, level: 1 });
AdminRoleSchema.index({ scope: 1 });
AdminRoleSchema.index({ isSystem: 1 });
AdminRoleSchema.index({ isDefault: 1 });
AdminRoleSchema.index({ deletedAt: 1 });

/* ============================
 * Hooks
 * ============================ */

AdminRoleSchema.pre('validate', function (next) {
  try {
    this.name = normalizeText(this.name);
    this.code = normalizeCode(this.code || this.name);
    this.description = normalizeText(this.description);
    this.notes = normalizeText(this.notes);
    this.color = normalizeText(this.color);
    this.icon = normalizeText(this.icon);

    if (this.status !== 'active') {
      this.active = false;
    }

    if (this.active === false && this.status === 'active') {
      this.status = 'inactive';
    }

    this.permissions = normalizePermissions(this.permissions);

    next();
  } catch (error) {
    next(error);
  }
});

/* ============================
 * Métodos
 * ============================ */

AdminRoleSchema.methods.hasPermission = function hasPermission(permission) {
  const cleanPermission = normalizePermission(permission);

  if (!cleanPermission) return false;

  return Array.isArray(this.permissions) && this.permissions.includes(cleanPermission);
};

AdminRoleSchema.methods.addPermission = function addPermission(permission) {
  const cleanPermission = normalizePermission(permission);

  if (!cleanPermission) return this;

  const currentPermissions = normalizePermissions(this.permissions);

  if (!currentPermissions.includes(cleanPermission)) {
    currentPermissions.push(cleanPermission);
  }

  this.permissions = currentPermissions;

  return this;
};

AdminRoleSchema.methods.removePermission = function removePermission(permission) {
  const cleanPermission = normalizePermission(permission);

  if (!cleanPermission) return this;

  this.permissions = normalizePermissions(this.permissions).filter(
    (item) => item !== cleanPermission
  );

  return this;
};

AdminRoleSchema.methods.canManageRole = function canManageRole(targetRole) {
  if (!targetRole) return false;

  const currentLevel = Number(this.level || 50);
  const targetLevel = Number(targetRole.level || 50);

  return currentLevel < targetLevel;
};

AdminRoleSchema.methods.toSafeObject = function toSafeObject() {
  const role = this.toObject({ virtuals: true });

  delete role.__v;

  return role;
};

/* ============================
 * Métodos estáticos
 * ============================ */

AdminRoleSchema.statics.normalizeCode = normalizeCode;
AdminRoleSchema.statics.normalizePermission = normalizePermission;
AdminRoleSchema.statics.normalizePermissions = normalizePermissions;

AdminRoleSchema.statics.getAvailablePermissions = function getAvailablePermissions() {
  return [...DEFAULT_PERMISSIONS];
};

AdminRoleSchema.statics.getDefaultRoles = function getDefaultRoles() {
  return [
    {
      name: 'Propietario',
      code: 'owner',
      description: 'Acceso total al sistema.',
      scope: 'global',
      level: 1,
      isSystem: true,
      isDefault: false,
      permissions: DEFAULT_PERMISSIONS,
    },
    {
      name: 'Administrador',
      code: 'admin',
      description: 'Gestiona operación general, productos, órdenes, usuarios, configuración y reportes.',
      scope: 'global',
      level: 10,
      isSystem: true,
      isDefault: true,
      permissions: DEFAULT_PERMISSIONS.filter(
        (permission) =>
          ![
            'orders:delete',
            'roles:disable',
            'logs:export',
          ].includes(permission)
      ),
    },
    {
      name: 'Encargado de sede',
      code: 'manager',
      description: 'Gestiona ventas, inventario y operación de una sede.',
      scope: 'branch',
      level: 30,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'orders:create',
        'orders:update',
        'orders:status',
        'orders:mark_printed',
        'orders:archive',
        'orders:tags',
        'orders:customer_data',
        'orders:notes',
        'orders:email',
        'orders:export',

        'pos:view',
        'pos:create',
        'pos:discount',
        'pos:cancel',

        'products:view',

        'inventory:view',
        'inventory:update',
        'inventory:transfer',
        'inventory:adjust',
        'inventory:export',

        'carts:view',
        'favorites:view',

        'customers:view',
        'customers:create',
        'customers:update',

        'billing:view',
        'billing:create',
        'billing:download',

        'payments:view',

        'branches:view',

        'reports:view',
        'reports:export',
      ],
    },
    {
      name: 'Cajero',
      code: 'cashier',
      description: 'Registra ventas POS, consulta productos y gestiona operación básica de órdenes.',
      scope: 'branch',
      level: 50,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'orders:create',
        'orders:status',
        'orders:mark_printed',
        'orders:notes',

        'pos:view',
        'pos:create',
        'pos:discount',

        'products:view',

        'inventory:view',

        'customers:view',
        'customers:create',

        'billing:view',
        'billing:download',

        'payments:view',
      ],
    },
    {
      name: 'Vendedor',
      code: 'seller',
      description: 'Registra ventas manuales, consulta productos y atiende clientes.',
      scope: 'branch',
      level: 55,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'orders:create',
        'orders:notes',
        'orders:email',

        'pos:view',
        'pos:create',

        'products:view',

        'inventory:view',

        'carts:view',
        'favorites:view',

        'customers:view',
        'customers:create',
        'customers:update',

        'billing:view',
      ],
    },
    {
      name: 'Bodega',
      code: 'warehouse',
      description: 'Gestiona inventario y preparación de pedidos.',
      scope: 'branch',
      level: 60,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'orders:status',
        'orders:mark_printed',
        'orders:notes',

        'products:view',

        'inventory:view',
        'inventory:update',
        'inventory:transfer',
        'inventory:adjust',
        'inventory:import',
        'inventory:export',

        'branches:view',
      ],
    },
    {
      name: 'Facturación',
      code: 'billing',
      description: 'Gestiona facturación electrónica, documentos DIAN/Factus y soportes.',
      scope: 'global',
      level: 65,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'orders:customer_data',
        'orders:email',
        'orders:refund',
        'orders:export',

        'customers:view',

        'billing:view',
        'billing:create',
        'billing:retry',
        'billing:credit_note',
        'billing:download',

        'payments:view',

        'reports:view',
        'reports:export',
      ],
    },
    {
      name: 'Diseñador / contenido',
      code: 'content',
      description: 'Gestiona páginas, apariencia, secciones, menús y archivos visuales.',
      scope: 'global',
      level: 70,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'products:view',

        'pages:view',
        'pages:create',
        'pages:update',
        'pages:delete',
        'pages:system',

        'appearance:view',
        'appearance:update',
        'appearance:sections',
        'appearance:menus',

        'media:view',
        'media:upload',
        'media:delete',
      ],
    },
    {
      name: 'Configuración técnica',
      code: 'settings-manager',
      description: 'Gestiona configuración general, correo, pagos, panel y parámetros técnicos.',
      scope: 'global',
      level: 75,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'settings:view',
        'settings:store',
        'settings:billing',
        'settings:payments',
        'settings:shipping',
        'settings:mail',
        'settings:mail_test',
        'settings:login',
        'settings:panel',

        'billing:settings',
        'payments:settings',

        'appearance:view',
        'appearance:admin',

        'branches:view',
        'branches:update',
        'branches:fiscal',

        'geo:view',
        'geo:update',
      ],
    },
    {
      name: 'Auditor',
      code: 'auditor',
      description: 'Consulta información sensible, reportes y registros de auditoría sin modificar datos operativos.',
      scope: 'global',
      level: 80,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'products:view',
        'inventory:view',
        'carts:view',
        'favorites:view',
        'customers:view',
        'billing:view',
        'payments:view',
        'branches:view',
        'reports:view',
        'reports:export',
        'logs:view',
        'logs:export',
      ],
    },
    {
      name: 'Solo lectura',
      code: 'viewer',
      description: 'Consulta información sin modificar datos.',
      scope: 'global',
      level: 90,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',

        'orders:view',
        'products:view',
        'inventory:view',
        'carts:view',
        'favorites:view',
        'customers:view',
        'billing:view',
        'payments:view',
        'pages:view',
        'appearance:view',
        'settings:view',
        'branches:view',
        'reports:view',
      ],
    },
  ];
};

/* ============================
 * Salida limpia
 * ============================ */

AdminRoleSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

AdminRoleSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
});

/* ============================
 * Export
 * ============================ */

module.exports =
  mongoose.models.AdminRole || mongoose.model('AdminRole', AdminRoleSchema);