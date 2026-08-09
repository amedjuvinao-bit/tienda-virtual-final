'use strict';

const crypto = require('crypto');
const {
  assertVariantIdentity,
  resolveVariantIdentity,
} = require('../../shared/variantKeyAuthority.cjs');

const BATCH_ID = 'QA50-CATALOGO-V1';
const PRODUCT_COUNT = 50;
const PRODUCT_CODES = Object.freeze(
  Array.from({ length: PRODUCT_COUNT }, (_, index) =>
    `QA50-${String(index + 1).padStart(3, '0')}`
  )
);

const TYPE_DISTRIBUTION = Object.freeze({
  physical: 24,
  digital: 8,
  service: 7,
  custom: 6,
  bundle: 5,
});

const CATEGORY_NAMES = Object.freeze({
  root: 'DEMOSTRACIÓN',
  technology: 'DEMO · Tecnología',
  fashion: 'DEMO · Moda',
  footwear: 'DEMO · Calzado',
  food: 'DEMO · Alimentos',
  beauty: 'DEMO · Belleza',
  home: 'DEMO · Hogar',
  accessories: 'DEMO · Accesorios',
  stationery: 'DEMO · Papelería',
  pets: 'DEMO · Mascotas',
  sports: 'DEMO · Deportes',
  toys: 'DEMO · Juguetes',
  digital: 'DEMO · Productos digitales',
  services: 'DEMO · Servicios',
  bundles: 'DEMO · Combos',
});

const COLLECTION_NAMES = Object.freeze({
  featured: 'DEMO · Destacados',
  offers: 'DEMO · Ofertas',
  new: 'DEMO · Novedades',
  digital: 'DEMO · Entrega digital',
  services: 'DEMO · Servicios',
  bundles: 'DEMO · Combos',
});

const PHYSICAL_TITLES = Object.freeze([
  'Camiseta esencial de algodón',
  'Lámpara compacta de escritorio',
  'Agenda profesional de oficina',
  'Set hidratante para cuidado diario',
  'Mezcla nutritiva para mascota',
  'Botella deportiva térmica',
  'Gorra urbana por color',
  'Bolso artesanal por material',
  'Jabón líquido por presentación',
  'Memoria portátil por capacidad',
  'Chaqueta ligera por talla y color',
  'Tenis flexibles por talla y color',
  'Cojín decorativo por medida y color',
  'Base cosmética por tono y presentación',
  'Café seleccionado por sabor y presentación',
  'Snack canino por tamaño y sabor',
  'Casco deportivo por talla, material y color',
  'Organizador de oficina configurable',
  'Bloques creativos por edad, piezas y color',
  'Mochila técnica por tamaño, material y color',
  'Teléfono Nova por capacidad, RAM, color y conectividad',
  'Tableta Axis por capacidad, RAM, color y conectividad',
  'Portátil Vector por capacidad, RAM, color y conectividad',
  'Reloj inteligente Pulse por capacidad, RAM, color y conectividad',
]);

const DIGITAL_TITLES = Object.freeze([
  'Guía digital de ventas consultivas',
  'Plantillas digitales para redes',
  'Curso grabado de inventario',
  'Recetario digital saludable',
  'Manual digital de cuidado de mascotas',
  'Kit descargable de productividad',
  'Ebook de fotografía de producto',
  'Biblioteca digital de ejercicios',
]);

const SERVICE_TITLES = Object.freeze([
  'Consultoría virtual de catálogo',
  'Instalación técnica a domicilio',
  'Diagnóstico de inventario en sede',
  'Sesión de estilo personalizada',
  'Asesoría nutricional para mascotas',
  'Entrenamiento deportivo individual',
  'Configuración remota de tecnología',
]);

const CUSTOM_TITLES = Object.freeze([
  'Caja de regalo personalizada',
  'Cuaderno corporativo personalizado',
  'Camiseta personalizada por material',
  'Vela personalizada por color y presentación',
  'Morral personalizado por tamaño, material y color',
  'Equipo personalizado por capacidad, RAM, color y conectividad',
]);

const BUNDLE_TITLES = Object.freeze([
  'Paquete inicio esencial',
  'Paquete moda y guía digital',
  'Paquete servicio y recurso digital',
  'Paquete regalo personalizado',
  'Paquete tecnología y deporte',
]);

function clean(value) {
  return String(value || '').trim();
}

function codeAt(index) {
  return PRODUCT_CODES[index - 1];
}

function deterministicObjectId(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24);
}

function placeholderUrl(code, role) {
  const safeRole = encodeURIComponent(String(role || 'image'));
  return `https://qa.invalid/${BATCH_ID}/${code}/${safeRole}.webp`;
}

function defaultMedia(code) {
  return {
    cover: placeholderUrl(code, 'cover'),
    gallery: [
      placeholderUrl(code, 'gallery-1'),
      placeholderUrl(code, 'gallery-2'),
    ],
    variants: {},
  };
}

function taxonomyFields(taxonomy, categoryName, collectionName) {
  const categories = Array.isArray(taxonomy?.categories) ? taxonomy.categories : [];
  const collections = Array.isArray(taxonomy?.collections) ? taxonomy.collections : [];
  const root = categories.find((entry) => entry.name === CATEGORY_NAMES.root);
  const category = categories.find((entry) => entry.name === categoryName);
  const collection = collections.find((entry) => entry.name === collectionName);

  if (!root || !category || !collection) {
    const missing = [
      !root ? CATEGORY_NAMES.root : '',
      !category ? categoryName : '',
      !collection ? collectionName : '',
    ].filter(Boolean);
    throw new Error(`QA50_TAXONOMY_MISSING:${missing.join('|')}`);
  }

  return {
    category: category.name,
    categories: [root.name, category.name],
    primaryCategoryId: String(category._id),
    categoryIds: [String(root._id), String(category._id)],
    collectionIds: [String(collection._id)],
  };
}

function attachVariantMedia(variant, media, code) {
  const url = media?.variants?.[variant.variantKey] || placeholderUrl(
    code,
    `variant-${encodeURIComponent(variant.variantKey)}`
  );
  return {
    ...variant,
    image: url,
    images: [url, media.gallery[1]],
  };
}

function makeVariant({
  code,
  index,
  attributes,
  stock,
  price,
  cost,
  media,
}) {
  const identity = resolveVariantIdentity({ attributes });
  const variant = {
    variantKey: identity.variantKey,
    label: identity.attributes.map((attribute) => attribute.value).join(' / '),
    size: identity.size,
    color: identity.color,
    attributes: identity.attributes,
    sku: `${code}-V${String(index + 1).padStart(2, '0')}`,
    barcode: String(7705200000000 + Number(code.slice(-3)) * 20 + index + 1),
    price,
    cost,
    originalPrice: index % 2 === 0 ? price + 12000 : null,
    initialStock: stock,
    active: true,
    sortOrder: index,
  };
  assertVariantIdentity(variant);
  return attachVariantMedia(variant, media, code);
}

function axesFromVariants(variants) {
  const axes = new Map();
  for (const variant of variants) {
    for (const attribute of variant.attributes) {
      if (!axes.has(attribute.key)) {
        axes.set(attribute.key, {
          key: attribute.key,
          label: attribute.label,
          values: [],
        });
      }
      const axis = axes.get(attribute.key);
      if (!axis.values.includes(attribute.value)) axis.values.push(attribute.value);
    }
  }
  return Array.from(axes.values());
}

function commonPayload({
  index,
  title,
  productType,
  categoryName,
  collectionName,
  taxonomy,
  media,
  price,
  cost,
  trackInventory,
  unitOfMeasure = 'unit',
}) {
  const code = codeAt(index);
  return {
    sku: code,
    title: `[${code}] ${title}`,
    description: `Producto integral del lote ${BATCH_ID}. Registro ${code} para validar catálogo, API, imágenes, edición e inventario sin afectar datos anteriores.`,
    productType,
    unitOfMeasure,
    trackInventory,
    allowBackorder: productType === 'digital' || productType === 'service',
    price,
    originalPrice: index % 3 === 0 ? price + 25000 : null,
    cost,
    averageCost: cost,
    taxRate: [0, 5, 19][index % 3],
    taxIncluded: true,
    image: media.cover,
    images: media.gallery.slice(0, 2),
    active: true,
    visible: true,
    features: [
      `Lote ${BATCH_ID}`,
      `Código ${code}`,
      `Clase ${productType}`,
    ],
    brand: `QA Marca ${String((index % 8) + 1).padStart(2, '0')}`,
    season: 'QA permanente',
    supplier: { name: `Proveedor QA ${String((index % 5) + 1).padStart(2, '0')}` },
    tags: [BATCH_ID, code, 'QA catálogo integral', productType],
    seo: {
      title: `${title} | ${code}`,
      description: `Prueba ${BATCH_ID} para ${title}.`,
      keywords: [BATCH_ID, code, productType],
      image: media.cover,
      noIndex: true,
    },
    commercialFields: [
      {
        key: 'qa_batch',
        label: 'Lote QA',
        group: 'Control de calidad',
        type: 'text',
        value: BATCH_ID,
        public: true,
        sortOrder: 0,
      },
      {
        key: 'qa_code',
        label: 'Código QA',
        group: 'Control de calidad',
        type: 'text',
        value: code,
        public: true,
        sortOrder: 1,
      },
    ],
    notes: `Lote exacto ${BATCH_ID}; código ${code}`,
    ...taxonomyFields(taxonomy, categoryName, collectionName),
  };
}

function buildSimplePhysical({ index, title, categoryName, stock, taxonomy, media, productType = 'physical' }) {
  const price = 39000 + index * 3100;
  return {
    ...commonPayload({
      index,
      title,
      productType,
      categoryName,
      collectionName: COLLECTION_NAMES.featured,
      taxonomy,
      media,
      price,
      cost: Math.round(price * 0.48),
      trackInventory: true,
    }),
    barcode: String(7705100000000 + index),
    variantPreset: 'none',
    variantAxes: [],
    variants: [],
    sizes: [],
    colors: [],
    inventory: [],
    stock,
    reorderPoint: stock > 0 ? Math.min(5, stock) : 0,
    reorderQty: stock > 0 ? 12 : 0,
    warehouseLocation: `QA-${String(index).padStart(2, '0')}`,
    weightGrams: 180 + index * 15,
    dimensionsCm: { l: 20 + (index % 4), w: 14 + (index % 3), h: 5 + (index % 5) },
  };
}

function buildVariantPhysical({
  index,
  title,
  categoryName,
  preset,
  attributeRows,
  taxonomy,
  media,
  productType = 'physical',
}) {
  const code = codeAt(index);
  const basePrice = 65000 + index * 4200;
  const stocks = [0, 1, 8, 35, 120, 500];
  const variants = attributeRows.map((attributes, variantIndex) =>
    makeVariant({
      code,
      index: variantIndex,
      attributes,
      stock: stocks[(index + variantIndex) % stocks.length],
      price: basePrice + variantIndex * 5500,
      cost: Math.round((basePrice + variantIndex * 5500) * 0.46),
      media,
    })
  );

  return {
    ...commonPayload({
      index,
      title,
      productType,
      categoryName,
      collectionName: index % 2 === 0 ? COLLECTION_NAMES.offers : COLLECTION_NAMES.new,
      taxonomy,
      media,
      price: basePrice,
      cost: Math.round(basePrice * 0.46),
      trackInventory: true,
    }),
    barcode: String(7705100000000 + index),
    variantPreset: preset,
    variantAxes: axesFromVariants(variants),
    variants,
    sizes: [],
    colors: [],
    inventory: [],
    stock: variants.reduce((sum, variant) => sum + variant.initialStock, 0),
    reorderPoint: 4,
    reorderQty: 20,
    warehouseLocation: `QA-VAR-${String(index).padStart(2, '0')}`,
    weightGrams: 300 + index * 25,
    dimensionsCm: { l: 28 + (index % 6), w: 18 + (index % 5), h: 8 + (index % 4) },
  };
}

function attr(key, label, value) {
  return { key, label, value };
}

function oneAttributeRows(index) {
  if (index === 7) return ['black', 'royalblue', 'red'].map((value) => [attr('color', 'Color', value)]);
  if (index === 8) return ['algodón', 'lino', 'denim'].map((value) => [attr('material', 'Material', value)]);
  if (index === 9) return ['250 ml', '500 ml', '1 l'].map((value) => [attr('presentacion', 'Presentación', value)]);
  return ['64 GB', '128 GB', '256 GB'].map((value) => [attr('capacidad', 'Capacidad', value)]);
}

function twoAttributeRows(index) {
  const definitions = {
    11: [['S', 'black'], ['M', 'royalblue'], ['L', 'red'], ['XL', 'white']].map(([size, color]) => [attr('talla', 'Talla', size), attr('color', 'Color', color)]),
    12: [['36', 'white'], ['38', 'black'], ['40', 'royalblue'], ['42', 'red']].map(([size, color]) => [attr('talla', 'Talla', size), attr('color', 'Color', color)]),
    13: [['40 x 40 cm', 'beige'], ['45 x 45 cm', 'gray'], ['50 x 50 cm', 'navy'], ['60 x 40 cm', 'white']].map(([size, color]) => [attr('medida', 'Medida', size), attr('color', 'Color', color)]),
    14: [['claro', '30 ml'], ['medio', '30 ml'], ['oscuro', '50 ml'], ['neutro', '50 ml']].map(([tone, presentation]) => [attr('tono', 'Tono', tone), attr('presentacion', 'Presentación', presentation)]),
    15: [['suave', '250 g'], ['medio', '500 g'], ['intenso', '500 g'], ['descafeinado', '1 kg']].map(([flavor, presentation]) => [attr('sabor', 'Sabor', flavor), attr('presentacion', 'Presentación', presentation)]),
    16: [['pequeño', 'pollo'], ['mediano', 'res'], ['grande', 'salmón'], ['familiar', 'mixto']].map(([size, flavor]) => [attr('tamano', 'Tamaño', size), attr('sabor', 'Sabor', flavor)]),
  };
  return definitions[index];
}

function threeAttributeRows(index) {
  const definitions = {
    17: [['S', 'policarbonato', 'black'], ['M', 'fibra', 'royalblue'], ['L', 'carbono', 'red']].map(([size, material, color]) => [attr('talla', 'Talla', size), attr('material', 'Material', material), attr('color', 'Color', color)]),
    18: [['pequeño', 'metal', 'white'], ['mediano', 'madera', 'brown'], ['grande', 'plástico', 'gray']].map(([size, material, color]) => [attr('tamano', 'Tamaño', size), attr('material', 'Material', material), attr('color', 'Color', color)]),
    19: [['3+', '40 piezas', 'yellow'], ['6+', '80 piezas', 'royalblue'], ['9+', '120 piezas', 'red']].map(([age, pieces, color]) => [attr('edad', 'Edad', age), attr('piezas', 'Piezas', pieces), attr('color', 'Color', color)]),
    20: [['20 l', 'nylon', 'black'], ['30 l', 'lona', 'royalblue'], ['45 l', 'poliéster', 'green']].map(([size, material, color]) => [attr('tamano', 'Tamaño', size), attr('material', 'Material', material), attr('color', 'Color', color)]),
  };
  return definitions[index];
}

function fourAttributeRows(index) {
  const colors = index % 2 === 0 ? ['black', 'white', 'royalblue'] : ['navy', 'gray', 'red'];
  return [
    ['64 GB', '4 GB', colors[0], 'wifi'],
    ['128 GB', '8 GB', colors[1], 'wifi 6'],
    ['256 GB', '16 GB', colors[2], '5g'],
  ].map(([capacity, ram, color, connection]) => [
    attr('capacidad', 'Capacidad', capacity),
    attr('ram', 'RAM', ram),
    attr('color', 'Color', color),
    attr('conectividad', 'Conectividad', connection),
  ]);
}

function buildPhysicalDefinitions({ taxonomy, mediaByCode }) {
  const categoryCycle = [
    CATEGORY_NAMES.fashion,
    CATEGORY_NAMES.home,
    CATEGORY_NAMES.stationery,
    CATEGORY_NAMES.beauty,
    CATEGORY_NAMES.pets,
    CATEGORY_NAMES.sports,
  ];
  const simpleStocks = [0, 1, 12, 75, 500, 24];
  const products = [];
  for (let index = 1; index <= 6; index += 1) {
    products.push(buildSimplePhysical({
      index,
      title: PHYSICAL_TITLES[index - 1],
      categoryName: categoryCycle[index - 1],
      stock: simpleStocks[index - 1],
      taxonomy,
      media: mediaByCode[codeAt(index)] || defaultMedia(codeAt(index)),
    }));
  }
  const oneCategories = [CATEGORY_NAMES.accessories, CATEGORY_NAMES.fashion, CATEGORY_NAMES.beauty, CATEGORY_NAMES.technology];
  const onePresets = ['custom', 'custom', 'beauty', 'tech'];
  for (let index = 7; index <= 10; index += 1) {
    products.push(buildVariantPhysical({
      index,
      title: PHYSICAL_TITLES[index - 1],
      categoryName: oneCategories[index - 7],
      preset: onePresets[index - 7],
      attributeRows: oneAttributeRows(index),
      taxonomy,
      media: mediaByCode[codeAt(index)] || defaultMedia(codeAt(index)),
    }));
  }
  const twoCategories = [CATEGORY_NAMES.fashion, CATEGORY_NAMES.footwear, CATEGORY_NAMES.home, CATEGORY_NAMES.beauty, CATEGORY_NAMES.food, CATEGORY_NAMES.pets];
  const twoPresets = ['fashion', 'footwear', 'home', 'beauty', 'food', 'food'];
  for (let index = 11; index <= 16; index += 1) {
    products.push(buildVariantPhysical({
      index,
      title: PHYSICAL_TITLES[index - 1],
      categoryName: twoCategories[index - 11],
      preset: twoPresets[index - 11],
      attributeRows: twoAttributeRows(index),
      taxonomy,
      media: mediaByCode[codeAt(index)] || defaultMedia(codeAt(index)),
    }));
  }
  const threeCategories = [CATEGORY_NAMES.sports, CATEGORY_NAMES.stationery, CATEGORY_NAMES.toys, CATEGORY_NAMES.accessories];
  for (let index = 17; index <= 20; index += 1) {
    products.push(buildVariantPhysical({
      index,
      title: PHYSICAL_TITLES[index - 1],
      categoryName: threeCategories[index - 17],
      preset: 'custom',
      attributeRows: threeAttributeRows(index),
      taxonomy,
      media: mediaByCode[codeAt(index)] || defaultMedia(codeAt(index)),
    }));
  }
  for (let index = 21; index <= 24; index += 1) {
    products.push(buildVariantPhysical({
      index,
      title: PHYSICAL_TITLES[index - 1],
      categoryName: CATEGORY_NAMES.technology,
      preset: 'tech',
      attributeRows: fourAttributeRows(index),
      taxonomy,
      media: mediaByCode[codeAt(index)] || defaultMedia(codeAt(index)),
    }));
  }
  return products;
}

function buildDigitalDefinitions({ taxonomy, mediaByCode }) {
  return DIGITAL_TITLES.map((title, offset) => {
    const index = 25 + offset;
    const code = codeAt(index);
    const media = mediaByCode[code] || defaultMedia(code);
    const automatic = offset % 2 === 0;
    const price = 29000 + offset * 13000;
    return {
      ...commonPayload({
        index,
        title,
        productType: 'digital',
        categoryName: CATEGORY_NAMES.digital,
        collectionName: COLLECTION_NAMES.digital,
        taxonomy,
        media,
        price,
        cost: Math.round(price * 0.2),
        trackInventory: false,
        unitOfMeasure: 'license',
      }),
      barcode: '',
      variantPreset: 'none',
      variantAxes: [],
      variants: [],
      inventory: [],
      stock: 0,
      weightGrams: 0,
      dimensionsCm: { l: 0, w: 0, h: 0 },
      digitalDelivery: {
        deliveryMode: automatic ? 'automatic' : 'manual',
        assetUrl: automatic ? media.cover : '',
        fileName: `${code.toLowerCase()}-recurso.webp`,
        mimeType: 'image/webp',
        fileSizeBytes: 2048 + offset * 100,
        downloadLimit: 3 + (offset % 4),
        accessDays: 30 + offset * 10,
        customerMessage: `Recurso digital controlado del lote ${BATCH_ID}.`,
      },
    };
  });
}

function buildServiceDefinitions({ taxonomy, mediaByCode }) {
  const locations = ['online', 'customer', 'store'];
  return SERVICE_TITLES.map((title, offset) => {
    const index = 33 + offset;
    const code = codeAt(index);
    const media = mediaByCode[code] || defaultMedia(code);
    const scheduled = offset % 2 === 0;
    const price = 70000 + offset * 24000;
    return {
      ...commonPayload({
        index,
        title,
        productType: 'service',
        categoryName: CATEGORY_NAMES.services,
        collectionName: COLLECTION_NAMES.services,
        taxonomy,
        media,
        price,
        cost: Math.round(price * 0.35),
        trackInventory: false,
        unitOfMeasure: 'service',
      }),
      barcode: '',
      variantPreset: 'none',
      variantAxes: [],
      variants: [],
      inventory: [],
      stock: 0,
      weightGrams: 0,
      dimensionsCm: { l: 0, w: 0, h: 0 },
      serviceDelivery: {
        fulfillmentMode: scheduled ? 'scheduled' : 'manual',
        locationType: locations[offset % locations.length],
        durationMinutes: 30 + offset * 15,
        leadTimeHours: offset * 2,
        bookingUrl: scheduled ? `http://localhost:5173/qa/${code.toLowerCase()}` : '',
        customerInstructions: `Instrucciones del servicio ${code}.`,
        internalInstructions: `Control interno ${BATCH_ID}.`,
      },
    };
  });
}

function buildCustomDefinitions({ taxonomy, mediaByCode }) {
  const products = [];
  products.push(buildSimplePhysical({
    index: 40,
    title: CUSTOM_TITLES[0],
    categoryName: CATEGORY_NAMES.accessories,
    stock: 1,
    taxonomy,
    media: mediaByCode[codeAt(40)] || defaultMedia(codeAt(40)),
    productType: 'custom',
  }));
  products.push(buildSimplePhysical({
    index: 41,
    title: CUSTOM_TITLES[1],
    categoryName: CATEGORY_NAMES.stationery,
    stock: 60,
    taxonomy,
    media: mediaByCode[codeAt(41)] || defaultMedia(codeAt(41)),
    productType: 'custom',
  }));
  const rowsByIndex = {
    42: ['algodón', 'lino', 'poliéster'].map((value) => [attr('material', 'Material', value)]),
    43: [['white', 'pequeña'], ['pink', 'mediana'], ['purple', 'grande']].map(([color, presentation]) => [attr('color', 'Color', color), attr('presentacion', 'Presentación', presentation)]),
    44: [['20 l', 'lona', 'black'], ['30 l', 'nylon', 'royalblue'], ['40 l', 'poliéster', 'red']].map(([size, material, color]) => [attr('tamano', 'Tamaño', size), attr('material', 'Material', material), attr('color', 'Color', color)]),
    45: fourAttributeRows(45),
  };
  const customCategories = {
    42: CATEGORY_NAMES.fashion,
    43: CATEGORY_NAMES.home,
    44: CATEGORY_NAMES.accessories,
    45: CATEGORY_NAMES.technology,
  };
  for (let index = 42; index <= 45; index += 1) {
    products.push(buildVariantPhysical({
      index,
      title: CUSTOM_TITLES[index - 40],
      categoryName: customCategories[index],
      preset: index === 45 ? 'tech' : 'custom',
      attributeRows: rowsByIndex[index],
      taxonomy,
      media: mediaByCode[codeAt(index)] || defaultMedia(codeAt(index)),
      productType: 'custom',
    }));
  }
  return products;
}

function component(productIdsByCode, definitionsByCode, code, variantIndex = null, quantity = 1) {
  const product = definitionsByCode[code];
  const productId = productIdsByCode[code] || deterministicObjectId(code);
  const variant = variantIndex == null ? null : product?.variants?.[variantIndex] || null;
  return {
    product: productId,
    variantKey: variant?.variantKey || 'default__default',
    quantity,
  };
}

function buildBundleDefinitions({ taxonomy, mediaByCode, productIdsByCode, definitionsByCode }) {
  const componentPlans = [
    [[codeAt(2), null, 1], [codeAt(3), null, 1]],
    [[codeAt(11), 1, 1], [codeAt(25), null, 1]],
    [[codeAt(33), null, 1], [codeAt(26), null, 1]],
    [[codeAt(42), 0, 1], [codeAt(2), null, 2]],
    [[codeAt(21), 1, 1], [codeAt(17), 2, 1], [codeAt(27), null, 1]],
  ];
  return BUNDLE_TITLES.map((title, offset) => {
    const index = 46 + offset;
    const code = codeAt(index);
    const media = mediaByCode[code] || defaultMedia(code);
    const price = 180000 + offset * 95000;
    return {
      ...commonPayload({
        index,
        title,
        productType: 'bundle',
        categoryName: CATEGORY_NAMES.bundles,
        collectionName: COLLECTION_NAMES.bundles,
        taxonomy,
        media,
        price,
        cost: Math.round(price * 0.62),
        trackInventory: false,
        unitOfMeasure: 'package',
      }),
      barcode: '',
      variantPreset: 'none',
      variantAxes: [],
      variants: [],
      inventory: [],
      stock: 0,
      weightGrams: 0,
      dimensionsCm: { l: 0, w: 0, h: 0 },
      bundleComponents: componentPlans[offset].map(([componentCode, variantIndex, quantity]) =>
        component(productIdsByCode, definitionsByCode, componentCode, variantIndex, quantity)
      ),
    };
  });
}

function buildQa50Definitions({ taxonomy, mediaByCode = {}, productIdsByCode = {} } = {}) {
  const physical = buildPhysicalDefinitions({ taxonomy, mediaByCode });
  const digital = buildDigitalDefinitions({ taxonomy, mediaByCode });
  const service = buildServiceDefinitions({ taxonomy, mediaByCode });
  const custom = buildCustomDefinitions({ taxonomy, mediaByCode });
  const base = [...physical, ...digital, ...service, ...custom];
  const definitionsByCode = Object.fromEntries(base.map((product) => [product.sku, product]));
  const bundles = buildBundleDefinitions({
    taxonomy,
    mediaByCode,
    productIdsByCode,
    definitionsByCode,
  });
  const products = [...base, ...bundles];

  if (products.length !== PRODUCT_COUNT) {
    throw new Error(`QA50_DEFINITION_COUNT_INVALID:${products.length}`);
  }
  return products;
}

function validateQa50Definitions(products) {
  const errors = [];
  const codes = new Set();
  const skuKeys = new Set();
  const barcodeKeys = new Set();
  const typeCounts = {};

  for (const product of Array.isArray(products) ? products : []) {
    const code = clean(product?.sku);
    if (!PRODUCT_CODES.includes(code)) errors.push(`${code || '(sin código)'}:CODE_INVALID`);
    if (codes.has(code)) errors.push(`${code}:DUPLICATE_CODE`);
    codes.add(code);
    typeCounts[product.productType] = Number(typeCounts[product.productType] || 0) + 1;

    if (!product.title || !product.description) errors.push(`${code}:REQUIRED_TEXT_MISSING`);
    if (product.active !== true || product.visible !== true) errors.push(`${code}:NOT_PUBLIC`);
    if (!Array.isArray(product.images) || product.images.length < 2 || !product.image) {
      errors.push(`${code}:MEDIA_INCOMPLETE`);
    }
    const values = [product.sku, ...(product.variants || []).map((variant) => variant.sku)];
    for (const value of values.filter(Boolean)) {
      const key = clean(value).toUpperCase();
      if (skuKeys.has(key)) errors.push(`${code}:DUPLICATE_SKU:${key}`);
      skuKeys.add(key);
    }
    const barcodes = [product.barcode, ...(product.variants || []).map((variant) => variant.barcode)];
    for (const value of barcodes.filter(Boolean)) {
      const key = clean(value).normalize('NFKC').replace(/\s+/g, '').toUpperCase();
      if (barcodeKeys.has(key)) errors.push(`${code}:DUPLICATE_BARCODE:${key}`);
      barcodeKeys.add(key);
    }
    const variantKeys = new Set();
    for (const variant of product.variants || []) {
      try {
        assertVariantIdentity(variant);
      } catch (error) {
        errors.push(`${code}:VARIANT_KEY_INVALID:${error.message}`);
      }
      if (variantKeys.has(variant.variantKey)) errors.push(`${code}:DUPLICATE_VARIANT_KEY`);
      variantKeys.add(variant.variantKey);
    }
    if (product.variantAxes?.length > 4) errors.push(`${code}:TOO_MANY_AXES`);
    if (['digital', 'service', 'bundle'].includes(product.productType)) {
      if (product.trackInventory !== false || product.variants.length) {
        errors.push(`${code}:NON_PHYSICAL_INVENTORY_CONFLICT`);
      }
    }
  }

  for (const [type, expected] of Object.entries(TYPE_DISTRIBUTION)) {
    if (Number(typeCounts[type] || 0) !== expected) {
      errors.push(`TYPE_DISTRIBUTION:${type}:${typeCounts[type] || 0}/${expected}`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    productCount: products.length,
    typeCounts,
    skuCount: skuKeys.size,
    barcodeCount: barcodeKeys.size,
    variantCount: products.reduce((sum, product) => sum + product.variants.length, 0),
  };
}

function requiredMediaRoles(product) {
  return [
    'cover',
    'gallery-1',
    'gallery-2',
    ...(product.variants || []).map((variant) => `variant-${variant.variantKey}`),
  ];
}

module.exports = {
  BATCH_ID,
  PRODUCT_COUNT,
  PRODUCT_CODES,
  TYPE_DISTRIBUTION,
  CATEGORY_NAMES,
  COLLECTION_NAMES,
  buildQa50Definitions,
  validateQa50Definitions,
  requiredMediaRoles,
  placeholderUrl,
};
