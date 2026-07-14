// backend/scripts/mergeDuplicateCustomers.js
/* eslint-disable no-console */

/**
 * Limpieza segura de clientes duplicados.
 *
 * Por defecto NO modifica datos: solo muestra el plan.
 *
 * Comandos:
 * - Ver plan:       npm run customers:merge-duplicates
 * - Aplicar merge:  npm run customers:merge-duplicates:apply
 *
 * Variables opcionales:
 * - CUSTOMERS_MERGE_APPLY=true        Aplica cambios reales.
 * - CUSTOMERS_MERGE_LIMIT=20          Limita cantidad de grupos procesados.
 * - CUSTOMERS_MERGE_KEEP_OLD_ACTIVE=true  No inactiva duplicados, solo reporta/actualiza referencias.
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const CustomerFollowUp = require('../models/CustomerFollowUp');
const Order = require('../models/Order');

const APPLY = String(process.env.CUSTOMERS_MERGE_APPLY || 'false').toLowerCase() === 'true';
const LIMIT = Math.max(1, Number(process.env.CUSTOMERS_MERGE_LIMIT || 50));
const KEEP_OLD_ACTIVE = String(process.env.CUSTOMERS_MERGE_KEEP_OLD_ACTIVE || 'false').toLowerCase() === 'true';

const MERGED_TAG = 'merged-duplicate';

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function onlyDigits(value) {
  return cleanText(value).replace(/\D/g, '');
}

function cleanArray(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(cleanLower).filter(Boolean))];
}

function customerLabel(customer = {}) {
  return `${customer.fullName || customer.displayName || 'Sin nombre'} | ${customer.customerCode || 'Sin codigo'} | ${customer.phone || '-'} | ${customer.email || '-'} | ${customer.documentType || ''} ${customer.documentNumber || ''}`;
}

function getCustomerId(customer = {}) {
  return String(customer._id || customer.id || '');
}

function identityKeys(customer = {}) {
  const keys = [];
  const normalizedDocument = onlyDigits(customer.normalizedDocument || customer.documentNumber);
  const normalizedPhone = cleanText(customer.normalizedPhone || customer.phone);
  const normalizedEmail = cleanLower(customer.normalizedEmail || customer.email);
  const documentType = cleanText(customer.documentType || '').toUpperCase();

  if (normalizedDocument) keys.push(`doc:${documentType}:${normalizedDocument}`);
  if (normalizedPhone) keys.push(`phone:${normalizedPhone}`);
  if (normalizedEmail) keys.push(`email:${normalizedEmail}`);

  return keys;
}

function orderMatchForCustomer(customer = {}) {
  const id = getCustomerId(customer);
  const email = cleanLower(customer.email || customer.normalizedEmail);
  const phone = cleanText(customer.phone || customer.normalizedPhone);
  const doc = cleanText(customer.documentNumber || customer.normalizedDocument);
  const normalizedPhone = cleanText(customer.normalizedPhone || onlyDigits(phone));
  const normalizedDoc = cleanText(customer.normalizedDocument || onlyDigits(doc));
  const filters = [];

  if (id) filters.push({ 'customer.customerId': id });
  if (email) filters.push({ 'customer.email': email }, { 'billing.email': email });
  if (phone) filters.push({ 'customer.phone': phone }, { 'billing.phone': phone });
  if (normalizedPhone && normalizedPhone !== phone) filters.push({ 'customer.phone': normalizedPhone }, { 'billing.phone': normalizedPhone });
  if (doc) filters.push({ 'customer.id': doc }, { 'billing.id': doc });
  if (normalizedDoc && normalizedDoc !== doc) filters.push({ 'customer.id': normalizedDoc }, { 'billing.id': normalizedDoc });

  return filters.length ? { $or: filters } : { _id: null };
}

function orderMatchForCustomers(customers = []) {
  const filters = customers.flatMap((customer) => {
    const match = orderMatchForCustomer(customer);
    return Array.isArray(match.$or) ? match.$or : [];
  });

  return filters.length ? { $or: filters } : { _id: null };
}

function buildSnapshot(primary = {}) {
  return {
    name: primary.fullName || primary.displayName || '',
    lastname: '',
    id: primary.documentNumber || '',
    documentType: primary.documentType || '',
    emailOrPhone: primary.email || primary.phone || '',
    email: primary.email || '',
    phone: primary.phone || '',
    address: primary.address || '',
    city: primary.city || '',
    postalCode: primary.postalCode || '',
    country: primary.country || 'CO',
    department: primary.department || '',
  };
}

function mergeText(current, incoming) {
  const a = cleanText(current);
  const b = cleanText(incoming);
  return a || b;
}

function mergeNotes(primary, duplicates) {
  const parts = [];
  const existing = cleanText(primary.notes);
  if (existing) parts.push(existing);

  duplicates.forEach((customer) => {
    const note = cleanText(customer.notes);
    if (note && !parts.includes(note)) {
      parts.push(`[Duplicado ${customer.customerCode || getCustomerId(customer)}] ${note}`);
    }
  });

  return parts.join('\n');
}

function choosePrimary(customers = [], orderCounts = {}, followCounts = {}) {
  return [...customers].sort((a, b) => {
    const aId = getCustomerId(a);
    const bId = getCustomerId(b);
    const aScore = Number(orderCounts[aId] || 0) * 1000
      + Number(followCounts[aId] || 0) * 100
      + Number(a.stats?.ordersCount || 0) * 10
      + (a.email ? 2 : 0)
      + (a.phone ? 2 : 0)
      + (a.documentNumber ? 2 : 0);
    const bScore = Number(orderCounts[bId] || 0) * 1000
      + Number(followCounts[bId] || 0) * 100
      + Number(b.stats?.ordersCount || 0) * 10
      + (b.email ? 2 : 0)
      + (b.phone ? 2 : 0)
      + (b.documentNumber ? 2 : 0);

    if (bScore !== aScore) return bScore - aScore;

    const aUpdated = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bUpdated = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bUpdated - aUpdated;
  })[0];
}

async function connect() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
}

async function loadActiveCustomers() {
  return Customer.find({ deletedAt: null, status: 'active' }).sort({ createdAt: 1 });
}

function buildDuplicateComponents(customers = []) {
  const byKey = new Map();
  const byId = new Map();

  customers.forEach((customer) => {
    const id = getCustomerId(customer);
    byId.set(id, customer);
    identityKeys(customer).forEach((key) => {
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key).push(id);
    });
  });

  const parent = new Map();
  const find = (id) => {
    if (!parent.has(id)) parent.set(id, id);
    if (parent.get(id) !== id) parent.set(id, find(parent.get(id)));
    return parent.get(id);
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  byKey.forEach((ids) => {
    if (ids.length <= 1) return;
    ids.slice(1).forEach((id) => union(ids[0], id));
  });

  const components = new Map();
  customers.forEach((customer) => {
    const id = getCustomerId(customer);
    const root = find(id);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(customer);
  });

  return [...components.values()]
    .filter((group) => group.length > 1)
    .slice(0, LIMIT);
}

async function countOrdersByCustomer(customers = []) {
  const result = {};

  for (const customer of customers) {
    const id = getCustomerId(customer);
    result[id] = await Order.countDocuments(orderMatchForCustomer(customer));
  }

  return result;
}

async function countFollowUpsByCustomer(customers = []) {
  const ids = customers.map((customer) => customer._id);
  const rows = await CustomerFollowUp.aggregate([
    { $match: { customer: { $in: ids }, deletedAt: null } },
    { $group: { _id: '$customer', count: { $sum: 1 } } },
  ]);

  return rows.reduce((acc, row) => {
    acc[String(row._id)] = row.count;
    return acc;
  }, {});
}

async function buildPlan() {
  const customers = await loadActiveCustomers();
  const groups = buildDuplicateComponents(customers);
  const plans = [];

  for (const group of groups) {
    const orderCounts = await countOrdersByCustomer(group);
    const followCounts = await countFollowUpsByCustomer(group);
    const primary = choosePrimary(group, orderCounts, followCounts);
    const duplicates = group.filter((customer) => getCustomerId(customer) !== getCustomerId(primary));
    const keys = [...new Set(group.flatMap(identityKeys))];

    plans.push({ primary, duplicates, group, keys, orderCounts, followCounts });
  }

  return plans;
}

async function recomputePrimaryStats(primary) {
  const match = orderMatchForCustomer(primary);
  const [agg] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        ordersCount: { $sum: 1 },
        posOrdersCount: { $sum: { $cond: [{ $eq: ['$source', 'pos'] }, 1, 0] } },
        webOrdersCount: { $sum: { $cond: [{ $ne: ['$source', 'pos'] }, 1, 0] } },
        totalSpent: { $sum: { $ifNull: ['$total', 0] } },
        firstPurchaseAt: { $min: '$createdAt' },
        lastPurchaseAt: { $max: '$createdAt' },
      },
    },
  ]);

  const lastOrder = await Order.findOne(match).sort({ createdAt: -1 }).select('_id orderNumber').lean();

  primary.stats = {
    ordersCount: Number(agg?.ordersCount || 0),
    posOrdersCount: Number(agg?.posOrdersCount || 0),
    webOrdersCount: Number(agg?.webOrdersCount || 0),
    totalSpent: Number(agg?.totalSpent || 0),
    firstPurchaseAt: agg?.firstPurchaseAt || null,
    lastPurchaseAt: agg?.lastPurchaseAt || null,
    lastOrder: lastOrder?._id || null,
    lastOrderNumber: lastOrder?.orderNumber || '',
  };
}

async function applyPlan(plan) {
  const { primary, duplicates } = plan;
  const duplicateIds = duplicates.map((customer) => customer._id);
  const now = new Date();
  const snapshot = buildSnapshot(primary);

  primary.phone = mergeText(primary.phone, duplicates.find((customer) => customer.phone)?.phone);
  primary.email = mergeText(primary.email, duplicates.find((customer) => customer.email)?.email);
  primary.documentType = mergeText(primary.documentType, duplicates.find((customer) => customer.documentType)?.documentType);
  primary.documentNumber = mergeText(primary.documentNumber, duplicates.find((customer) => customer.documentNumber)?.documentNumber);
  primary.address = mergeText(primary.address, duplicates.find((customer) => customer.address)?.address);
  primary.city = mergeText(primary.city, duplicates.find((customer) => customer.city)?.city);
  primary.department = mergeText(primary.department, duplicates.find((customer) => customer.department)?.department);
  primary.notes = mergeNotes(primary, duplicates);
  primary.tags = cleanArray([...(primary.tags || []), ...duplicates.flatMap((customer) => customer.tags || []), MERGED_TAG]);
  await primary.save();

  await CustomerFollowUp.updateMany(
    { customer: { $in: duplicateIds } },
    { $set: { customer: primary._id, updatedAt: now } }
  );

  await Order.updateMany(orderMatchForCustomers(duplicates), {
    $set: {
      'customer.name': snapshot.name,
      'customer.lastname': snapshot.lastname,
      'customer.id': snapshot.id,
      'customer.documentType': snapshot.documentType,
      'customer.emailOrPhone': snapshot.emailOrPhone,
      'customer.email': snapshot.email,
      'customer.phone': snapshot.phone,
      'customer.address': snapshot.address,
      'customer.city': snapshot.city,
      'customer.postalCode': snapshot.postalCode,
      'customer.country': snapshot.country,
      'customer.department': snapshot.department,
      'billing.name': snapshot.name,
      'billing.lastname': snapshot.lastname,
      'billing.id': snapshot.id,
      'billing.documentType': snapshot.documentType,
      'billing.email': snapshot.email,
      'billing.phone': snapshot.phone,
      'billing.address': snapshot.address,
      'billing.city': snapshot.city,
      'billing.postalCode': snapshot.postalCode,
      'billing.country': snapshot.country,
      'billing.department': snapshot.department,
    },
  });

  if (!KEEP_OLD_ACTIVE) {
    await Customer.updateMany(
      { _id: { $in: duplicateIds } },
      {
        $set: {
          status: 'inactive',
          active: false,
          deletedAt: now,
          updatedAt: now,
        },
        $addToSet: {
          tags: MERGED_TAG,
        },
      }
    );
  }

  await recomputePrimaryStats(primary);
  await primary.save();
}

function printPlan(plans = []) {
  console.log(`\n=== Merge de duplicados de clientes ===`);
  console.log(`Modo: ${APPLY ? 'APLICAR CAMBIOS' : 'SOLO VISTA PREVIA'}`);
  console.log(`Grupos encontrados: ${plans.length}`);

  if (!plans.length) {
    console.log('No se encontraron grupos duplicados activos.');
    return;
  }

  plans.forEach((plan, index) => {
    console.log(`\nGrupo ${index + 1}`);
    console.log(`Claves duplicadas: ${plan.keys.join(', ')}`);
    console.log(`CONSERVAR: ${customerLabel(plan.primary)}`);
    console.log(`   Compras: ${plan.orderCounts[getCustomerId(plan.primary)] || 0} | Seguimientos: ${plan.followCounts[getCustomerId(plan.primary)] || 0}`);
    plan.duplicates.forEach((customer) => {
      console.log(`MERGEAR:   ${customerLabel(customer)}`);
      console.log(`   Compras: ${plan.orderCounts[getCustomerId(customer)] || 0} | Seguimientos: ${plan.followCounts[getCustomerId(customer)] || 0}`);
    });
  });
}

async function main() {
  await connect();
  const plans = await buildPlan();
  printPlan(plans);

  if (!APPLY) {
    console.log('\nNo se aplicaron cambios. Para ejecutar el merge real usa: npm run customers:merge-duplicates:apply');
    return;
  }

  for (const plan of plans) {
    await applyPlan(plan);
  }

  console.log(`\nMerge aplicado. Grupos procesados: ${plans.length}`);
  console.log('Ejecuta ahora: npm run test:customers');
}

main()
  .catch((error) => {
    console.error('\nERROR mergeDuplicateCustomers:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });
