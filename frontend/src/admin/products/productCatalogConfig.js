// frontend/src/admin/products/productCatalogConfig.js

export const PRODUCT_TYPES = [
  {
    value: 'physical',
    label: 'Producto físico',
    description: 'Tiene inventario, puede venderse en tienda física o virtual y puede requerir envío.',
    defaultTrackInventory: true,
  },
  {
    value: 'digital',
    label: 'Producto digital',
    description: 'No requiere stock físico ni envío tradicional.',
    defaultTrackInventory: false,
  },
  {
    value: 'service',
    label: 'Servicio',
    description: 'No maneja existencias físicas. Útil para asesorías, citas o servicios.',
    defaultTrackInventory: false,
  },
  {
    value: 'bundle',
    label: 'Combo / kit',
    description: 'Agrupa productos existentes y descuenta automáticamente sus componentes.',
    defaultTrackInventory: false,
  },
  {
    value: 'custom',
    label: 'Personalizado',
    description: 'Producto configurable bajo pedido o con reglas especiales.',
    defaultTrackInventory: true,
  },
];

export const UNIT_OPTIONS = [
  { value: 'unit', label: 'Unidad' },
  { value: 'package', label: 'Paquete' },
  { value: 'box', label: 'Caja' },
  { value: 'kg', label: 'Kilogramo' },
  { value: 'g', label: 'Gramo' },
  { value: 'lb', label: 'Libra' },
  { value: 'l', label: 'Litro' },
  { value: 'ml', label: 'Mililitro' },
  { value: 'm', label: 'Metro' },
  { value: 'cm', label: 'Centímetro' },
  { value: 'hour', label: 'Hora' },
  { value: 'service', label: 'Servicio' },
  { value: 'license', label: 'Licencia' },
];

export const CATEGORY_SUGGESTIONS = [
  'Ropa',
  'Calzado',
  'Accesorios',
  'Belleza y cuidado personal',
  'Tecnología',
  'Hogar',
  'Alimentos',
  'Papelería',
  'Repuestos',
  'Servicios',
  'Productos digitales',
  'Combos y kits',
];

export const VARIANT_PRESETS = [
  {
    value: 'none',
    label: 'Sin variantes',
    helper: 'Usa esta opción cuando el producto no cambia por talla, color o presentación.',
    axisLabel: 'Variante',
    suggestions: [],
  },
  {
    value: 'fashion',
    label: 'Moda / ropa',
    helper: 'Tallas y colores para prendas de vestir.',
    axisLabel: 'Talla',
    suggestions: ['XS', 'S', 'M', 'L', 'XL', '0-3M', '3-6M', '6-9M', '12-18M', '2', '4', '6', '8', '10', '12', '14'],
  },
  {
    value: 'footwear',
    label: 'Calzado',
    helper: 'Numeraciones y colores para zapatos o sandalias.',
    axisLabel: 'Talla',
    suggestions: ['18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '35', '36', '37', '38', '39', '40'],
  },
  {
    value: 'beauty',
    label: 'Belleza / cosmética',
    helper: 'Tonos, presentaciones o tamaños para cosméticos.',
    axisLabel: 'Presentación',
    suggestions: ['30 ml', '50 ml', '100 ml', 'Tono claro', 'Tono medio', 'Tono oscuro', 'Muestra', 'Kit'],
  },
  {
    value: 'food',
    label: 'Alimentos',
    helper: 'Sabores, gramajes o presentaciones.',
    axisLabel: 'Presentación',
    suggestions: ['Unidad', '250 g', '500 g', '1 kg', 'Caja', 'Paquete', 'Sabor vainilla', 'Sabor chocolate'],
  },
  {
    value: 'tech',
    label: 'Tecnología',
    helper: 'Capacidad, color, memoria o referencia.',
    axisLabel: 'Especificación',
    suggestions: ['64 GB', '128 GB', '256 GB', 'Negro', 'Blanco', 'USB-C', 'Bluetooth', 'WiFi'],
  },
  {
    value: 'home',
    label: 'Hogar',
    helper: 'Medidas, colores o materiales.',
    axisLabel: 'Medida',
    suggestions: ['Pequeño', 'Mediano', 'Grande', '1 plaza', '2 plazas', 'Madera', 'Metal', 'Vidrio'],
  },
  {
    value: 'parts',
    label: 'Repuestos',
    helper: 'Referencias, compatibilidad o medidas técnicas.',
    axisLabel: 'Referencia',
    suggestions: ['Original', 'Genérico', 'Compatible', 'Set x2', 'Set x4', 'Derecho', 'Izquierdo'],
  },
  {
    value: 'custom',
    label: 'Personalizado',
    helper: 'Define tus propias variantes según el negocio.',
    axisLabel: 'Variante',
    suggestions: [],
  },
];

export function getProductTypeMeta(value) {
  return PRODUCT_TYPES.find((item) => item.value === value) || PRODUCT_TYPES[0];
}

export function getVariantPresetMeta(value) {
  return VARIANT_PRESETS.find((item) => item.value === value) || VARIANT_PRESETS[0];
}

export function shouldTrackInventoryByType(productType) {
  const type = getProductTypeMeta(productType);
  return !['digital', 'service', 'bundle'].includes(type.value) &&
    type.defaultTrackInventory === true;
}

export function formatProductTypeLabel(value) {
  return getProductTypeMeta(value).label;
}
