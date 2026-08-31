// backend/scripts/seedDemonstrationProducts.js
/* eslint-disable no-console */

'use strict';

/**
 * Catálogo demostrativo permanente del módulo Productos.
 *
 * - Crea o restaura exactamente 27 productos identificados con SKU DEMO-*.
 * - Nunca elimina productos.
 * - Nunca modifica un producto ajeno a esta semilla.
 * - Es idempotente: una segunda ejecución conserva los mismos documentos.
 * - Expone variantes, fotos, inventario, taxonomía, SEO, campos comerciales,
 *   productos digitales, servicios y combos.
 */

require('dotenv').config({
  path: require('path').join(__dirname, '..', '.env'),
  quiet: true,
});

const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const Product = require('../models/Product');
const Branch = require('../models/Branch');
const InventoryStock = require('../models/InventoryStock');
const ProductTaxonomy = require('../models/ProductTaxonomy');
const {
  resolveBundleComponents,
} = require('../services/productBundleService');

const RUN_ID = Math.random().toString(36).slice(2, 9).toUpperCase();
const BASE_URL = String(
  process.env.PRODUCT_TEST_BASE_URL || 'http://localhost:5000'
).replace(/\/$/, '');
const SEED_TAG = 'seed-demonstration-products-v1';
const DEMO_SKU_PREFIX = 'DEMO-';

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
  if (error?.data) console.error(`     ${JSON.stringify(error.data)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function money(value) {
  return Number(value || 0).toLocaleString('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  });
}

function imageUrl(
  photoId,
  width = 1200,
  version = 1,
  adjustments = {}
) {
  const params = new URLSearchParams({
    auto: 'format',
    fit: 'crop',
    w: String(width),
    q: '82',
    v: String(version),
  });

  Object.entries(adjustments).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  });

  return `https://images.unsplash.com/${photoId}?${params.toString()}`;
}

function gallery(photoId) {
  return [
    imageUrl(photoId, 1200, 1),
    imageUrl(photoId, 900, 2),
  ];
}

function variantImageProfile(index = 0) {
  const profiles = [
    { hue: 0, sat: -12, con: 3, exp: 0 },
    { hue: 35, sat: 18, con: 7, exp: 2 },
    { hue: 95, sat: 32, con: 10, exp: -2 },
    { hue: 180, sat: -45, con: 12, exp: 4 },
    { hue: 250, sat: 45, con: 5, exp: -4 },
    { hue: 315, sat: 6, con: 15, exp: 3 },
  ];

  return profiles[index % profiles.length];
}

function variantGallery(photoId, index) {
  const profile = variantImageProfile(index);
  const alternateProfile = {
    ...profile,
    hue: (profile.hue + 12) % 360,
    exp: Math.max(-100, Math.min(100, profile.exp + 2)),
  };

  return [
    imageUrl(photoId, 1200, index + 30, profile),
    imageUrl(photoId, 900, index + 50, alternateProfile),
  ];
}

let productBarcodeSequence = 7798000000000;
let variantBarcodeSequence = 7799000000000;

function nextProductBarcode() {
  productBarcodeSequence += 1;
  return String(productBarcodeSequence);
}

function nextVariantBarcode() {
  variantBarcodeSequence += 1;
  return String(variantBarcodeSequence);
}

function variant(
  size,
  tone,
  color,
  stock,
  price,
  cost,
  suffix,
  photoId
) {
  return {
    size,
    tone,
    color,
    stock,
    price,
    cost,
    suffix,
    photoId,
  };
}

function makePhysical({
  sku,
  title,
  description,
  categoryKey,
  collectionKeys = ['featured'],
  photoId,
  price,
  originalPrice = null,
  cost,
  taxRate = 19,
  brand,
  unitOfMeasure = 'unit',
  variantPreset = 'custom',
  axisLabels = ['Presentación', 'Color'],
  variants,
  weightGrams = 500,
  dimensionsCm = { l: 20, w: 15, h: 10 },
  reorderPoint = 3,
  reorderQty = 8,
  visible = true,
  active = true,
  extraTags = [],
  publicField = null,
}) {
  const normalizedVariants = variants.map((row, index) => {
    const variantPhoto = row.photoId || photoId;
    const imageProfile = variantImageProfile(index);
    return {
      size: row.size,
      color: row.color,
      label: `${row.size} / ${row.tone}`,
      attributes: [
        {
          key: axisLabels[0].toLowerCase(),
          label: axisLabels[0],
          value: row.size,
        },
        {
          key: axisLabels[1].toLowerCase(),
          label: axisLabels[1],
          value: row.tone,
        },
      ],
      sku: `${sku}-${row.suffix}`,
      barcode: nextVariantBarcode(),
      price: row.price,
      cost: row.cost,
      originalPrice:
        originalPrice && row.price < originalPrice
          ? originalPrice
          : null,
      image: imageUrl(
        variantPhoto,
        1000,
        index + 10,
        imageProfile
      ),
      images: variantGallery(variantPhoto, index),
      active: true,
      sortOrder: index,
      initialStock: row.stock,
    };
  });

  return {
    sku,
    title,
    description,
    productType: 'physical',
    categoryKey,
    collectionKeys,
    photoId,
    price,
    originalPrice,
    cost,
    averageCost: cost,
    taxRate,
    taxIncluded: true,
    brand,
    supplier: {
      name: `Proveedor demostrativo ${brand}`,
      contact: 'Catálogo de prueba',
      email: 'productos.demo@example.com',
    },
    barcode: nextProductBarcode(),
    unitOfMeasure,
    trackInventory: true,
    allowBackorder: false,
    variantPreset,
    variantAxes: [
      {
        label: axisLabels[0],
        values: [...new Set(variants.map((row) => row.size))],
      },
      {
        label: axisLabels[1],
        values: [...new Set(variants.map((row) => row.tone))],
      },
    ],
    variants: normalizedVariants,
    sizes: [...new Set(variants.map((row) => row.size))],
    colors: [...new Set(variants.map((row) => row.color))],
    inventory: normalizedVariants.map((row) => ({
      size: row.size,
      color: row.color,
      stock: row.initialStock,
    })),
    stockRows: normalizedVariants.map((row) => ({
      label: row.label,
      size: row.size,
      color: row.color,
      attributes: row.attributes,
      sku: row.sku,
      barcode: row.barcode,
      stock: row.initialStock,
      reservedStock: 0,
      reorderPoint,
    })),
    reorderPoint,
    reorderQty,
    weightGrams,
    dimensionsCm,
    visible,
    active,
    tags: ['Demostración', 'Físico', 'Con variantes', ...extraTags],
    publicField,
  };
}

function makeDigital({
  sku,
  title,
  description,
  photoId,
  price,
  cost,
  deliveryMode,
  fileName,
  mimeType,
  categoryKey = 'digital',
  collectionKeys = ['digital'],
  visible = true,
  active = true,
}) {
  return {
    sku,
    title,
    description,
    productType: 'digital',
    categoryKey,
    collectionKeys,
    photoId,
    price,
    cost,
    averageCost: cost,
    taxRate: 19,
    taxIncluded: true,
    brand: 'Demo Digital',
    supplier: {
      name: 'Estudio Digital Demostrativo',
      contact: 'Entrega electrónica',
      email: 'digital.demo@example.com',
    },
    barcode: nextProductBarcode(),
    unitOfMeasure: 'license',
    trackInventory: false,
    allowBackorder: true,
    variantPreset: 'none',
    variantAxes: [],
    variants: [],
    sizes: [],
    colors: [],
    inventory: [],
    stockRows: [],
    reorderPoint: 0,
    reorderQty: 0,
    weightGrams: 0,
    dimensionsCm: { l: 0, w: 0, h: 0 },
    visible,
    active,
    tags: ['Demostración', 'Digital', deliveryMode === 'automatic' ? 'Entrega automática' : 'Entrega manual'],
    digitalDelivery: {
      deliveryMode,
      assetUrl:
        deliveryMode === 'automatic'
          ? `https://downloads.example.com/demo/${fileName}`
          : '',
      fileName,
      mimeType,
      fileSizeBytes: 5242880,
      downloadLimit: 3,
      accessDays: 30,
      customerMessage:
        deliveryMode === 'automatic'
          ? 'Tu enlace seguro se habilita cuando se confirma el pago.'
          : 'El equipo enviará el material al correo registrado después de verificar el pago.',
    },
  };
}

function makeService({
  sku,
  title,
  description,
  photoId,
  price,
  cost,
  fulfillmentMode,
  locationType,
  durationMinutes,
  leadTimeHours,
  categoryKey = 'services',
  collectionKeys = ['services'],
  visible = true,
  active = true,
}) {
  return {
    sku,
    title,
    description,
    productType: 'service',
    categoryKey,
    collectionKeys,
    photoId,
    price,
    cost,
    averageCost: cost,
    taxRate: 19,
    taxIncluded: true,
    brand: 'Demo Servicios',
    supplier: {
      name: 'Equipo de Servicios Demostrativos',
      contact: 'Coordinación de agenda',
      email: 'servicios.demo@example.com',
    },
    barcode: nextProductBarcode(),
    unitOfMeasure: 'service',
    trackInventory: false,
    allowBackorder: true,
    variantPreset: 'none',
    variantAxes: [],
    variants: [],
    sizes: [],
    colors: [],
    inventory: [],
    stockRows: [],
    reorderPoint: 0,
    reorderQty: 0,
    weightGrams: 0,
    dimensionsCm: { l: 0, w: 0, h: 0 },
    visible,
    active,
    tags: ['Demostración', 'Servicio', locationType, fulfillmentMode],
    serviceDelivery: {
      fulfillmentMode,
      locationType,
      durationMinutes,
      leadTimeHours,
      bookingUrl:
        fulfillmentMode === 'scheduled'
          ? 'https://agenda.example.com/demo/reservar'
          : '',
      customerInstructions:
        locationType === 'online'
          ? 'Después del pago recibirás las instrucciones para conectarte.'
          : locationType === 'customer'
            ? 'Confirma dirección, disponibilidad y persona de contacto.'
            : 'Presenta el número de pedido al llegar a la sede.',
      internalInstructions:
        'Ejemplo demostrativo: asignar responsable y actualizar el estado de la prestación desde la orden.',
    },
  };
}

function makeBundle({
  sku,
  title,
  description,
  photoId,
  price,
  cost,
  components,
  collectionKeys = ['bundles'],
}) {
  return {
    sku,
    title,
    description,
    productType: 'bundle',
    categoryKey: 'bundles',
    collectionKeys,
    photoId,
    price,
    originalPrice: Math.round(price * 1.18),
    cost,
    averageCost: cost,
    taxRate: 19,
    taxIncluded: true,
    brand: 'Demo Combos',
    supplier: {
      name: 'Catálogo de Combos Demostrativos',
      contact: 'Composición automática',
      email: 'combos.demo@example.com',
    },
    barcode: nextProductBarcode(),
    unitOfMeasure: 'package',
    trackInventory: false,
    allowBackorder: false,
    variantPreset: 'none',
    variantAxes: [],
    variants: [],
    sizes: [],
    colors: [],
    inventory: [],
    stockRows: [],
    reorderPoint: 0,
    reorderQty: 0,
    weightGrams: 0,
    dimensionsCm: { l: 0, w: 0, h: 0 },
    visible: true,
    active: true,
    tags: ['Demostración', 'Combo', 'Componentes reales'],
    componentSpecs: components,
  };
}

const PHYSICAL_PRODUCTS = [
  makePhysical({
    sku: 'DEMO-TEC-SMARTPHONE-X',
    title: 'DEMO Smartphone X Pro',
    description: 'Teléfono demostrativo con precios, costos, códigos, fotos y existencias diferentes por capacidad y color.',
    categoryKey: 'technology',
    collectionKeys: ['featured', 'offers'],
    photoId: 'photo-1511707171634-5f897ff02aa9',
    price: 1899000,
    originalPrice: 2199000,
    cost: 1320000,
    brand: 'DemoTech',
    variantPreset: 'tech',
    axisLabels: ['Capacidad', 'Color'],
    variants: [
      variant('128 GB', 'Negro', '#111827', 8, 1899000, 1320000, '128-NEG'),
      variant('128 GB', 'Azul', '#1d4ed8', 5, 1949000, 1350000, '128-AZU'),
      variant('256 GB', 'Negro', '#111827', 4, 2199000, 1510000, '256-NEG'),
      variant('256 GB', 'Dorado', '#d4af37', 2, 2249000, 1540000, '256-DOR'),
    ],
    weightGrams: 210,
    dimensionsCm: { l: 16, w: 8, h: 1 },
    publicField: ['Pantalla', '6,7 pulgadas AMOLED'],
  }),
  makePhysical({
    sku: 'DEMO-MOD-CAMISETA-PREMIUM',
    title: 'DEMO Camiseta Premium',
    description: 'Prenda con combinación de tallas y colores, imágenes y precios por variante.',
    categoryKey: 'fashion',
    photoId: 'photo-1521572163474-6864f9cf17ab',
    price: 69900,
    originalPrice: 89900,
    cost: 33000,
    brand: 'DemoWear',
    variantPreset: 'fashion',
    axisLabels: ['Talla', 'Color'],
    variants: [
      variant('S', 'Negro', '#000000', 12, 69900, 33000, 'S-NEG'),
      variant('M', 'Negro', '#000000', 15, 69900, 33000, 'M-NEG'),
      variant('L', 'Negro', '#000000', 10, 69900, 33000, 'L-NEG'),
      variant('S', 'Blanco', '#ffffff', 9, 71900, 34000, 'S-BLA'),
      variant('M', 'Blanco', '#ffffff', 11, 71900, 34000, 'M-BLA'),
      variant('L', 'Blanco', '#ffffff', 7, 71900, 34000, 'L-BLA'),
    ],
    weightGrams: 260,
    publicField: ['Material', 'Algodón peinado'],
  }),
  makePhysical({
    sku: 'DEMO-CAL-TENIS-URBANOS',
    title: 'DEMO Tenis Urbanos Flex',
    description: 'Calzado con talla, color, SKU, código de barras, imagen y precio propios por variante.',
    categoryKey: 'footwear',
    collectionKeys: ['featured', 'new'],
    photoId: 'photo-1542291026-7eec264c27ff',
    price: 219900,
    originalPrice: 259900,
    cost: 118000,
    brand: 'DemoStep',
    variantPreset: 'footwear',
    axisLabels: ['Talla', 'Color'],
    variants: [
      variant('38', 'Blanco', '#ffffff', 5, 219900, 118000, '38-BLA'),
      variant('39', 'Blanco', '#ffffff', 7, 219900, 118000, '39-BLA'),
      variant('40', 'Negro', '#000000', 6, 229900, 122000, '40-NEG'),
      variant('41', 'Negro', '#000000', 3, 229900, 122000, '41-NEG'),
    ],
    weightGrams: 850,
    dimensionsCm: { l: 34, w: 22, h: 13 },
    publicField: ['Suela', 'Caucho flexible antideslizante'],
  }),
  makePhysical({
    sku: 'DEMO-TEC-AUDIFONOS-BT',
    title: 'DEMO Audífonos Bluetooth Pro',
    description: 'Audio inalámbrico con colores, fotografías e inventario independientes.',
    categoryKey: 'technology',
    collectionKeys: ['offers'],
    photoId: 'photo-1505740420928-5e560c06d30e',
    price: 159000,
    originalPrice: 189000,
    cost: 85000,
    brand: 'DemoSound',
    variantPreset: 'tech',
    axisLabels: ['Conectividad', 'Color'],
    variants: [
      variant('Bluetooth 5.3', 'Negro', '#000000', 12, 159000, 85000, 'BT-NEG'),
      variant('Bluetooth 5.3', 'Blanco', '#ffffff', 8, 164000, 87000, 'BT-BLA'),
    ],
    weightGrams: 250,
    dimensionsCm: { l: 16, w: 10, h: 6 },
    publicField: ['Autonomía', 'Hasta 30 horas'],
  }),
  makePhysical({
    sku: 'DEMO-ALI-CAFE-ESPECIAL',
    title: 'DEMO Café Especial Sierra',
    description: 'Alimento con presentación, tipo de tostión, IVA y stock por referencia.',
    categoryKey: 'food',
    collectionKeys: ['featured'],
    photoId: 'photo-1495474472287-4d71bcdd2085',
    price: 28500,
    cost: 16000,
    taxRate: 5,
    brand: 'DemoCafé',
    unitOfMeasure: 'package',
    variantPreset: 'food',
    axisLabels: ['Presentación', 'Tostión'],
    variants: [
      variant('250 g', 'Media', '#8b5e3c', 25, 18500, 10200, '250-MED'),
      variant('500 g', 'Media', '#8b5e3c', 18, 28500, 16000, '500-MED'),
      variant('500 g', 'Oscura', '#4b2e1f', 14, 29900, 16800, '500-OSC'),
    ],
    weightGrams: 520,
    publicField: ['Origen', 'Sierra Nevada de Santa Marta'],
  }),
  makePhysical({
    sku: 'DEMO-BEL-SHAMPOO',
    title: 'DEMO Shampoo Hidratante',
    description: 'Producto de belleza con aroma y presentación diferenciados.',
    categoryKey: 'beauty',
    collectionKeys: ['new'],
    photoId: 'photo-1556228720-195a672e8a03',
    price: 32000,
    cost: 18500,
    brand: 'DemoCare',
    variantPreset: 'beauty',
    axisLabels: ['Presentación', 'Aroma'],
    variants: [
      variant('250 ml', 'Coco', '#f5f5dc', 20, 22000, 12500, '250-COC'),
      variant('500 ml', 'Coco', '#f5f5dc', 16, 32000, 18500, '500-COC'),
      variant('500 ml', 'Aloe', '#86efac', 13, 33500, 19200, '500-ALO'),
    ],
    weightGrams: 560,
    dimensionsCm: { l: 7, w: 7, h: 22 },
    publicField: ['Tipo de cabello', 'Seco o maltratado'],
  }),
  makePhysical({
    sku: 'DEMO-HOG-SILLA-ERGONOMICA',
    title: 'DEMO Silla Ergonómica Office',
    description: 'Mueble con acabados, costos, precios y existencias por variante.',
    categoryKey: 'home',
    collectionKeys: ['featured'],
    photoId: 'photo-1586023492125-27b2c045efd7',
    price: 689000,
    originalPrice: 749000,
    cost: 410000,
    brand: 'DemoHome',
    variantPreset: 'home',
    axisLabels: ['Tamaño', 'Acabado'],
    variants: [
      variant('Estándar', 'Negro', '#000000', 4, 689000, 410000, 'STD-NEG'),
      variant('Estándar', 'Gris', '#808080', 3, 699000, 418000, 'STD-GRI'),
      variant('Alta', 'Negro', '#000000', 2, 759000, 452000, 'ALT-NEG'),
    ],
    weightGrams: 14500,
    dimensionsCm: { l: 70, w: 68, h: 120 },
    reorderPoint: 1,
    reorderQty: 3,
    publicField: ['Soporte', 'Lumbar ajustable'],
  }),
  makePhysical({
    sku: 'DEMO-HOG-LAMPARA-LED',
    title: 'DEMO Lámpara LED Minimalista',
    description: 'Ejemplo activo pero oculto en la tienda pública para probar visibilidad administrativa.',
    categoryKey: 'home',
    collectionKeys: ['new'],
    photoId: 'photo-1507473885765-e6ed057f782c',
    price: 129900,
    cost: 67000,
    brand: 'DemoLight',
    variantPreset: 'home',
    axisLabels: ['Potencia', 'Color'],
    variants: [
      variant('12 W', 'Negro', '#000000', 9, 129900, 67000, '12-NEG'),
      variant('12 W', 'Dorado', '#ffd700', 6, 139900, 72000, '12-DOR'),
    ],
    weightGrams: 1800,
    dimensionsCm: { l: 25, w: 25, h: 45 },
    visible: false,
    active: true,
    extraTags: ['Oculto'],
    publicField: ['Estado de ejemplo', 'Activo y oculto'],
  }),
  makePhysical({
    sku: 'DEMO-ACC-MOCHILA-VIAJE',
    title: 'DEMO Mochila de Viaje 30 L',
    description: 'Accesorio con tres colores y control independiente de disponibilidad.',
    categoryKey: 'accessories',
    collectionKeys: ['offers'],
    photoId: 'photo-1553062407-98eeb64c6a62',
    price: 179900,
    originalPrice: 209900,
    cost: 94000,
    brand: 'DemoTrip',
    variantPreset: 'custom',
    axisLabels: ['Capacidad', 'Color'],
    variants: [
      variant('30 L', 'Negro', '#000000', 10, 179900, 94000, '30-NEG'),
      variant('30 L', 'Azul', '#1d4ed8', 7, 184900, 97000, '30-AZU'),
      variant('30 L', 'Verde', '#15803d', 5, 184900, 97000, '30-VER'),
    ],
    weightGrams: 920,
    dimensionsCm: { l: 48, w: 32, h: 20 },
    publicField: ['Resistencia', 'Tela repelente al agua'],
  }),
  makePhysical({
    sku: 'DEMO-ACC-RELOJ-URBANO',
    title: 'DEMO Reloj Urbano',
    description: 'Reloj con correa y acabado diferenciados por variante.',
    categoryKey: 'accessories',
    collectionKeys: ['featured'],
    photoId: 'photo-1523275335684-37898b6baf30',
    price: 249900,
    cost: 128000,
    brand: 'DemoTime',
    variantPreset: 'custom',
    axisLabels: ['Correa', 'Acabado'],
    variants: [
      variant('Cuero', 'Marrón', '#8b4513', 6, 249900, 128000, 'CUE-MAR'),
      variant('Cuero', 'Negro', '#000000', 5, 254900, 131000, 'CUE-NEG'),
      variant('Acero', 'Plateado', '#c0c0c0', 4, 289900, 149000, 'ACE-PLA'),
    ],
    weightGrams: 160,
    dimensionsCm: { l: 10, w: 10, h: 8 },
    publicField: ['Garantía', '12 meses'],
  }),
  makePhysical({
    sku: 'DEMO-HOG-LICUADORA',
    title: 'DEMO Licuadora PowerMix',
    description: 'Electrodoméstico con potencia y color por referencia.',
    categoryKey: 'home',
    collectionKeys: ['offers'],
    photoId: 'photo-1570222094114-d054a817e56b',
    price: 269900,
    originalPrice: 319900,
    cost: 158000,
    brand: 'DemoKitchen',
    variantPreset: 'home',
    axisLabels: ['Potencia', 'Color'],
    variants: [
      variant('600 W', 'Negro', '#000000', 8, 269900, 158000, '600-NEG'),
      variant('800 W', 'Rojo', '#dc2626', 5, 319900, 187000, '800-ROJ'),
    ],
    weightGrams: 3400,
    dimensionsCm: { l: 23, w: 20, h: 42 },
    publicField: ['Vaso', 'Vidrio de 1,5 litros'],
  }),
  makePhysical({
    sku: 'DEMO-PAP-CUADERNO',
    title: 'DEMO Cuaderno Creativo',
    description: 'Ejemplo inactivo y oculto que conserva sus variantes e historial para administración.',
    categoryKey: 'stationery',
    collectionKeys: ['new'],
    photoId: 'photo-1531346878377-a5be20888e57',
    price: 18900,
    cost: 8500,
    brand: 'DemoPaper',
    variantPreset: 'custom',
    axisLabels: ['Tamaño', 'Diseño'],
    variants: [
      variant('A5', 'Azul', '#2563eb', 18, 18900, 8500, 'A5-AZU'),
      variant('A5', 'Rosa', '#f472b6', 15, 18900, 8500, 'A5-ROS'),
      variant('Carta', 'Negro', '#000000', 12, 24900, 11200, 'CAR-NEG'),
    ],
    weightGrams: 430,
    dimensionsCm: { l: 28, w: 22, h: 2 },
    visible: false,
    active: false,
    extraTags: ['Inactivo'],
    publicField: ['Estado de ejemplo', 'Inactivo y oculto'],
  }),
  makePhysical({
    sku: 'DEMO-HOG-MACETA',
    title: 'DEMO Maceta Cerámica',
    description: 'Decoración con tamaños y acabados distintos.',
    categoryKey: 'home',
    collectionKeys: ['new'],
    photoId: 'photo-1485955900006-10f4d324d411',
    price: 49900,
    cost: 23000,
    brand: 'DemoDeco',
    variantPreset: 'home',
    axisLabels: ['Tamaño', 'Color'],
    variants: [
      variant('Pequeña', 'Blanco', '#ffffff', 14, 39900, 18500, 'PEQ-BLA'),
      variant('Mediana', 'Terracota', '#c65d3b', 11, 49900, 23000, 'MED-TER'),
      variant('Grande', 'Negro', '#000000', 7, 69900, 32000, 'GRA-NEG'),
    ],
    weightGrams: 2100,
    dimensionsCm: { l: 28, w: 28, h: 30 },
    publicField: ['Uso', 'Interior y exterior cubierto'],
  }),
  makePhysical({
    sku: 'DEMO-MAS-ALIMENTO-PERRO',
    title: 'DEMO Alimento Premium para Perro',
    description: 'Producto para mascotas con tamaños y fórmulas diferenciadas.',
    categoryKey: 'pets',
    collectionKeys: ['featured'],
    photoId: 'photo-1589924691995-400dc9ecc119',
    price: 89900,
    cost: 57000,
    taxRate: 5,
    brand: 'DemoPet',
    unitOfMeasure: 'package',
    variantPreset: 'food',
    axisLabels: ['Peso', 'Fórmula'],
    variants: [
      variant('2 kg', 'Adulto', '#8b5e3c', 16, 49900, 31000, '2K-ADU'),
      variant('5 kg', 'Adulto', '#8b5e3c', 12, 89900, 57000, '5K-ADU'),
      variant('5 kg', 'Cachorro', '#f59e0b', 10, 94900, 60000, '5K-CAC'),
    ],
    weightGrams: 5200,
    dimensionsCm: { l: 45, w: 30, h: 12 },
    publicField: ['Proteína', '26 % mínimo'],
  }),
  makePhysical({
    sku: 'DEMO-DEP-BICICLETA',
    title: 'DEMO Bicicleta Urbana',
    description: 'Producto deportivo de alto valor con talla de marco, color, precio y stock por variante.',
    categoryKey: 'sports',
    collectionKeys: ['featured', 'new'],
    photoId: 'photo-1485965120184-e220f721d03e',
    price: 1299000,
    originalPrice: 1499000,
    cost: 870000,
    brand: 'DemoRide',
    variantPreset: 'custom',
    axisLabels: ['Marco', 'Color'],
    variants: [
      variant('S', 'Negro', '#000000', 3, 1299000, 870000, 'S-NEG'),
      variant('M', 'Negro', '#000000', 4, 1299000, 870000, 'M-NEG'),
      variant('M', 'Azul', '#1d4ed8', 2, 1349000, 895000, 'M-AZU'),
      variant('L', 'Gris', '#808080', 2, 1349000, 895000, 'L-GRI'),
    ],
    weightGrams: 13800,
    dimensionsCm: { l: 175, w: 65, h: 105 },
    reorderPoint: 1,
    reorderQty: 2,
    publicField: ['Cambios', '7 velocidades'],
  }),
  makePhysical({
    sku: 'DEMO-TEC-MONITOR-4K',
    title: 'DEMO Monitor Profesional 4K',
    description: 'Pantalla con tamaño, resolución, costos e imágenes propios.',
    categoryKey: 'technology',
    collectionKeys: ['featured'],
    photoId: 'photo-1527443224154-c4a3942d3acf',
    price: 1199000,
    cost: 760000,
    brand: 'DemoView',
    variantPreset: 'tech',
    axisLabels: ['Tamaño', 'Resolución'],
    variants: [
      variant('27 pulgadas', '4K', '#111827', 5, 1199000, 760000, '27-4K'),
      variant('32 pulgadas', '4K', '#111827', 3, 1549000, 980000, '32-4K'),
    ],
    weightGrams: 7200,
    dimensionsCm: { l: 72, w: 22, h: 51 },
    publicField: ['Conectividad', 'HDMI, DisplayPort y USB-C'],
  }),
  makePhysical({
    sku: 'DEMO-BEL-PERFUME',
    title: 'DEMO Perfume Esencia',
    description: 'Fragancia con volumen, familia olfativa y precio por presentación.',
    categoryKey: 'beauty',
    collectionKeys: ['offers'],
    photoId: 'photo-1541643600914-78b084683601',
    price: 189900,
    cost: 92000,
    brand: 'DemoEssence',
    variantPreset: 'beauty',
    axisLabels: ['Volumen', 'Familia'],
    variants: [
      variant('50 ml', 'Cítrica', '#fbbf24', 9, 149900, 72000, '50-CIT'),
      variant('100 ml', 'Cítrica', '#fbbf24', 6, 219900, 108000, '100-CIT'),
      variant('100 ml', 'Amaderada', '#92400e', 5, 229900, 112000, '100-AMA'),
    ],
    weightGrams: 420,
    dimensionsCm: { l: 12, w: 8, h: 18 },
    publicField: ['Concentración', 'Eau de parfum'],
  }),
  makePhysical({
    sku: 'DEMO-JUG-BLOQUES',
    title: 'DEMO Bloques Creativos',
    description: 'Juguete con cantidad de piezas y tema por variante.',
    categoryKey: 'toys',
    collectionKeys: ['new', 'offers'],
    photoId: 'photo-1594787318286-3d835c1d207f',
    price: 79900,
    originalPrice: 94900,
    cost: 41000,
    brand: 'DemoKids',
    unitOfMeasure: 'box',
    variantPreset: 'custom',
    axisLabels: ['Piezas', 'Tema'],
    variants: [
      variant('120 piezas', 'Ciudad', '#3b82f6', 12, 79900, 41000, '120-CIU'),
      variant('180 piezas', 'Espacio', '#7c3aed', 8, 109900, 57000, '180-ESP'),
      variant('220 piezas', 'Vehículos', '#ef4444', 6, 129900, 68000, '220-VEH'),
    ],
    weightGrams: 1300,
    dimensionsCm: { l: 38, w: 28, h: 9 },
    publicField: ['Edad recomendada', '6 años en adelante'],
  }),
];

const DIGITAL_PRODUCTS = [
  makeDigital({
    sku: 'DEMO-DIG-EBOOK-VENTAS',
    title: 'DEMO Ebook Guía de Ventas',
    description: 'Archivo PDF con entrega automática, enlace protegido, vencimiento y límite de descargas.',
    photoId: 'photo-1544716278-ca5e3f4abd8c',
    price: 39000,
    cost: 4000,
    deliveryMode: 'automatic',
    fileName: 'guia-demo-ventas.pdf',
    mimeType: 'application/pdf',
  }),
  makeDigital({
    sku: 'DEMO-DIG-PLANTILLAS',
    title: 'DEMO Pack de Plantillas Profesionales',
    description: 'Archivo ZIP que permite probar cumplimiento digital automático después del pago.',
    photoId: 'photo-1460661419201-fd4cecdf8a8b',
    price: 59000,
    cost: 8000,
    deliveryMode: 'automatic',
    fileName: 'plantillas-demo.zip',
    mimeType: 'application/zip',
  }),
  makeDigital({
    sku: 'DEMO-DIG-CURSO-GRABADO',
    title: 'DEMO Curso Grabado de Excel',
    description: 'Producto digital de entrega manual para comparar los dos modos de cumplimiento.',
    photoId: 'photo-1522202176988-66273c2fd55f',
    price: 129000,
    cost: 22000,
    deliveryMode: 'manual',
    fileName: 'acceso-curso-excel.txt',
    mimeType: 'text/plain',
  }),
];

const SERVICE_PRODUCTS = [
  makeService({
    sku: 'DEMO-SER-CONSULTORIA-ONLINE',
    title: 'DEMO Consultoría Online 60 Minutos',
    description: 'Servicio agendable en línea con duración, anticipación e instrucciones para el cliente.',
    photoId: 'photo-1556761175-b413da4baf72',
    price: 150000,
    cost: 65000,
    fulfillmentMode: 'scheduled',
    locationType: 'online',
    durationMinutes: 60,
    leadTimeHours: 24,
  }),
  makeService({
    sku: 'DEMO-SER-INSTALACION-DOMICILIO',
    title: 'DEMO Instalación a Domicilio',
    description: 'Servicio prestado en la dirección del cliente, con seguimiento desde la orden.',
    photoId: 'photo-1581092918056-0c4c3acd3789',
    price: 110000,
    cost: 48000,
    fulfillmentMode: 'scheduled',
    locationType: 'customer',
    durationMinutes: 90,
    leadTimeHours: 48,
  }),
  makeService({
    sku: 'DEMO-SER-MANTENIMIENTO-SEDE',
    title: 'DEMO Mantenimiento en Sede',
    description: 'Servicio manual recibido en sede para probar estados de prestación sin envío ni inventario.',
    photoId: 'photo-1581092160562-40aa08e78837',
    price: 85000,
    cost: 36000,
    fulfillmentMode: 'manual',
    locationType: 'store',
    durationMinutes: 120,
    leadTimeHours: 0,
  }),
];

const BUNDLE_PRODUCTS = [
  makeBundle({
    sku: 'DEMO-COM-OFICINA',
    title: 'DEMO Combo Oficina Productiva',
    description: 'Combo físico que descuenta una variante concreta de silla, monitor y audífonos.',
    photoId: 'photo-1497215728101-856f4ea42174',
    price: 829000,
    cost: 500000,
    components: [
      { sku: 'DEMO-HOG-SILLA-ERGONOMICA', variantIndex: 0, quantity: 1 },
      { sku: 'DEMO-TEC-MONITOR-4K', variantIndex: 0, quantity: 1 },
      { sku: 'DEMO-TEC-AUDIFONOS-BT', variantIndex: 0, quantity: 1 },
    ],
  }),
  makeBundle({
    sku: 'DEMO-COM-CREADOR',
    title: 'DEMO Combo Creador Híbrido',
    description: 'Combo mixto con audífonos físicos, plantillas digitales y consultoría online.',
    photoId: 'photo-1497366811353-6870744d04b2',
    price: 299000,
    cost: 158000,
    components: [
      { sku: 'DEMO-TEC-AUDIFONOS-BT', variantIndex: 0, quantity: 1 },
      { sku: 'DEMO-DIG-PLANTILLAS', quantity: 1 },
      { sku: 'DEMO-SER-CONSULTORIA-ONLINE', quantity: 1 },
    ],
  }),
  makeBundle({
    sku: 'DEMO-COM-NEGOCIO-DIGITAL',
    title: 'DEMO Combo Negocio Digital',
    description: 'Combo completamente virtual con ebook, curso y consultoría; no genera costo de envío.',
    photoId: 'photo-1552664730-d307ca884978',
    price: 249000,
    cost: 91000,
    components: [
      { sku: 'DEMO-DIG-EBOOK-VENTAS', quantity: 1 },
      { sku: 'DEMO-DIG-CURSO-GRABADO', quantity: 1 },
      { sku: 'DEMO-SER-CONSULTORIA-ONLINE', quantity: 1 },
    ],
  }),
];

const DEMO_PRODUCTS = [
  ...PHYSICAL_PRODUCTS,
  ...DIGITAL_PRODUCTS,
  ...SERVICE_PRODUCTS,
  ...BUNDLE_PRODUCTS,
];

assert(
  DEMO_PRODUCTS.length === 27,
  `La definición debe contener 27 productos y contiene ${DEMO_PRODUCTS.length}`
);

const TAXONOMY_DEFINITIONS = [
  {
    key: 'root',
    kind: 'category',
    name: 'DEMOSTRACIÓN',
    slug: 'demo-catalogo',
    description: `Raíz del catálogo demostrativo. ${SEED_TAG}`,
    sortOrder: 900,
  },
  ...[
    ['technology', 'Tecnología'],
    ['fashion', 'Moda'],
    ['footwear', 'Calzado'],
    ['food', 'Alimentos'],
    ['beauty', 'Belleza'],
    ['home', 'Hogar'],
    ['accessories', 'Accesorios'],
    ['stationery', 'Papelería'],
    ['pets', 'Mascotas'],
    ['sports', 'Deportes'],
    ['toys', 'Juguetes'],
    ['digital', 'Productos digitales'],
    ['services', 'Servicios'],
    ['bundles', 'Combos'],
  ].map(([key, name], index) => ({
    key,
    kind: 'category',
    name: `DEMO · ${name}`,
    slug: `demo-${key}`,
    parentKey: 'root',
    description: `Categoría demostrativa ${name}. ${SEED_TAG}`,
    sortOrder: 910 + index,
  })),
  ...[
    ['featured', 'DEMO · Destacados'],
    ['offers', 'DEMO · Ofertas'],
    ['new', 'DEMO · Novedades'],
    ['digital', 'DEMO · Entrega digital'],
    ['services', 'DEMO · Servicios'],
    ['bundles', 'DEMO · Combos'],
  ].map(([key, name], index) => ({
    key: `collection:${key}`,
    kind: 'collection',
    name,
    slug: `demo-collection-${key}`,
    description: `Colección demostrativa. ${SEED_TAG}`,
    sortOrder: 950 + index,
  })),
];

function makeToken() {
  if (!process.env.JWT_SECRET) return null;

  return jwt.sign(
    {
      role: 'admin',
      username: 'products-demonstration-seed',
      authType: 'legacy',
      adminRole: 'owner',
    },
    process.env.JWT_SECRET,
    { expiresIn: '30m' }
  );
}

async function connectDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no está configurado en backend/.env');
  }

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  ok('Conexión a MongoDB activa');
}

async function ensureBranch() {
  let branch = await Branch.findOne({
    deletedAt: null,
    active: true,
    status: 'active',
  })
    .sort({
      isMain: -1,
      isDefaultForOnlineOrders: -1,
      createdAt: 1,
    })
    .exec();

  if (branch) {
    ok(`Sede encontrada para inventario: ${branch.name}`);
    return branch;
  }

  branch = new Branch({
    name: 'Sede Principal',
    code: 'SEDE-PRINCIPAL',
    type: 'store',
    status: 'active',
    active: true,
    isMain: true,
    isDefaultForOnlineOrders: true,
    notes: `Creada por ${SEED_TAG}`,
  });

  await branch.save();
  warn('No había sedes activas. Se creó Sede Principal para el inventario demostrativo.');
  return branch;
}

async function upsertTaxonomy(definition, taxonomyByKey) {
  const existing = await ProductTaxonomy.findOne({
    kind: definition.kind,
    slug: definition.slug,
  });

  if (
    existing &&
    !String(existing.description || '').includes(SEED_TAG)
  ) {
    throw new Error(
      `La clasificación ${definition.slug} ya existe y no pertenece a la demostración. No se modificó.`
    );
  }

  const taxonomy =
    existing ||
    new ProductTaxonomy({
      kind: definition.kind,
      slug: definition.slug,
    });

  taxonomy.name = definition.name;
  taxonomy.description = definition.description;
  taxonomy.parent = definition.parentKey
    ? taxonomyByKey.get(definition.parentKey)?._id || null
    : null;
  taxonomy.image = imageUrl(
    definition.kind === 'collection'
      ? 'photo-1441986300917-64674bd600d8'
      : 'photo-1472851294608-062f824d29cc',
    1000,
    definition.sortOrder
  );
  taxonomy.active = true;
  taxonomy.archivedAt = null;
  taxonomy.sortOrder = definition.sortOrder;
  taxonomy.seo = {
    title: `${definition.name} | Catálogo de prueba`,
    description:
      'Clasificación creada para probar y manipular las funciones profesionales del módulo Productos.',
  };

  await taxonomy.save();
  taxonomyByKey.set(definition.key, taxonomy);
  return taxonomy;
}

async function seedTaxonomies() {
  const taxonomyByKey = new Map();

  for (const definition of TAXONOMY_DEFINITIONS) {
    await upsertTaxonomy(definition, taxonomyByKey);
  }

  ok('Categorías jerárquicas y colecciones demostrativas creadas/actualizadas');
  return taxonomyByKey;
}

function buildCommercialFields(item) {
  const fields = [
    {
      key: 'funcion-demostrada',
      label: 'Función demostrada',
      group: 'Demostración',
      type: 'text',
      value:
        item.productType === 'physical'
          ? 'Variantes, imágenes, precio, costo e inventario por sede'
          : item.productType === 'digital'
            ? 'Entrega digital posterior al pago'
            : item.productType === 'service'
              ? 'Prestación y seguimiento del servicio'
              : 'Componentes y disponibilidad calculada',
      public: true,
    },
    {
      key: 'editable-por-usuario',
      label: 'Puedes editar este ejemplo',
      group: 'Demostración',
      type: 'boolean',
      value: true,
      public: true,
    },
    {
      key: 'margen-objetivo',
      label: 'Margen objetivo interno',
      group: 'Administración',
      type: 'number',
      value: 35,
      public: false,
    },
  ];

  if (Array.isArray(item.publicField) && item.publicField.length === 2) {
    fields.unshift({
      key: cleanText(item.publicField[0]).toLowerCase(),
      label: item.publicField[0],
      group: 'Características',
      type: 'text',
      value: item.publicField[1],
      public: true,
    });
  }

  return fields;
}

function buildProductPayload(item, taxonomyByKey, bundleComponents = []) {
  const rootCategory = taxonomyByKey.get('root');
  const primaryCategory = taxonomyByKey.get(item.categoryKey);
  const collectionRefs = item.collectionKeys
    .map((key) => taxonomyByKey.get(`collection:${key}`)?._id)
    .filter(Boolean);
  const images = gallery(item.photoId);
  const stock = item.stockRows.reduce(
    (sum, row) => sum + Number(row.stock || 0),
    0
  );

  return {
    sku: item.sku,
    title: item.title,
    description: item.description,
    price: item.price,
    originalPrice: item.originalPrice,
    image: images[0],
    images,
    features: [
      'Producto permanente de demostración',
      `Tipo: ${item.productType}`,
      'Editable desde el panel administrativo',
    ],
    colors: item.colors,
    sizes: item.sizes,
    inventory: item.inventory,
    variants: item.variants,
    productType: item.productType,
    unitOfMeasure: item.unitOfMeasure,
    trackInventory: item.trackInventory,
    allowBackorder: item.allowBackorder,
    variantPreset: item.variantPreset,
    variantAxes: item.variantAxes,
    category: primaryCategory?.name || 'DEMOSTRACIÓN',
    categories: [
      rootCategory?.name,
      primaryCategory?.name,
    ].filter(Boolean),
    primaryCategoryRef: primaryCategory?._id || rootCategory?._id,
    categoryRefs: [
      rootCategory?._id,
      primaryCategory?._id,
    ].filter(Boolean),
    collectionRefs,
    tags: [...item.tags, item.sku],
    seo: {
      title: `${item.title} | Ejemplo editable`,
      description: item.description,
      keywords: [
        'demostración',
        'producto editable',
        item.productType,
        primaryCategory?.name || 'catálogo',
      ],
      image: images[0],
      canonicalUrl: '',
      noIndex: item.visible === false || item.active === false,
    },
    commercialFields: buildCommercialFields(item),
    digitalDelivery: item.digitalDelivery || {},
    serviceDelivery: item.serviceDelivery || {},
    bundleComponents,
    stock,
    visible: item.visible,
    active: item.active,
    archivedAt: null,
    reorderPoint: item.reorderPoint,
    reorderQty: item.reorderQty,
    warehouseLocation: 'DEMO-CATALOGO',
    weightGrams: item.weightGrams,
    dimensionsCm: item.dimensionsCm,
    cost: item.cost,
    averageCost: item.averageCost,
    taxRate: item.taxRate,
    taxIncluded: item.taxIncluded,
    brand: item.brand,
    season: 'DEMOSTRACIÓN',
    supplier: item.supplier,
    barcode: item.barcode,
    notes: `Producto demostrativo permanente y editable. ${SEED_TAG}. No eliminar automáticamente.`,
  };
}

async function upsertProduct(
  item,
  taxonomyByKey,
  bundleComponents = []
) {
  let product = await Product.findOne({ sku: item.sku })
    .select('+digitalDelivery.assetUrl +digitalDelivery.customerMessage +serviceDelivery.bookingUrl +serviceDelivery.internalInstructions')
    .exec();

  if (
    product &&
    !String(product.notes || '').includes(SEED_TAG)
  ) {
    throw new Error(
      `El SKU ${item.sku} ya pertenece a un producto ajeno a la demostración. No se modificó.`
    );
  }

  const payload = buildProductPayload(
    item,
    taxonomyByKey,
    bundleComponents
  );

  if (!product) {
    product = new Product(payload);
  } else {
    Object.assign(product, payload);
  }

  product.$locals = product.$locals || {};
  product.$locals.variantsAuthoritative = true;
  await product.save();
  return product;
}

async function upsertStock({ branch, product, row, item }) {
  const variant = InventoryStock.buildVariantSnapshot({
    label: row.label,
    size: row.size,
    color: row.color,
    attributes: row.attributes,
    sku: row.sku,
    barcode: row.barcode,
  });
  const variantKey = InventoryStock.buildVariantKey(
    variant.size,
    variant.color,
    variant.attributes
  );
  const legacyVariantKey = InventoryStock.buildVariantKey(
    variant.size,
    variant.color
  );
  const filter = {
    branch: branch._id,
    product: product._id,
    variantKey,
    deletedAt: null,
  };

  let stock = await InventoryStock.findOne(filter);

  if (!stock && legacyVariantKey !== variantKey) {
    stock = await InventoryStock.findOne({
      branch: branch._id,
      product: product._id,
      variantKey: legacyVariantKey,
      deletedAt: null,
    });

    if (stock) {
      assert(
        String(stock.notes || '').includes(SEED_TAG),
        `La existencia heredada ${legacyVariantKey} de ${product.sku} no pertenece al catálogo DEMO`
      );
    }
  }

  if (!stock) {
    stock = new InventoryStock({
      branch: branch._id,
      product: product._id,
      variantKey,
    });
  }

  stock.branchSnapshot =
    InventoryStock.buildBranchSnapshot(branch);
  stock.productSnapshot =
    InventoryStock.buildProductSnapshot(product);
  stock.variant = variant;
  stock.variantKey = variantKey;
  stock.stock = Number(row.stock || 0);
  stock.reservedStock = Number(row.reservedStock || 0);
  stock.availableStock = Math.max(
    0,
    stock.stock - stock.reservedStock
  );
  stock.reorderPoint = Number(
    row.reorderPoint ?? item.reorderPoint ?? 0
  );
  stock.reorderQty = Number(item.reorderQty || 0);
  stock.warehouseLocation = 'DEMO-CATALOGO';
  stock.notes = `Existencia permanente de demostración. ${SEED_TAG}`;
  stock.active = true;
  stock.deletedAt = null;
  stock.lastCountedAt = new Date();
  stock.lastMovementAt = new Date();

  await stock.save();
  return stock;
}

async function resolveDemoBundleComponents(item, productsBySku) {
  const requested = item.componentSpecs.map((component) => {
    const product = productsBySku.get(component.sku);
    assert(
      product,
      `No existe el componente ${component.sku} para ${item.sku}`
    );

    const variants = Array.isArray(product.variants)
      ? product.variants.filter((row) => row.active !== false)
      : [];
    const selectedVariant =
      variants[component.variantIndex || 0] || null;

    return {
      product: product._id,
      variantKey:
        selectedVariant?.variantKey || 'default__default',
      quantity: component.quantity,
    };
  });

  return resolveBundleComponents(requested);
}

async function seedProducts(branch, taxonomyByKey) {
  const productsBySku = new Map();

  for (const item of DEMO_PRODUCTS.filter(
    (row) => row.productType !== 'bundle'
  )) {
    const product = await upsertProduct(item, taxonomyByKey);
    productsBySku.set(item.sku, product);

    for (const row of item.stockRows) {
      await upsertStock({
        branch,
        product,
        row,
        item,
      });
    }
  }

  for (const item of DEMO_PRODUCTS.filter(
    (row) => row.productType === 'bundle'
  )) {
    const bundleComponents =
      await resolveDemoBundleComponents(item, productsBySku);
    const product = await upsertProduct(
      item,
      taxonomyByKey,
      bundleComponents
    );
    productsBySku.set(item.sku, product);
  }

  ok(`${productsBySku.size} productos demostrativos creados/actualizados`);
  return productsBySku;
}

async function validateProducts({
  beforeForeignCount,
  firstSeedIds,
}) {
  const skus = DEMO_PRODUCTS.map((item) => item.sku);
  const saved = await Product.find({
    sku: { $in: skus },
  })
    .select('+digitalDelivery.assetUrl +digitalDelivery.customerMessage +serviceDelivery.bookingUrl +serviceDelivery.internalInstructions')
    .lean();

  assert(
    saved.length === 27,
    `Se esperaban 27 productos demostrativos y hay ${saved.length}`
  );
  ok('Los 27 productos demostrativos permanecen en la base');

  const countsByType = saved.reduce((accumulator, item) => {
    accumulator[item.productType] =
      (accumulator[item.productType] || 0) + 1;
    return accumulator;
  }, {});
  assert(
    countsByType.physical === 18 &&
      countsByType.digital === 3 &&
      countsByType.service === 3 &&
      countsByType.bundle === 3,
    `Distribución inesperada: ${JSON.stringify(countsByType)}`
  );
  ok('Distribución validada: 18 físicos, 3 digitales, 3 servicios y 3 combos');

  const withoutPhotos = saved.filter(
    (item) =>
      !item.image ||
      !Array.isArray(item.images) ||
      item.images.length < 2
  );
  assert(
    withoutPhotos.length === 0,
    `Hay ejemplos sin fotografía: ${withoutPhotos.map((item) => item.sku).join(', ')}`
  );
  ok('Todos los productos tienen portada y galería fotográfica');

  const physical = saved.filter(
    (item) => item.productType === 'physical'
  );
  assert(
    physical.every(
      (item) =>
        Array.isArray(item.variants) &&
        item.variants.length >= 2 &&
        item.variants.every(
          (row) =>
            row.sku &&
            row.barcode &&
            row.image &&
            Number(row.price || 0) > 0
        )
    ),
    'Un producto físico no expone variantes comerciales completas'
  );
  ok('Los 18 físicos exponen variantes con SKU, código, foto, precio y costo');

  const repeatedVariantVisuals = physical.filter((item) => {
    const visualProfiles = item.variants.map((row) => {
      const url = new URL(row.image);
      return [
        url.pathname,
        url.searchParams.get('hue'),
        url.searchParams.get('sat'),
        url.searchParams.get('con'),
        url.searchParams.get('exp'),
      ].join('|');
    });

    return (
      visualProfiles.some((profile) => profile.includes('null')) ||
      new Set(visualProfiles).size !== visualProfiles.length
    );
  });
  assert(
    repeatedVariantVisuals.length === 0,
    `Hay variantes sin cambio fotográfico visible: ${repeatedVariantVisuals
      .map((item) => item.sku)
      .join(', ')}`
  );
  ok('Cada variante física tiene una fotografía visualmente diferenciada');

  const stocks = await InventoryStock.find({
    product: {
      $in: physical.map((item) => item._id),
    },
    deletedAt: null,
    active: true,
  }).lean();
  const expectedStockRows = PHYSICAL_PRODUCTS.reduce(
    (sum, item) => sum + item.stockRows.length,
    0
  );
  const expectedVariantKeys = new Map(
    physical.map((product) => [
      String(product._id),
      new Set(
        (product.variants || [])
          .filter((variant) => variant.active !== false)
          .map((variant) => String(variant.variantKey || '').toLowerCase())
          .filter(Boolean)
      ),
    ])
  );
  const stockVariantKeys = new Map();

  stocks.forEach((stock) => {
    const productId = String(stock.product);
    const keys = stockVariantKeys.get(productId) || new Set();
    keys.add(String(stock.variantKey || '').toLowerCase());
    stockVariantKeys.set(productId, keys);
  });

  assert(
    stocks.length >= expectedStockRows,
    `Se esperaban al menos ${expectedStockRows} existencias y hay ${stocks.length}`
  );
  assert(
    stocks.every(
      (row) =>
        row.variant?.sku &&
        Number(row.stock || 0) >= 0
    ),
    'Una existencia no conserva la variante o el stock'
  );
  assert(
    [...expectedVariantKeys.entries()].every(([productId, variantKeys]) => {
      const inventoryKeys = stockVariantKeys.get(productId) || new Set();
      return [...variantKeys].every((variantKey) =>
        inventoryKeys.has(variantKey)
      );
    }),
    'Una variante del catálogo DEMO no coincide con su clave real en InventoryStock'
  );
  ok(`${expectedStockRows} existencias por variante disponibles para manipulación`);
  ok('Cada variante DEMO coincide con su existencia canónica en InventoryStock');

  assert(
    saved.every(
      (item) =>
        item.primaryCategoryRef &&
        Array.isArray(item.categoryRefs) &&
        item.categoryRefs.length >= 2 &&
        Array.isArray(item.collectionRefs) &&
        item.collectionRefs.length >= 1
    ),
    'Un producto no tiene categoría jerárquica o colección'
  );
  assert(
    saved.every(
      (item) =>
        item.seo?.title &&
        item.seo?.description &&
        item.seo?.image &&
        Array.isArray(item.commercialFields) &&
        item.commercialFields.some((field) => field.public === true) &&
        item.commercialFields.some((field) => field.public === false)
    ),
    'Un producto no expone SEO o campos comerciales públicos/privados'
  );
  ok('Categorías, colecciones, SEO y campos comerciales están poblados');

  const digital = saved.filter(
    (item) => item.productType === 'digital'
  );
  assert(
    digital.some(
      (item) =>
        item.digitalDelivery?.deliveryMode === 'automatic' &&
        item.digitalDelivery?.assetUrl
    ) &&
      digital.some(
        (item) =>
          item.digitalDelivery?.deliveryMode === 'manual'
      ),
    'Faltan ejemplos de entrega digital automática o manual'
  );
  ok('Entrega digital automática y manual listas para probar');

  const services = saved.filter(
    (item) => item.productType === 'service'
  );
  const locations = new Set(
    services.map((item) => item.serviceDelivery?.locationType)
  );
  assert(
    ['online', 'store', 'customer'].every((location) =>
      locations.has(location)
    ),
    'Falta una modalidad de ubicación de servicio'
  );
  ok('Servicios online, en sede y a domicilio listos para seguimiento');

  const bundles = saved.filter(
    (item) => item.productType === 'bundle'
  );
  assert(
    bundles.every(
      (item) =>
        Array.isArray(item.bundleComponents) &&
        item.bundleComponents.length === 3
    ),
    'Un combo no conserva sus tres componentes'
  );
  assert(
    bundles.some((item) =>
      item.bundleComponents.some(
        (component) =>
          component.productType === 'digital' ||
          component.productType === 'service'
      )
    ),
    'Falta un combo mixto o virtual'
  );
  ok('Combos físico, mixto y virtual conservan componentes concretos');

  assert(
    saved.some(
      (item) => item.active === true && item.visible === false
    ) &&
      saved.some(
        (item) => item.active === false && item.visible === false
      ),
    'Faltan estados oculto e inactivo para demostración'
  );
  ok('Estados visible, oculto e inactivo disponibles para probar');

  const secondSeedIds = new Map(
    saved.map((item) => [item.sku, String(item._id)])
  );
  assert(
    [...firstSeedIds.entries()].every(
      ([sku, id]) => secondSeedIds.get(sku) === id
    ),
    'La segunda ejecución duplicó o reemplazó productos'
  );
  ok('Idempotencia validada: una segunda ejecución no duplica productos');

  const afterForeignCount = await Product.countDocuments({
    $nor: [{ notes: { $regex: SEED_TAG } }],
  });
  assert(
    afterForeignCount === beforeForeignCount,
    `Cambió la cantidad de productos ajenos: antes ${beforeForeignCount}, después ${afterForeignCount}`
  );
  ok('No se creó, eliminó ni reemplazó ningún producto ajeno a la demostración');

  saved
    .sort((left, right) =>
      left.productType.localeCompare(right.productType) ||
      left.sku.localeCompare(right.sku)
    )
    .forEach((product) => {
      console.log(
        `   - ${product.sku} | ${product.title} | ${product.productType} | ${money(product.price)}`
      );
    });
}

async function validateAdminEndpoint() {
  const token = makeToken();

  if (!token) {
    warn('JWT_SECRET no está configurado. Se omite la comprobación HTTP del listado administrativo.');
    return;
  }

  let response;
  try {
    response = await fetch(
      `${BASE_URL}/api/products/admin/list?page=1&limit=100&q=${DEMO_SKU_PREFIX}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch {
    warn(`Backend no disponible en ${BASE_URL}. La carga y validación MongoDB sí terminaron.`);
    return;
  }

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error ||
        `HTTP ${response.status}`
    );
    error.data = data;
    throw error;
  }

  const list = Array.isArray(data?.products) ? data.products : [];
  assert(
    list.length >= 27,
    `El listado administrativo devolvió ${list.length} ejemplos`
  );
  ok('El listado administrativo expone los 27 ejemplos');
}

async function main() {
  console.log('\n=== Catálogo demostrativo de Productos ===');
  console.log(`Run ID: ${RUN_ID}`);
  console.log('Alcance: 27 productos permanentes, editables y sin borrado automático.');

  try {
    await connectDb();
    const beforeForeignCount = await Product.countDocuments({
      $nor: [{ notes: { $regex: SEED_TAG } }],
    });
    const branch = await ensureBranch();
    const taxonomyByKey = await seedTaxonomies();
    const firstSeed = await seedProducts(
      branch,
      taxonomyByKey
    );
    const firstSeedIds = new Map(
      [...firstSeed.entries()].map(([sku, product]) => [
        sku,
        String(product._id),
      ])
    );

    await seedProducts(branch, taxonomyByKey);
    await validateProducts({
      beforeForeignCount,
      firstSeedIds,
    });
    if (process.env.PRODUCT_TEST_SKIP_ADMIN_ENDPOINT === '1') {
      ok('Validación HTTP administrativa omitida durante el reinicio local controlado');
    } else {
      await validateAdminEndpoint();
    }
  } catch (error) {
    fail(
      'Error inesperado en el catálogo demostrativo',
      error
    );
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    console.log('\n=== Resultado final ===');
    console.log(`OK: ${results.ok}`);
    console.log(`WARN: ${results.warn}`);
    console.log(`FAIL: ${results.fail}`);
    console.log('Los productos demostrativos NO se eliminan al terminar.');

    process.exit(results.fail > 0 ? 1 : 0);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  DEMO_PRODUCTS,
  SEED_TAG,
  main,
};
