// backend/routes/adminBranches.js

const express = require('express');
const mongoose = require('mongoose');

const requireAdmin = require('../middleware/requireAdmin');
const requirePermission = require('../middleware/requirePermission');

const Branch = require('../models/Branch');
const AdminUser = require('../models/AdminUser');

const router = express.Router();

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const VALID_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'name',
  'code',
  'type',
  'status',
  'isMain',
  'isDefaultForOnlineOrders',
]);

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function cleanLower(value, fallback = '') {
  return cleanText(value, fallback).toLowerCase();
}

function cleanUpper(value, fallback = '') {
  return cleanText(value, fallback).toUpperCase();
}

function parseBoolean(value, fallback = null) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return fallback;
}

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isValidObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ''));
}

function toObjectId(value) {
  if (!isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
}

function getCurrentAdminId(req) {
  return req.adminUserId && isValidObjectId(req.adminUserId)
    ? toObjectId(req.adminUserId)
    : null;
}

function parsePagination(query = {}) {
  const page = Math.max(Number(query.page || DEFAULT_PAGE), 1);
  const rawLimit = Math.max(Number(query.limit || DEFAULT_LIMIT), 1);
  const limit = Math.min(rawLimit, MAX_LIMIT);
  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

function parseSort(query = {}) {
  const rawSort = cleanText(query.sort || '-createdAt');

  let direction = -1;
  let field = rawSort;

  if (rawSort.startsWith('-')) {
    field = rawSort.slice(1);
    direction = -1;
  } else if (rawSort.startsWith('+')) {
    field = rawSort.slice(1);
    direction = 1;
  }

  if (!VALID_SORT_FIELDS.has(field)) {
    return { createdAt: -1 };
  }

  return { [field]: direction, name: 1 };
}

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({
    ok: false,
    message,
    ...extra,
  });
}

function normalizeCode(value) {
  return Branch.normalizeCode(value);
}

function buildBranchPublicResponse(branch) {
  if (!branch) return null;

  if (typeof branch.toSafeObject === 'function') {
    return branch.toSafeObject();
  }

  const plain = branch.toObject ? branch.toObject({ virtuals: true }) : { ...branch };

  delete plain.__v;

  return plain;
}

function buildListFilter(query = {}) {
  const filter = {
    deletedAt: null,
  };

  const q = cleanText(query.q || query.search || '');

  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');

    filter.$or = [
      { name: regex },
      { code: regex },
      { type: regex },
      { notes: regex },
      { 'contact.phone': regex },
      { 'contact.whatsapp': regex },
      { 'contact.email': regex },
      { 'address.department': regex },
      { 'address.city': regex },
      { 'address.addressLine': regex },
    ];
  }

  const type = cleanLower(query.type || '');

  if (type && type !== 'all') {
    filter.type = type;
  }

  const status = cleanLower(query.status || '');

  if (status && status !== 'all') {
    filter.status = status;
  }

  const active = parseBoolean(query.active, null);

  if (active !== null) {
    filter.active = active;
  }

  const isMain = parseBoolean(query.isMain, null);

  if (isMain !== null) {
    filter.isMain = isMain;
  }

  const isDefaultForOnlineOrders = parseBoolean(
    query.isDefaultForOnlineOrders,
    null
  );

  if (isDefaultForOnlineOrders !== null) {
    filter.isDefaultForOnlineOrders = isDefaultForOnlineOrders;
  }

  return filter;
}

function validateBranchPayload(body = {}, { isCreate = false } = {}) {
  const errors = [];

  const name = cleanText(body.name);
  const code = normalizeCode(body.code || body.name);

  if (isCreate && !name) {
    errors.push('El nombre de la sede es obligatorio.');
  }

  if (isCreate && !code) {
    errors.push('El código de la sede es obligatorio.');
  }

  if (code && code.length < 2) {
    errors.push('El código de la sede debe tener mínimo 2 caracteres.');
  }

  if (code && !/^[A-Z0-9._-]+$/.test(code)) {
    errors.push(
      'El código de la sede solo puede contener letras, números, punto, guion y guion bajo.'
    );
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

async function countUsersAssignedToBranch(branchId) {
  if (!isValidObjectId(branchId)) return 0;

  return AdminUser.countDocuments({
    deletedAt: null,
    'branches.branch': toObjectId(branchId),
  });
}

async function countActiveBranches(excludeBranchId = null) {
  const filter = {
    deletedAt: null,
    active: true,
    status: 'active',
  };

  if (excludeBranchId && isValidObjectId(excludeBranchId)) {
    filter._id = { $ne: toObjectId(excludeBranchId) };
  }

  return Branch.countDocuments(filter);
}

async function ensureCanDisableOrDeleteBranch(branch, action = 'disable') {
  if (!branch) {
    return {
      ok: false,
      status: 404,
      message: 'Sede no encontrada.',
    };
  }

  const branchId = branch._id;

  if (branch.isMain) {
    return {
      ok: false,
      status: 400,
      message:
        'No puedes desactivar o eliminar la sede principal. Primero asigna otra sede como principal.',
    };
  }

  if (branch.isDefaultForOnlineOrders) {
    return {
      ok: false,
      status: 400,
      message:
        'No puedes desactivar o eliminar la sede predeterminada para ventas online. Primero asigna otra sede.',
    };
  }

  const usersCount = await countUsersAssignedToBranch(branchId);

  if (usersCount > 0) {
    return {
      ok: false,
      status: 400,
      message:
        'No puedes desactivar o eliminar esta sede porque tiene usuarios asignados.',
      usersCount,
    };
  }

  const activeBranchesLeft = await countActiveBranches(branchId);

  if (activeBranchesLeft <= 0 && action !== 'delete-force') {
    return {
      ok: false,
      status: 400,
      message: 'No puedes dejar el sistema sin sedes activas.',
    };
  }

  return {
    ok: true,
  };
}

function buildContactPayload(contact = {}, currentContact = {}) {
  return {
    phone:
      contact.phone !== undefined
        ? cleanText(contact.phone)
        : cleanText(currentContact.phone),
    whatsapp:
      contact.whatsapp !== undefined
        ? cleanText(contact.whatsapp)
        : cleanText(currentContact.whatsapp),
    email:
      contact.email !== undefined
        ? cleanLower(contact.email)
        : cleanLower(currentContact.email),
  };
}

function buildAddressPayload(address = {}, currentAddress = {}) {
  return {
    country:
      address.country !== undefined
        ? cleanText(address.country, 'Colombia')
        : cleanText(currentAddress.country, 'Colombia'),

    department:
      address.department !== undefined
        ? cleanText(address.department)
        : cleanText(currentAddress.department),

    departmentCode:
      address.departmentCode !== undefined
        ? cleanText(address.departmentCode)
        : cleanText(currentAddress.departmentCode),

    city:
      address.city !== undefined
        ? cleanText(address.city)
        : cleanText(currentAddress.city),

    cityCode:
      address.cityCode !== undefined
        ? cleanText(address.cityCode)
        : cleanText(currentAddress.cityCode),

    addressLine:
      address.addressLine !== undefined
        ? cleanText(address.addressLine)
        : cleanText(currentAddress.addressLine),

    neighborhood:
      address.neighborhood !== undefined
        ? cleanText(address.neighborhood)
        : cleanText(currentAddress.neighborhood),

    postalCode:
      address.postalCode !== undefined
        ? cleanText(address.postalCode)
        : cleanText(currentAddress.postalCode),
  };
}

function buildGeoPayload(geo = {}, currentGeo = {}) {
  const lat =
    geo.lat !== undefined && geo.lat !== null && geo.lat !== ''
      ? Number(geo.lat)
      : currentGeo.lat ?? null;

  const lng =
    geo.lng !== undefined && geo.lng !== null && geo.lng !== ''
      ? Number(geo.lng)
      : currentGeo.lng ?? null;

  return {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function buildFiscalPayload(fiscal = {}, currentFiscal = {}) {
  return {
    useCompanyFiscalInfo:
      fiscal.useCompanyFiscalInfo !== undefined
        ? fiscal.useCompanyFiscalInfo === true
        : currentFiscal.useCompanyFiscalInfo !== false,

    legalName:
      fiscal.legalName !== undefined
        ? cleanText(fiscal.legalName)
        : cleanText(currentFiscal.legalName),

    nit:
      fiscal.nit !== undefined
        ? cleanText(fiscal.nit)
        : cleanText(currentFiscal.nit),

    dv:
      fiscal.dv !== undefined
        ? cleanText(fiscal.dv)
        : cleanText(currentFiscal.dv),

    billingEmail:
      fiscal.billingEmail !== undefined
        ? cleanLower(fiscal.billingEmail)
        : cleanLower(currentFiscal.billingEmail),

    dianResolutionPrefix:
      fiscal.dianResolutionPrefix !== undefined
        ? cleanUpper(fiscal.dianResolutionPrefix)
        : cleanUpper(currentFiscal.dianResolutionPrefix),
  };
}

function buildSettingsPayload(settings = {}, currentSettings = {}) {
  return {
    allowPosSales:
      settings.allowPosSales !== undefined
        ? settings.allowPosSales === true
        : currentSettings.allowPosSales !== false,

    allowManualOrders:
      settings.allowManualOrders !== undefined
        ? settings.allowManualOrders === true
        : currentSettings.allowManualOrders !== false,

    allowInventoryMovements:
      settings.allowInventoryMovements !== undefined
        ? settings.allowInventoryMovements === true
        : currentSettings.allowInventoryMovements !== false,

    allowElectronicInvoice:
      settings.allowElectronicInvoice !== undefined
        ? settings.allowElectronicInvoice === true
        : currentSettings.allowElectronicInvoice !== false,

    requireCashSessionForPos:
      settings.requireCashSessionForPos !== undefined
        ? settings.requireCashSessionForPos === true
        : currentSettings.requireCashSessionForPos !== false,

    allowNegativeStock:
      settings.allowNegativeStock !== undefined
        ? settings.allowNegativeStock === true
        : currentSettings.allowNegativeStock === true,

    defaultPaymentMethod:
      settings.defaultPaymentMethod !== undefined
        ? cleanLower(settings.defaultPaymentMethod)
        : cleanLower(currentSettings.defaultPaymentMethod || 'cash'),

    defaultCustomerName:
      settings.defaultCustomerName !== undefined
        ? cleanText(settings.defaultCustomerName, 'Consumidor final')
        : cleanText(currentSettings.defaultCustomerName, 'Consumidor final'),
  };
}

function buildSchedulePayload(schedule = {}, currentSchedule = {}) {
  const dayNames = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const result = {};

  dayNames.forEach((dayName) => {
    const incomingDay = schedule[dayName] || {};
    const currentDay = currentSchedule[dayName] || {};

    result[dayName] = {
      enabled:
        incomingDay.enabled !== undefined
          ? incomingDay.enabled === true
          : currentDay.enabled !== false,

      open:
        incomingDay.open !== undefined
          ? cleanText(incomingDay.open)
          : cleanText(currentDay.open || '08:00'),

      close:
        incomingDay.close !== undefined
          ? cleanText(incomingDay.close)
          : cleanText(currentDay.close || '18:00'),
    };
  });

  return result;
}

async function applyUniqueMainAndOnlineFlags(branch) {
  if (branch.isMain) {
    await Branch.updateMany(
      {
        _id: { $ne: branch._id },
        deletedAt: null,
        isMain: true,
      },
      {
        $set: {
          isMain: false,
        },
      }
    );
  }

  if (branch.isDefaultForOnlineOrders) {
    await Branch.updateMany(
      {
        _id: { $ne: branch._id },
        deletedAt: null,
        isDefaultForOnlineOrders: true,
      },
      {
        $set: {
          isDefaultForOnlineOrders: false,
        },
      }
    );
  }
}

/* ============================
 * META
 * ============================ */

router.get(
  '/meta',
  requireAdmin,
  requirePermission('branches:view'),
  async (_req, res) => {
    try {
      return res.json({
        ok: true,
        data: {
          statuses: Branch.getStatuses(),
          types: Branch.getTypes(),
          paymentMethods: ['', 'cash', 'transfer', 'card', 'mixed', 'other'],
        },
      });
    } catch (error) {
      console.error('❌ Error obteniendo meta sedes:', error.message);

      return sendError(res, 500, 'Error obteniendo información base de sedes.');
    }
  }
);

/* ============================
 * LISTAR SEDES
 * ============================ */

router.get(
  '/',
  requireAdmin,
  requirePermission('branches:view'),
  async (req, res) => {
    try {
      const filter = buildListFilter(req.query);
      const sort = parseSort(req.query);
      const { page, limit, skip } = parsePagination(req.query);

      const [total, branches] = await Promise.all([
        Branch.countDocuments(filter),

        Branch.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .populate('manager', 'username displayName firstName lastName role')
          .lean({ virtuals: true }),
      ]);

      return res.json({
        ok: true,
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
        data: branches,
      });
    } catch (error) {
      console.error('❌ Error listando sedes:', error.message);

      return sendError(res, 500, 'Error listando sedes administrativas.');
    }
  }
);

/* ============================
 * DETALLE DE SEDE
 * ============================ */

router.get(
  '/:id',
  requireAdmin,
  requirePermission('branches:view'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const branch = await Branch.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      })
        .populate('manager', 'username displayName firstName lastName role')
        .lean({ virtuals: true });

      if (!branch) {
        return sendError(res, 404, 'Sede no encontrada.');
      }

      const usersCount = await countUsersAssignedToBranch(branch._id);

      return res.json({
        ok: true,
        data: {
          ...branch,
          usersCount,
        },
      });
    } catch (error) {
      console.error('❌ Error obteniendo sede:', error.message);

      return sendError(res, 500, 'Error obteniendo sede administrativa.');
    }
  }
);

/* ============================
 * CREAR SEDE
 * ============================ */

router.post(
  '/',
  requireAdmin,
  requirePermission('branches:create'),
  async (req, res) => {
    try {
      const body = req.body || {};

      const validation = validateBranchPayload(body, { isCreate: true });

      if (!validation.ok) {
        return sendError(res, 400, 'Datos inválidos para crear la sede.', {
          errors: validation.errors,
        });
      }

      const code = normalizeCode(body.code || body.name);

      const duplicatedBranch = await Branch.findOne({
        deletedAt: null,
        code,
      }).lean();

      if (duplicatedBranch) {
        return sendError(res, 409, 'Ya existe una sede con ese código.');
      }

      const activeBranchesCount = await Branch.countDocuments({
        deletedAt: null,
        active: true,
        status: 'active',
      });

      const shouldBeMain =
        body.isMain === true || activeBranchesCount === 0;

      const shouldBeDefaultForOnline =
        body.isDefaultForOnlineOrders === true || activeBranchesCount === 0;

      const branch = new Branch({
        name: cleanText(body.name),
        code,
        type: cleanLower(body.type || 'store'),
        status: cleanLower(body.status || 'active'),
        active: body.active !== false,

        isMain: shouldBeMain,
        isDefaultForOnlineOrders: shouldBeDefaultForOnline,

        contact: buildContactPayload(body.contact || {}),
        address: buildAddressPayload(body.address || {}),
        geo: buildGeoPayload(body.geo || {}),
        schedule: buildSchedulePayload(body.schedule || {}),
        fiscal: buildFiscalPayload(body.fiscal || {}),
        settings: buildSettingsPayload(body.settings || {}),

        manager:
          body.manager && isValidObjectId(body.manager)
            ? toObjectId(body.manager)
            : null,

        notes: cleanText(body.notes),
        createdBy: getCurrentAdminId(req),
        updatedBy: getCurrentAdminId(req),
      });

      await branch.save();
      await applyUniqueMainAndOnlineFlags(branch);

      return res.status(201).json({
        ok: true,
        message: 'Sede creada correctamente.',
        data: buildBranchPublicResponse(branch),
      });
    } catch (error) {
      console.error('❌ Error creando sede:', error.message);

      if (error?.code === 11000) {
        return sendError(res, 409, 'Ya existe una sede con ese código.');
      }

      return sendError(res, 500, error.message || 'Error creando sede.');
    }
  }
);

/* ============================
 * ACTUALIZAR SEDE
 * ============================ */

router.put(
  '/:id',
  requireAdmin,
  requirePermission('branches:update'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const body = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const branch = await Branch.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      if (!branch) {
        return sendError(res, 404, 'Sede no encontrada.');
      }

      const validation = validateBranchPayload(body, { isCreate: false });

      if (!validation.ok) {
        return sendError(res, 400, 'Datos inválidos para actualizar la sede.', {
          errors: validation.errors,
        });
      }

      if (body.code !== undefined) {
        const newCode = normalizeCode(body.code);

        const duplicatedBranch = await Branch.findOne({
          _id: { $ne: branch._id },
          deletedAt: null,
          code: newCode,
        }).lean();

        if (duplicatedBranch) {
          return sendError(res, 409, 'Ya existe otra sede con ese código.');
        }

        branch.code = newCode;
      }

      if (body.name !== undefined) {
        branch.name = cleanText(body.name);
      }

      if (body.type !== undefined) {
        branch.type = cleanLower(body.type);
      }

      if (body.status !== undefined || body.active !== undefined) {
        const wantsDisable =
          body.active === false ||
          (body.status !== undefined && cleanLower(body.status) !== 'active');

        if (wantsDisable) {
          const allowed = await ensureCanDisableOrDeleteBranch(branch, 'disable');

          if (!allowed.ok) {
            return sendError(res, allowed.status, allowed.message, {
              usersCount: allowed.usersCount,
            });
          }
        }

        if (body.status !== undefined) {
          branch.status = cleanLower(body.status);
        }

        if (body.active !== undefined) {
          branch.active = body.active === true;
        }
      }

      if (body.isMain !== undefined) {
        if (branch.isMain && body.isMain === false) {
          return sendError(
            res,
            400,
            'No puedes quitar la marca de sede principal directamente. Marca otra sede como principal.'
          );
        }

        branch.isMain = body.isMain === true;
      }

      if (body.isDefaultForOnlineOrders !== undefined) {
        if (
          branch.isDefaultForOnlineOrders &&
          body.isDefaultForOnlineOrders === false
        ) {
          return sendError(
            res,
            400,
            'No puedes quitar la sede online predeterminada directamente. Marca otra sede como predeterminada.'
          );
        }

        branch.isDefaultForOnlineOrders =
          body.isDefaultForOnlineOrders === true;
      }

      if (body.contact !== undefined) {
        branch.contact = buildContactPayload(body.contact, branch.contact || {});
      }

      if (body.address !== undefined) {
        branch.address = buildAddressPayload(body.address, branch.address || {});
      }

      if (body.geo !== undefined) {
        branch.geo = buildGeoPayload(body.geo, branch.geo || {});
      }

      if (body.schedule !== undefined) {
        branch.schedule = buildSchedulePayload(
          body.schedule,
          branch.schedule || {}
        );
      }

      if (body.fiscal !== undefined) {
        branch.fiscal = buildFiscalPayload(body.fiscal, branch.fiscal || {});
      }

      if (body.settings !== undefined) {
        branch.settings = buildSettingsPayload(
          body.settings,
          branch.settings || {}
        );
      }

      if (body.manager !== undefined) {
        branch.manager =
          body.manager && isValidObjectId(body.manager)
            ? toObjectId(body.manager)
            : null;
      }

      if (body.notes !== undefined) {
        branch.notes = cleanText(body.notes);
      }

      branch.updatedBy = getCurrentAdminId(req);

      await branch.save();
      await applyUniqueMainAndOnlineFlags(branch);

      const savedBranch = await Branch.findById(branch._id).populate(
        'manager',
        'username displayName firstName lastName role'
      );

      return res.json({
        ok: true,
        message: 'Sede actualizada correctamente.',
        data: buildBranchPublicResponse(savedBranch),
      });
    } catch (error) {
      console.error('❌ Error actualizando sede:', error.message);

      if (error?.code === 11000) {
        return sendError(res, 409, 'Ya existe otra sede con ese código.');
      }

      return sendError(res, 500, error.message || 'Error actualizando sede.');
    }
  }
);

/* ============================
 * MARCAR COMO SEDE PRINCIPAL
 * ============================ */

router.patch(
  '/:id/main',
  requireAdmin,
  requirePermission('branches:update'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const branch = await Branch.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      if (!branch) {
        return sendError(res, 404, 'Sede no encontrada.');
      }

      if (branch.active !== true || branch.status !== 'active') {
        return sendError(
          res,
          400,
          'Solo una sede activa puede ser marcada como principal.'
        );
      }

      branch.isMain = true;
      branch.updatedBy = getCurrentAdminId(req);

      await branch.save();
      await applyUniqueMainAndOnlineFlags(branch);

      return res.json({
        ok: true,
        message: 'Sede principal actualizada correctamente.',
        data: buildBranchPublicResponse(branch),
      });
    } catch (error) {
      console.error('❌ Error marcando sede principal:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error marcando sede principal.'
      );
    }
  }
);

/* ============================
 * MARCAR COMO SEDE ONLINE
 * ============================ */

router.patch(
  '/:id/online-default',
  requireAdmin,
  requirePermission('branches:update'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const branch = await Branch.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      if (!branch) {
        return sendError(res, 404, 'Sede no encontrada.');
      }

      if (branch.active !== true || branch.status !== 'active') {
        return sendError(
          res,
          400,
          'Solo una sede activa puede ser predeterminada para ventas online.'
        );
      }

      branch.isDefaultForOnlineOrders = true;
      branch.updatedBy = getCurrentAdminId(req);

      await branch.save();
      await applyUniqueMainAndOnlineFlags(branch);

      return res.json({
        ok: true,
        message: 'Sede predeterminada online actualizada correctamente.',
        data: buildBranchPublicResponse(branch),
      });
    } catch (error) {
      console.error('❌ Error marcando sede online:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error marcando sede online predeterminada.'
      );
    }
  }
);

/* ============================
 * CAMBIAR ESTADO
 * ============================ */

router.patch(
  '/:id/status',
  requireAdmin,
  requirePermission('branches:disable'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, active } = req.body || {};

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const branch = await Branch.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      if (!branch) {
        return sendError(res, 404, 'Sede no encontrada.');
      }

      const wantsDisable =
        active === false ||
        (status !== undefined && cleanLower(status) !== 'active');

      if (wantsDisable) {
        const allowed = await ensureCanDisableOrDeleteBranch(branch, 'disable');

        if (!allowed.ok) {
          return sendError(res, allowed.status, allowed.message, {
            usersCount: allowed.usersCount,
          });
        }
      }

      if (status !== undefined) {
        branch.status = cleanLower(status);
      }

      if (active !== undefined) {
        branch.active = active === true;
      }

      branch.updatedBy = getCurrentAdminId(req);

      await branch.save();

      return res.json({
        ok: true,
        message: 'Estado de la sede actualizado correctamente.',
        data: buildBranchPublicResponse(branch),
      });
    } catch (error) {
      console.error('❌ Error cambiando estado sede:', error.message);

      return sendError(
        res,
        500,
        error.message || 'Error cambiando estado de la sede.'
      );
    }
  }
);

/* ============================
 * ELIMINAR SEDE
 * ============================ */

router.delete(
  '/:id',
  requireAdmin,
  requirePermission('branches:disable'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!isValidObjectId(id)) {
        return sendError(res, 400, 'ID de sede inválido.');
      }

      const branch = await Branch.findOne({
        _id: toObjectId(id),
        deletedAt: null,
      });

      if (!branch) {
        return sendError(res, 404, 'Sede no encontrada.');
      }

      const allowed = await ensureCanDisableOrDeleteBranch(branch, 'delete');

      if (!allowed.ok) {
        return sendError(res, allowed.status, allowed.message, {
          usersCount: allowed.usersCount,
        });
      }

      branch.deletedAt = new Date();
      branch.deletedBy = getCurrentAdminId(req);
      branch.active = false;
      branch.status = 'inactive';
      branch.updatedBy = getCurrentAdminId(req);

      await branch.save();

      return res.json({
        ok: true,
        message: 'Sede eliminada correctamente.',
      });
    } catch (error) {
      console.error('❌ Error eliminando sede:', error.message);

      return sendError(res, 500, error.message || 'Error eliminando sede.');
    }
  }
);

module.exports = router;