// backend/models/AdminRole.js

const mongoose = require('mongoose');

const ROLE_STATUS = ['active', 'inactive'];

const ROLE_SCOPES = [
  'global',
  'branch',
  'own',
];

const DEFAULT_PERMISSIONS = [
  // Panel
  'dashboard:view',

  // Órdenes
  'orders:view',
  'orders:create',
  'orders:update',
  'orders:cancel',
  'orders:refund',
  'orders:export',

  // Ventas manuales / POS
  'pos:view',
  'pos:create',
  'pos:discount',
  'pos:cancel',

  // Productos
  'products:view',
  'products:create',
  'products:update',
  'products:delete',

  // Inventario
  'inventory:view',
  'inventory:update',
  'inventory:transfer',
  'inventory:adjust',

  // Clientes
  'customers:view',
  'customers:create',
  'customers:update',

  // Facturación electrónica
  'billing:view',
  'billing:create',
  'billing:retry',
  'billing:credit-note',
  'billing:download',

  // Usuarios administrativos
  'admin-users:view',
  'admin-users:create',
  'admin-users:update',
  'admin-users:disable',

  // Roles
  'roles:view',
  'roles:create',
  'roles:update',
  'roles:disable',

  // Sedes
  'branches:view',
  'branches:create',
  'branches:update',
  'branches:disable',

  // Configuración
  'settings:view',
  'settings:update',

  // Reportes
  'reports:view',
  'reports:export',
];

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
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ':');
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
      description: 'Gestiona operación general, productos, órdenes, usuarios y reportes.',
      scope: 'global',
      level: 10,
      isSystem: true,
      isDefault: true,
      permissions: DEFAULT_PERMISSIONS.filter(
        (permission) => !['roles:disable'].includes(permission)
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
        'orders:export',
        'pos:view',
        'pos:create',
        'pos:discount',
        'products:view',
        'inventory:view',
        'inventory:update',
        'inventory:transfer',
        'customers:view',
        'customers:create',
        'customers:update',
        'billing:view',
        'billing:create',
        'reports:view',
      ],
    },
    {
      name: 'Cajero',
      code: 'cashier',
      description: 'Registra ventas POS y consulta productos.',
      scope: 'branch',
      level: 50,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',
        'orders:view',
        'pos:view',
        'pos:create',
        'products:view',
        'inventory:view',
        'customers:view',
        'customers:create',
      ],
    },
    {
      name: 'Vendedor',
      code: 'seller',
      description: 'Registra ventas manuales y consulta productos.',
      scope: 'branch',
      level: 55,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',
        'orders:view',
        'orders:create',
        'pos:view',
        'pos:create',
        'products:view',
        'inventory:view',
        'customers:view',
        'customers:create',
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
        'products:view',
        'inventory:view',
        'inventory:update',
        'inventory:transfer',
        'inventory:adjust',
      ],
    },
    {
      name: 'Facturación',
      code: 'billing',
      description: 'Gestiona facturación electrónica y documentos DIAN.',
      scope: 'global',
      level: 65,
      isSystem: true,
      isDefault: false,
      permissions: [
        'dashboard:view',
        'orders:view',
        'billing:view',
        'billing:create',
        'billing:retry',
        'billing:credit-note',
        'billing:download',
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
        'customers:view',
        'billing:view',
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