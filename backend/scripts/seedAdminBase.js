// backend/scripts/seedAdminBase.js

require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env'),
});

const mongoose = require('mongoose');

const AdminRole = require('../models/AdminRole');
const Branch = require('../models/Branch');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_ATLAS_URI ||
  '';

const SYNC_SYSTEM_ROLE_PERMISSIONS =
  String(process.env.SEED_SYNC_SYSTEM_ROLE_PERMISSIONS || 'false').toLowerCase() ===
  'true';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function cleanCode(value, fallback = '') {
  return cleanText(value, fallback)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[^A-Z0-9._-]/g, '');
}

function getMainBranchPayload() {
  return {
    name: cleanText(process.env.ADMIN_MAIN_BRANCH_NAME, 'Sede Principal'),
    code: cleanCode(process.env.ADMIN_MAIN_BRANCH_CODE, 'PRINCIPAL'),
    type: cleanText(process.env.ADMIN_MAIN_BRANCH_TYPE, 'store'),
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,

    contact: {
      phone: cleanText(process.env.ADMIN_MAIN_BRANCH_PHONE, ''),
      whatsapp: cleanText(process.env.ADMIN_MAIN_BRANCH_WHATSAPP, ''),
      email: cleanText(process.env.ADMIN_MAIN_BRANCH_EMAIL, ''),
    },

    address: {
      country: cleanText(process.env.ADMIN_MAIN_BRANCH_COUNTRY, 'Colombia'),
      department: cleanText(process.env.ADMIN_MAIN_BRANCH_DEPARTMENT, ''),
      departmentCode: cleanText(process.env.ADMIN_MAIN_BRANCH_DEPARTMENT_CODE, ''),
      city: cleanText(process.env.ADMIN_MAIN_BRANCH_CITY, ''),
      cityCode: cleanText(process.env.ADMIN_MAIN_BRANCH_CITY_CODE, ''),
      addressLine: cleanText(process.env.ADMIN_MAIN_BRANCH_ADDRESS, ''),
      neighborhood: cleanText(process.env.ADMIN_MAIN_BRANCH_NEIGHBORHOOD, ''),
      postalCode: cleanText(process.env.ADMIN_MAIN_BRANCH_POSTAL_CODE, ''),
    },

    settings: {
      allowPosSales: true,
      allowManualOrders: true,
      allowInventoryMovements: true,
      allowElectronicInvoice: true,
      requireCashSessionForPos: true,
      allowNegativeStock: false,
      defaultPaymentMethod: 'cash',
      defaultCustomerName: 'Consumidor final',
    },

    notes:
      'Sede principal creada automáticamente para iniciar el módulo administrativo profesional.',
  };
}

async function connectDB() {
  if (!MONGODB_URI) {
    throw new Error(
      'No se encontró MONGODB_URI, MONGO_URI ni MONGODB_ATLAS_URI en el archivo .env.'
    );
  }

  await mongoose.connect(MONGODB_URI);

  console.log('✅ Conectado a MongoDB');
}

async function seedRoles() {
  const defaultRoles = AdminRole.getDefaultRoles();

  console.log(`\n🔐 Verificando roles administrativos: ${defaultRoles.length}`);

  const results = [];

  for (const role of defaultRoles) {
    const setPayload = {
      name: role.name,
      description: role.description,
      scope: role.scope,
      level: role.level,
      isSystem: true,
      isDefault: Boolean(role.isDefault),
      status: 'active',
      active: true,
    };

    if (SYNC_SYSTEM_ROLE_PERMISSIONS) {
      setPayload.permissions = role.permissions;
    }

    const updatePayload = {
      $set: setPayload,
      $setOnInsert: {
        code: role.code,
        permissions: role.permissions,
        createdAt: new Date(),
      },
    };

    const savedRole = await AdminRole.findOneAndUpdate(
      { code: role.code },
      updatePayload,
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      }
    );

    results.push(savedRole);

    console.log(
      `   ✅ Rol listo: ${savedRole.name} (${savedRole.code}) - permisos: ${
        savedRole.permissions?.length || 0
      }`
    );
  }

  return results;
}

async function seedMainBranch() {
  const branchPayload = getMainBranchPayload();

  console.log('\n🏪 Verificando sede principal');

  const existingMainBranch = await Branch.findOne({
    deletedAt: null,
    $or: [{ isMain: true }, { code: branchPayload.code }],
  });

  if (existingMainBranch) {
    existingMainBranch.isMain = true;
    existingMainBranch.isDefaultForOnlineOrders = true;
    existingMainBranch.active = true;
    existingMainBranch.status = 'active';

    if (!existingMainBranch.settings) {
      existingMainBranch.settings = branchPayload.settings;
    }

    await existingMainBranch.save();

    console.log(
      `   ✅ Sede principal ya existía y fue verificada: ${existingMainBranch.name} (${existingMainBranch.code})`
    );

    return existingMainBranch;
  }

  const createdBranch = await Branch.create(branchPayload);

  console.log(
    `   ✅ Sede principal creada: ${createdBranch.name} (${createdBranch.code})`
  );

  return createdBranch;
}

async function runSeed() {
  try {
    console.log('🚀 Iniciando seed base administrativo');

    await connectDB();

    const roles = await seedRoles();
    const branch = await seedMainBranch();

    console.log('\n🎉 Seed base administrativo completado');
    console.log('--------------------------------------');
    console.log(`Roles listos: ${roles.length}`);
    console.log(`Sede principal: ${branch.name} (${branch.code})`);
    console.log('--------------------------------------');

    if (!SYNC_SYSTEM_ROLE_PERMISSIONS) {
      console.log(
        'ℹ️ Nota: permisos de roles existentes no fueron sobreescritos. Para sincronizarlos usa SEED_SYNC_SYSTEM_ROLE_PERMISSIONS=true.'
      );
    }
  } catch (error) {
    console.error('\n❌ Error ejecutando seed base administrativo');
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexión MongoDB cerrada');
  }
}

runSeed();