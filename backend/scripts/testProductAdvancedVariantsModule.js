// backend/scripts/testProductAdvancedVariantsModule.js
/* eslint-disable no-console */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const mongoose = require('mongoose');

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const InventoryMovement = require('../models/InventoryMovement');
const {
  buildVariantKey,
  resolveVariantCommercialSnapshot,
} = require('../lib/products/productVariantConfig');
const {
  resolveAuthoritativeItems,
} = require('../services/orderPricingService');
const {
  createInventoryMovement,
} = require('../services/inventoryService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const TEST_SKU = `VAR-${RUN_ID}`;
const TEST_DYNAMIC_SKU = `VAR4-${RUN_ID}`;

const results = {
  ok: 0,
  warn: 0,
  fail: 0,
};

function ok(message) {
  results.ok += 1;
  console.log(`OK  ${message}`);
}

function warn(message) {
  results.warn += 1;
  console.warn(`WARN ${message}`);
}

function fail(message, error = null) {
  results.fail += 1;
  console.error(`FAIL ${message}`);
  if (error?.message) console.error(`     ${error.message}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function connectDb() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGODB_URI/MONGO_URI no esta configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(uri);
  }

  ok('Conexion a MongoDB activa');
}

async function ensureBranch() {
  let branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({ isMain: -1, isDefaultForOnlineOrders: -1, createdAt: 1 })
    .exec();

  if (branch) {
    ok(`Sede activa encontrada: ${branch.name}`);
    return branch;
  }

  branch = new Branch({
    name: 'Sede Principal',
    code: `VAR-${RUN_ID}`,
    type: 'store',
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,
    notes: `Creada por prueba variantes avanzadas ${RUN_ID}`,
  });

  await branch.save();
  warn('No habia sedes activas. Se creo una sede temporal para la prueba.');
  return branch;
}

async function waitForHook() {
  await new Promise((resolve) => setTimeout(resolve, 300));
}

async function cleanup(...productIds) {
  for (const productId of productIds.filter(Boolean)) {
    await InventoryMovement.deleteMany({ product: productId });
    await InventoryStock.deleteMany({ product: productId });
    await Product.deleteOne({ _id: productId });
  }

  await Product.deleteMany({
    sku: { $in: [TEST_SKU, TEST_DYNAMIC_SKU] },
  });
}

async function main() {
  console.log('\n=== Prueba Variantes Avanzadas de Producto ===');
  console.log(`Run ID: ${RUN_ID}`);

  let product = null;
  let dynamicProduct = null;

  try {
    await connectDb();
    const branch = await ensureBranch();
    await cleanup();

    product = new Product({
      sku: TEST_SKU,
      title: `Producto variantes avanzadas ${RUN_ID}`,
      description: 'Producto temporal para validar imagen, precio, costo, SKU y barcode por variante.',
      productType: 'physical',
      unitOfMeasure: 'unit',
      trackInventory: true,
      allowBackorder: false,
      variantPreset: 'generic',
      category: 'Pruebas variantes',
      categories: ['Pruebas variantes'],
      price: 120000,
      cost: 60000,
      averageCost: 60000,
      image: 'https://example.com/base.jpg',
      images: ['https://example.com/base-gallery.jpg'],
      variants: [
        {
          size: '128GB',
          color: '#0000ff',
          label: '128GB / Azul',
          sku: `${TEST_SKU}-AZU-128`,
          barcode: `770${RUN_ID}128`,
          price: 135000,
          cost: 80000,
          image: 'https://example.com/azul-cover.jpg',
          images: ['https://example.com/azul-1.jpg', 'https://example.com/azul-2.jpg'],
          initialStock: 3,
          active: true,
        },
        {
          size: '256GB',
          color: '#ff0000',
          label: '256GB / Rojo',
          sku: `${TEST_SKU}-ROJ-256`,
          barcode: `770${RUN_ID}256`,
          price: 155000,
          cost: 95000,
          image: 'https://example.com/rojo-cover.jpg',
          images: ['https://example.com/rojo-1.jpg'],
          initialStock: 2,
          active: true,
        },
      ],
      active: true,
    });

    await product.save();
    await waitForHook();
    ok('Producto temporal con variantes avanzadas creado');

    let savedProduct = await Product.findById(product._id).lean();
    assert(Array.isArray(savedProduct.variants) && savedProduct.variants.length === 2, 'No se guardaron las dos variantes avanzadas.');
    ok('Product.variants guarda variantes comerciales avanzadas');

    const blueVariant = savedProduct.variants.find((variant) => variant.color === '#0000ff');
    assert(blueVariant, 'No se encontro variante azul.');
    assert(Number(blueVariant.price || 0) === 135000, 'La variante azul no guardo precio propio.');
    assert(Number(blueVariant.cost || 0) === 80000, 'La variante azul no guardo costo propio.');
    assert(blueVariant.image === 'https://example.com/azul-cover.jpg', 'La variante azul no guardo imagen principal.');
    assert(Array.isArray(blueVariant.images) && blueVariant.images.length === 2, 'La variante azul no guardo galeria propia.');
    ok('Variante guarda precio, costo e imagenes propias');

    let rows = await InventoryStock.find({ product: product._id, deletedAt: null }).lean();
    assert(rows.length >= 2, 'No se crearon filas InventoryStock para las variantes.');

    const blueKey = buildVariantKey('128GB', '#0000ff');
    const redKey = buildVariantKey('256GB', '#ff0000');
    const blueStock = rows.find((row) => row.variantKey === blueKey);
    const redStock = rows.find((row) => row.variantKey === redKey);

    assert(blueStock, 'No existe InventoryStock para variante azul.');
    assert(redStock, 'No existe InventoryStock para variante roja.');
    assert(Number(blueStock.stock || 0) === 3, 'La variante azul no creo stock inicial correcto.');
    assert(Number(redStock.stock || 0) === 2, 'La variante roja no creo stock inicial correcto.');
    ok('Variantes avanzadas se sincronizan con InventoryStock por variantKey');

    assert(blueStock.variant?.sku === `${TEST_SKU}-AZU-128`, 'InventoryStock no guardo snapshot SKU de variante.');
    assert(blueStock.variant?.barcode === `770${RUN_ID}128`, 'InventoryStock no guardo snapshot barcode de variante.');
    ok('InventoryStock conserva SKU y barcode de variante');

    savedProduct = await Product.findById(product._id).lean();
    assert(Number(savedProduct.stock || 0) === 5, 'Product.stock no refleja la suma real de InventoryStock.');
    ok('Product.stock refleja inventario real total');

    const blueSnapshot = resolveVariantCommercialSnapshot(savedProduct, {
      size: '128GB',
      color: '#0000ff',
    });
    assert(Number(blueSnapshot.price || 0) === 135000, 'El helper comercial no resolvio precio de variante.');
    assert(blueSnapshot.image === 'https://example.com/azul-cover.jpg', 'El helper comercial no resolvio imagen de variante.');
    ok('Helper comercial resuelve precio e imagen por variante');

    product = await Product.findById(product._id);
    product.variants = product.variants.map((variant) => {
      const plain = variant.toObject ? variant.toObject() : variant;
      if (plain.color !== '#0000ff') return plain;
      return {
        ...plain,
        price: 145000,
        cost: 82000,
        image: 'https://example.com/azul-cover-v2.jpg',
        initialStock: 999,
      };
    });

    await product.save();
    await waitForHook();
    ok('Variante avanzada editada');

    savedProduct = await Product.findById(product._id).lean();
    const editedSnapshot = resolveVariantCommercialSnapshot(savedProduct, {
      size: '128GB',
      color: '#0000ff',
    });
    assert(Number(editedSnapshot.price || 0) === 145000, 'Editar variante no actualizo precio comercial.');
    assert(editedSnapshot.image === 'https://example.com/azul-cover-v2.jpg', 'Editar variante no actualizo imagen comercial.');
    ok('Editar variante actualiza precio e imagen sin cambiar producto base');

    rows = await InventoryStock.find({ product: product._id, deletedAt: null }).lean();
    const blueStockAfterEdit = rows.find((row) => row.variantKey === blueKey);
    assert(Number(blueStockAfterEdit.stock || 0) === 3, 'Editar variante sobrescribio el stock real existente.');
    ok('Editar variante no sobrescribe stock real existente');

    product = await Product.findById(product._id);
    product.variants = product.variants.map((variant) => {
      const plain = variant.toObject ? variant.toObject() : variant;
      return plain.variantKey === redKey
        ? { ...plain, active: false }
        : plain;
    });
    product.inventory = product.inventory.filter(
      (row) => buildVariantKey(row.size, row.color) !== redKey
    );
    product.$locals = product.$locals || {};
    product.$locals.variantsAuthoritative = true;

    await product.save();
    await waitForHook();

    rows = await InventoryStock.find({
      product: product._id,
      deletedAt: null,
    }).lean();
    const redStockAfterRetire = rows.find(
      (row) => row.variantKey === redKey
    );
    assert(redStockAfterRetire, 'Retirar variante borro su existencia.');
    assert(
      redStockAfterRetire.active === false,
      'Retirar variante dejo activa su existencia.'
    );
    assert(
      Number(redStockAfterRetire.stock || 0) === 2,
      'Retirar variante altero su stock historico.'
    );
    ok('Retirar variante desactiva venta y conserva existencia historica');

    const variantAxes = [
      { key: 'capacidad', label: 'Capacidad', values: ['128 GB'] },
      { key: 'ram', label: 'RAM', values: ['8 GB', '12 GB'] },
      { key: 'color', label: 'Color', values: ['Negro'] },
      {
        key: 'conectividad',
        label: 'Conectividad',
        values: ['5G', 'Wi-Fi'],
      },
    ];
    const attributes5g = [
      { key: 'capacidad', label: 'Capacidad', value: '128 GB' },
      { key: 'ram', label: 'RAM', value: '8 GB' },
      { key: 'color', label: 'Color', value: 'Negro' },
      { key: 'conectividad', label: 'Conectividad', value: '5G' },
    ];
    const attributesWifi = [
      { key: 'capacidad', label: 'Capacidad', value: '128 GB' },
      { key: 'ram', label: 'RAM', value: '12 GB' },
      { key: 'color', label: 'Color', value: 'Negro' },
      { key: 'conectividad', label: 'Conectividad', value: 'Wi-Fi' },
    ];

    dynamicProduct = new Product({
      sku: TEST_DYNAMIC_SKU,
      title: `Producto cuatro atributos ${RUN_ID}`,
      description:
        'Producto temporal con capacidad, RAM, color y conectividad.',
      productType: 'physical',
      unitOfMeasure: 'unit',
      trackInventory: true,
      allowBackorder: false,
      variantPreset: 'tech',
      variantAxes,
      category: 'Pruebas variantes',
      categories: ['Pruebas variantes'],
      price: 1400000,
      cost: 900000,
      image: 'https://example.com/telefono-base.jpg',
      variants: [
        {
          size: '128 GB',
          color: 'Negro',
          attributes: attributes5g,
          sku: `${TEST_DYNAMIC_SKU}-8-5G`,
          price: 1499000,
          image: 'https://example.com/telefono-8-5g.jpg',
          initialStock: 4,
          active: true,
        },
        {
          size: '128 GB',
          color: 'Negro',
          attributes: attributesWifi,
          sku: `${TEST_DYNAMIC_SKU}-12-WIFI`,
          price: 1599000,
          image: 'https://example.com/telefono-12-wifi.jpg',
          initialStock: 6,
          active: true,
        },
      ],
      active: true,
      visible: true,
    });

    await dynamicProduct.save();
    await waitForHook();

    const savedDynamicProduct = await Product.findById(
      dynamicProduct._id
    ).lean();
    const dynamicVariants = savedDynamicProduct.variants || [];
    assert(
      dynamicVariants.length === 2,
      'No se guardaron las dos variantes de cuatro atributos.'
    );
    assert(
      dynamicVariants.every(
        (variant) =>
          Array.isArray(variant.attributes) &&
          variant.attributes.length === 4
      ),
      'Las variantes no conservaron sus cuatro atributos.'
    );
    assert(
      dynamicVariants[0].variantKey !== dynamicVariants[1].variantKey,
      'Dos combinaciones distintas colisionaron en la misma variantKey.'
    );
    assert(
      dynamicVariants.every((variant) =>
        String(variant.variantKey).startsWith('v2__')
      ),
      'Las variantes dinámicas no usan la identidad canónica v2.'
    );
    assert(
      buildVariantKey('', '', [...attributesWifi].reverse()) ===
        buildVariantKey('', '', attributesWifi),
      'La identidad cambia cuando los mismos atributos llegan en otro orden.'
    );
    ok('Cuatro atributos generan combinaciones e identidades independientes');

    const dynamicRows = await InventoryStock.find({
      product: dynamicProduct._id,
      deletedAt: null,
    }).lean();
    assert(
      dynamicRows.length === 2,
      'InventoryStock mezclo variantes con igual talla y color heredados.'
    );
    assert(
      dynamicRows.every(
        (row) =>
          Array.isArray(row.variant?.attributes) &&
          row.variant.attributes.length === 4
      ),
      'InventoryStock no conservo los cuatro atributos de la variante.'
    );
    assert(
      dynamicRows.reduce((sum, row) => sum + Number(row.stock || 0), 0) === 10,
      'InventoryStock no separo correctamente las existencias por combinacion.'
    );
    ok('InventoryStock separa stock por los cuatro atributos');

    const wifiVariant = dynamicVariants.find(
      (variant) => variant.sku === `${TEST_DYNAMIC_SKU}-12-WIFI`
    );
    const wifiSnapshot = resolveVariantCommercialSnapshot(
      savedDynamicProduct,
      { variantKey: wifiVariant.variantKey }
    );
    assert(
      Number(wifiSnapshot.price || 0) === 1599000,
      'La ficha comercial no resolvio el precio de la variante de cuatro atributos.'
    );
    assert(
      wifiSnapshot.variantAttributes?.length === 4,
      'La ficha comercial no devolvio los cuatro atributos.'
    );

    const [orderLine] = await resolveAuthoritativeItems([
      {
        productId: dynamicProduct._id,
        variantKey: wifiVariant.variantKey,
        variantAttributes: attributesWifi,
        quantity: 1,
      },
    ]);
    assert(
      orderLine.variantKey === wifiVariant.variantKey &&
        orderLine.variantAttributes?.length === 4 &&
        Number(orderLine.price || 0) === 1599000,
      'La orden no conservo la variante exacta seleccionada en el carrito.'
    );
    ok('Carrito y orden conservan los cuatro atributos y el precio exacto');

    const adjustment = await createInventoryMovement({
      type: 'adjustment_in',
      productId: dynamicProduct._id,
      branchId: branch._id,
      variantKey: wifiVariant.variantKey,
      variantLabel: wifiVariant.label,
      variantAttributes: attributesWifi,
      size: wifiVariant.size,
      color: wifiVariant.color,
      quantity: 2,
      reason: `Prueba cuatro atributos ${RUN_ID}`,
      reference: `VAR4-${RUN_ID}`,
      postNow: true,
    });
    const adjustedRows = await InventoryStock.find({
      product: dynamicProduct._id,
      deletedAt: null,
    }).lean();
    const adjustedWifiRow = adjustedRows.find(
      (row) => row.variantKey === wifiVariant.variantKey
    );
    const untouched5gRow = adjustedRows.find(
      (row) => row.variantKey !== wifiVariant.variantKey
    );
    assert(
      Number(adjustedWifiRow?.stock || 0) === 8 &&
        Number(untouched5gRow?.stock || 0) === 4,
      'El ajuste de inventario se aplico a otra combinacion.'
    );
    assert(
      adjustment.variantKey === wifiVariant.variantKey &&
        adjustment.variant?.attributes?.length === 4,
      'El kardex no conservo la identidad completa de la variante.'
    );
    ok('Ajustes y Kardex operan sobre la variante exacta de cuatro atributos');
  } catch (error) {
    fail('Error inesperado en prueba Variantes Avanzadas', error);
  } finally {
    await cleanup(product?._id, dynamicProduct?._id);
    ok('Limpieza final de datos temporales');

    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);

    await mongoose.disconnect();

    if (results.fail > 0) process.exit(1);
  }
}

main();
