// frontend/src/admin/inventory/components/InventoryAdjustmentModal.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Info,
  MapPin,
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
  postNow: true,
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
    width: 'min(1040px, calc(100vw - 28px))',
    height: 'min(720px, calc(100vh - 28px))',
    maxHeight: 'calc(100vh - 28px)',
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
  const [step, setStep] = useState(1);

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
    setStep(1);
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

  const validateStep = (stepToValidate) => {
    setError('');

    if (stepToValidate === 1) {
      if (!form.productId) {
        setError('Selecciona el producto que vas a modificar.');
        return false;
      }

      if (!form.branchId) {
        setError('Selecciona la sede o bodega donde está el producto.');
        return false;
      }

      if (!form.variantKey && !cleanText(form.size) && !cleanText(form.color)) {
        setError('Selecciona la presentación o variante del producto.');
        return false;
      }
    }

    if (stepToValidate === 2) {
      const quantity = Number(form.quantity);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setError('Escribe una cantidad mayor a cero para continuar.');
        return false;
      }

      if (selectedType.direction === 'out' && quantity > currentAvailableStock) {
        setError(
          `No puedes retirar ${formatNumber(quantity)} unidades. Solo hay ${formatNumber(currentAvailableStock)} disponibles.`
        );
        return false;
      }
    }

    if (stepToValidate === 3 && !String(form.reason || '').trim()) {
      setError('Escribe un motivo breve para dejar claro por qué se hace el movimiento.');
      return false;
    }

    return true;
  };

  const goToNextStep = () => {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(current + 1, 4));
  };

  const goToPreviousStep = () => {
    setError('');
    setStep((current) => Math.max(current - 1, 1));
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
      postNow: form.postNow,
    };

    try {
      setSaving(true);

      await api.post('/api/admin/inventory/movements', payload);

      setSuccess(
        form.postNow
          ? 'Movimiento de inventario creado correctamente.'
          : 'Solicitud enviada a revisión. El stock todavía no cambió.'
      );

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

  const numericQuantity = Number(form.quantity || 0);
  const expectedStock = selectedType.direction === 'out'
    ? currentAvailableStock - numericQuantity
    : currentAvailableStock + numericQuantity;

  const canSubmit = !saving && !referenceLoading;

  const steps = [
    { number: 1, label: 'Ubicación', icon: MapPin },
    { number: 2, label: 'Movimiento', icon: ArrowRightLeft },
    { number: 3, label: 'Soporte', icon: Info },
    { number: 4, label: 'Confirmar', icon: ClipboardCheck },
  ];

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-2 md:p-4"
      aria-modal="true"
      role="dialog"
      aria-labelledby="inventory-adjustment-title"
      onClick={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <div className="absolute inset-0 backdrop-blur-sm" style={styles.overlay} />

      <div className="relative z-[100000]" style={styles.modal}>
        <header className="shrink-0 px-5 py-4 md:px-7" style={styles.header}>
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={styles.eyebrow}>
                Nuevo movimiento · Paso {step} de 4
              </p>
              <h2 id="inventory-adjustment-title" className="mt-1 truncate text-xl font-black tracking-tight md:text-2xl" style={styles.title}>
                Ajustar inventario
              </h2>
            </div>

            <button type="button" onClick={onClose} disabled={saving} className="inline-flex h-10 w-10 shrink-0 items-center justify-center transition disabled:opacity-60" style={styles.closeButton} title="Cerrar">
              <X size={20} />
            </button>
          </div>

          <nav className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Progreso del ajuste">
            {steps.map((item) => {
              const StepIcon = item.icon;
              const active = step === item.number;
              const completed = step > item.number;

              return (
                <div
                  key={item.number}
                  className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-2 md:px-3"
                  style={{
                    border: active ? '1px solid var(--admin-primary)' : '1px solid var(--admin-card-border)',
                    background: active ? 'var(--admin-primary-soft-bg)' : 'var(--admin-card-bg)',
                    color: active || completed ? 'var(--admin-primary)' : 'var(--admin-card-muted-text)',
                  }}
                  aria-current={active ? 'step' : undefined}
                >
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black"
                    style={{
                      background: completed ? 'var(--admin-primary)' : 'var(--admin-button-soft-bg)',
                      color: completed ? 'var(--admin-primary-text)' : 'currentColor',
                    }}
                  >
                    {completed ? <CheckCircle2 size={15} /> : <StepIcon size={14} />}
                  </span>
                  <span className="hidden truncate text-xs font-black sm:block">{item.label}</span>
                </div>
              );
            })}
          </nav>
        </header>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5" style={styles.body}>
            <main className="mx-auto flex h-full w-full max-w-[930px] flex-col gap-3">
              {(error || referenceError) && (
                <div className="flex items-start gap-3 px-4 py-2.5 text-sm font-semibold" style={styles.dangerBox} role="alert">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{error || referenceError}</p>
                </div>
              )}

              {success && (
                <div className="px-4 py-2.5 text-sm font-bold" style={styles.successBox} role="status">
                  {success}
                </div>
              )}

              {step === 1 && (
                <PanelCard>
                  <PanelTitle
                    icon={<PackageSearch size={18} />}
                    title="¿Qué producto vas a ajustar?"
                    description="Elige la ubicación exacta. Así evitamos modificar otra sede o presentación por error."
                  />

                  {referenceLoading ? (
                    <div className="mt-5 flex items-center justify-center gap-2 py-12 text-sm font-bold" style={styles.cardMuted}>
                      <RefreshCw size={18} className="animate-spin" />
                      Cargando productos y sedes...
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div>
                          <Label>1. Producto</Label>
                          <select value={form.productId} onChange={(event) => updateProduct(event.target.value)} disabled={saving || productOptions.length === 0} className="mt-2 w-full px-4 py-3 text-sm font-bold disabled:opacity-70" style={styles.input}>
                            <option value="">Seleccionar producto</option>
                            {productOptions.map((product) => (
                              <option key={getProductId(product)} value={getProductId(product)}>
                                {getProductTitle(product)} · SKU {getProductSku(product)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>2. Sede o bodega</Label>
                          <select value={form.branchId} onChange={(event) => updateField('branchId', event.target.value)} disabled={saving || branchOptions.length === 0} className="mt-2 w-full px-4 py-3 text-sm font-bold disabled:opacity-70" style={styles.input}>
                            <option value="">Seleccionar sede o bodega</option>
                            {branchOptions.map((branch) => (
                              <option key={getBranchId(branch)} value={getBranchId(branch)}>{getBranchName(branch)}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>3. Variante o presentación</Label>
                          <select
                            value={buildVariantValue({ size: form.size, color: form.color, variantKey: form.variantKey })}
                            onChange={(event) => updateVariant(event.target.value)}
                            disabled={saving || variantOptions.length === 0}
                            className="mt-2 w-full px-4 py-3 text-sm font-bold disabled:opacity-70"
                            style={styles.input}
                          >
                            <option value="">Seleccionar variante</option>
                            {variantOptions.map((variant) => (
                              <option key={buildVariantValue(variant)} value={buildVariantValue(variant)}>{getVariantLabel(variant)}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>Inventario disponible</Label>
                          <div className="mt-2 flex min-h-[46px] items-center justify-between gap-3 px-4 py-2.5" style={styles.softCard}>
                            <span className="text-sm font-bold" style={styles.cardMuted}>
                              {existingStockRow ? 'Existencia actual' : 'Se creará un registro nuevo'}
                            </span>
                            <strong className="text-xl" style={styles.cardTitle}>
                              {existingStockRow ? formatNumber(currentAvailableStock) : 'Nuevo'}
                            </strong>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 flex items-center gap-3 rounded-2xl px-4 py-3" style={styles.softCard}>
                        <MapPin size={19} className="shrink-0" style={{ color: 'var(--admin-primary)' }} />
                        <p className="min-w-0 truncate text-sm font-bold" style={styles.cardTitle}>
                          {selectedProduct && selectedBranch
                            ? `${getProductTitle(selectedProduct)} · ${getBranchName(selectedBranch)} · ${form.variantLabel || [form.size, form.color].filter(Boolean).join(' / ') || 'Sin variante'}`
                            : 'Completa las tres selecciones para continuar.'}
                        </p>
                      </div>
                      <HelpText>Las sedes sin existencias, incluida Bodega Principal, también pueden seleccionarse.</HelpText>
                    </>
                  )}
                </PanelCard>
              )}

              {step === 2 && (
                <PanelCard>
                  <PanelTitle
                    icon={<ArrowRightLeft size={18} />}
                    title="¿Qué cambio necesitas hacer?"
                    description="Selecciona la razón operativa y escribe solo las unidades que entran o salen."
                  />

                  <div className="mt-5 grid gap-5 md:grid-cols-2">
                    <div>
                      <Label>Tipo de movimiento</Label>
                      <select value={form.type} onChange={(event) => updateField('type', event.target.value)} disabled={saving} className="mt-2 w-full px-4 py-3 text-sm font-bold" style={styles.input}>
                        {MOVEMENT_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>

                      <div className="mt-3 flex items-start gap-3 p-4" style={styles.softCard}>
                        <Info size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--admin-primary)' }} />
                        <div>
                          <p className="text-sm font-black" style={styles.cardTitle}>{selectedType.action}</p>
                          <p className="mt-1 text-xs leading-5" style={styles.cardMuted}>{selectedType.help}</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Cantidad de unidades</Label>
                      <input type="number" min="1" step="1" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} disabled={saving} placeholder="Ejemplo: 10" autoFocus className="mt-2 w-full px-4 py-3 text-lg font-black" style={styles.input} />
                      <HelpText>No escribas el stock total; escribe únicamente cuánto entra o cuánto sale.</HelpText>

                      <div className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl" style={{ border: '1px solid var(--admin-card-border)' }}>
                        <StockFigure label="Ahora" value={formatNumber(currentAvailableStock)} />
                        <StockFigure label={selectedType.direction === 'out' ? 'Sale' : 'Entra'} value={form.quantity ? `${selectedType.direction === 'out' ? '−' : '+'}${formatNumber(form.quantity)}` : '—'} accent />
                        <StockFigure label="Quedaría" value={form.quantity && numericQuantity > 0 ? formatNumber(expectedStock) : '—'} />
                      </div>
                    </div>
                  </div>
                </PanelCard>
              )}

              {step === 3 && (
                <PanelCard>
                  <PanelTitle
                    icon={<Info size={18} />}
                    title="Deja el soporte del movimiento"
                    description="El motivo será visible en el historial. Luego decide si se aplica ahora o pasa a aprobación."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                      <Label>Motivo obligatorio</Label>
                      <input type="text" value={form.reason} onChange={(event) => updateField('reason', event.target.value)} disabled={saving} placeholder="Ej: Conteo físico encontró 3 unidades adicionales" autoFocus className="mt-2 w-full px-4 py-3 text-sm font-bold" style={styles.input} />
                    </div>

                    <div>
                      <Label>Referencia <span style={styles.cardMuted}>(opcional)</span></Label>
                      <input type="text" value={form.reference} onChange={(event) => updateField('reference', event.target.value)} disabled={saving} placeholder="Acta, remisión o código" className="mt-2 w-full px-4 py-3 text-sm font-bold" style={styles.input} />
                    </div>

                    <div>
                      <Label>Observación <span style={styles.cardMuted}>(opcional)</span></Label>
                      <input type="text" value={form.notes} onChange={(event) => updateField('notes', event.target.value)} disabled={saving} placeholder="Detalle adicional" className="mt-2 w-full px-4 py-3 text-sm font-bold" style={styles.input} />
                    </div>
                  </div>

                  <fieldset className="mt-5">
                    <legend className="text-sm font-black" style={styles.label}>¿Cuándo debe cambiar el stock?</legend>
                    <div className="mt-2 grid gap-3 md:grid-cols-2">
                      <ProcessChoice selected={form.postNow} onClick={() => updateField('postNow', true)} icon={<CheckCircle2 size={20} />} title="Aplicar ahora" description="El stock cambia al confirmar este ajuste." />
                      <ProcessChoice selected={!form.postNow} onClick={() => updateField('postNow', false)} icon={<Clock size={20} />} title="Enviar a revisión" description="Queda pendiente hasta que otra persona lo apruebe." />
                    </div>
                  </fieldset>
                </PanelCard>
              )}

              {step === 4 && (
                <PanelCard>
                  <PanelTitle
                    icon={<ClipboardCheck size={18} />}
                    title="Revisa antes de confirmar"
                    description="Esta es la operación exacta que quedará registrada. Si algo no coincide, vuelve al paso anterior."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ReviewItem label="Producto" value={selectedProduct ? getProductTitle(selectedProduct) : '—'} />
                      <ReviewItem label="Sede" value={selectedBranch ? getBranchName(selectedBranch) : '—'} />
                      <ReviewItem label="Variante" value={form.variantLabel || [form.size, form.color].filter(Boolean).join(' / ') || '—'} />
                      <ReviewItem label="Movimiento" value={selectedType.label} />
                      <ReviewItem label="Motivo" value={form.reason || '—'} wide />
                      {(form.reference || form.notes) && <ReviewItem label="Soporte adicional" value={[form.reference, form.notes].filter(Boolean).join(' · ')} wide />}
                    </div>

                    <div className="flex flex-col justify-between p-5" style={styles.summary}>
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.2em] opacity-80">Resultado</p>
                        <p className="mt-2 text-sm font-bold opacity-90">{selectedType.action}</p>
                      </div>
                      <div className="my-5 flex items-end justify-between gap-3">
                        <div><span className="block text-xs opacity-75">Antes</span><strong className="text-2xl">{formatNumber(currentAvailableStock)}</strong></div>
                        <ArrowRight size={21} className="mb-1 opacity-75" />
                        <div className="text-right"><span className="block text-xs opacity-75">Después</span><strong className="text-3xl">{formatNumber(expectedStock)}</strong></div>
                      </div>
                      <p className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold leading-5">
                        {form.postNow ? 'Se aplicará inmediatamente.' : 'Se enviará a revisión sin cambiar el stock.'}
                      </p>
                    </div>
                  </div>
                </PanelCard>
              )}
            </main>
          </div>

          <footer className="shrink-0 px-4 py-3 md:px-7" style={styles.footer}>
            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={step === 1 ? onClose : goToPreviousStep} disabled={saving} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-black disabled:opacity-60" style={styles.softButton}>
                {step === 1 ? <X size={16} /> : <ArrowLeft size={16} />}
                {step === 1 ? 'Cancelar' : 'Anterior'}
              </button>

              <p className="hidden text-center text-xs font-semibold md:block" style={styles.muted}>
                {step === 1 && 'Primero ubicamos el inventario correcto.'}
                {step === 2 && getImpactText(form.type, form.quantity)}
                {step === 3 && 'El soporte permite auditar el movimiento después.'}
                {step === 4 && (form.postNow ? 'El cambio será inmediato.' : 'El stock no cambiará hasta la aprobación.')}
              </p>

              {step < 4 ? (
                <button type="button" onClick={goToNextStep} disabled={saving || referenceLoading} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-black disabled:opacity-60" style={styles.primaryButton}>
                  Siguiente
                  <ArrowRight size={16} />
                </button>
              ) : (
                <button type="submit" disabled={!canSubmit} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-black disabled:opacity-60" style={styles.primaryButton}>
                  {saving ? <><RefreshCw size={16} className="animate-spin" /> Guardando...</> : <><Save size={16} /> {form.postNow ? 'Confirmar ajuste' : 'Enviar a revisión'}</>}
                </button>
              )}
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

function ProcessChoice({ selected, onClick, icon, title, description }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 items-start gap-3 p-4 text-left transition"
      style={{
        ...styles.softCard,
        border: selected
          ? '2px solid var(--admin-primary)'
          : styles.softCard.border,
        boxShadow: selected
          ? '0 10px 28px color-mix(in srgb, var(--admin-primary) 18%, transparent)'
          : 'none',
      }}
      aria-pressed={selected}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
        style={{
          background: selected ? 'var(--admin-primary)' : 'var(--admin-button-soft-bg)',
          color: selected ? 'var(--admin-primary-text)' : 'var(--admin-primary)',
        }}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <strong className="block text-sm" style={styles.cardTitle}>{title}</strong>
        <span className="mt-1 block text-xs leading-5" style={styles.cardMuted}>{description}</span>
      </span>
    </button>
  );
}

function StockFigure({ label, value, accent = false }) {
  return (
    <div
      className="min-w-0 px-2 py-3 text-center"
      style={{
        borderRight: label === 'Quedaría' ? 'none' : '1px solid var(--admin-card-border)',
        background: accent ? 'var(--admin-primary-soft-bg)' : 'var(--admin-card-bg)',
      }}
    >
      <span className="block truncate text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>{label}</span>
      <strong className="mt-1 block truncate text-xl" style={{ color: accent ? 'var(--admin-primary)' : 'var(--admin-card-text)' }}>{value}</strong>
    </div>
  );
}

function ReviewItem({ label, value, wide = false }) {
  return (
    <div className={`min-w-0 px-4 py-3 ${wide ? 'sm:col-span-2' : ''}`} style={styles.softCard}>
      <span className="block text-[10px] font-black uppercase tracking-[0.14em]" style={styles.cardMuted}>{label}</span>
      <strong className="mt-1 block break-words text-sm" style={styles.cardTitle}>{value || '—'}</strong>
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
