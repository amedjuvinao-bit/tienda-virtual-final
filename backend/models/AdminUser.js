// backend/models/AdminUser.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const PASSWORD_HASH_ROUNDS = Number(process.env.ADMIN_PASSWORD_HASH_ROUNDS || 12);
const PASSWORD_RESET_MINUTES = Number(process.env.ADMIN_PASSWORD_RESET_MINUTES || 30);
const PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES = Number(
  process.env.ADMIN_PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES || 2
);
const PASSWORD_RESET_REQUEST_WINDOW_MINUTES = Number(
  process.env.ADMIN_PASSWORD_RESET_REQUEST_WINDOW_MINUTES || 60
);
const PASSWORD_RESET_REQUEST_MAX_PER_WINDOW = Number(
  process.env.ADMIN_PASSWORD_RESET_REQUEST_MAX_PER_WINDOW || 5
);

const ADMIN_USER_ROLES = [
  'owner',
  'admin',
  'manager',
  'seller',
  'cashier',
  'warehouse',
  'billing',
  'support',
  'viewer',
];

const ADMIN_USER_STATUS = ['active', 'inactive', 'blocked', 'pending'];

const DEFAULT_SECURITY = {
  maxFailedLoginAttempts: 5,
  lockMinutes: 15,
};

function normalizeText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeEmail(value) {
  return normalizeLower(value);
}

function normalizeUsername(value) {
  return normalizeLower(value).replace(/\s+/g, '');
}

function normalizeRoleCode(value) {
  return normalizeLower(value).replace(/\s+/g, '-');
}

function normalizePermission(value) {
  return normalizeLower(value).replace(/\s+/g, ':');
}

function hashPasswordResetToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token || ''))
    .digest('hex');
}

function minutesToMilliseconds(minutes) {
  return Number(minutes || 0) * 60 * 1000;
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

const AssignedBranchSchema = new mongoose.Schema(
  {
    branch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },

    branchName: {
      type: String,
      trim: true,
      default: '',
    },

    branchCode: {
      type: String,
      trim: true,
      uppercase: true,
      default: '',
    },

    isDefault: {
      type: Boolean,
      default: false,
    },

    canSell: {
      type: Boolean,
      default: true,
    },

    canManageInventory: {
      type: Boolean,
      default: false,
    },

    canInvoice: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const AdminUserSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    lastName: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },

    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 40,
      match: [
        /^[a-z0-9._-]+$/,
        'El usuario solo puede contener letras, números, punto, guion y guion bajo.',
      ],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 160,
      default: '',
      match: [
        /^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        'El correo electrónico no tiene un formato válido.',
      ],
    },

    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    documentType: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 20,
      default: '',
    },

    documentNumber: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      default: null,
    },

    mustChangePassword: {
      type: Boolean,
      default: true,
    },

    passwordResetTokenHash: {
      type: String,
      default: '',
      select: false,
    },

    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetUsedAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetLastRequestedAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetRequestWindowStartedAt: {
      type: Date,
      default: null,
      select: false,
    },

    passwordResetRequestCount: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },

    role: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 80,
      default: 'seller',
      set: normalizeRoleCode,
      match: [
        /^[a-z0-9][a-z0-9._-]*$/,
        'El código del perfil solo puede contener letras, números, punto, guion y guion bajo.',
      ],
    },

    roleRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminRole',
      default: null,
    },

    permissions: {
      type: [String],
      default: [],
      set: normalizePermissions,
    },

    branches: {
      type: [AssignedBranchSchema],
      default: [],
    },

    defaultBranch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },

    status: {
      type: String,
      enum: ADMIN_USER_STATUS,
      default: 'active',
    },

    active: {
      type: Boolean,
      default: true,
    },

    emailVerified: {
      type: Boolean,
      default: false,
    },

    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },

    twoFactorSecret: {
      type: String,
      select: false,
      default: '',
    },

    failedLoginAttempts: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },

    lockedUntil: {
      type: Date,
      default: null,
      select: false,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },

    lastLoginIp: {
      type: String,
      trim: true,
      maxlength: 80,
      default: '',
      select: false,
    },

    lastUserAgent: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
      select: false,
    },

    tokenVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
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

AdminUserSchema.index({ username: 1 }, { unique: true });

AdminUserSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: 'string', $gt: '' },
    },
  }
);

AdminUserSchema.index({ active: 1, status: 1, role: 1 });
AdminUserSchema.index({ roleRef: 1 });
AdminUserSchema.index({ createdAt: -1 });
AdminUserSchema.index({ 'branches.branch': 1 });
AdminUserSchema.index({ defaultBranch: 1 });
AdminUserSchema.index({ deletedAt: 1 });

AdminUserSchema.index(
  { passwordResetTokenHash: 1 },
  {
    sparse: true,
    partialFilterExpression: {
      passwordResetTokenHash: { $type: 'string', $gt: '' },
    },
  }
);

AdminUserSchema.index({ passwordResetExpiresAt: 1 });
AdminUserSchema.index({ passwordResetLastRequestedAt: 1 });
AdminUserSchema.index({ passwordResetRequestWindowStartedAt: 1 });

/* ============================
 * Virtuales
 * ============================ */

AdminUserSchema.virtual('fullName').get(function () {
  const fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();

  return fullName || this.displayName || this.username;
});

AdminUserSchema.virtual('isLocked').get(function () {
  return Boolean(this.lockedUntil && this.lockedUntil > new Date());
});

/* ============================
 * Hooks
 * ============================ */

AdminUserSchema.pre('validate', function (next) {
  try {
    this.firstName = normalizeText(this.firstName);
    this.lastName = normalizeText(this.lastName);
    this.displayName = normalizeText(this.displayName);
    this.username = normalizeUsername(this.username);
    this.email = normalizeEmail(this.email);
    this.phone = normalizeText(this.phone);
    this.documentType = normalizeText(this.documentType).toUpperCase();
    this.documentNumber = normalizeText(this.documentNumber);
    this.role = normalizeRoleCode(this.role || 'seller');
    this.notes = normalizeText(this.notes);

    if (!this.displayName) {
      const fullName = `${this.firstName || ''} ${this.lastName || ''}`.trim();
      this.displayName = fullName || this.username;
    }

    if (this.status !== 'active') {
      this.active = false;
    }

    if (this.active === false && this.status === 'active') {
      this.status = 'inactive';
    }

    if (Array.isArray(this.branches) && this.branches.length > 0) {
      let defaultFound = false;

      this.branches = this.branches.map((branchItem) => {
        const item = branchItem;

        item.branchName = normalizeText(item.branchName);
        item.branchCode = normalizeText(item.branchCode).toUpperCase();

        if (item.isDefault && !defaultFound) {
          defaultFound = true;
          this.defaultBranch = item.branch;
        } else if (item.isDefault && defaultFound) {
          item.isDefault = false;
        }

        return item;
      });

      if (!defaultFound && !this.defaultBranch) {
        this.branches[0].isDefault = true;
        this.defaultBranch = this.branches[0].branch;
      }
    } else {
      this.defaultBranch = null;
    }

    next();
  } catch (error) {
    next(error);
  }
});

AdminUserSchema.pre('save', function (next) {
  if (this.isModified('passwordHash')) {
    this.passwordChangedAt = new Date();
    this.tokenVersion = Number(this.tokenVersion || 0) + 1;

    if (this.passwordResetTokenHash || this.passwordResetExpiresAt) {
      this.passwordResetUsedAt = new Date();
    }

    this.passwordResetTokenHash = '';
    this.passwordResetExpiresAt = null;
  }

  next();
});

/* ============================
 * Métodos de seguridad
 * ============================ */

AdminUserSchema.methods.setPassword = async function setPassword(plainPassword) {
  const password = String(plainPassword || '');

  if (password.length < 10) {
    throw new Error('La contraseña debe tener mínimo 10 caracteres.');
  }

  const hasUppercase = /[A-ZÁÉÍÓÚÑ]/.test(password);
  const hasLowercase = /[a-záéíóúñ]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber || !hasSymbol) {
    throw new Error(
      'La contraseña debe incluir mayúscula, minúscula, número y símbolo.'
    );
  }

  this.passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  this.mustChangePassword = false;

  return this;
};

AdminUserSchema.methods.comparePassword = async function comparePassword(
  plainPassword
) {
  if (!this.passwordHash) return false;

  return bcrypt.compare(String(plainPassword || ''), this.passwordHash);
};

AdminUserSchema.methods.getPasswordResetRequestLimitStatus =
  function getPasswordResetRequestLimitStatus({ now = new Date() } = {}) {
    const currentTime = now instanceof Date ? now : new Date(now);
    const lastRequestedAt = this.passwordResetLastRequestedAt || null;
    const windowStartedAt = this.passwordResetRequestWindowStartedAt || null;
    const currentCount = Number(this.passwordResetRequestCount || 0);

    const cooldownMs = minutesToMilliseconds(
      PASSWORD_RESET_REQUEST_COOLDOWN_MINUTES
    );
    const windowMs = minutesToMilliseconds(PASSWORD_RESET_REQUEST_WINDOW_MINUTES);

    if (
      lastRequestedAt &&
      cooldownMs > 0 &&
      currentTime.getTime() - lastRequestedAt.getTime() < cooldownMs
    ) {
      const retryAfterMs =
        cooldownMs - (currentTime.getTime() - lastRequestedAt.getTime());

      return {
        allowed: false,
        reason: 'cooldown',
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        message: `Debes esperar ${Math.max(
          1,
          Math.ceil(retryAfterMs / 1000)
        )} segundos antes de solicitar otro enlace.`,
      };
    }

    if (
      windowStartedAt &&
      windowMs > 0 &&
      currentTime.getTime() - windowStartedAt.getTime() < windowMs &&
      currentCount >= PASSWORD_RESET_REQUEST_MAX_PER_WINDOW
    ) {
      const retryAfterMs =
        windowMs - (currentTime.getTime() - windowStartedAt.getTime());

      return {
        allowed: false,
        reason: 'window_limit',
        retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        message: `Has solicitado demasiados enlaces. Intenta nuevamente en ${Math.max(
          1,
          Math.ceil(retryAfterMs / 1000)
        )} segundos.`,
      };
    }

    return {
      allowed: true,
      reason: '',
      retryAfterSeconds: 0,
      message: '',
    };
  };

AdminUserSchema.methods.registerPasswordResetRequest =
  function registerPasswordResetRequest({ now = new Date() } = {}) {
    const currentTime = now instanceof Date ? now : new Date(now);
    const windowStartedAt = this.passwordResetRequestWindowStartedAt || null;
    const windowMs = minutesToMilliseconds(PASSWORD_RESET_REQUEST_WINDOW_MINUTES);

    if (
      !windowStartedAt ||
      windowMs <= 0 ||
      currentTime.getTime() - windowStartedAt.getTime() >= windowMs
    ) {
      this.passwordResetRequestWindowStartedAt = currentTime;
      this.passwordResetRequestCount = 1;
    } else {
      this.passwordResetRequestCount =
        Number(this.passwordResetRequestCount || 0) + 1;
    }

    this.passwordResetLastRequestedAt = currentTime;

    return this;
  };

AdminUserSchema.methods.createPasswordResetToken =
  function createPasswordResetToken({ minutes = PASSWORD_RESET_MINUTES } = {}) {
    const expiresMinutes = Number(minutes || PASSWORD_RESET_MINUTES);
    const rawToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetTokenHash = hashPasswordResetToken(rawToken);
    this.passwordResetExpiresAt = new Date(
      Date.now() + expiresMinutes * 60 * 1000
    );
    this.passwordResetUsedAt = null;

    return rawToken;
  };

AdminUserSchema.methods.clearPasswordResetToken =
  function clearPasswordResetToken({ markAsUsed = false } = {}) {
    this.passwordResetTokenHash = '';
    this.passwordResetExpiresAt = null;

    if (markAsUsed) {
      this.passwordResetUsedAt = new Date();
    }

    return this;
  };

AdminUserSchema.methods.isPasswordResetTokenValid =
  function isPasswordResetTokenValid(rawToken) {
    const cleanToken = String(rawToken || '').trim();

    if (!cleanToken) return false;
    if (!this.passwordResetTokenHash) return false;
    if (!this.passwordResetExpiresAt) return false;
    if (this.passwordResetUsedAt) return false;
    if (this.passwordResetExpiresAt <= new Date()) return false;

    return this.passwordResetTokenHash === hashPasswordResetToken(cleanToken);
  };

AdminUserSchema.methods.isAccountLocked = function isAccountLocked() {
  return Boolean(this.lockedUntil && this.lockedUntil > new Date());
};

AdminUserSchema.methods.registerFailedLogin = async function registerFailedLogin() {
  const failedAttempts = Number(this.failedLoginAttempts || 0) + 1;

  this.failedLoginAttempts = failedAttempts;

  if (failedAttempts >= DEFAULT_SECURITY.maxFailedLoginAttempts) {
    this.lockedUntil = new Date(
      Date.now() + DEFAULT_SECURITY.lockMinutes * 60 * 1000
    );
    this.status = this.status === 'active' ? 'blocked' : this.status;
  }

  await this.save();

  return this;
};

AdminUserSchema.methods.resetLoginSecurity = async function resetLoginSecurity({
  ip = '',
  userAgent = '',
} = {}) {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;

  if (this.status === 'blocked') {
    this.status = 'active';
    this.active = true;
  }

  this.lastLoginAt = new Date();
  this.lastLoginIp = normalizeText(ip).slice(0, 80);
  this.lastUserAgent = normalizeText(userAgent).slice(0, 500);

  await this.save();

  return this;
};

AdminUserSchema.methods.invalidateSessions = async function invalidateSessions() {
  this.tokenVersion = Number(this.tokenVersion || 0) + 1;
  await this.save();

  return this;
};

AdminUserSchema.methods.hasRole = function hasRole(roles = []) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return allowedRoles
    .map((role) => normalizeRoleCode(role))
    .includes(normalizeRoleCode(this.role));
};

AdminUserSchema.methods.hasPermission = function hasPermission(permission) {
  const cleanPermission = normalizePermission(permission);

  if (!cleanPermission) return false;

  if (normalizeRoleCode(this.role) === 'owner') return true;

  return Array.isArray(this.permissions) && this.permissions.includes(cleanPermission);
};

AdminUserSchema.methods.canAccessBranch = function canAccessBranch(branchId) {
  const currentRole = normalizeRoleCode(this.role);

  if (currentRole === 'owner' || currentRole === 'admin') return true;

  const target = String(branchId || '');

  if (!target) return false;

  return (this.branches || []).some((item) => String(item.branch || '') === target);
};

AdminUserSchema.methods.toSafeObject = function toSafeObject() {
  const user = this.toObject({ virtuals: true });

  delete user.passwordHash;
  delete user.twoFactorSecret;
  delete user.failedLoginAttempts;
  delete user.lockedUntil;
  delete user.lastLoginIp;
  delete user.lastUserAgent;
  delete user.tokenVersion;
  delete user.passwordResetTokenHash;
  delete user.passwordResetExpiresAt;
  delete user.passwordResetUsedAt;
  delete user.passwordResetLastRequestedAt;
  delete user.passwordResetRequestWindowStartedAt;
  delete user.passwordResetRequestCount;
  delete user.__v;

  return user;
};

/* ============================
 * Métodos estáticos
 * ============================ */

AdminUserSchema.statics.findByLogin = function findByLogin(login) {
  const cleanLogin = normalizeLower(login);

  return this.findOne({
    deletedAt: null,
    $or: [{ username: cleanLogin }, { email: cleanLogin }],
  }).select(
    '+passwordHash +failedLoginAttempts +lockedUntil +tokenVersion +lastLoginIp +lastUserAgent'
  );
};

AdminUserSchema.statics.findByPasswordResetToken =
  function findByPasswordResetToken(rawToken) {
    const cleanToken = String(rawToken || '').trim();

    if (!cleanToken) {
      return null;
    }

    const tokenHash = hashPasswordResetToken(cleanToken);

    return this.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
      passwordResetUsedAt: null,
    }).select(
      '+passwordHash +passwordResetTokenHash +passwordResetExpiresAt +passwordResetUsedAt +tokenVersion'
    );
  };

AdminUserSchema.statics.getPasswordResetRequestSelect =
  function getPasswordResetRequestSelect() {
    return [
      '+passwordResetTokenHash',
      '+passwordResetExpiresAt',
      '+passwordResetUsedAt',
      '+passwordResetLastRequestedAt',
      '+passwordResetRequestWindowStartedAt',
      '+passwordResetRequestCount',
      '+tokenVersion',
    ].join(' ');
  };

AdminUserSchema.statics.normalizeUsername = normalizeUsername;
AdminUserSchema.statics.normalizeEmail = normalizeEmail;
AdminUserSchema.statics.normalizeRoleCode = normalizeRoleCode;
AdminUserSchema.statics.normalizePermissions = normalizePermissions;
AdminUserSchema.statics.hashPasswordResetToken = hashPasswordResetToken;

AdminUserSchema.statics.getRoles = function getRoles() {
  return [...ADMIN_USER_ROLES];
};

AdminUserSchema.statics.getStatuses = function getStatuses() {
  return [...ADMIN_USER_STATUS];
};

/* ============================
 * Salida limpia
 * ============================ */

AdminUserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.twoFactorSecret;
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    delete ret.lastLoginIp;
    delete ret.lastUserAgent;
    delete ret.tokenVersion;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpiresAt;
    delete ret.passwordResetUsedAt;
    delete ret.passwordResetLastRequestedAt;
    delete ret.passwordResetRequestWindowStartedAt;
    delete ret.passwordResetRequestCount;
    delete ret.__v;

    return ret;
  },
});

AdminUserSchema.set('toObject', {
  virtuals: true,
  versionKey: false,
});

/* ============================
 * Export
 * ============================ */

module.exports =
  mongoose.models.AdminUser || mongoose.model('AdminUser', AdminUserSchema);