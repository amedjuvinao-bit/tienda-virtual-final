// src/admin/FormularioProducto.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import ColorBarPicker from '../components/ColorBarPicker.jsx';
import api from '../lib/api';
import {
  CATEGORY_SUGGESTIONS,
  PRODUCT_TYPES,
  UNIT_OPTIONS,
  VARIANT_PRESETS,
  getProductTypeMeta,
  getVariantPresetMeta,
  shouldTrackInventoryByType,
} from './products/productCatalogConfig';
import variantKeyAuthority from '@shared/variant-key-authority';

const {
  buildVariantKey,
  canonicalizeVariantKey,
  resolveVariantIdentity,
} = variantKeyAuthority;

export function formatProductSaveError(error) {
  const response = error?.response?.data;
  const validationErrors = Array.isArray(response?.errors)
    ? response.errors
    : [];

  const details = validationErrors
    .map((entry) => {
      const field = String(entry?.field || '').trim();
      const message = String(entry?.message || '').trim();
      if (!message) return '';
      return field ? `${field}: ${message}` : message;
    })
    .filter(Boolean);

  if (details.length) return details.join(' · ');

  const status = error?.response?.status;
  return (
    response?.message ||
    (status === 401
      ? 'No autorizado.'
      : status === 409
        ? 'Dato único duplicado.'
        : 'Error al guardar')
  );
}

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;
const UPLOAD_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER;

function makeSku(category) {
  const words = String(category || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const base = words.length >= 2
    ? words.slice(0, 3).map((word) => word[0]).join('').toUpperCase()
    : (words[0] || 'OT').slice(0, 3).toUpperCase();

  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const rnd = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);

  return `${base.padEnd(2, 'X')}-${y}${m}-${rnd}`;
}

function normalizeStringArray(arr, max = Infinity) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];

  for (const item of arr) {
    const value = String(item || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= max) break;
  }

  return out;
}

function getReferenceId(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return String(value._id || value.id || '');
}

function createCommercialFieldRow(index = 0) {
  return {
    key: '',
    label: '',
    group: 'General',
    type: 'text',
    value: '',
    public: true,
    sortOrder: index,
  };
}

function createBundleComponentRow(value = {}) {
  return {
    product: getReferenceId(value.product || value.productId),
    variantKey: canonicalizeVariantKey(value.variantKey) || '',
    quantity: Math.max(1, Math.floor(Number(value.quantity || 1))),
  };
}

function toMoney(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : Math.max(0, Math.round(Number(fallback || 0)));
}

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeAttributeKey(value) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeVariantAttributes(attributes = []) {
  const out = [];
  const seen = new Set();

  for (const attribute of Array.isArray(attributes) ? attributes : []) {
    const label = cleanText(
      attribute?.label || attribute?.name || attribute?.key || ''
    ).slice(0, 120);
    const key = normalizeAttributeKey(
      attribute?.key || attribute?.name || label
    );
    const value = cleanText(attribute?.value || '').slice(0, 160);
    if (!key || !value || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label: label || key, value });
    if (out.length >= 4) break;
  }

  return out;
}

function normalizeVariantForPayload(variant = {}) {
  const identity = resolveVariantIdentity({
    size: variant.size,
    color: variant.color,
    attributes: normalizeVariantAttributes(variant.attributes),
  });

  return {
    ...variant,
    variantKey: identity.variantKey,
    size: identity.size,
    color: identity.color,
    attributes: identity.attributes,
  };
}

function buildVariantLabel(size = '', color = '', attributes = []) {
  const attributeValues = normalizeVariantAttributes(attributes)
    .map((attribute) => attribute.value)
    .filter(Boolean);
  const parts = attributeValues.length
    ? attributeValues
    : [cleanText(size), cleanText(color)].filter(Boolean);
  return parts.join(' / ') || 'Variante general';
}

function normalizeVariantAxes(axes = [], preset = null) {
  const source =
    Array.isArray(axes) && axes.length
      ? axes
      : (preset?.axes || []).map((label) => ({ label, values: [] }));
  const out = [];
  const seen = new Set();

  for (const axis of source) {
    const label = cleanText(
      typeof axis === 'string'
        ? axis
        : axis?.label || axis?.name || axis?.key || ''
    ).slice(0, 40);
    const key = normalizeAttributeKey(
      typeof axis === 'string' ? label : axis?.key || label
    );
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      label: label || key,
      values: normalizeStringArray(axis?.values || [], 40),
    });
    if (out.length >= 4) break;
  }

  return out;
}

export function shouldPreserveLegacyEmptyVariants({
  isEditing = false,
  loadedHadExplicitVariants = true,
  loadedAxesSignature = '',
  currentAxes = [],
} = {}) {
  return (
    isEditing &&
    loadedHadExplicitVariants === false &&
    loadedAxesSignature === JSON.stringify(normalizeVariantAxes(currentAxes))
  );
}

function getLegacyVariantFields(attributes = []) {
  const normalized = normalizeVariantAttributes(attributes);
  const colorAttribute = normalized.find((attribute) =>
    ['color', 'colour', 'tono'].includes(attribute.key)
  );
  const sizeAttribute = normalized.find(
    (attribute) => !['color', 'colour', 'tono'].includes(attribute.key)
  );

  return {
    size: sizeAttribute?.value || '',
    color: colorAttribute?.value || '',
  };
}

function getColorValue(color) {
  return typeof color === 'string' ? color : color?.hex || color?.value || color?.name || '';
}

function hasInventoryDuplicatesFront(inv) {
  const set = new Set();
  for (const row of inv) {
    const key = `${String(row?.color || '').toLowerCase()}|${String(row?.size || '').toLowerCase()}`;
    if (set.has(key)) return true;
    set.add(key);
  }
  return false;
}

function getInitialTrackInventory(productType, explicitValue) {
  if (typeof explicitValue === 'boolean') return explicitValue;
  return shouldTrackInventoryByType(productType);
}

export function normalizeLoadedVariants(product = {}) {
  if (Array.isArray(product.variants) && product.variants.length) {
    return product.variants.map((variant, index) => {
      const size = cleanText(variant.size || '');
      const color = cleanText(variant.color || '');
      const attributes = normalizeVariantAttributes(
        variant.attributes || variant.variantAttributes || []
      );
      let identity;
      try {
        identity = resolveVariantIdentity({
          variantKey: variant.variantKey,
          size,
          color,
          attributes,
        });
      } catch (error) {
        if (error?.code !== 'VARIANT_KEY_MISMATCH') throw error;

        // Compatibilidad de edición para claves heredadas construidas con
        // etiquetas visibles. La reconstrucción sigue perteneciendo
        // exclusivamente a variantKeyAuthority.
        identity = resolveVariantIdentity({ size, color, attributes });
      }
      return {
        variantKey: identity.variantKey,
        label: cleanText(
          variant.label ||
            buildVariantLabel(size, color, attributes)
        ),
        size: identity.size,
        color: identity.color,
        attributes: identity.attributes,
        sku: cleanText(variant.sku || '').toUpperCase(),
        barcode: cleanText(variant.barcode || ''),
        price: variant.price ?? '',
        cost: variant.cost ?? '',
        originalPrice: variant.originalPrice ?? '',
        image: cleanText(variant.image || ''),
        images: normalizeStringArray(variant.images || [], 8),
        initialStock: Math.max(0, Math.floor(Number(variant.initialStock || 0))),
        active: variant.active !== false,
        sortOrder: Number(variant.sortOrder ?? index),
      };
    });
  }

  const inventory = Array.isArray(product.inventory) ? product.inventory : [];
  return inventory
    .filter((row) => cleanText(row?.size || '') || cleanText(row?.color || ''))
    .map((row, index) => {
      const size = cleanText(row.size || '');
      const color = cleanText(row.color || '');
      return {
        variantKey: buildVariantKey(size, color),
        label: buildVariantLabel(size, color),
        size,
        color,
        attributes: [],
        sku: '',
        barcode: '',
        price: '',
        cost: '',
        originalPrice: '',
        image: '',
        images: [],
        initialStock: Math.max(0, Math.floor(Number(row.stock || 0))),
        active: true,
        sortOrder: index,
      };
    });
}

function buildAxisCombinations(axes = [], maximum = 300) {
  const configuredAxes = normalizeVariantAxes(axes)
    .filter((axis) => axis.values.length > 0);
  if (!configuredAxes.length) return [];

  let combinations = [[]];
  for (const axis of configuredAxes) {
    const next = [];
    for (const combination of combinations) {
      for (const value of axis.values) {
        next.push([
          ...combination,
          { key: axis.key, label: axis.label, value },
        ]);
        if (next.length >= maximum) break;
      }
      if (next.length >= maximum) break;
    }
    combinations = next;
  }

  return combinations;
}

function mergeAdvancedVariants({
  previous = [],
  axes = [],
  basePrice = 0,
  baseCost = 0,
}) {
  const existingByKey = new Map(previous.map((variant) => [cleanText(variant.variantKey).toLowerCase(), variant]));
  const combos = [];

  const combinations = buildAxisCombinations(axes);
  if (!combinations.length) return previous;
  const legacyIdentity =
    previous.length > 0 &&
    previous.every(
      (variant) =>
        normalizeVariantAttributes(variant.attributes).length === 0
    ) &&
    normalizeVariantAxes(axes).filter(
      (axis) => axis.values.length > 0
    ).length <= 2;

  combinations.forEach((attributes) => {
    const { size, color } = getLegacyVariantFields(attributes);
    const storedAttributes = legacyIdentity ? [] : attributes;
    const key = buildVariantKey(size, color, storedAttributes);
    const existing = existingByKey.get(key);

    combos.push({
      variantKey: key,
      label:
        existing?.label ||
        buildVariantLabel(size, color, attributes),
      size,
      color,
      attributes: storedAttributes,
      sku: existing?.sku || '',
      barcode: existing?.barcode || '',
      price: existing?.price ?? '',
      cost: existing?.cost ?? '',
      originalPrice: existing?.originalPrice ?? '',
      image: existing?.image || '',
      images: normalizeStringArray(existing?.images || [], 8),
      initialStock: Math.max(
        0,
        Math.floor(Number(existing?.initialStock || 0))
      ),
      active: existing?.active !== false,
      sortOrder: existing?.sortOrder ?? combos.length,
      _basePrice: basePrice,
      _baseCost: baseCost,
    });
  });

  return combos;
}

function Thumb({ src, alt, onRemove, index }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
      <img src={src} alt={alt} className="h-20 w-full object-cover" />
      <div className="absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}>
        {index + 1}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded border px-1.5 py-0.5 text-[10px] opacity-0 shadow transition group-hover:opacity-100"
        style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}
      >
        Quitar
      </button>
    </div>
  );
}

function FieldLabel({ children, required = false, helper = '' }) {
  return (
    <label className="block text-sm font-semibold" style={{ color: 'var(--admin-card-text)' }}>
      {children} {required && <span style={{ color: 'var(--admin-primary)' }}>*</span>}
      {helper && (
        <span className="ml-1 text-xs font-normal" style={{ color: 'var(--admin-card-muted-text)' }}>
          {helper}
        </span>
      )}
    </label>
  );
}

const inputStyle = {
  border: '1px solid var(--admin-input-border)',
  borderRadius: 'var(--admin-radius)',
  background: 'var(--admin-input-bg)',
  color: 'var(--admin-input-text)',
  outline: 'none',
};

const cardStyle = {
  border: '1px solid var(--admin-card-border)',
  borderRadius: 'calc(var(--admin-radius) + 8px)',
  background: 'var(--admin-card-bg)',
  color: 'var(--admin-card-text)',
  boxShadow: 'var(--admin-glass-shadow)',
};

const sectionStyle = {
  borderColor: 'var(--admin-card-border)',
  background: 'color-mix(in srgb, var(--admin-card-bg) 94%, var(--admin-primary) 6%)',
};

const pillStyle = {
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--admin-primary) 64%, var(--admin-card-border) 36%)',
  background: 'var(--admin-button-soft-bg)',
  color: 'var(--admin-button-soft-text)',
};

function actionButtonStyle(kind = 'primary') {
  if (kind === 'danger') {
    return {
      border: '1px solid var(--admin-danger)',
      background: 'var(--admin-danger)',
      color: 'var(--admin-danger-text, var(--admin-button-text))',
    };
  }

  if (kind === 'soft') {
    return {
      border: '1px solid var(--admin-button-soft-border)',
      background: 'var(--admin-button-soft-bg)',
      color: 'var(--admin-button-soft-text)',
    };
  }

  return {
    border: '1px solid var(--admin-button-border)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
  };
}

export default function FormularioProducto() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [sku, setSku] = useState('');
  const [titulo, setTitulo] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [imagen, setImagen] = useState('');
  const [imagenes, setImagenes] = useState([]);
  const [activo, setActivo] = useState(true);
  const [cargando, setCargando] = useState(false);

  const [productType, setProductType] = useState('physical');
  const [trackInventory, setTrackInventory] = useState(true);
  const [unitOfMeasure, setUnitOfMeasure] = useState('unit');
  const [allowBackorder, setAllowBackorder] = useState(false);
  const [variantPreset, setVariantPreset] = useState('fashion');
  const [variantAxes, setVariantAxes] = useState(() =>
    normalizeVariantAxes([], getVariantPresetMeta('fashion'))
  );
  const [variantAxisDrafts, setVariantAxisDrafts] = useState({});

  const [categoria, setCategoria] = useState('');
  const [originalCategoria, setOriginalCategoria] = useState('');
  const [catOptions, setCatOptions] = useState([]);
  const [categoriesExtra, setCategoriesExtra] = useState([]);
  const [taxonomy, setTaxonomy] = useState({
    categories: [],
    collections: [],
    legacyCategories: [],
  });
  const [primaryCategoryId, setPrimaryCategoryId] = useState('');
  const [categoryIds, setCategoryIds] = useState([]);
  const [collectionIds, setCollectionIds] = useState([]);
  const [taxonomyName, setTaxonomyName] = useState('');
  const [taxonomyKind, setTaxonomyKind] = useState('category');
  const [taxonomyParent, setTaxonomyParent] = useState('');
  const [taxonomySaving, setTaxonomySaving] = useState(false);

  const [colorsArr, setColorsArr] = useState([]);
  const [colorsText, setColorsText] = useState('');
  const [stock, setStock] = useState(0);
  const [sizes, setSizes] = useState([]);
  const [variantStock, setVariantStock] = useState({});
  const [advancedVariants, setAdvancedVariants] = useState([]);
  const loadedVariantAxesSignatureRef = useRef('');
  const loadedHadExplicitVariantsRef = useRef(true);
  const [expandedVariant, setExpandedVariant] = useState('');

  const [reorderPoint, setReorderPoint] = useState(0);
  const [reorderQty, setReorderQty] = useState(0);
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [weightGrams, setWeightGrams] = useState(0);
  const [dimL, setDimL] = useState(0);
  const [dimW, setDimW] = useState(0);
  const [dimH, setDimH] = useState(0);
  const [customsDescription, setCustomsDescription] = useState('');
  const [customsHsCode, setCustomsHsCode] = useState('');
  const [customsCountryOfManufacture, setCustomsCountryOfManufacture] = useState('');
  const [customsCountries, setCustomsCountries] = useState([]);

  const [cost, setCost] = useState(0);
  const [averageCost, setAverageCost] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxIncluded, setTaxIncluded] = useState(true);

  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState([]);
  const [tagsInput, setTagsInput] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState([]);
  const [seoKeywordsInput, setSeoKeywordsInput] = useState('');
  const [seoImage, setSeoImage] = useState('');
  const [canonicalUrl, setCanonicalUrl] = useState('');
  const [seoNoIndex, setSeoNoIndex] = useState(false);
  const [commercialFields, setCommercialFields] = useState([]);
  const [digitalDelivery, setDigitalDelivery] = useState({
    deliveryMode: 'automatic',
    assetUrl: '',
    fileName: '',
    mimeType: '',
    fileSizeBytes: 0,
    downloadLimit: 3,
    accessDays: 30,
    customerMessage: '',
  });
  const [serviceDelivery, setServiceDelivery] = useState({
    fulfillmentMode: 'scheduled',
    locationType: 'online',
    durationMinutes: 60,
    leadTimeHours: 0,
    bookingUrl: '',
    customerInstructions: '',
    internalInstructions: '',
  });
  const [bundleComponents, setBundleComponents] = useState([]);
  const [bundleCandidates, setBundleCandidates] = useState([]);
  const [bundleProductDetails, setBundleProductDetails] = useState({});
  const [bundleCandidatesLoading, setBundleCandidatesLoading] = useState(false);

  const selectedType = useMemo(() => getProductTypeMeta(productType), [productType]);
  const selectedPreset = useMemo(() => getVariantPresetMeta(variantPreset), [variantPreset]);

  const colorKeys = useMemo(() => {
    return (Array.isArray(colorsArr) ? colorsArr : [])
      .map(getColorValue)
      .filter(Boolean);
  }, [colorsArr]);

  useEffect(() => {
    let active = true;
    api.get('/api/geo/countries')
      .then(({ data }) => {
        if (!active) return;
        setCustomsCountries(
          (Array.isArray(data) ? data : [])
            .filter((country) => /^[A-Za-z]{2}$/.test(String(country?.code || '')))
            .map((country) => ({
              code: String(country.code).toUpperCase(),
              name: String(country.name || country.code),
            }))
        );
      })
      .catch((error) => {
        console.error('No fue posible cargar el catálogo de países.', error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return undefined;

    let active = true;
    const controller = new AbortController();

    const notifyLoadError = (message) => {
      if (!active) return;

      try {
        toast.error(message);
      } catch (notificationError) {
        console.error(
          '[FormularioProducto] Error de presentación al mostrar la notificación:',
          notificationError
        );
      }
    };

    const loadProduct = async () => {
      let p;

      try {
        const { data } = await api.get(`/api/products/admin/${id}`, {
          signal: controller.signal,
        });

        if (!active) return;
        p = data || {};
      } catch (requestError) {
        if (
          !active ||
          controller.signal.aborted ||
          axios.isCancel(requestError) ||
          requestError?.code === 'ERR_CANCELED'
        ) {
          return;
        }

        if (requestError?.response?.status === 404) {
          notifyLoadError('Este producto no existe o fue eliminado.');
          navigate('/admin/productos');
        } else {
          console.error(
            '[FormularioProducto] Error HTTP al cargar el producto:',
            requestError
          );
          notifyLoadError('Error al cargar producto');
        }

        return;
      }

      try {
        const loadedProductType = p.productType || 'physical';
        const loadedTrackInventory = getInitialTrackInventory(loadedProductType, p.trackInventory);

        setSku(p.sku || '');
        setTitulo(p.title || '');
        setPrecio(p.price || '');
        setDescripcion(p.description || '');
        setImagen(p.image || '');
        setImagenes(Array.isArray(p.images) ? p.images : []);
        setActivo(p.active !== false);
        setProductType(loadedProductType);
        setTrackInventory(loadedTrackInventory);
        setUnitOfMeasure(p.unitOfMeasure || 'unit');
        setAllowBackorder(p.allowBackorder === true);
        const loadedVariantPreset =
          p.variantPreset ||
          (Array.isArray(p.sizes) && p.sizes.length
            ? 'fashion'
            : 'none');
        setVariantPreset(loadedVariantPreset);
        setVariantAxes(
          normalizeVariantAxes(
            p.variantAxes,
            getVariantPresetMeta(loadedVariantPreset)
          )
        );
        setCategoria(p.category || '');
        setOriginalCategoria(p.category || '');
        setCategoriesExtra(normalizeStringArray(p.categories || []));
        const loadedPrimaryCategoryId = getReferenceId(
          p.primaryCategoryRef
        );
        const loadedCategoryIds = normalizeStringArray(
          (p.categoryRefs || []).map(getReferenceId)
        );
        setPrimaryCategoryId(loadedPrimaryCategoryId);
        setCategoryIds(
          loadedPrimaryCategoryId &&
          !loadedCategoryIds.includes(loadedPrimaryCategoryId)
            ? [loadedPrimaryCategoryId, ...loadedCategoryIds]
            : loadedCategoryIds
        );
        setCollectionIds(
          normalizeStringArray(
            (p.collectionRefs || []).map(getReferenceId)
          )
        );

        let normalizedColors = [];
        if (Array.isArray(p.colors) && p.colors.length) {
          normalizedColors = normalizeStringArray(p.colors.map(getColorValue), 10);
        }

        if ((!normalizedColors || normalizedColors.length === 0) && Array.isArray(p.inventory)) {
          normalizedColors = normalizeStringArray(p.inventory.map((row) => String(row.color || '').trim()), 10);
        }

        setColorsArr(normalizedColors);
        setColorsText((normalizedColors || []).join(', '));

        const initialSizes = normalizeStringArray(p.sizes || []);
        const derivedSizes = initialSizes.length
          ? initialSizes
          : Array.isArray(p.inventory)
            ? normalizeStringArray(p.inventory.map((row) => String(row.size || '').trim()))
            : [];
        setSizes(derivedSizes);

        if (Array.isArray(p.inventory)) {
          const map = {};
          p.inventory.forEach((row) => {
            const key = `${row.size || ''}|||${row.color || ''}`;
            map[key] = Number(row.stock || 0);
          });
          setVariantStock(map);
        } else {
          setVariantStock({});
        }

        const loadedVariants = normalizeLoadedVariants(p);
        loadedHadExplicitVariantsRef.current =
          Array.isArray(p.variants) && p.variants.length > 0;
        loadedVariantAxesSignatureRef.current = JSON.stringify(
          normalizeVariantAxes(
            p.variantAxes,
            getVariantPresetMeta(loadedVariantPreset)
          )
        );
        setAdvancedVariants(loadedVariants);
        if (loadedVariants[0]?.variantKey) setExpandedVariant(loadedVariants[0].variantKey);

        setStock(Number(p.stock ?? 0));
        setReorderPoint(Number(p.reorderPoint ?? 0));
        setReorderQty(Number(p.reorderQty ?? 0));
        setWarehouseLocation(p.warehouseLocation || '');
        setWeightGrams(Number(p.weightGrams ?? 0));
        setDimL(Number(p.dimensionsCm?.l ?? 0));
        setDimW(Number(p.dimensionsCm?.w ?? 0));
        setDimH(Number(p.dimensionsCm?.h ?? 0));
        setCustomsDescription(p.customs?.description || '');
        setCustomsHsCode(p.customs?.hsCode || '');
        setCustomsCountryOfManufacture(p.customs?.countryOfManufacture || '');
        setCost(Number(p.cost ?? 0));
        setAverageCost(Number(p.averageCost ?? 0));
        setTaxRate(Number(p.taxRate ?? 0));
        setTaxIncluded(p.taxIncluded !== false);
        setBrand(p.brand || '');
        setSeason(p.season || '');
        setSupplierName(p.supplier?.name || '');
        setBarcode(p.barcode || '');
        setNotes(p.notes || '');
        setTags(normalizeStringArray(p.tags || [], 30));
        setSeoTitle(p.seo?.title || '');
        setSeoDescription(p.seo?.description || '');
        setSeoKeywords(
          normalizeStringArray(p.seo?.keywords || [], 15)
        );
        setSeoImage(p.seo?.image || '');
        setCanonicalUrl(p.seo?.canonicalUrl || '');
        setSeoNoIndex(p.seo?.noIndex === true);
        setCommercialFields(
          Array.isArray(p.commercialFields)
            ? p.commercialFields.map((field, index) => ({
                key: field?.key || '',
                label: field?.label || '',
                group: field?.group || 'General',
                type: field?.type || 'text',
                value: field?.value ?? '',
                public: field?.public !== false,
                sortOrder: index,
              }))
            : []
        );
        setDigitalDelivery({
          deliveryMode: p.digitalDelivery?.deliveryMode || 'automatic',
          assetUrl: p.digitalDelivery?.assetUrl || '',
          fileName: p.digitalDelivery?.fileName || '',
          mimeType: p.digitalDelivery?.mimeType || '',
          fileSizeBytes: Number(p.digitalDelivery?.fileSizeBytes || 0),
          downloadLimit: Number(p.digitalDelivery?.downloadLimit || 3),
          accessDays: Number(p.digitalDelivery?.accessDays || 30),
          customerMessage: p.digitalDelivery?.customerMessage || '',
        });
        setServiceDelivery({
          fulfillmentMode: p.serviceDelivery?.fulfillmentMode || 'scheduled',
          locationType: p.serviceDelivery?.locationType || 'online',
          durationMinutes: Number(p.serviceDelivery?.durationMinutes || 60),
          leadTimeHours: Number(p.serviceDelivery?.leadTimeHours || 0),
          bookingUrl: p.serviceDelivery?.bookingUrl || '',
          customerInstructions: p.serviceDelivery?.customerInstructions || '',
          internalInstructions: p.serviceDelivery?.internalInstructions || '',
        });
        setBundleComponents(
          Array.isArray(p.bundleComponents)
            ? p.bundleComponents.map(createBundleComponentRow)
            : []
        );
      } catch (processingError) {
        console.error(
          '[FormularioProducto] Error al procesar los datos del producto:',
          processingError
        );
        notifyLoadError('Error al procesar los datos del producto');
      }
    };

    loadProduct();

    return () => {
      active = false;
      controller.abort();
    };
  }, [id, navigate]);

  const loadTaxonomy = async () => {
    try {
      const { data } = await api.get(
        '/api/products/admin/taxonomy'
      );
      const next = {
        categories: Array.isArray(data?.categories)
          ? data.categories
          : [],
        collections: Array.isArray(data?.collections)
          ? data.collections
          : [],
        legacyCategories: Array.isArray(data?.legacyCategories)
          ? data.legacyCategories
          : [],
      };

      setTaxonomy(next);
      setCatOptions(
        normalizeStringArray([
          ...next.categories.map((item) => item.name),
          ...next.legacyCategories,
        ])
      );
      return next;
    } catch (error) {
      console.error(
        'No fue posible cargar categorías y colecciones.',
        error
      );
      return null;
    }
  };

  useEffect(() => {
    loadTaxonomy();
  }, []);

  useEffect(() => {
    if (!categoria) {
      if (!id) setSku('');
      return;
    }

    if (!id) {
      setSku(makeSku(categoria));
      return;
    }

    if (originalCategoria && categoria !== originalCategoria) {
      setSku(makeSku(categoria));
    }
  }, [categoria, id, originalCategoria]);

  useEffect(() => {
    if (['digital', 'service', 'bundle'].includes(productType)) {
      setTrackInventory(false);
      setAllowBackorder(false);
      setVariantPreset('none');
      return;
    }

    if (!id) {
      setTrackInventory(shouldTrackInventoryByType(productType));
    }
  }, [productType, id]);

  useEffect(() => {
    if (productType !== 'bundle') return undefined;

    let cancelled = false;

    const loadCandidates = async () => {
      try {
        setBundleCandidatesLoading(true);
        const { data } = await api.get('/api/products/admin/list', {
          params: {
            page: 1,
            limit: 100,
            status: 'active',
            sort: 'title',
          },
        });
        if (cancelled) return;
        const list = Array.isArray(data?.products) ? data.products : [];
        setBundleCandidates(
          list.filter(
            (product) =>
              product.productType !== 'bundle' &&
              String(product._id) !== String(id || '')
          )
        );
      } catch (error) {
        if (!cancelled) {
          setBundleCandidates([]);
          toast.error('No fue posible cargar los productos para el combo.');
        }
      } finally {
        if (!cancelled) setBundleCandidatesLoading(false);
      }
    };

    loadCandidates();
    return () => {
      cancelled = true;
    };
  }, [productType, id]);

  useEffect(() => {
    if (productType !== 'bundle') return;

    const missingIds = bundleComponents
      .map((component) => component.product)
      .filter(
        (productId) =>
          productId && !bundleProductDetails[productId]
      );

    if (!missingIds.length) return;

    let cancelled = false;
    Promise.all(
      [...new Set(missingIds)].map(async (productId) => {
        const { data } = await api.get(`/api/products/admin/${productId}`);
        return [productId, data || {}];
      })
    )
      .then((entries) => {
        if (cancelled) return;
        setBundleProductDetails((previous) => ({
          ...previous,
          ...Object.fromEntries(entries),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('No fue posible cargar una variante del combo.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productType, bundleComponents, bundleProductDetails]);

  useEffect(() => {
    if (!trackInventory) return;

    setAdvancedVariants((prev) => {
      const axesSignature = JSON.stringify(normalizeVariantAxes(variantAxes));
      if (
        prev.length > 0 &&
        loadedVariantAxesSignatureRef.current === axesSignature
      ) {
        return prev;
      }

      loadedVariantAxesSignatureRef.current = '';
      const merged = mergeAdvancedVariants({
        previous: prev,
        axes: variantAxes,
        basePrice: toMoney(precio, 0),
        baseCost: toMoney(cost || averageCost, 0),
      });

      if (!expandedVariant && merged[0]?.variantKey) {
        setExpandedVariant(merged[0].variantKey);
      }

      return merged;
    });
  }, [trackInventory, variantAxes, precio, cost, averageCost, expandedVariant]);

  useEffect(() => {
    const configuredAxes = normalizeVariantAxes(variantAxes);
    const colorAxis = configuredAxes.find((axis) =>
      ['color', 'colour', 'tono'].includes(axis.key)
    );
    const primaryAxis = configuredAxes.find(
      (axis) => !['color', 'colour', 'tono'].includes(axis.key)
    );
    const nextSizes = normalizeStringArray(primaryAxis?.values || []);
    const nextColors = normalizeStringArray(colorAxis?.values || [], 10);

    setSizes(nextSizes);
    setColorsArr(nextColors);
    setColorsText(nextColors.join(', '));
  }, [variantAxes]);

  useEffect(() => {
    setVariantAxisDrafts((previous) => {
      const next = {};
      normalizeVariantAxes(variantAxes).forEach((axis, index) => {
        const draft = String(previous[index] || '');
        const draftValues = normalizeStringArray(
          draft.split(',').map((value) => value.trim()),
          40
        );
        const keepsCurrentDraft =
          JSON.stringify(draftValues) === JSON.stringify(axis.values);
        next[index] = keepsCurrentDraft
          ? draft
          : axis.values.join(', ');
      });
      return next;
    });
  }, [variantAxes]);

  const subirImagen = async ({ file, gallery = false, variantKey = '' }) => {
    if (!file) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast.error('Cloudinary no está configurado.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', UPLOAD_PRESET);
    if (UPLOAD_FOLDER) formData.append('folder', UPLOAD_FOLDER);

    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, formData);
      const url = res.data.secure_url;

      if (variantKey) {
        setAdvancedVariants((prev) => prev.map((variant) => {
          if (variant.variantKey !== variantKey) return variant;
          if (gallery) {
            return { ...variant, images: normalizeStringArray([...(variant.images || []), url], 8) };
          }
          return { ...variant, image: url };
        }));
        return;
      }

      if (gallery) {
        setImagenes((prev) => normalizeStringArray([...prev, url], 5));
      } else {
        setImagen(url);
      }
    } catch (error) {
      console.error('Cloudinary upload error:', error?.response?.data || error.message);
      toast.error('Error al subir imagen');
    }
  };

  const toggleSize = (size) => {
    const value = String(size || '').trim();
    if (!value) return;

    setVariantAxes((previous) => {
      const axes = normalizeVariantAxes(previous, selectedPreset);
      if (!axes.length) return previous;
      const current = axes[0].values;
      const exists = current.some(
        (item) => item.toLowerCase() === value.toLowerCase()
      );
      axes[0] = {
        ...axes[0],
        values: exists
          ? current.filter(
              (item) => item.toLowerCase() !== value.toLowerCase()
            )
          : normalizeStringArray([...current, value], 40),
      };
      return axes;
    });
  };

  const handleVariantPresetChange = (value) => {
    const preset = getVariantPresetMeta(value);
    setVariantPreset(value);
    setVariantAxes((previous) => {
      const previousAxes = normalizeVariantAxes(previous);
      return normalizeVariantAxes(
        (preset.axes || []).map((label) => {
          const key = normalizeAttributeKey(label);
          const existing = previousAxes.find(
            (axis) => axis.key === key
          );
          return {
            key,
            label,
            values: existing?.values || [],
          };
        }),
        preset
      );
    });
  };

  const updateVariantAxis = (index, patch) => {
    setVariantAxes((previous) =>
      normalizeVariantAxes(previous).map((axis, axisIndex) => {
        if (axisIndex !== index) return axis;
        const nextLabel =
          patch.label === undefined
            ? axis.label
            : cleanText(patch.label).slice(0, 40);
        return {
          ...axis,
          ...patch,
          key:
            patch.label === undefined
              ? axis.key
              : normalizeAttributeKey(nextLabel),
          label: nextLabel,
          values:
            patch.values === undefined
              ? axis.values
              : normalizeStringArray(patch.values, 40),
        };
      })
    );
  };

  const addVariantAxis = () => {
    setVariantAxes((previous) => {
      const axes = normalizeVariantAxes(previous);
      if (axes.length >= 4) return axes;
      const label = `Atributo ${axes.length + 1}`;
      return [
        ...axes,
        {
          key: normalizeAttributeKey(label),
          label,
          values: [],
        },
      ];
    });
  };

  const removeVariantAxis = (index) => {
    setVariantAxes((previous) =>
      normalizeVariantAxes(previous).filter(
        (_, axisIndex) => axisIndex !== index
      )
    );
  };

  const removeCatChip = (value) => {
    setCategoriesExtra((prev) => prev.filter((item) => item.toLowerCase() !== String(value).toLowerCase()));
  };

  const selectPrimaryCategory = (value) => {
    const categoryId = String(value || '');
    setPrimaryCategoryId(categoryId);

    if (!categoryId) return;

    const selected = taxonomy.categories.find(
      (item) => item._id === categoryId
    );
    if (selected) setCategoria(selected.name);
    setCategoryIds((previous) =>
      normalizeStringArray([categoryId, ...previous])
    );
  };

  const toggleReference = (value, setter) => {
    const idValue = String(value || '');
    if (!idValue) return;

    setter((previous) =>
      previous.includes(idValue)
        ? previous.filter((item) => item !== idValue)
        : [...previous, idValue]
    );
  };

  const createTaxonomy = async () => {
    const name = taxonomyName.trim();
    if (!name || taxonomySaving) return;

    setTaxonomySaving(true);
    try {
      const { data } = await api.post(
        '/api/products/admin/taxonomy',
        {
          kind: taxonomyKind,
          name,
          parent:
            taxonomyKind === 'category'
              ? taxonomyParent || null
              : null,
        }
      );
      const created = data?.item;
      await loadTaxonomy();

      if (created?._id && created.kind === 'category') {
        setPrimaryCategoryId(created._id);
        setCategoria(created.name || name);
        setCategoryIds((previous) =>
          normalizeStringArray([
            created._id,
            ...previous,
          ])
        );
      } else if (created?._id) {
        setCollectionIds((previous) =>
          normalizeStringArray([
            ...previous,
            created._id,
          ])
        );
      }

      setTaxonomyName('');
      setTaxonomyParent('');
      toast.success(
        taxonomyKind === 'category'
          ? 'Categoría creada'
          : 'Colección creada'
      );
    } catch (error) {
      toast.error(
        error?.response?.data?.message ||
          'No fue posible crear la clasificación.'
      );
    } finally {
      setTaxonomySaving(false);
    }
  };

  const addTokens = (rawValue, current, setter, maximum) => {
    const values = String(rawValue || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setter(normalizeStringArray([...current, ...values], maximum));
  };

  const updateCommercialField = (index, patch) => {
    setCommercialFields((previous) =>
      previous.map((field, fieldIndex) =>
        fieldIndex === index
          ? { ...field, ...patch }
          : field
      )
    );
  };

  const removeCommercialField = (index) => {
    setCommercialFields((previous) =>
      previous.filter((_, fieldIndex) => fieldIndex !== index)
    );
  };

  const updateVariant = (variantKey, patch) => {
    setAdvancedVariants((prev) => prev.map((variant) => (
      variant.variantKey === variantKey ? { ...variant, ...patch } : variant
    )));
  };

  const updateBundleComponent = (index, patch) => {
    setBundleComponents((previous) =>
      previous.map((component, componentIndex) =>
        componentIndex === index
          ? { ...component, ...patch }
          : component
      )
    );
  };

  const removeBundleComponent = (index) => {
    setBundleComponents((previous) =>
      previous.filter(
        (_, componentIndex) => componentIndex !== index
      )
    );
  };

  const removeVariantImage = (variantKey, imageIndex) => {
    setAdvancedVariants((prev) => prev.map((variant) => {
      if (variant.variantKey !== variantKey) return variant;
      return { ...variant, images: (variant.images || []).filter((_, index) => index !== imageIndex) };
    }));
  };

  const totalFromMatrix = useMemo(() => {
    return advancedVariants
      .filter((variant) => variant.active !== false)
      .reduce(
        (sum, variant) =>
          sum + Math.max(0, Number(variant.initialStock || 0)),
        0
      );
  }, [advancedVariants]);

  const inventoryArray = useMemo(() => {
    if (!trackInventory) return [];

    if (advancedVariants.length) {
      const legacyRows = new Map();
      advancedVariants
        .filter((variant) => variant.active !== false)
        .map(normalizeVariantForPayload)
        .forEach((variant) => {
          const key = `${variant.size}|||${variant.color}`;
          const previous = legacyRows.get(key) || {
            size: variant.size,
            color: variant.color,
            stock: 0,
          };
          previous.stock += Math.max(
            0,
            Math.floor(Number(variant.initialStock || 0))
          );
          legacyRows.set(key, previous);
        });
      return Array.from(legacyRows.values()).filter(
        (row) => row.size || row.color
      );
    }

    const out = [];
    sizes.forEach((size) => {
      const colors = colorKeys.length ? colorKeys : [''];
      colors.forEach((color) => {
        const key = `${size}|||${color}`;
        const qty = Math.max(0, Math.floor(Number(variantStock[key] || 0)));
        out.push({ size, color, stock: qty });
      });
    });

    return out;
  }, [trackInventory, advancedVariants, sizes, colorKeys, variantStock]);

  const variantPayload = useMemo(() => {
    if (!trackInventory) return [];
    if (
      shouldPreserveLegacyEmptyVariants({
        isEditing: Boolean(id),
        loadedHadExplicitVariants:
          loadedHadExplicitVariantsRef.current,
        loadedAxesSignature:
          loadedVariantAxesSignatureRef.current,
        currentAxes: variantAxes,
      })
    ) {
      return [];
    }
    return advancedVariants
      .filter(
        (variant) =>
          variant.size ||
          variant.color ||
          variant.label ||
          variant.attributes?.length
      )
      .map(normalizeVariantForPayload)
      .map((variant, index) => ({
        variantKey: variant.variantKey,
        label:
          variant.label ||
          buildVariantLabel(
            variant.size,
            variant.color,
            variant.attributes
          ),
        size: variant.size,
        color: variant.color,
        attributes: variant.attributes,
        sku: variant.sku || '',
        barcode: variant.barcode || '',
        price: variant.price === '' || variant.price == null ? null : toMoney(variant.price, precio),
        cost: variant.cost === '' || variant.cost == null ? null : toMoney(variant.cost, cost || averageCost),
        originalPrice: variant.originalPrice === '' || variant.originalPrice == null ? null : toMoney(variant.originalPrice, 0),
        image: variant.image || '',
        images: normalizeStringArray(variant.images || [], 8),
        initialStock: Math.max(0, Math.floor(Number(variant.initialStock || 0))),
        active: variant.active !== false,
        sortOrder: index,
      }));
  }, [trackInventory, advancedVariants, precio, cost, averageCost, id, variantAxes]);

  const formInvalid = useMemo(() => {
    const price = Number(precio);
    if (!titulo.trim()) return true;
    if (!categoria.trim()) return true;
    if (!price || price <= 0 || Number.isNaN(price)) return true;
    return false;
  }, [titulo, categoria, precio]);

  const guardarProducto = async (event) => {
    event.preventDefault();
    if (cargando) return;

    if (!sku) return toast.error('SKU es obligatorio. Elige una categoría.');
    if (!titulo.trim()) return toast.error('El título es obligatorio');

    const price = Number(precio);
    if (!price || price <= 0 || Number.isNaN(price)) return toast.error('El precio debe ser mayor a 0');
    if (!categoria.trim()) return toast.error('La categoría es obligatoria');
    const configuredVariantAxes = normalizeVariantAxes(variantAxes);
    const activeVariantAxes = configuredVariantAxes.filter(
      (axis) => axis.values.length > 0
    );
    const variantCombinationCount = activeVariantAxes.reduce(
      (total, axis) => total * Math.max(1, axis.values.length),
      activeVariantAxes.length ? 1 : 0
    );
    if (variantCombinationCount > 300) {
      return toast.error(
        'Las variantes generan más de 300 combinaciones. Reduce los valores de los atributos.'
      );
    }
    if (
      productType === 'digital' &&
      digitalDelivery.deliveryMode === 'automatic' &&
      !digitalDelivery.assetUrl.trim()
    ) {
      return toast.error('La entrega automática necesita el enlace privado del archivo.');
    }
    if (
      productType === 'service' &&
      serviceDelivery.fulfillmentMode === 'scheduled' &&
      !serviceDelivery.bookingUrl.trim()
    ) {
      return toast.error('La agenda mediante enlace necesita una URL de reserva.');
    }
    if (productType === 'bundle' && bundleComponents.length === 0) {
      return toast.error('Agrega al menos un producto al combo.');
    }
    if (
      productType === 'bundle' &&
      bundleComponents.some((component) => !component.product)
    ) {
      return toast.error('Selecciona el producto de cada componente del combo.');
    }
    if (
      productType === 'bundle' &&
      bundleComponents.some(
        (component) => !bundleProductDetails[component.product]?._id
      )
    ) {
      return toast.error('Espera mientras se cargan los componentes del combo.');
    }
    if (
      productType === 'bundle' &&
      bundleComponents.some((component) => {
        const variants = (
          bundleProductDetails[component.product]?.variants || []
        ).filter((variant) => variant.active !== false);
        return (
          variants.length > 1 &&
          !variants.some(
            (variant) =>
              variant.variantKey === component.variantKey
          )
        );
      })
    ) {
      return toast.error('Selecciona la variante de cada producto del combo.');
    }

    const bundleIdentities = new Set();
    for (const component of bundleComponents) {
      const variants = (
        bundleProductDetails[component.product]?.variants || []
      ).filter((variant) => variant.active !== false);
      const variantKey =
        component.variantKey ||
        (variants.length === 1
          ? variants[0].variantKey
          : 'default__default');
      const identity = `${component.product}:${variantKey}`;
      if (bundleIdentities.has(identity)) {
        return toast.error('El combo contiene el mismo producto y variante más de una vez.');
      }
      bundleIdentities.add(identity);
    }

    let finalColors = Array.isArray(colorsArr) ? [...colorsArr] : [];
    if (colorsText && colorsText.trim()) {
      const parsed = colorsText.split(',').map((item) => item.trim()).filter(Boolean);
      finalColors = normalizeStringArray([...finalColors, ...parsed], 10);
    } else {
      finalColors = normalizeStringArray(finalColors, 10);
    }

    if (finalColors.length > 10) {
      toast.error('Máximo 10 colores por producto.');
      return;
    }

    const dimensions = {
      l: Math.max(0, Number(dimL) || 0),
      w: Math.max(0, Number(dimW) || 0),
      h: Math.max(0, Number(dimH) || 0),
    };
    const supplier = { name: supplierName.trim() };
    const categoriesNormalized = normalizeStringArray(categoriesExtra);

    const data = {
      sku,
      title: titulo,
      price,
      description: descripcion,
      image: imagen,
      images: Array.isArray(imagenes) ? imagenes.slice(0, 5) : [],
      active: activo,
      category: categoria.trim(),
      categories: categoriesNormalized,
      primaryCategoryId: primaryCategoryId || null,
      categoryIds: normalizeStringArray(categoryIds),
      collectionIds: normalizeStringArray(collectionIds),
      productType,
      unitOfMeasure,
      trackInventory,
      allowBackorder,
      variantPreset,
      variantAxes: trackInventory
        ? normalizeVariantAxes(variantAxes)
        : [],
      colors: trackInventory ? finalColors : [],
      sizes: trackInventory ? normalizeStringArray(sizes) : [],
      inventory: trackInventory ? inventoryArray : [],
      variants: trackInventory ? variantPayload : [],
      reorderPoint: trackInventory ? Math.max(0, Number(reorderPoint || 0)) : 0,
      reorderQty: trackInventory ? Math.max(0, Number(reorderQty || 0)) : 0,
      warehouseLocation: trackInventory ? warehouseLocation || '' : '',
      weightGrams: Math.max(0, Number(weightGrams || 0)),
      dimensionsCm: dimensions,
      customs: ['physical', 'bundle'].includes(productType)
        ? {
            description: customsDescription.trim(),
            hsCode: customsHsCode.trim(),
            countryOfManufacture: customsCountryOfManufacture,
          }
        : {},
      cost: Math.max(0, Number(cost || 0)),
      averageCost: Math.max(0, Number(averageCost || 0)),
      taxRate: Math.min(100, Math.max(0, Number(taxRate || 0))),
      taxIncluded: Boolean(taxIncluded),
      brand: brand || '',
      season: season || '',
      supplier,
      barcode: barcode || '',
      tags: normalizeStringArray(tags, 30),
      seo: {
        title: seoTitle.trim(),
        description: seoDescription.trim(),
        keywords: normalizeStringArray(seoKeywords, 15),
        image: seoImage.trim(),
        canonicalUrl: canonicalUrl.trim(),
        noIndex: Boolean(seoNoIndex),
      },
      commercialFields: commercialFields
        .filter((field) => field.label?.trim())
        .map((field, index) => ({
          key: field.key || field.label,
          label: field.label,
          group: field.group || 'General',
          type: field.type || 'text',
          value: field.value ?? '',
          public: field.public !== false,
          sortOrder: index,
        })),
      digitalDelivery:
        productType === 'digital'
          ? {
              ...digitalDelivery,
              fileSizeBytes: Math.max(
                0,
                Math.floor(Number(digitalDelivery.fileSizeBytes || 0))
              ),
              downloadLimit: Math.max(
                1,
                Math.floor(Number(digitalDelivery.downloadLimit || 1))
              ),
              accessDays: Math.max(
                1,
                Math.floor(Number(digitalDelivery.accessDays || 1))
              ),
            }
          : {},
      serviceDelivery:
        productType === 'service'
          ? {
              ...serviceDelivery,
              durationMinutes: Math.max(
                5,
                Math.floor(Number(serviceDelivery.durationMinutes || 60))
              ),
              leadTimeHours: Math.max(
                0,
                Math.floor(Number(serviceDelivery.leadTimeHours || 0))
              ),
            }
          : {},
      bundleComponents:
        productType === 'bundle'
          ? bundleComponents.map((component) => ({
              product: component.product,
              variantKey: component.variantKey || (() => {
                const variants = (
                  bundleProductDetails[component.product]?.variants || []
                ).filter((variant) => variant.active !== false);
                return variants.length === 1
                  ? variants[0].variantKey
                  : 'default__default';
              })(),
              quantity: Math.max(
                1,
                Math.floor(Number(component.quantity || 1))
              ),
            }))
          : [],
      notes: notes || '',
    };

    const numericStock = Math.max(0, Math.floor(Number(stock) || 0));
    if (trackInventory && numericStock > 0) data.stock = numericStock;

    if (trackInventory && hasInventoryDuplicatesFront(inventoryArray)) {
      toast.error('Hay combinaciones duplicadas en la matriz de variantes.');
      return;
    }

    setCargando(true);
    try {
      if (id) {
        const regen = originalCategoria && categoria && categoria !== originalCategoria ? '&regenSku=1' : '';
        await api.put(`/api/products/${id}?mode=replace${regen}`, data);
      } else {
        await api.post('/api/products', data);
      }

      toast.success(id ? 'Producto actualizado' : 'Producto creado');
      navigate('/admin/productos');
    } catch (err) {
      if (err?.message === 'NO_ADMIN_TOKEN') {
        toast.error('Token de administrador ausente. Inicia sesión de nuevo.');
        return;
      }
      const msg = formatProductSaveError(err);
      toast.error(msg);
      console.error('[FormularioProducto] Error al guardar:', {
        status: err?.response?.status || null,
        error: err?.response?.data?.error || null,
        errors: Array.isArray(err?.response?.data?.errors)
          ? err.response.data.errors
          : [],
      });
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl p-6" style={{ color: 'var(--admin-card-text)' }}>
      <div style={cardStyle}>
        <div className="border-b px-6 py-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-glass-bg)' }}>
          <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--admin-primary)' }}>
            Catálogo universal
          </p>
          <h2 className="mt-1 text-2xl font-bold">{id ? 'Editar producto' : 'Nuevo producto'}</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
            Configura productos universales, inventario real y variantes con precio e imágenes propias.
          </p>
        </div>

        <form onSubmit={guardarProducto} className="space-y-8 p-6">
          <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <FieldLabel required helper="se genera por categoría">SKU</FieldLabel>
              <input value={sku} disabled readOnly className="w-full px-3 py-2" style={{ ...inputStyle, opacity: 0.78 }} placeholder="Se generará al elegir categoría" />
              {id && originalCategoria && categoria && categoria !== originalCategoria && (
                <p className="text-xs" style={{ color: 'var(--admin-warning-text)' }}>
                  Al guardar se regenerará el SKU según la nueva categoría.
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <FieldLabel required>Título</FieldLabel>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Ej. Producto, servicio o combo" required />
            </div>

            <div className="space-y-2">
              <FieldLabel required>Tipo de producto</FieldLabel>
              <select value={productType} onChange={(e) => setProductType(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
                {PRODUCT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>{selectedType.description}</p>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Categoría principal</FieldLabel>
              <select value={primaryCategoryId} onChange={(e) => selectPrimaryCategory(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
                <option value="">Seleccionar categoría</option>
                {taxonomy.categories.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.path || item.name}
                  </option>
                ))}
              </select>
              {!primaryCategoryId && (
                <>
                  <input list="categoriasOptions" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Categoría existente sin migrar" required />
                  <datalist id="categoriasOptions">
                    {[...new Set([...(catOptions || []), ...CATEGORY_SUGGESTIONS])].map((cat) => (
                      <option key={cat} value={cat} />
                    ))}
                  </datalist>
                </>
              )}
            </div>

            <div className="space-y-2">
              <FieldLabel>Unidad de medida</FieldLabel>
              <select value={unitOfMeasure} onChange={(e) => setUnitOfMeasure(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
                {UNIT_OPTIONS.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <FieldLabel required>Precio base</FieldLabel>
              <input type="number" min="0" step="1" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="89000" required />
            </div>

            <div className="space-y-2">
              <FieldLabel>Costo base</FieldLabel>
              <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="0" />
            </div>

            <div className="space-y-2">
              <FieldLabel>Código de barras base</FieldLabel>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="EAN / UPC / interno" />
            </div>

            <div className="space-y-2 md:col-span-3">
              <FieldLabel>Descripción</FieldLabel>
              <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Descripción comercial, características, uso, cuidados o condiciones del servicio." />
            </div>
          </section>

          {productType === 'digital' && (
            <section className="space-y-5 rounded-2xl border p-4" style={sectionStyle}>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>
                  Entrega digital
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                  El enlace privado nunca se publica en el catálogo. Se habilita después de confirmar el pago.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldLabel required>Modalidad de entrega</FieldLabel>
                  <select
                    value={digitalDelivery.deliveryMode}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        deliveryMode: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  >
                    <option value="automatic">Automática después del pago</option>
                    <option value="manual">Coordinada manualmente</option>
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <FieldLabel required={digitalDelivery.deliveryMode === 'automatic'}>
                    Enlace privado del archivo
                  </FieldLabel>
                  <input
                    type="url"
                    value={digitalDelivery.assetUrl}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        assetUrl: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                    placeholder="https://almacen-privado.example/archivo.pdf"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Nombre del archivo</FieldLabel>
                  <input
                    value={digitalDelivery.fileName}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        fileName: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                    placeholder="guia-profesional.pdf"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Tipo MIME</FieldLabel>
                  <input
                    value={digitalDelivery.mimeType}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        mimeType: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                    placeholder="application/pdf"
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Tamaño en bytes</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={digitalDelivery.fileSizeBytes}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        fileSizeBytes: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Límite de descargas</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={digitalDelivery.downloadLimit}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        downloadLimit: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Días de acceso</FieldLabel>
                  <input
                    type="number"
                    min="1"
                    max="3650"
                    value={digitalDelivery.accessDays}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        accessDays: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2 md:col-span-3">
                  <FieldLabel>Mensaje para el comprador</FieldLabel>
                  <textarea
                    rows={3}
                    value={digitalDelivery.customerMessage}
                    onChange={(event) =>
                      setDigitalDelivery((previous) => ({
                        ...previous,
                        customerMessage: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                    placeholder="Instrucciones de uso o información complementaria."
                  />
                </div>
              </div>
            </section>
          )}

          {productType === 'service' && (
            <section className="space-y-5 rounded-2xl border p-4" style={sectionStyle}>
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>
                  Prestación del servicio
                </h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Define cómo se agenda, dónde se presta y qué instrucciones recibe el comprador al pagar.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-3">
                <div className="space-y-2">
                  <FieldLabel required>Coordinación</FieldLabel>
                  <select
                    value={serviceDelivery.fulfillmentMode}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        fulfillmentMode: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  >
                    <option value="scheduled">Agenda mediante enlace</option>
                    <option value="manual">Coordinación manual</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Lugar</FieldLabel>
                  <select
                    value={serviceDelivery.locationType}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        locationType: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  >
                    <option value="online">En línea</option>
                    <option value="store">En el establecimiento</option>
                    <option value="customer">En la ubicación del cliente</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <FieldLabel required>Duración en minutos</FieldLabel>
                  <input
                    type="number"
                    min="5"
                    value={serviceDelivery.durationMinutes}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        durationMinutes: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Anticipación mínima en horas</FieldLabel>
                  <input
                    type="number"
                    min="0"
                    value={serviceDelivery.leadTimeHours}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        leadTimeHours: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <FieldLabel required={serviceDelivery.fulfillmentMode === 'scheduled'}>
                    Enlace privado de agenda
                  </FieldLabel>
                  <input
                    type="url"
                    value={serviceDelivery.bookingUrl}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        bookingUrl: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                    placeholder="https://agenda.example/reservar"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Instrucciones para el comprador</FieldLabel>
                  <textarea
                    rows={3}
                    value={serviceDelivery.customerInstructions}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        customerInstructions: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>

                <div className="space-y-2">
                  <FieldLabel>Notas internas</FieldLabel>
                  <textarea
                    rows={3}
                    value={serviceDelivery.internalInstructions}
                    onChange={(event) =>
                      setServiceDelivery((previous) => ({
                        ...previous,
                        internalInstructions: event.target.value,
                      }))
                    }
                    className="w-full px-3 py-2"
                    style={inputStyle}
                  />
                </div>
              </div>
            </section>
          )}

          {productType === 'bundle' && (
            <section className="space-y-5 rounded-2xl border p-4" style={sectionStyle}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>
                    Componentes del combo
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                    Al vender el combo se reservan y descuentan las existencias de cada componente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setBundleComponents((previous) => [
                      ...previous,
                      createBundleComponentRow(),
                    ])
                  }
                  className="rounded-xl px-4 py-2 text-sm font-bold"
                  style={buttonStyle('soft')}
                  disabled={bundleCandidatesLoading}
                >
                  Agregar componente
                </button>
              </div>

              {bundleCandidatesLoading && (
                <p className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                  Cargando productos disponibles…
                </p>
              )}

              {!bundleCandidatesLoading && bundleComponents.length === 0 && (
                <p className="rounded-xl border p-4 text-sm" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
                  Agrega al menos un producto para construir el combo.
                </p>
              )}

              <div className="space-y-3">
                {bundleComponents.map((component, index) => {
                  const detail = bundleProductDetails[component.product] || {};
                  const variants = Array.isArray(detail.variants)
                    ? detail.variants.filter((variant) => variant.active !== false)
                    : [];

                  return (
                    <div key={`${component.product || 'new'}-${index}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_120px_auto]" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                      <div className="space-y-2">
                        <FieldLabel required>Producto</FieldLabel>
                        <select
                          value={component.product}
                          onChange={(event) =>
                            updateBundleComponent(index, {
                              product: event.target.value,
                              variantKey: 'default__default',
                            })
                          }
                          className="w-full px-3 py-2"
                          style={inputStyle}
                        >
                          <option value="">Seleccionar producto</option>
                          {bundleCandidates.map((candidate) => (
                            <option key={candidate._id} value={candidate._id}>
                              {candidate.title} · {candidate.sku}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <FieldLabel>Variante</FieldLabel>
                        <select
                          value={component.variantKey}
                          onChange={(event) =>
                            updateBundleComponent(index, {
                              variantKey: event.target.value,
                            })
                          }
                          className="w-full px-3 py-2"
                          style={inputStyle}
                          disabled={!component.product || !detail._id}
                        >
                          {variants.length === 0 ? (
                            <option value="default__default">Presentación general</option>
                          ) : (
                            <>
                              {variants.length > 1 && (
                                <option value="">Seleccionar variante</option>
                              )}
                              {variants.map((variant) => (
                                <option key={variant.variantKey} value={variant.variantKey}>
                                  {variant.label || [variant.size, variant.color].filter(Boolean).join(' / ') || 'Presentación general'}
                                </option>
                              ))}
                            </>
                          )}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <FieldLabel required>Cantidad</FieldLabel>
                        <input
                          type="number"
                          min="1"
                          value={component.quantity}
                          onChange={(event) =>
                            updateBundleComponent(index, {
                              quantity: event.target.value,
                            })
                          }
                          className="w-full px-3 py-2"
                          style={inputStyle}
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={() => removeBundleComponent(index)}
                          className="rounded-xl px-3 py-2 text-sm font-bold"
                          style={buttonStyle('soft')}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid gap-5 rounded-2xl border p-4 md:grid-cols-2" style={sectionStyle}>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Inventario</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                El producto guarda la ficha comercial. Inventario conserva las existencias reales por sede y variante.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} className="h-5 w-5" style={{ accentColor: 'var(--admin-primary)' }} disabled={['digital', 'service', 'bundle'].includes(productType)} />
                <span className="text-sm font-semibold">Controlar inventario para este producto</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <input type="checkbox" checked={allowBackorder} onChange={(e) => setAllowBackorder(e.target.checked)} className="h-5 w-5" style={{ accentColor: 'var(--admin-primary)' }} disabled={!trackInventory} />
                <span className="text-sm font-semibold">Permitir venta sin stock disponible</span>
              </label>
            </div>

            {trackInventory && (
              <>
                <div className="space-y-2">
                  <FieldLabel>Plantilla de variantes</FieldLabel>
                  <select value={variantPreset} onChange={(e) => handleVariantPresetChange(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
                    {VARIANT_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>{preset.label}</option>
                    ))}
                  </select>
                  <p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>{selectedPreset.helper}</p>
                </div>

                <div className="space-y-2">
                  <FieldLabel>Stock inicial heredado</FieldLabel>
                  <input type="number" min="0" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="0" />
                  <p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
                    La existencia real queda en InventoryStock. Este valor solo sirve como respaldo inicial.
                  </p>
                </div>
              </>
            )}
          </section>

          {trackInventory && (
            <section className="space-y-5">
              <section className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--admin-primary)' }}>
                      Atributos de variantes
                    </p>
                    <h3 className="text-lg font-bold">Hasta cuatro atributos combinables</h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                      Ejemplo: Capacidad + RAM + Color + Conectividad.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border px-3 py-1.5 text-xs font-black" style={pillStyle}>
                      {advancedVariants.length} combinaciones
                    </span>
                    <span className="rounded-full border px-3 py-1.5 text-xs font-black" style={pillStyle}>
                      Stock inicial {totalFromMatrix}
                    </span>
                    <button type="button" disabled={variantAxes.length >= 4} onClick={addVariantAxis} className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50" style={actionButtonStyle('soft')}>
                      Añadir atributo
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 p-4 lg:grid-cols-2">
                  {variantAxes.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-5 text-center lg:col-span-2" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
                      Este producto no tiene atributos. Selecciona una plantilla o añade el primero.
                    </div>
                  ) : (
                    variantAxes.map((axis, index) => {
                      const isColorAxis = ['color', 'colour', 'tono'].includes(axis.key);
                      return (
                        <article key={`${axis.key}-${index}`} className="space-y-3 rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'color-mix(in srgb, var(--admin-card-bg) 94%, var(--admin-primary) 6%)' }}>
                          <div className="flex items-end gap-3">
                            <div className="flex-1">
                              <FieldLabel>Atributo {index + 1}</FieldLabel>
                              <input value={axis.label} onChange={(e) => updateVariantAxis(index, { label: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder="Ej. Capacidad" />
                            </div>
                            <button type="button" onClick={() => removeVariantAxis(index)} className="rounded-xl px-3 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}>
                              Quitar
                            </button>
                          </div>

                          {isColorAxis && (
                            <ColorBarPicker selected={axis.values} onChange={(values) => updateVariantAxis(index, { values })} max={40} />
                          )}

                          <div>
                            <FieldLabel>Valores separados por coma</FieldLabel>
                            <input
                              value={variantAxisDrafts[index] ?? axis.values.join(', ')}
                              onChange={(e) => {
                                const draft = e.target.value;
                                setVariantAxisDrafts((previous) => ({
                                  ...previous,
                                  [index]: draft,
                                }));
                                updateVariantAxis(index, {
                                  values: draft
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter(Boolean),
                                });
                              }}
                              onBlur={() =>
                                setVariantAxisDrafts((previous) => ({
                                  ...previous,
                                  [index]: axis.values.join(', '),
                                }))
                              }
                              className="w-full px-3 py-2"
                              style={inputStyle}
                              placeholder={isColorAxis ? 'Negro, Dorado, #ffffff' : '128 GB, 256 GB'}
                            />
                          </div>

                          {index === 0 && (selectedPreset.suggestions || []).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {selectedPreset.suggestions.map((item) => {
                                const active = axis.values.some((value) => value.toLowerCase() === item.toLowerCase());
                                return (
                                  <button key={item} type="button" onClick={() => toggleSize(item)} className="rounded-full px-3 py-1.5 text-xs font-black" style={active ? actionButtonStyle() : pillStyle}>
                                    {item}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </article>
                      );
                    })
                  )}
                </div>
              </section>

              {advancedVariants.length > 0 && (
                <section className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                  <div className="border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                    <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: 'var(--admin-primary)' }}>
                      Variantes avanzadas
                    </p>
                    <h3 className="text-lg font-bold">Precio, SKU e imágenes por variante</h3>
                    <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                      Si una variante no tiene precio o costo propio, usará el precio y costo base del producto.
                    </p>
                  </div>

                  <div className="space-y-3 p-4">
                    {advancedVariants.map((variant) => {
                      const open = expandedVariant === variant.variantKey;
                      const effectivePrice = variant.price !== '' && variant.price != null ? variant.price : precio || 0;
                      const effectiveCost = variant.cost !== '' && variant.cost != null ? variant.cost : cost || averageCost || 0;
                      const margin = Math.max(0, toMoney(effectivePrice) - toMoney(effectiveCost));
                      return (
                        <article key={variant.variantKey} className="rounded-2xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'color-mix(in srgb, var(--admin-card-bg) 92%, var(--admin-primary) 8%)' }}>
                          <div className="flex flex-wrap items-center gap-4">
                            <div className="h-20 w-20 overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                              {variant.image || imagen ? (
                                <img src={variant.image || imagen} alt={variant.label} className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Sin imagen</div>
                              )}
                            </div>
                            <div className="min-w-[220px] flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border px-3 py-1 text-xs font-black" style={pillStyle}>{variant.label}</span>
                                <span className="rounded-full border px-3 py-1 text-xs font-black" style={variant.active ? pillStyle : { ...pillStyle, opacity: 0.65 }}> {variant.active ? 'ACTIVA' : 'INACTIVA'} </span>
                              </div>
                              {variant.attributes?.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {variant.attributes.map((attribute) => (
                                    <span key={`${variant.variantKey}-${attribute.key}`} className="rounded-full border px-2.5 py-1 text-[11px] font-bold" style={pillStyle}>
                                      {attribute.label}: {attribute.value}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="mt-2 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
                                {variant.variantKey} · Stock inicial {variant.initialStock || 0}
                              </p>
                              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                                <span>Precio: <b style={{ color: 'var(--admin-card-text)' }}>${Number(effectivePrice || 0).toLocaleString('es-CO')}</b></span>
                                <span>Costo: <b style={{ color: 'var(--admin-card-text)' }}>${Number(effectiveCost || 0).toLocaleString('es-CO')}</b></span>
                                <span>Margen: <b style={{ color: 'var(--admin-primary)' }}>${margin.toLocaleString('es-CO')}</b></span>
                              </div>
                            </div>
                            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold" style={actionButtonStyle(open ? 'soft' : 'primary')} onClick={() => setExpandedVariant(open ? '' : variant.variantKey)}>
                              {open ? 'Cerrar' : 'Configurar'}
                            </button>
                          </div>

                          {open && (
                            <div className="mt-5 grid gap-4 lg:grid-cols-3">
                              <div className="space-y-3 lg:col-span-2">
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div>
                                    <FieldLabel>Nombre visible</FieldLabel>
                                    <input value={variant.label} onChange={(e) => updateVariant(variant.variantKey, { label: e.target.value })} className="w-full px-3 py-2" style={inputStyle} />
                                  </div>
                                  <div>
                                    <FieldLabel>SKU variante</FieldLabel>
                                    <input value={variant.sku} onChange={(e) => updateVariant(variant.variantKey, { sku: e.target.value.toUpperCase() })} className="w-full px-3 py-2" style={inputStyle} placeholder="SKU propio" />
                                  </div>
                                  <div>
                                    <FieldLabel>Barcode variante</FieldLabel>
                                    <input value={variant.barcode} onChange={(e) => updateVariant(variant.variantKey, { barcode: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder="EAN / UPC" />
                                  </div>
                                  <div>
                                    <FieldLabel>Precio propio</FieldLabel>
                                    <input type="number" min="0" value={variant.price ?? ''} onChange={(e) => updateVariant(variant.variantKey, { price: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder={`Base ${precio || 0}`} />
                                  </div>
                                  <div>
                                    <FieldLabel>Costo propio</FieldLabel>
                                    <input type="number" min="0" value={variant.cost ?? ''} onChange={(e) => updateVariant(variant.variantKey, { cost: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder={`Base ${cost || averageCost || 0}`} />
                                  </div>
                                  <div>
                                    <FieldLabel>Precio anterior</FieldLabel>
                                    <input type="number" min="0" value={variant.originalPrice ?? ''} onChange={(e) => updateVariant(variant.variantKey, { originalPrice: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder="Opcional" />
                                  </div>
                                  <div>
                                    <FieldLabel>Stock inicial</FieldLabel>
                                    <input type="number" min="0" value={variant.initialStock ?? 0} onChange={(e) => {
                                      const qty = Math.max(0, Math.floor(Number(e.target.value || 0)));
                                      updateVariant(variant.variantKey, { initialStock: qty });
                                    }} className="w-full px-3 py-2" style={inputStyle} />
                                  </div>
                                  <label className="flex items-center gap-3 pt-6">
                                    <input type="checkbox" checked={variant.active !== false} onChange={(e) => updateVariant(variant.variantKey, { active: e.target.checked })} className="h-5 w-5" style={{ accentColor: 'var(--admin-primary)' }} />
                                    <span className="text-sm font-semibold">Variante activa</span>
                                  </label>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <FieldLabel>Imagen principal variante</FieldLabel>
                                <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                                  {variant.image ? (
                                    <img src={variant.image} alt={variant.label} className="h-36 w-full object-cover" />
                                  ) : (
                                    <div className="flex h-36 items-center justify-center text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Sin imagen propia</div>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <label className="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}>
                                    <input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen({ file: e.target.files?.[0], variantKey: variant.variantKey })} />
                                    Subir portada
                                  </label>
                                  {variant.image && (
                                    <button type="button" className="rounded-full px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')} onClick={() => updateVariant(variant.variantKey, { image: '' })}>Quitar</button>
                                  )}
                                </div>

                                <FieldLabel>Galería variante</FieldLabel>
                                <label className="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}>
                                  <input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen({ file: e.target.files?.[0], variantKey: variant.variantKey, gallery: true })} />
                                  Añadir imagen
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  {(variant.images || []).length === 0 ? (
                                    <div className="col-span-full rounded-xl border border-dashed p-4 text-center text-xs" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>
                                      Sin galería propia
                                    </div>
                                  ) : (
                                    variant.images.map((src, index) => (
                                      <Thumb key={`${variant.variantKey}-${src}-${index}`} src={src} alt={`Imagen ${index + 1}`} index={index} onRemove={() => removeVariantImage(variant.variantKey, index)} />
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )}
            </section>
          )}

          <section className="grid gap-5 rounded-2xl border p-4 md:grid-cols-3" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Finanzas y logística</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                Estos datos alimentan margen, utilidad, envíos e informes financieros.
              </p>
            </div>

            <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
              <div><FieldLabel>Costo promedio</FieldLabel><input type="number" min="0" value={averageCost} onChange={(e) => setAverageCost(e.target.value)} className="w-full px-3 py-2" style={inputStyle} /></div>
              <div><FieldLabel>IVA %</FieldLabel><input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full px-3 py-2" style={inputStyle} /></div>
              <div className="flex items-center gap-2 pt-6"><input id="taxIncluded" type="checkbox" checked={taxIncluded} onChange={(e) => setTaxIncluded(e.target.checked)} className="h-5 w-5" style={{ accentColor: 'var(--admin-primary)' }} /><label htmlFor="taxIncluded" className="text-sm font-semibold">Precio incluye IVA</label></div>
              <div><FieldLabel>Punto de pedido</FieldLabel><input type="number" min="0" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="w-full px-3 py-2" style={inputStyle} disabled={!trackInventory} /></div>
              <div><FieldLabel>Reposición sugerida</FieldLabel><input type="number" min="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} className="w-full px-3 py-2" style={inputStyle} disabled={!trackInventory} /></div>
              <div><FieldLabel>Ubicación bodega</FieldLabel><input value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} className="w-full px-3 py-2" style={inputStyle} disabled={!trackInventory} placeholder="Estante A-3" /></div>
              <div><FieldLabel>Peso gramos</FieldLabel><input type="number" min="0" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} className="w-full px-3 py-2" style={inputStyle} /></div>
              <div className="md:col-span-2"><FieldLabel>Dimensiones cm</FieldLabel><div className="grid grid-cols-3 gap-2"><input type="number" min="0" value={dimL} onChange={(e) => setDimL(e.target.value)} placeholder="Largo" className="px-3 py-2" style={inputStyle} /><input type="number" min="0" value={dimW} onChange={(e) => setDimW(e.target.value)} placeholder="Ancho" className="px-3 py-2" style={inputStyle} /><input type="number" min="0" value={dimH} onChange={(e) => setDimH(e.target.value)} placeholder="Alto" className="px-3 py-2" style={inputStyle} /></div></div>
              {['physical', 'bundle'].includes(productType) && (
                <div className="grid gap-4 border-t pt-4 md:col-span-3 md:grid-cols-3" style={{ borderColor: 'var(--admin-card-border)' }}>
                  <div className="md:col-span-3">
                    <h4 className="text-sm font-black">Aduanas internacionales</h4>
                    <p className="mt-1 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
                      Solo se exige al cotizar entre países distintos. El código HS y el país de fabricación se envían a Envia sin alterar el catálogo comercial.
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>Descripción aduanera</FieldLabel>
                    <input value={customsDescription} onChange={(e) => setCustomsDescription(e.target.value)} maxLength={250} className="w-full px-3 py-2" style={inputStyle} placeholder="Ej. Vestido de algodón para mujer" />
                  </div>
                  <div>
                    <FieldLabel>Código HS (6 a 10 dígitos)</FieldLabel>
                    <input value={customsHsCode} onChange={(e) => setCustomsHsCode(e.target.value)} maxLength={20} inputMode="numeric" className="w-full px-3 py-2" style={inputStyle} placeholder="6104.42" />
                  </div>
                  <div className="md:col-span-2">
                    <FieldLabel>País de fabricación</FieldLabel>
                    <select value={customsCountryOfManufacture} onChange={(e) => setCustomsCountryOfManufacture(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
                      <option value="">Selecciona un país</option>
                      {customsCountries.map((country) => (
                        <option key={country.code} value={country.code}>{country.name} ({country.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Clasificación comercial</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                Organiza el producto en categorías jerárquicas, colecciones y etiquetas reutilizables.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2"><FieldLabel>Marca</FieldLabel><input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full px-3 py-2" style={inputStyle} /></div>
              <div className="space-y-2"><FieldLabel>Temporada</FieldLabel><input value={season} onChange={(e) => setSeason(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Ej. Primavera 2026" /></div>
              <div className="space-y-2"><FieldLabel>Proveedor</FieldLabel><input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full px-3 py-2" style={inputStyle} /></div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-3">
                <FieldLabel>Categorías asociadas</FieldLabel>
                <div className="max-h-52 space-y-2 overflow-auto rounded-xl border p-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  {taxonomy.categories.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Crea la primera categoría en el bloque inferior.</p>
                  ) : (
                    taxonomy.categories.map((item) => {
                      const isPrimary = item._id === primaryCategoryId;
                      const checked = categoryIds.includes(item._id);
                      return (
                        <label key={item._id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                          <span className="flex items-center gap-3">
                            <input type="checkbox" checked={checked} disabled={isPrimary} onChange={() => toggleReference(item._id, setCategoryIds)} style={{ accentColor: 'var(--admin-primary)' }} />
                            <span className="text-sm font-semibold">{item.path || item.name}</span>
                          </span>
                          {isPrimary && <span className="text-[10px] font-black uppercase" style={{ color: 'var(--admin-primary)' }}>Principal</span>}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <FieldLabel>Colecciones</FieldLabel>
                <div className="max-h-52 space-y-2 overflow-auto rounded-xl border p-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  {taxonomy.collections.length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Todavía no hay colecciones creadas.</p>
                  ) : (
                    taxonomy.collections.map((item) => (
                      <label key={item._id} className="flex items-center gap-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                        <input type="checkbox" checked={collectionIds.includes(item._id)} onChange={() => toggleReference(item._id, setCollectionIds)} style={{ accentColor: 'var(--admin-primary)' }} />
                        <span className="text-sm font-semibold">{item.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
              <div className="md:col-span-4">
                <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-primary)' }}>Crear clasificación rápida</p>
              </div>
              <select value={taxonomyKind} onChange={(e) => { setTaxonomyKind(e.target.value); setTaxonomyParent(''); }} className="w-full px-3 py-2" style={inputStyle}>
                <option value="category">Categoría</option>
                <option value="collection">Colección</option>
              </select>
              <input value={taxonomyName} onChange={(e) => setTaxonomyName(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Nombre" />
              {taxonomyKind === 'category' ? (
                <select value={taxonomyParent} onChange={(e) => setTaxonomyParent(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
                  <option value="">Sin categoría superior</option>
                  {taxonomy.categories.map((item) => <option key={item._id} value={item._id}>{item.path || item.name}</option>)}
                </select>
              ) : (
                <div className="flex items-center px-3 text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Las colecciones no dependen de una categoría.</div>
              )}
              <button type="button" disabled={taxonomySaving || !taxonomyName.trim()} onClick={createTaxonomy} className="rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50" style={actionButtonStyle()}>
                {taxonomySaving ? 'Creando...' : 'Crear y seleccionar'}
              </button>
            </div>

            <div className="space-y-2">
              <FieldLabel>Etiquetas</FieldLabel>
              <div className="flex gap-2">
                <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ',') {
                    event.preventDefault();
                    addTokens(tagsInput, tags, setTags, 30);
                    setTagsInput('');
                  }
                }} className="flex-1 px-3 py-2" style={inputStyle} placeholder="Ej. regalo, destacado, nueva colección" />
                <button type="button" onClick={() => { addTokens(tagsInput, tags, setTags, 30); setTagsInput(''); }} className="rounded-xl px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}>Añadir</button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black" style={pillStyle}>
                      {tag}
                      <button type="button" onClick={() => setTags((previous) => previous.filter((item) => item !== tag))}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {!primaryCategoryId && categoriesExtra.length > 0 && (
              <div className="space-y-2">
                <FieldLabel>Categorías heredadas</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {categoriesExtra.map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-black" style={pillStyle}>
                      {cat}
                      <button type="button" onClick={() => removeCatChip(cat)}>×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-6 rounded-2xl border p-5 lg:grid-cols-2" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>SEO del producto</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Controla cómo aparece el producto en buscadores y al compartirlo.</p>
              </div>
              <div>
                <FieldLabel helper={`${seoTitle.length}/70`}>Título SEO</FieldLabel>
                <input maxLength={70} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder={titulo || 'Título del producto'} />
              </div>
              <div>
                <FieldLabel helper={`${seoDescription.length}/320`}>Metadescripción</FieldLabel>
                <textarea maxLength={320} rows={4} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder={descripcion || 'Descripción breve para buscadores'} />
              </div>
              <div>
                <FieldLabel>Palabras clave</FieldLabel>
                <div className="flex gap-2">
                  <input value={seoKeywordsInput} onChange={(e) => setSeoKeywordsInput(e.target.value)} onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addTokens(seoKeywordsInput, seoKeywords, setSeoKeywords, 15);
                      setSeoKeywordsInput('');
                    }
                  }} className="flex-1 px-3 py-2" style={inputStyle} placeholder="separadas por coma" />
                  <button type="button" onClick={() => { addTokens(seoKeywordsInput, seoKeywords, setSeoKeywords, 15); setSeoKeywordsInput(''); }} className="rounded-xl px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}>Añadir</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">{seoKeywords.map((keyword) => <span key={keyword} className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs" style={pillStyle}>{keyword}<button type="button" onClick={() => setSeoKeywords((previous) => previous.filter((item) => item !== keyword))}>×</button></span>)}</div>
              </div>
              <div><FieldLabel>Imagen social</FieldLabel><input value={seoImage} onChange={(e) => setSeoImage(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Vacío: usa la portada del producto" /></div>
              <div><FieldLabel>URL canónica</FieldLabel><input type="url" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Vacío: usa la URL actual" /></div>
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                <input type="checkbox" checked={seoNoIndex} onChange={(e) => setSeoNoIndex(e.target.checked)} style={{ accentColor: 'var(--admin-primary)' }} />
                <span className="text-sm font-semibold">Ocultar este producto de los buscadores</span>
              </label>
            </div>

            <div className="rounded-2xl border p-5" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
              <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: 'var(--admin-primary)' }}>Vista previa</p>
              <p className="mt-5 text-xl font-semibold" style={{ color: '#1a0dab' }}>{seoTitle || titulo || 'Título del producto'}</p>
              <p className="mt-1 text-sm" style={{ color: '#188038' }}>{canonicalUrl || `https://tu-tienda.com/producto/${id || 'nuevo-producto'}`}</p>
              <p className="mt-2 text-sm leading-6" style={{ color: 'var(--admin-card-muted-text)' }}>{seoDescription || descripcion || 'Agrega una descripción clara para mejorar la presentación en los resultados de búsqueda.'}</p>
              <div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <p className="text-sm font-bold">Metadatos incluidos al publicar</p>
                <p className="mt-2 text-xs leading-5" style={{ color: 'var(--admin-card-muted-text)' }}>Título, descripción, canonical, robots, Open Graph, Twitter Card y datos estructurados de Product.</p>
              </div>
            </div>
          </section>

          <section className="space-y-4 rounded-2xl border p-5" style={{ borderColor: 'var(--admin-card-border)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Campos comerciales personalizados</h3>
                <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Añade especificaciones propias sin modificar el modelo cada vez.</p>
              </div>
              <button type="button" onClick={() => setCommercialFields((previous) => [...previous, createCommercialFieldRow(previous.length)])} className="rounded-xl px-4 py-2 text-sm font-semibold" style={actionButtonStyle()}>Añadir campo</button>
            </div>

            {commercialFields.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center text-sm" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>Sin campos personalizados.</div>
            ) : (
              <div className="space-y-3">
                {commercialFields.map((field, index) => (
                  <article key={`${field.key}-${index}`} className="grid gap-3 rounded-xl border p-4 md:grid-cols-6" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                    <div className="md:col-span-2"><FieldLabel>Nombre</FieldLabel><input value={field.label} onChange={(e) => updateCommercialField(index, { label: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder="Ej. Material" /></div>
                    <div><FieldLabel>Grupo</FieldLabel><input value={field.group} onChange={(e) => updateCommercialField(index, { group: e.target.value })} className="w-full px-3 py-2" style={inputStyle} placeholder="General" /></div>
                    <div><FieldLabel>Tipo</FieldLabel><select value={field.type} onChange={(e) => updateCommercialField(index, { type: e.target.value })} className="w-full px-3 py-2" style={inputStyle}><option value="text">Texto</option><option value="number">Número</option><option value="boolean">Sí / No</option><option value="date">Fecha</option><option value="url">Enlace</option></select></div>
                    <div className="md:col-span-2"><FieldLabel>Valor</FieldLabel>{field.type === 'boolean' ? <select value={field.value} onChange={(e) => updateCommercialField(index, { value: e.target.value })} className="w-full px-3 py-2" style={inputStyle}><option value="true">Sí</option><option value="false">No</option></select> : <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'} value={field.value} onChange={(e) => updateCommercialField(index, { value: e.target.value })} className="w-full px-3 py-2" style={inputStyle} />}</div>
                    <div className="flex items-center gap-3 md:col-span-5"><input type="checkbox" checked={field.public !== false} onChange={(e) => updateCommercialField(index, { public: e.target.checked })} style={{ accentColor: 'var(--admin-primary)' }} /><span className="text-sm font-semibold">Visible en la ficha pública</span></div>
                    <button type="button" onClick={() => removeCommercialField(index)} className="rounded-xl px-3 py-2 text-sm font-semibold" style={actionButtonStyle('danger')}>Quitar</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}><h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Imagen portada</h3><p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Se mostrará primero en la tienda si la variante no tiene imagen propia.</p></div>
              <div className="p-5">
                <label className="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}><input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen({ file: e.target.files?.[0] })} />Elegir portada</label>
                <div className="mt-4 h-64 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>{imagen ? (<div className="relative h-full w-full"><img src={imagen} alt="Portada del producto" className="h-full w-full object-cover" /><button type="button" onClick={() => setImagen('')} className="absolute right-2 top-2 rounded-full border px-2 py-1 text-xs shadow" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)', color: 'var(--admin-card-text)' }}>Quitar</button></div>) : (<div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Sin portada seleccionada</div>)}</div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}><h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Galería</h3><p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Máximo 5 imágenes generales del producto.</p></div>
              <div className="p-5">
                <label className="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold" style={actionButtonStyle('soft')}><input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen({ file: e.target.files?.[0], gallery: true })} />Añadir imagen</label>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{imagenes.length === 0 ? (<div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>Sin imágenes adicionales</div>) : (imagenes.map((src, index) => (<Thumb key={`${src}-${index}`} src={src} alt={`Galería ${index + 1}`} index={index} onRemove={() => setImagenes((prev) => prev.filter((_, i) => i !== index))} />)))}</div>
              </div>
            </div>
          </section>

          <section className="space-y-2"><FieldLabel>Notas internas</FieldLabel><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Observaciones internas para inventario, compras o finanzas." /></section>

          <section className="flex flex-wrap items-center justify-between gap-4 border-t pt-5" style={{ borderColor: 'var(--admin-card-border)' }}>
            <label className="flex items-center gap-3"><input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5" style={{ accentColor: 'var(--admin-primary)' }} /><span className="text-sm font-semibold">Producto activo en la tienda</span></label>
            <div className="flex gap-3"><button type="button" onClick={() => navigate('/admin/productos')} className="rounded-xl border px-5 py-2.5 text-sm font-semibold" style={actionButtonStyle('soft')}>Cancelar</button><button disabled={cargando || formInvalid} className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50" style={actionButtonStyle()}>{cargando ? 'Guardando...' : id ? 'Guardar cambios' : 'Crear producto'}</button></div>
          </section>
        </form>
      </div>
    </div>
  );
}
