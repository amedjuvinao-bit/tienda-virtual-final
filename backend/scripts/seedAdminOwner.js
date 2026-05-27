// backend/scripts/seedAdminOwner.js

require('dotenv').config({
  path: require('path').resolve(__dirname, '../.env'),
});

const mongoose = require('mongoose');

const AdminUser = require('../models/AdminUser');
const AdminRole = require('../models/AdminRole');
const Branch = require('../models/Branch');

const MONGODB_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  process.env.MONGODB_ATLAS_URI ||
  '';

const OWNER_USERNAME =
  process.env.ADMIN_OWNER_USERNAME ||
  process.env.ADMIN_USER ||
  'owner';

const OWNER_EMAIL = process.env.ADMIN_OWNER_EMAIL || '';

const OWNER_PASSWORD = process.env.ADMIN_OWNER_PASSWORD || '';

const OWNER_FIRST_NAME = process.env.ADMIN_OWNER_FIRST_NAME || 'Propietario';

const OWNER_LAST_NAME = process.env.ADMIN_OWNER_LAST_NAME || 'Principal';

const OWNER_PHONE = process.env.ADMIN_OWNER_PHONE || '';

const OWNER_DOCUMENT_TYPE = process.env.ADMIN_OWNER_DOCUMENT_TYPE || '';

const OWNER_DOCUMENT_NUMBER = process.env.ADMIN_OWNER_DOCUMENT_NUMBER || '';

const OWNER_RESET_PASSWORD =
  String(process.env.ADMIN_OWNER_RESET_PASSWORD || 'false').toLowerCase() === 'true';

function cleanText(value, fallback = '') {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  return text || fallback;
}

function maskEmail(email) {
  const cleanEmail = String(email || '').trim();

  if (!cleanEmail || !cleanEmail.includes('@')) return '';

  const [name, domain] = cleanEmail.split('@');

  if (!name || !domain) return cleanEmail;

  const visible = name.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
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

async function getOwnerRole() {
  const ownerRole = await AdminRole.findOne({
    code: 'owner',
    deletedAt: null,
  });

  if (!ownerRole) {
    throw new Error(
      'No existe el rol owner. Primero ejecuta: node scripts/seedAdminBase.js'
    );
  }

  return ownerRole;
}

async function getMainBranch() {
  const mainBranch =
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      isMain: true,
    })) ||
    (await Branch.findOne({
      deletedAt: null,
      active: true,
      status: 'active',
      code: 'PRINCIPAL',
    }));

  if (!mainBranch) {
    throw new Error(
      'No existe sede principal. Primero ejecuta: node scripts/seedAdminBase.js'
    );
  }

  return mainBranch;
}

function validateOwnerInput({ username, password, isNewUser }) {
  const cleanUsername = cleanText(username).toLowerCase();

  if (!cleanUsername) {
    throw new Error('ADMIN_OWNER_USERNAME no puede estar vacío.');
  }

  if (cleanUsername.length < 3) {
    throw new Error('ADMIN_OWNER_USERNAME debe tener mínimo 3 caracteres.');
  }

  if (isNewUser && !password) {
    throw new Error(
      'ADMIN_OWNER_PASSWORD es obligatorio para crear el primer usuario propietario.'
    );
  }

  if (password && password.length < 10) {
    throw new Error('ADMIN_OWNER_PASSWORD debe tener mínimo 10 caracteres.');
  }
}

async function createOrUpdateOwner() {
  const ownerRole = await getOwnerRole();
  const mainBranch = await getMainBranch();

  const username = cleanText(OWNER_USERNAME).toLowerCase();
  const email = cleanText(OWNER_EMAIL).toLowerCase();

  const existingOwner = await AdminUser.findOne({
    deletedAt: null,
    $or: [
      { username },
      ...(email ? [{ email }] : []),
    ],
  }).select(
    '+passwordHash +failedLoginAttempts +lockedUntil +tokenVersion'
  );

  validateOwnerInput({
    username,
    password: OWNER_PASSWORD,
    isNewUser: !existingOwner,
  });

  const ownerPayload = {
    firstName: cleanText(OWNER_FIRST_NAME, 'Propietario'),
    lastName: cleanText(OWNER_LAST_NAME, 'Principal'),
    displayName: cleanText(
      `${OWNER_FIRST_NAME || 'Propietario'} ${OWNER_LAST_NAME || 'Principal'}`,
      'Propietario Principal'
    ),
    username,
    email,
    phone: cleanText(OWNER_PHONE),
    documentType: cleanText(OWNER_DOCUMENT_TYPE).toUpperCase(),
    documentNumber: cleanText(OWNER_DOCUMENT_NUMBER),

    role: 'owner',
    roleRef: ownerRole._id,
    permissions: ownerRole.permissions || [],

    branches: [
      {
        branch: mainBranch._id,
        branchName: mainBranch.name,
        branchCode: mainBranch.code,
        isDefault: true,
        canSell: true,
        canManageInventory: true,
        canInvoice: true,
      },
    ],
    defaultBranch: mainBranch._id,

    status: 'active',
    active: true,
    mustChangePassword: false,
    emailVerified: Boolean(email),

    notes: 'Usuario propietario creado por seedAdminOwner.js.',
  };

  if (!existingOwner) {
    const owner = new AdminUser(ownerPayload);
    await owner.setPassword(OWNER_PASSWORD);
    await owner.save();

    console.log('✅ Usuario propietario creado correctamente');
    console.log('------------------------------------------');
    console.log(`Usuario: ${owner.username}`);
    console.log(`Correo: ${maskEmail(owner.email) || 'Sin correo configurado'}`);
    console.log(`Rol: ${owner.role}`);
    console.log(`Sede: ${mainBranch.name} (${mainBranch.code})`);
    console.log('------------------------------------------');

    return owner;
  }

  existingOwner.firstName = ownerPayload.firstName;
  existingOwner.lastName = ownerPayload.lastName;
  existingOwner.displayName = ownerPayload.displayName;
  existingOwner.email = ownerPayload.email;
  existingOwner.phone = ownerPayload.phone;
  existingOwner.documentType = ownerPayload.documentType;
  existingOwner.documentNumber = ownerPayload.documentNumber;

  existingOwner.role = ownerPayload.role;
  existingOwner.roleRef = ownerPayload.roleRef;
  existingOwner.permissions = ownerPayload.permissions;
  existingOwner.branches = ownerPayload.branches;
  existingOwner.defaultBranch = ownerPayload.defaultBranch;

  existingOwner.status = 'active';
  existingOwner.active = true;
  existingOwner.emailVerified = Boolean(email);
  existingOwner.notes = ownerPayload.notes;

  if (OWNER_RESET_PASSWORD) {
    if (!OWNER_PASSWORD) {
      throw new Error(
        'ADMIN_OWNER_RESET_PASSWORD=true requiere ADMIN_OWNER_PASSWORD en el .env.'
      );
    }

    await existingOwner.setPassword(OWNER_PASSWORD);
    console.log('🔐 Contraseña del propietario actualizada por configuración.');
  }

  await existingOwner.save();

  console.log('✅ Usuario propietario ya existía y fue verificado');
  console.log('------------------------------------------');
  console.log(`Usuario: ${existingOwner.username}`);
  console.log(`Correo: ${maskEmail(existingOwner.email) || 'Sin correo configurado'}`);
  console.log(`Rol: ${existingOwner.role}`);
  console.log(`Sede: ${mainBranch.name} (${mainBranch.code})`);
  console.log(
    `Contraseña actualizada: ${OWNER_RESET_PASSWORD ? 'Sí' : 'No'}`
  );
  console.log('------------------------------------------');

  return existingOwner;
}

async function runSeed() {
  try {
    console.log('🚀 Iniciando seed de usuario propietario');

    await connectDB();

    await createOrUpdateOwner();

    console.log('\n🎉 Seed de propietario completado correctamente');
  } catch (error) {
    console.error('\n❌ Error ejecutando seed de usuario propietario');
    console.error(error.message || error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexión MongoDB cerrada');
  }
}

runSeed();