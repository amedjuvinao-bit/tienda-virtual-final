// frontend/src/admin/inventory/components/InventoryAdjustmentModal.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRightLeft,
  Info,
  PackageSearch,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import api from '../../../lib/api';

const INITIAL_FORM = {
  productId: '',
  branchId: '',
  size: '',
  color: '',
  variantKey: '',
  variantLabel: '',
  variantAttributes: [],
  type: 'initial_stock',
  quantity: '',
  reason: '',
  reference: '',
  notes: '',
};

const MOVEMENT_TYPES = [
  {
    value: 'initial_stock',
    label: 'Stock inicial',
    action: 'Suma stock',
    direction: 'in',
    help: 'Carga inventario por primera vez en una sede o bodega.',
  },
  {
    value: 'adjustment_in',
    label: 'Ajuste positivo',
    action: 'Suma stock',
    direction: 'in',
    help: 'Suma unidades por corrección de inventario.',
  },
  {
    value: 'adjustment_out',
    label: 'Ajuste negativo',
    action: 'Resta stock',
    direction: 'out',
    help: 'Resta unidades por corrección de inventario.',
  },
  {
    value: 'purchase_in',
    label: 'Entrada por compra',
    action: 'Suma stock',
    direction: 'in',
    help: 'Registra mercancía nueva que entra a la tienda o bodega.',
  },
  {
    value: 'return_in',
    label: 'Entrada por devolución',
    action: 'Suma stock',
    direction: 'in',
    help: 'Registra productos devueltos que vuelven al inventario.',
  },
  {
    value: 'damage_out',
    label: 'Salida por daño',
    action: 'Resta stock',
    direction: 'out',
    help: 'Retira productos dañados del inventario disponible.',
  },
  {
    value: 'loss_out',
    label: 'Salida por pérdida',
    action: 'Resta stock',
    direction: 'out',
    help: 'Retira productos perdidos del inventario disponible.',
  },
];

const styles = {
  overlay: {
    background: 'var(--admin-modal-overlay)',
  },

  modal: {
    width: 'min(1320px, calc(100vw - 34px))',
    maxHeight: 'calc(100vh - 34px)',
    borderRadius: 'calc(var(--admin-radius) + 12px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-modal-bg)',
    color: 'var(--admin-modal-text)',
    boxShadow: '0 34px 110px rgba(15, 23, 42, 0.34)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },

  header: {
    borderBottom: '1px solid var(--admin-card-border)',
    background: 'var(--admin-modal-bg)',
  },

  eyebrow: {
    color: 'var(--admin-primary)',
  },

  title: {
    color: 'var(--admin-modal-text)',
  },

  cardTitle: {
    color: 'var(--admin-card-text)',
  },

  muted: {
    color: 'var(--admin-modal-muted-text)',
  },

  cardMuted: {
    color: 'var(--admin-card-muted-text)',
  },

  body: {
    background:
      'radial-gradient(circle at top left, color-mix(in srgb, var(--admin-primary) 10%, transparent), transparent 30%), var(--admin-page-bg)',
  },

  card: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  softCard: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-card-text)',
  },

  iconBox: {
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary)',
    border: '1px solid var(--admin-primary-soft-border)',
  },

  label: {
    color: 'var(--admin-card-text)',
  },

  input: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },

  help: {
    color: 'var(--admin-card-muted-text)',
  },

  primaryButton: {
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
    border: '1px solid var(--admin-button-bg)',
  },

  softButton: {
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    border: '1px solid var(--admin-button-soft-border)',
  },

  closeButton: {
    borderRadius: '999px',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    border: '1px solid var(--admin-button-soft-border)',
  },

  summary: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    background:
      'linear-gradient(145deg, var(--admin-primary), var(--admin-primary-hover))',
    color: 'var(--admin-primary-text)',
    border: '1px solid color-mix(in srgb, var(--admin-primary) 70%, white)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  summaryRow: {
    borderRadius: 'var(--admin-radius)',
    background: 'rgba(255,255,255,0.16)',
    color: 'var(--admin-primary-text)',
  },

  dangerBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },

  successBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid color-mix(in srgb, #22c55e 55%, var(--admin-card-border))',
    background: 'color-mix(in srgb, #22c55e 12%, var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
  },

  warningBox: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-warning)',
    background: 'var(--admin-warning-soft-bg)',
    color: 'var(--admin-warning-text)',
  },

  footer: {
    borderTop: '1px solid var(--admin-card-border)',
    background: 'var(--admin-modal-bg)',
  },
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function normalizeKey(value) {
  return cleanText(value).toLowerCase();
}

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO').format(number);
}

function getProductTitle(row) {
  return (
    row?.product?.title ||
    row?.productSnapshot?.title ||
    row?.title ||
    'Producto sin nombre'
  );
}

function getProductSku(row) {
  return (
    row?.product?.sku ||
    row?.productSnapshot?.sku ||
    row?.variant?.sku ||
    row?.sku ||
    '—'
  );
}

function getProductImage(row) {
  return row?.product?.image || row?.productSnapshot?.image || row?.image || '';
}

function getProductId(row) {
  return String(
    row?.product?._id ||
      row?.product ||
      row?.productSnapshot?._id ||
      row?.productSnapshot?.id ||
      row?._id ||
      row?.id ||
      ''
  );
}

function getBranchName(row) {
  return (
    row?.branch?.name ||
    row?.branchSnapshot?.name ||
    row?.branchName ||
    row?.name ||
    'Sede no definida'
  );
}

function getBranchId(row) {
  return String(
    row?.branch?._id ||
      row?.branch ||
      row?.branchSnapshot?._id ||
      row?.branchSnapshot?.id ||
      row?._id ||
      row?.id ||
      ''
  );
}

function getVariantSize(row) {
  return cleanText(row?.variant?.size || row?.size || '');
}

function getVariantColor(row) {
  return cleanText(row?.variant?.color || row?.color || '');
}

function getVariantKey(row) {
  return cleanText(
    row?.variantKey ||
      row?.variant?.variantKey ||
      row?.variantId ||
      ''
  ).toLowerCase();
}

function getVariantAttributes(row) {
  return (Array.isArray(row?.variant?.attributes)
    ? row.variant.attributes
    : Array.isArray(row?.attributes)
      ? row.attributes
      : Array.isArray(row?.variantAttributes)
        ? row.variantAttributes
        : []
  )
    .map((attribute) => ({
      key: cleanText(attribute?.key || attribute?.label).toLowerCase(),
      label: cleanText(attribute?.label || attribute?.key),
      value: cleanText(attribute?.value),
    }))
    .filter((attribute) => attribute.key && attribute.value)
    .slice(0, 4);
}

function getVariantLabel(row) {
  const explicit = cleanText(row?.variant?.label || row?.variantLabel);
  if (explicit) return explicit;
  const attributes = getVariantAttributes(row);
  return (
    attributes.map((attribute) => attribute.value).join(' / ') ||
    [getVariantSize(row), getVariantColor(row)].filter(Boolean).join(' / ') ||
    'Presentación general'
  );
}

function getAvailableStock(row) {
  if (typeof row?.availableStock === 'number') return row.availableStock;

  const stock = Number(row?.stock || 0);
  const reservedStock = Number(row?.reservedStock || 0);

  return stock - reservedStock;
}

function getMovementType(type) {
  return MOVEMENT_TYPES.find((item) => item.value === type) || MOVEMENT_TYPES[0];
}

function getImpactText(type, quantity) {
  const selectedType = getMovementType(type);
  const number = Number(quantity || 0);

  if (!Number.isFinite(number) || number <= 0) {
    return selectedType.direction === 'out'
      ? 'Cuando escribas la cantidad, este movimiento restará unidades.'
      : 'Cuando escribas la cantidad, este movimiento sumará unidades.';
  }

  return selectedType.direction === 'out'
    ? `Este movimiento restará ${formatNumber(number)} unidad(es) al inventario.`
    : `Este movimiento sumará ${formatNumber(number)} unidad(es) al inventario.`;
}

function getProductsFromResponse(response) {
  const data = response?.data;

  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.data?.products)) return data.data.products;

  return [];
}

function getBranchesFromResponse(response) {
  const data = response?.data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.branches)) return data.branches;
  if (Array.isArray(data?.data?.branches)) return data.data.branches;
  if (Array.isArray(data?.data?.data)) return data.data.data;

  return [];
}

function buildMergedProducts(products = [], stockRows = []) {
  const productMap = new Map();

  products.forEach((product) => {
    const productId = getProductId(product);

    if (!productId) return;

    productMap.set(productId, {
      ...product,
      _id: productId,
      title: getProductTitle(product),
      sku: getProductSku(product),
      image: getProductImage(product),
      inventory: Array.isArray(product?.inventory) ? product.inventory : [],
      variants: Array.isArray(product?.variants) ? product.variants : [],
      sizes: Array.isArray(product?.sizes) ? product.sizes : [],
      colors: Array.isArray(product?.colors) ? product.colors : [],
    });
  });

  stockRows.forEach((row) => {
    const productId = getProductId(row);

    if (!productId) return;

    const currentProduct = productMap.get(productId) || {
      _id: productId,
      title: getProductTitle(row),
      sku: getProductSku(row),
      image: getProductImage(row),
      inventory: [],
      variants: [],
      sizes: [],
      colors: [],
    };

    const size = getVariantSize(row);
    const color = getVariantColor(row);

    const rowVariantKey = getVariantKey(row);
    const exists = currentProduct.inventory.some((item) => {
      const itemVariantKey = getVariantKey(item);
      if (rowVariantKey || itemVariantKey) {
        return rowVariantKey === itemVariantKey;
      }
      return (
        normalizeKey(item?.size) === normalizeKey(size) &&
        normalizeKey(item?.color) === normalizeKey(color)
      );
    });

    if ((size || color) && !exists) {
      currentProduct.inventory.push({
        size,
        color,
        variantKey: rowVariantKey,
        variantLabel: getVariantLabel(row),
        attributes: getVariantAttributes(row),
        sku: row?.variant?.sku || '',
        barcode: row?.variant?.barcode || '',
      });
    }

    productMap.set(productId, currentProduct);
  });

  return Array.from(productMap.values()).sort((a, b) =>
    getProductTitle(a).localeCompare(getProductTitle(b), 'es')
  );
}

function buildMergedBranches(branches = [], stockRows = []) {
  const branchMap = new Map();

  branches.forEach((branch) => {
    const branchId = getBranchId(branch);

    if (!branchId) return;

    branchMap.set(branchId, {
      ...branch,
      _id: branchId,
      name: getBranchName(branch),
      code: branch?.code || '',
      type: branch?.type || '',
    });
  });

  stockRows.forEach((row) => {
    const branchId = getBranchId(row);

    if (!branchId || branchMap.has(branchId)) return;

    branchMap.set(branchId, {
      _id: branchId,
      name: getBranchName(row),
      code: row?.branch?.code || row?.branchSnapshot?.code || '',
      type: row?.branch?.type || row?.branchSnapshot?.type || '',
    });
  });

  return Array.from(branchMap.values()).sort((a, b) =>
    getBranchName(a).localeCompare(getBranchName(b), 'es')
  );
}

function buildVariantOptions(product, stockRows = []) {
  if (!product) return [];

  const productId = getProductId(product);
  const variantMap = new Map();

  const addVariant = (variant = {}) => {
    const size = cleanText(variant?.size);
    const color = cleanText(variant?.color);
    const variantKey = getVariantKey(variant);
    const variantAttributes = getVariantAttributes(variant);
    const variantLabel = getVariantLabel(variant);

    if (!size && !color && !variantKey && !variantAttributes.length) return;

    const key =
      variantKey ||
      (variantAttributes.length
        ? JSON.stringify(
            variantAttributes.map((attribute) => [
              attribute.key,
              attribute.value.toLowerCase(),
            ])
          )
        : `${normalizeKey(size)}|${normalizeKey(color)}`);

    if (!variantMap.has(key)) {
      variantMap.set(key, {
        size,
        color,
        variantKey,
        variantLabel,
        variantAttributes,
        sku: cleanText(variant?.sku),
        barcode: cleanText(variant?.barcode),
      });
    }
  };

  if (Array.isArray(product?.variants) && product.variants.length) {
    product.variants
      .filter((variant) => variant?.active !== false)
      .forEach(addVariant);
  } else if (Array.isArray(product?.inventory)) {
    product.inventory.forEach(addVariant);
  }

  stockRows
    .filter((row) => getProductId(row) === productId)
    .forEach((row) => {
      addVariant({
        size: getVariantSize(row),
        color: getVariantColor(row),
        variantKey: getVariantKey(row),
        variantLabel: getVariantLabel(row),
        variantAttributes: getVariantAttributes(row),
        sku: row?.variant?.sku || '',
        barcode: row?.variant?.barcode || '',
      });
    });

  const sizes = Array.isArray(product?.sizes)
    ? product.sizes.map((item) => cleanText(item)).filter(Boolean)
    : [];

  const colors = Array.isArray(product?.colors)
    ? product.colors
        .map((item) => {
          if (typeof item === 'string') return cleanText(item);
          return cleanText(item?.name || item?.value || item?.hex || item?.color);
        })
        .filter(Boolean)
    : [];

  if (variantMap.size === 0 && sizes.length > 0 && colors.length > 0) {
    sizes.forEach((size) => {
      colors.forEach((color) => {
        addVariant({ size, color });
      });
    });
  }

  if (variantMap.size === 0 && sizes.length > 0) {
    sizes.forEach((size) => addVariant({ size, color: 'Único' }));
  }

  if (variantMap.size === 0 && colors.length > 0) {
    colors.forEach((color) => addVariant({ size: 'Única', color }));
  }

  return Array.from(variantMap.values()).sort((a, b) =>
    getVariantLabel(a).localeCompare(getVariantLabel(b), 'es', {
      numeric: true,
    })
  );
}

function findExistingStockRow(
  stockRows = [],
  { productId, branchId, size, color, variantKey }
) {
  return (
    stockRows.find((row) => {
      const sameProduct = getProductId(row) === productId;
      const sameBranch = getBranchId(row) === branchId;
      const rowVariantKey = getVariantKey(row);
      const sameVariant = variantKey || rowVariantKey
        ? rowVariantKey === variantKey
        : null;
      const sameSize = normalizeKey(getVariantSize(row)) === normalizeKey(size);
      const sameColor = normalizeKey(getVariantColor(row)) === normalizeKey(color);

      return (
        sameProduct &&
        sameBranch &&
        (sameVariant === null ? sameSize && sameColor : sameVariant)
      );
    }) || null
  );
}

function buildVariantValue(variant) {
  return (
    getVariantKey(variant) ||
    `${variant?.size || ''}|||${variant?.color || ''}`
  );
}

export default function InventoryAdjustmentModal({
  open,
  onClose,
  stockRows = [],
  onSaved,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [products, setProducts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadReferences = useCallback(async () => {
    try {
      setReferenceLoading(true);
      setReferenceError('');

      const [productsRes, branchesRes] = await Promise.all([
        api.get('/api/products', {
          params: {
            page: 1,
            limit: 100,
            sort: 'title',
          },
        }),
        api.get('/api/admin/branches', {
          params: {
            limit: 100,
            sort: 'name',
          },
        }),
      ]);

      setProducts(getProductsFromResponse(productsRes));
      setBranches(getBranchesFromResponse(branchesRes));
    } catch (err) {
      console.error('❌ Error cargando productos o sedes:', err);

      setReferenceError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudieron cargar productos o sedes.'
      );
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  const productOptions = useMemo(
    () => buildMergedProducts(products, stockRows),
    [products, stockRows]
  );

  const branchOptions = useMemo(
    () => buildMergedBranches(branches, stockRows),
    [branches, stockRows]
  );

  const selectedProduct = useMemo(() => {
    if (!form.productId) return null;

    return productOptions.find((product) => getProductId(product) === form.productId) || null;
  }, [form.productId, productOptions]);

  const selectedBranch = useMemo(() => {
    if (!form.branchId) return null;

    return branchOptions.find((branch) => getBranchId(branch) === form.branchId) || null;
  }, [form.branchId, branchOptions]);

  const variantOptions = useMemo(
    () => buildVariantOptions(selectedProduct, stockRows),
    [selectedProduct, stockRows]
  );

  const selectedType = useMemo(() => getMovementType(form.type), [form.type]);

  const existingStockRow = useMemo(
    () =>
      findExistingStockRow(stockRows, {
        productId: form.productId,
        branchId: form.branchId,
        size: form.size,
        color: form.color,
        variantKey: form.variantKey,
      }),
    [
      stockRows,
      form.productId,
      form.branchId,
      form.size,
      form.color,
      form.variantKey,
    ]
  );

  const currentAvailableStock = existingStockRow
    ? getAvailableStock(existingStockRow)
    : 0;

  useEffect(() => {
    if (!open) return;

    setError('');
    setSuccess('');
    setReferenceError('');
    setForm(INITIAL_FORM);
    loadReferences();
  }, [open, loadReferences]);

  useEffect(() => {
    if (!open) return;

    setForm((prev) => {
      if (prev.productId || productOptions.length === 0) return prev;

      return {
        ...prev,
        productId: getProductId(productOptions[0]),
      };
    });
  }, [open, productOptions]);

  useEffect(() => {
    if (!open) return;

    setForm((prev) => {
      if (prev.branchId || branchOptions.length === 0) return prev;

      return {
        ...prev,
        branchId: getBranchId(branchOptions[0]),
      };
    });
  }, [open, branchOptions]);

  useEffect(() => {
    if (!open || !selectedProduct) return;

    setForm((prev) => {
      const currentVariantExists = variantOptions.some(
        (variant) => buildVariantValue(variant) === (
          prev.variantKey ||
          `${prev.size || ''}|||${prev.color || ''}`
        )
      );

      if (currentVariantExists) return prev;

      const firstVariant = variantOptions[0];

      return {
        ...prev,
        size: firstVariant?.size || '',
        color: firstVariant?.color || '',
        variantKey: firstVariant?.variantKey || '',
        variantLabel: firstVariant?.variantLabel || '',
        variantAttributes: firstVariant?.variantAttributes || [],
      };
    });
  }, [open, selectedProduct, variantOptions]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, saving]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateProduct = (productId) => {
    const nextProduct =
      productOptions.find((product) => getProductId(product) === productId) || null;

    const nextVariants = buildVariantOptions(nextProduct, stockRows);
    const firstVariant = nextVariants[0];

    setForm((prev) => ({
      ...prev,
      productId,
      size: firstVariant?.size || '',
      color: firstVariant?.color || '',
      variantKey: firstVariant?.variantKey || '',
      variantLabel: firstVariant?.variantLabel || '',
      variantAttributes: firstVariant?.variantAttributes || [],
    }));
  };

  const updateVariant = (value) => {
    const selectedVariant = variantOptions.find(
      (variant) => buildVariantValue(variant) === value
    );
    if (!selectedVariant) return;

    setForm((prev) => ({
      ...prev,
      size: selectedVariant.size,
      color: selectedVariant.color,
      variantKey: selectedVariant.variantKey || '',
      variantLabel: selectedVariant.variantLabel || '',
      variantAttributes: selectedVariant.variantAttributes || [],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!form.productId) {
      setError('Selecciona un producto.');
      return;
    }

    if (!form.branchId) {
      setError('Selecciona una sede o bodega.');
      return;
    }

    if (
      !form.variantKey &&
      !cleanText(form.size) &&
      !cleanText(form.color)
    ) {
      setError('Selecciona la variante.');
      return;
    }

    const quantity = Number(form.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('La cantidad debe ser mayor a cero.');
      return;
    }

    if (!String(form.reason || '').trim()) {
      setError('Escribe el motivo del movimiento.');
      return;
    }

    const payload = {
      type: form.type,
      productId: form.productId,
      branchId: form.branchId,
      size: cleanText(form.size),
      color: cleanText(form.color),
      variantKey: form.variantKey,
      variantLabel: form.variantLabel,
      variantAttributes: form.variantAttributes,
      variant: {
        variantKey: form.variantKey,
        label: form.variantLabel,
        size: cleanText(form.size),
        color: cleanText(form.color),
        attributes: form.variantAttributes,
      },
      quantity,
      reason: String(form.reason || '').trim(),
      reference: String(form.reference || '').trim(),
      notes: String(form.notes || '').trim(),
      postNow: true,
    };

    try {
      setSaving(true);

      await api.post('/api/admin/inventory/movements', payload);

      setSuccess('Movimiento de inventario creado correctamente.');

      if (typeof onSaved === 'function') {
        await onSaved();
      }

      window.setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      console.error('❌ Error creando movimiento de inventario:', err);

      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo crear el movimiento de inventario.'
      );
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !saving &&
    !referenceLoading &&
    Boolean(form.productId) &&
    Boolean(form.branchId) &&
    Boolean(form.variantKey || form.size || form.color);

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-2 md:p-4"
      aria-modal="true"
      role="dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className="absolute inset-0 backdrop-blur-sm" style={styles.overlay} />

      <div className="relative z-[100000]" style={styles.modal}>
        <header className="shrink-0 px-6 py-5 md:px-8" style={styles.header}>
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <p
                className="text-xs font-black uppercase tracking-[0.26em]"
                style={styles.eyebrow}
              >
                Movimiento de inventario
              </p>

              <h2
                className="mt-2 text-2xl font-black tracking-tight md:text-3xl"
                style={styles.title}
              >
                Nuevo ajuste de stock
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
                Selecciona producto, sede o bodega, talla, color y cantidad. También puedes cargar stock inicial en una sede sin inventario.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60"
              style={styles.closeButton}
              title="Cerrar"
            >
              <X size={21} />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5" style={styles.body}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <main className="flex min-w-0 flex-col gap-4">
                {error && (
                  <div
                    className="flex items-start gap-3 px-4 py-3 text-sm font-semibold"
                    style={styles.dangerBox}
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                {referenceError && !error && (
                  <div
                    className="flex items-start gap-3 px-4 py-3 text-sm font-semibold"
                    style={styles.dangerBox}
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{referenceError}</p>
                  </div>
                )}

                {success && (
                  <div className="px-4 py-3 text-sm font-bold" style={styles.successBox}>
                    {success}
                  </div>
                )}

                <PanelCard>
                  <PanelTitle
                    icon={<PackageSearch size={18} />}
                    title="Producto, sede y variante"
                    description="El movimiento se aplica a una combinación exacta de producto, sede y atributos de variante."
                  />

                  {referenceLoading && (
                    <div className="mt-4 flex items-center gap-2 text-sm font-bold" style={styles.cardMuted}>
                      <RefreshCw size={16} className="animate-spin" />
                      Cargando productos y sedes...
                    </div>
                  )}

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Producto</Label>

                      <select
                        value={form.productId}
                        onChange={(event) => updateProduct(event.target.value)}
                        disabled={saving || referenceLoading || productOptions.length === 0}
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      >
                        <option value="">Seleccionar producto</option>

                        {productOptions.map((product) => (
                          <option key={getProductId(product)} value={getProductId(product)}>
                            {getProductTitle(product)} · SKU {getProductSku(product)}
                          </option>
                        ))}
                      </select>

                      <HelpText>
                        El producto puede tener inventario en otra sede. Desde aquí puedes cargarlo en una bodega nueva.
                      </HelpText>
                    </div>

                    <div>
                      <Label>Sede o bodega</Label>

                      <select
                        value={form.branchId}
                        onChange={(event) => updateField('branchId', event.target.value)}
                        disabled={saving || referenceLoading || branchOptions.length === 0}
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      >
                        <option value="">Seleccionar sede o bodega</option>

                        {branchOptions.map((branch) => (
                          <option key={getBranchId(branch)} value={getBranchId(branch)}>
                            {getBranchName(branch)}
                          </option>
                        ))}
                      </select>

                      <HelpText>
                        Aquí debe aparecer Bodega Principal aunque todavía no tenga stock.
                      </HelpText>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Variante</Label>

                      <select
                        value={buildVariantValue({
                          size: form.size,
                          color: form.color,
                          variantKey: form.variantKey,
                        })}
                        onChange={(event) => updateVariant(event.target.value)}
                        disabled={saving || referenceLoading || variantOptions.length === 0}
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      >
                        <option value="">Seleccionar variante</option>

                        {variantOptions.map((variant) => (
                          <option
                            key={buildVariantValue(variant)}
                            value={buildVariantValue(variant)}
                          >
                            {getVariantLabel(variant)}
                          </option>
                        ))}
                      </select>

                      <HelpText>
                        Selecciona la combinación exacta de atributos del producto.
                      </HelpText>
                    </div>

                    <div>
                      <Label>Estado actual</Label>

                      <div className="mt-2 px-4 py-3 text-sm font-black" style={styles.input}>
                        {existingStockRow
                          ? `Ya existe inventario: ${formatNumber(currentAvailableStock)} disponible(s)`
                          : 'Nuevo registro para esta sede'}
                      </div>

                      <HelpText>
                        Si dice nuevo registro, al guardar se creará el stock inicial en esa sede.
                      </HelpText>
                    </div>
                  </div>

                  {selectedProduct && selectedBranch && (
                    <div className="mt-4 p-4" style={styles.softCard}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p
                            className="text-xs font-black uppercase tracking-[0.2em]"
                            style={styles.eyebrow}
                          >
                            Selección actual
                          </p>

                          <h3 className="mt-1 text-lg font-black" style={styles.cardTitle}>
                            {getProductTitle(selectedProduct)}
                          </h3>
                        </div>

                        <span
                          className="w-fit px-4 py-2 text-xs font-black uppercase tracking-wide"
                          style={{
                            borderRadius: '999px',
                            border: '1px solid var(--admin-button-soft-border)',
                            background: 'var(--admin-button-soft-bg)',
                            color: 'var(--admin-button-soft-text)',
                          }}
                        >
                          SKU: {getProductSku(selectedProduct)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <MiniInfo label="Sede" value={getBranchName(selectedBranch)} />
                        <MiniInfo label="Variante" value={form.variantLabel || [form.size, form.color].filter(Boolean).join(' / ') || '—'} />
                        <MiniInfo
                          label="Disponible"
                          value={
                            existingStockRow
                              ? formatNumber(currentAvailableStock)
                              : 'Nuevo'
                          }
                        />
                      </div>
                    </div>
                  )}
                </PanelCard>

                <PanelCard>
                  <PanelTitle
                    icon={<ArrowRightLeft size={18} />}
                    title="Movimiento"
                    description="Define si el inventario debe aumentar o disminuir."
                  />

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Tipo de movimiento</Label>

                      <select
                        value={form.type}
                        onChange={(event) => updateField('type', event.target.value)}
                        disabled={saving}
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      >
                        {MOVEMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>

                      <HelpText>
                        Para cargar por primera vez en una bodega, usa Stock inicial.
                      </HelpText>
                    </div>

                    <div>
                      <Label>Cantidad</Label>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={form.quantity}
                        onChange={(event) => updateField('quantity', event.target.value)}
                        disabled={saving}
                        placeholder="Ej: 10"
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      />

                      <HelpText>
                        Escribe únicamente la cantidad que entra o sale. No escribas el stock total.
                      </HelpText>
                    </div>
                  </div>

                  <div className="mt-4 p-4" style={styles.softCard}>
                    <div className="flex items-start gap-3">
                      <Info
                        size={18}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--admin-primary)' }}
                      />

                      <div>
                        <p className="text-sm font-black" style={styles.cardTitle}>
                          {selectedType.label} · {selectedType.action}
                        </p>

                        <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                          {selectedType.help}
                        </p>
                      </div>
                    </div>
                  </div>
                </PanelCard>

                <PanelCard>
                  <PanelTitle
                    icon={<Info size={18} />}
                    title="Soporte administrativo"
                    description="Esta información queda guardada en el historial del inventario."
                  />

                  <div className="mt-4">
                    <Label>Motivo</Label>

                    <input
                      type="text"
                      value={form.reason}
                      onChange={(event) => updateField('reason', event.target.value)}
                      disabled={saving}
                      placeholder="Ej: Stock inicial en Bodega Principal"
                      className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                      style={styles.input}
                    />

                    <HelpText>
                      Campo obligatorio. Explica por qué se modifica este inventario.
                    </HelpText>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>
                        Referencia <span style={styles.cardMuted}>(opcional)</span>
                      </Label>

                      <input
                        type="text"
                        value={form.reference}
                        onChange={(event) => updateField('reference', event.target.value)}
                        disabled={saving}
                        placeholder="Ej: STOCK-BODEGA-001"
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      />

                      <HelpText>
                        Puedes usar un número interno, acta, remisión o código de control.
                      </HelpText>
                    </div>

                    <div>
                      <Label>
                        Observación <span style={styles.cardMuted}>(opcional)</span>
                      </Label>

                      <textarea
                        rows={3}
                        value={form.notes}
                        onChange={(event) => updateField('notes', event.target.value)}
                        disabled={saving}
                        placeholder="Ej: Carga inicial de inventario en bodega..."
                        className="mt-2 w-full resize-none px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      />

                      <HelpText>
                        Agrega detalles adicionales si necesitas dejar soporte del movimiento.
                      </HelpText>
                    </div>
                  </div>
                </PanelCard>
              </main>

              <aside className="min-w-0">
                <div className="sticky top-0 flex flex-col gap-4">
                  <div className="p-5" style={styles.summary}>
                    <p className="text-xs font-black uppercase tracking-[0.22em] opacity-80">
                      Resumen
                    </p>

                    <h3 className="mt-2 text-2xl font-black">
                      Impacto del ajuste
                    </h3>

                    <p className="mt-3 text-sm leading-6 opacity-85">
                      Revisa el resultado antes de guardar. El cambio se aplicará inmediatamente.
                    </p>

                    <div className="mt-5 space-y-3">
                      <SummaryRow label="Acción" value={selectedType.label} />
                      <SummaryRow label="Efecto" value={selectedType.action} />
                      <SummaryRow
                        label="Cantidad"
                        value={form.quantity ? formatNumber(form.quantity) : 'Sin definir'}
                      />
                      <SummaryRow
                        label="Disponible actual"
                        value={
                          existingStockRow
                            ? formatNumber(currentAvailableStock)
                            : 'Nuevo registro'
                        }
                      />
                    </div>
                  </div>

                  <PanelCard>
                    <p className="text-sm font-black" style={styles.cardTitle}>
                      Resultado esperado
                    </p>

                    <p className="mt-2 text-sm leading-6" style={styles.cardMuted}>
                      {getImpactText(form.type, form.quantity)}
                    </p>
                  </PanelCard>

                  <div className="p-5" style={styles.warningBox}>
                    <p className="text-sm font-black">
                      Guía rápida
                    </p>

                    <ul className="mt-3 space-y-2 text-sm leading-6">
                      <li>
                        <b>Stock inicial:</b> crea inventario en una sede o bodega.
                      </li>
                      <li>
                        <b>Ajuste positivo:</b> suma unidades por corrección.
                      </li>
                      <li>
                        <b>Ajuste negativo:</b> resta unidades por corrección.
                      </li>
                      <li>
                        <b>Entrada por compra:</b> registra mercancía nueva.
                      </li>
                    </ul>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <footer className="shrink-0 px-5 py-4 md:px-8" style={styles.footer}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm" style={styles.muted}>
                Verifica producto, sede, talla, color y cantidad antes de guardar.
              </p>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="inline-flex items-center justify-center px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={styles.softButton}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 px-7 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={styles.primaryButton}
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      Guardar ajuste
                    </>
                  )}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body
  );
}

function PanelCard({ children }) {
  return (
    <section className="p-5" style={styles.card}>
      {children}
    </section>
  );
}

function PanelTitle({ icon, title, description }) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center"
        style={styles.iconBox}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <h3 className="text-lg font-black" style={styles.cardTitle}>
          {title}
        </h3>

        <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
          {description}
        </p>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label className="text-sm font-black" style={styles.label}>
      {children}
    </label>
  );
}

function HelpText({ children }) {
  return (
    <p className="mt-2 text-xs leading-5" style={styles.help}>
      {children}
    </p>
  );
}

function MiniInfo({ label, value }) {
  return (
    <div
      className="px-3 py-3"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: '1px solid var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p className="text-[11px] font-black uppercase tracking-wide" style={styles.cardMuted}>
        {label}
      </p>

      <p className="mt-1 text-sm font-black" style={styles.cardTitle}>
        {value || '—'}
      </p>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3"
      style={styles.summaryRow}
    >
      <span className="text-xs font-black uppercase tracking-wide opacity-75">
        {label}
      </span>

      <span className="text-right text-sm font-black">
        {value || '—'}
      </span>
    </div>
  );
}
