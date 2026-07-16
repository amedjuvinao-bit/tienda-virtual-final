// src/admin/FormularioProducto.jsx
import React, { useEffect, useMemo, useState } from 'react';
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

function hasInventoryDuplicatesFront(inv) {
  const set = new Set();
  for (const row of inv) {
    const key = `${String(row?.color || '').toLowerCase()}|${String(row?.size || '').toLowerCase()}`;
    if (set.has(key)) return true;
    set.add(key);
  }
  return false;
}

function Thumb({ src, alt, onRemove, index }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
      <img src={src} alt={alt} className="h-20 w-full object-cover" />
      <div className="absolute left-1 top-1 rounded bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-700">
        {index + 1}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 rounded border bg-white/90 px-1.5 py-0.5 text-[10px] text-slate-700 opacity-0 shadow transition group-hover:opacity-100"
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

function getInitialTrackInventory(productType, explicitValue) {
  if (typeof explicitValue === 'boolean') return explicitValue;
  return shouldTrackInventoryByType(productType);
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

  const [categoria, setCategoria] = useState('');
  const [originalCategoria, setOriginalCategoria] = useState('');
  const [catOptions, setCatOptions] = useState([]);
  const [categoriesExtra, setCategoriesExtra] = useState([]);
  const [catInput, setCatInput] = useState('');

  const [colorsArr, setColorsArr] = useState([]);
  const [colorsText, setColorsText] = useState('');
  const [stock, setStock] = useState(0);
  const [sizes, setSizes] = useState([]);
  const [sizeInput, setSizeInput] = useState('');
  const [variantStock, setVariantStock] = useState({});

  const [reorderPoint, setReorderPoint] = useState(0);
  const [reorderQty, setReorderQty] = useState(0);
  const [warehouseLocation, setWarehouseLocation] = useState('');
  const [weightGrams, setWeightGrams] = useState(0);
  const [dimL, setDimL] = useState(0);
  const [dimW, setDimW] = useState(0);
  const [dimH, setDimH] = useState(0);

  const [cost, setCost] = useState(0);
  const [averageCost, setAverageCost] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxIncluded, setTaxIncluded] = useState(true);

  const [brand, setBrand] = useState('');
  const [season, setSeason] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [barcode, setBarcode] = useState('');
  const [notes, setNotes] = useState('');

  const selectedType = useMemo(() => getProductTypeMeta(productType), [productType]);
  const selectedPreset = useMemo(() => getVariantPresetMeta(variantPreset), [variantPreset]);

  const colorKeys = useMemo(() => {
    return (Array.isArray(colorsArr) ? colorsArr : [])
      .map((color) => (typeof color === 'string' ? color : color?.hex || color?.value || color?.name || ''))
      .filter(Boolean);
  }, [colorsArr]);

  useEffect(() => {
    if (!id) return;

    api.get(`/api/products/${id}`)
      .then(({ data }) => {
        const p = data || {};

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
        setVariantPreset(p.variantPreset || (Array.isArray(p.sizes) && p.sizes.length ? 'fashion' : 'none'));

        setCategoria(p.category || '');
        setOriginalCategoria(p.category || '');
        setCategoriesExtra(normalizeStringArray(p.categories || []));

        let normalizedColors = [];
        if (Array.isArray(p.colors) && p.colors.length) {
          normalizedColors = normalizeStringArray(
            p.colors.map((color) => (typeof color === 'string' ? color : color?.hex || color?.value || color?.name || '')),
            10
          );
        }

        if ((!normalizedColors || normalizedColors.length === 0) && Array.isArray(p.inventory)) {
          normalizedColors = normalizeStringArray(
            p.inventory.map((row) => String(row.color || '').trim()),
            10
          );
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

        setStock(Number(p.stock ?? 0));
        setReorderPoint(Number(p.reorderPoint ?? 0));
        setReorderQty(Number(p.reorderQty ?? 0));
        setWarehouseLocation(p.warehouseLocation || '');
        setWeightGrams(Number(p.weightGrams ?? 0));
        setDimL(Number(p.dimensionsCm?.l ?? 0));
        setDimW(Number(p.dimensionsCm?.w ?? 0));
        setDimH(Number(p.dimensionsCm?.h ?? 0));

        setCost(Number(p.cost ?? 0));
        setAverageCost(Number(p.averageCost ?? 0));
        setTaxRate(Number(p.taxRate ?? 0));
        setTaxIncluded(p.taxIncluded !== false);

        setBrand(p.brand || '');
        setSeason(p.season || '');
        setSupplierName(p.supplier?.name || '');
        setBarcode(p.barcode || '');
        setNotes(p.notes || '');
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          toast.error('Este producto no existe o fue eliminado.');
          navigate('/admin/productos');
        } else {
          toast.error('Error al cargar producto');
        }
      });
  }, [id, navigate]);

  useEffect(() => {
    api.get('/api/products', { params: { _: Date.now() } })
      .then(({ data }) => {
        const set = new Set();
        (Array.isArray(data) ? data : []).forEach((p) => {
          const cats = Array.isArray(p?.categories) && p.categories.length ? p.categories : p?.category ? [p.category] : [];
          cats.forEach((cat) => {
            const value = String(cat || '').trim();
            if (value) set.add(value);
          });
        });
        setCatOptions([...set]);
      })
      .catch(() => {});
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
    if (!id) {
      setTrackInventory(shouldTrackInventoryByType(productType));
      if (productType === 'digital' || productType === 'service') {
        setVariantPreset('none');
      }
    }
  }, [productType, id]);

  const subirImagen = async (file, isGallery = false) => {
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

      if (isGallery) {
        setImagenes((prev) => {
          const next = [...prev];
          if (!next.includes(url)) next.push(url);
          if (next.length > 5) next.length = 5;
          return next;
        });
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

    setSizes((prev) => {
      const exists = prev.some((item) => item.toLowerCase() === value.toLowerCase());
      const next = exists
        ? prev.filter((item) => item.toLowerCase() !== value.toLowerCase())
        : [...prev, value];

      const map = {};
      Object.entries(variantStock).forEach(([key, qty]) => {
        const [variantValue] = key.split('|||');
        if (next.some((item) => item.toLowerCase() === variantValue.toLowerCase())) map[key] = qty;
      });
      setVariantStock(map);

      return normalizeStringArray(next);
    });
  };

  const addSizesFromInput = () => {
    if (!sizeInput.trim()) return;
    const parts = sizeInput.split(',').map((part) => part.trim()).filter(Boolean);
    setSizes((prev) => normalizeStringArray([...prev, ...parts]));
    setSizeInput('');
  };

  const addCatChip = (value) => {
    const clean = String(value || '').trim();
    if (!clean) return;
    setCategoriesExtra((prev) => normalizeStringArray([...prev, clean]));
  };

  const removeCatChip = (value) => {
    setCategoriesExtra((prev) => prev.filter((item) => item.toLowerCase() !== String(value).toLowerCase()));
  };

  const handleCatInputKey = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addCatChip(catInput);
      setCatInput('');
    }
  };

  const setCell = (size, color, value) => {
    const key = `${size}|||${color}`;
    const qty = Math.max(0, Math.floor(Number(value) || 0));
    setVariantStock((prev) => ({ ...prev, [key]: qty }));
  };

  const totalFromMatrix = useMemo(() => {
    return Object.values(variantStock).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
  }, [variantStock]);

  const inventoryArray = useMemo(() => {
    if (!trackInventory) return [];

    const out = [];
    sizes.forEach((size) => {
      const colors = colorKeys.length ? colorKeys : [''];
      colors.forEach((color) => {
        const key = `${size}|||${color}`;
        const qty = Math.max(0, Math.floor(Number(variantStock[key] || 0)));
        out.push({ size, color, stock: qty });
      });
    });

    return out.filter((row) => row.stock > 0);
  }, [trackInventory, sizes, colorKeys, variantStock]);

  const formInvalid = useMemo(() => {
    const price = Number(precio);
    const currentStock = Number(stock);
    if (!titulo.trim()) return true;
    if (!categoria.trim()) return true;
    if (!price || price <= 0 || Number.isNaN(price)) return true;
    if (trackInventory && inventoryArray.length === 0 && (Number.isNaN(currentStock) || currentStock < 0)) return true;
    return false;
  }, [titulo, categoria, precio, stock, trackInventory, inventoryArray.length]);

  const guardarProducto = async (event) => {
    event.preventDefault();
    if (cargando) return;

    if (!sku) return toast.error('SKU es obligatorio. Elige una categoría.');
    if (!titulo.trim()) return toast.error('El título es obligatorio');

    const price = Number(precio);
    if (!price || price <= 0 || Number.isNaN(price)) return toast.error('El precio debe ser mayor a 0');
    if (!categoria.trim()) return toast.error('La categoría es obligatoria');

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

    const dimensions =
      Number(dimL) || Number(dimW) || Number(dimH)
        ? { l: Number(dimL) || 0, w: Number(dimW) || 0, h: Number(dimH) || 0 }
        : undefined;

    const supplier = supplierName && supplierName.trim() ? { name: supplierName.trim() } : undefined;
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

      productType,
      unitOfMeasure,
      trackInventory,
      allowBackorder,
      variantPreset,
      variantAxes: trackInventory
        ? [
            { key: selectedPreset.axisLabel.toLowerCase(), label: selectedPreset.axisLabel, values: normalizeStringArray(sizes) },
            { key: 'color', label: 'Color', values: finalColors },
          ].filter((axis) => axis.values.length > 0)
        : [],

      colors: trackInventory ? finalColors : [],
      sizes: trackInventory ? normalizeStringArray(sizes) : [],
      inventory: trackInventory ? inventoryArray : [],

      reorderPoint: trackInventory ? Math.max(0, Number(reorderPoint || 0)) : 0,
      reorderQty: trackInventory ? Math.max(0, Number(reorderQty || 0)) : 0,
      warehouseLocation: trackInventory ? warehouseLocation || '' : '',
      weightGrams: Math.max(0, Number(weightGrams || 0)),
      dimensionsCm: dimensions,

      cost: Math.max(0, Number(cost || 0)),
      averageCost: Math.max(0, Number(averageCost || 0)),
      taxRate: Math.min(100, Math.max(0, Number(taxRate || 0))),
      taxIncluded: Boolean(taxIncluded),

      brand: brand || '',
      season: season || '',
      supplier,
      barcode: barcode || '',
      notes: notes || '',
    };

    const numericStock = Math.max(0, Math.floor(Number(stock) || 0));
    const shouldOmitStock = trackInventory && (inventoryArray?.length || 0) > 0 && (!numericStock || numericStock <= 0);
    if (trackInventory && !shouldOmitStock) {
      data.stock = numericStock;
    }

    if (trackInventory && hasInventoryDuplicatesFront(inventoryArray)) {
      toast.error('Hay combinaciones duplicadas en la matriz de variantes.');
      return;
    }

    setCargando(true);
    try {
      if (id) {
        const regen = originalCategoria && categoria && categoria !== originalCategoria ? '&regenSku=1' : '';
        await api.put(`/api/products/${id}?mode=replace${regen}`, data);
        toast.success('Producto actualizado');
      } else {
        await api.post('/api/products', data);
        toast.success('Producto creado');
      }
      navigate('/admin/productos');
    } catch (err) {
      if (err?.message === 'NO_ADMIN_TOKEN') {
        toast.error('Token de administrador ausente. Inicia sesión de nuevo.');
        return;
      }
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        (status === 401 ? 'No autorizado.' : status === 409 ? 'Dato único duplicado.' : 'Error al guardar');
      toast.error(msg);
      console.error(err);
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
            Configura productos físicos, digitales, servicios o combos sin limitar la tienda a ropa.
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
              <FieldLabel required>Categoría</FieldLabel>
              <input list="categoriasOptions" value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Ej. Tecnología, belleza, servicios" required />
              <datalist id="categoriasOptions">
                {[...new Set([...(catOptions || []), ...CATEGORY_SUGGESTIONS])].map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
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
              <FieldLabel required>Precio de venta</FieldLabel>
              <input type="number" min="0" step="1" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="89000" required />
            </div>

            <div className="space-y-2">
              <FieldLabel>Costo unitario</FieldLabel>
              <input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="0" />
            </div>

            <div className="space-y-2">
              <FieldLabel>Código de barras</FieldLabel>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="EAN / UPC / interno" />
            </div>

            <div className="space-y-2 md:col-span-3">
              <FieldLabel>Descripción</FieldLabel>
              <textarea rows={3} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Descripción comercial, características, uso, cuidados o condiciones del servicio." />
            </div>
          </section>

          <section className="grid gap-5 rounded-2xl border p-4 md:grid-cols-2" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Inventario</h3>
              <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                El catálogo guarda la configuración; los movimientos reales se harán desde Inventario por sede.
              </p>
            </div>

            <div className="grid gap-3">
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <input type="checkbox" checked={trackInventory} onChange={(e) => setTrackInventory(e.target.checked)} className="h-5 w-5 accent-pink-500" />
                <span className="text-sm font-semibold">Controlar inventario para este producto</span>
              </label>
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-card-bg)' }}>
                <input type="checkbox" checked={allowBackorder} onChange={(e) => setAllowBackorder(e.target.checked)} className="h-5 w-5 accent-pink-500" disabled={!trackInventory} />
                <span className="text-sm font-semibold">Permitir venta sin stock disponible</span>
              </label>
            </div>

            {trackInventory && (
              <>
                <div className="space-y-2">
                  <FieldLabel>Plantilla de variantes</FieldLabel>
                  <select value={variantPreset} onChange={(e) => setVariantPreset(e.target.value)} className="w-full px-3 py-2" style={inputStyle}>
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
                    Luego los movimientos se harán desde Inventario. Este dato queda como respaldo inicial.
                  </p>
                </div>
              </>
            )}
          </section>

          {trackInventory && (
            <section className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel>{selectedPreset.axisLabel || 'Variante'}</FieldLabel>
                  {selectedPreset.suggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedPreset.suggestions.map((item) => {
                        const active = sizes.some((size) => size.toLowerCase() === item.toLowerCase());
                        return (
                          <button
                            key={item}
                            type="button"
                            onClick={() => toggleSize(item)}
                            className="rounded-full border px-3 py-1.5 text-xs transition"
                            style={{
                              borderColor: active ? 'var(--admin-primary)' : 'var(--admin-card-border)',
                              background: active ? 'var(--admin-button-bg)' : 'var(--admin-card-bg)',
                              color: active ? 'var(--admin-button-text)' : 'var(--admin-card-text)',
                            }}
                          >
                            {item}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-2 flex gap-2">
                    <input value={sizeInput} onChange={(e) => setSizeInput(e.target.value)} className="flex-1 px-3 py-2" style={inputStyle} placeholder="Agregar variantes separadas por coma" />
                    <button type="button" onClick={addSizesFromInput} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'var(--admin-button-bg)', color: 'var(--admin-button-text)' }}>
                      Añadir
                    </button>
                  </div>
                  {sizes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sizes.map((size) => (
                        <span key={size} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary-soft-text)' }}>
                          {size}
                          <button type="button" onClick={() => toggleSize(size)}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <FieldLabel helper="opcional">Colores / atributos visuales</FieldLabel>
                  <ColorBarPicker selected={colorsArr} onChange={setColorsArr} max={10} />
                  <input
                    value={colorsText}
                    onChange={(e) => setColorsText(e.target.value)}
                    onBlur={() => {
                      const parsed = colorsText.split(',').map((item) => item.trim()).filter(Boolean);
                      const merged = normalizeStringArray([...(colorsArr || []), ...parsed], 10);
                      setColorsArr(merged);
                      setColorsText(merged.join(', '));
                    }}
                    className="w-full px-3 py-2"
                    style={inputStyle}
                    placeholder="Ej: negro, blanco, #f0c, gold"
                  />
                </div>
              </div>

              {(sizes.length > 0 || colorKeys.length > 0) && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>
                      Matriz de inventario inicial
                    </h3>
                    <div className="text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                      Total matriz: <b style={{ color: 'var(--admin-card-text)' }}>{totalFromMatrix}</b>
                      <button type="button" className="ml-3 rounded-full px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--admin-button-soft-bg)', color: 'var(--admin-button-soft-text)' }} onClick={() => setStock(totalFromMatrix)}>
                        Usar como stock
                      </button>
                    </div>
                  </div>

                  <div className="overflow-auto rounded-xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
                    <table className="min-w-full text-sm">
                      <thead style={{ background: 'var(--admin-table-head-bg)', color: 'var(--admin-table-text)' }}>
                        <tr>
                          <th className="border-r p-2 text-left" style={{ borderColor: 'var(--admin-card-border)' }}>
                            {selectedPreset.axisLabel || 'Variante'} \ Color
                          </th>
                          {colorKeys.length === 0 ? (
                            <th className="p-2" style={{ color: 'var(--admin-card-muted-text)' }}>Sin colores</th>
                          ) : (
                            colorKeys.map((color) => (
                              <th key={color} className="border-l p-2" style={{ borderColor: 'var(--admin-card-border)' }}>
                                <div className="flex items-center gap-2">
                                  <span className="inline-block h-4 w-4 rounded-full border" style={{ backgroundColor: color }} />
                                  <span className="font-normal">{color}</span>
                                </div>
                              </th>
                            ))
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {sizes.length === 0 ? (
                          <tr>
                            <td className="p-3" style={{ color: 'var(--admin-card-muted-text)' }}>Sin variantes</td>
                          </tr>
                        ) : (
                          sizes.map((size) => (
                            <tr key={size}>
                              <td className="border-r p-2 font-semibold" style={{ borderColor: 'var(--admin-card-border)' }}>{size}</td>
                              {(colorKeys.length ? colorKeys : ['']).map((color) => {
                                const key = `${size}|||${color}`;
                                return (
                                  <td key={key} className="border-l p-1" style={{ borderColor: 'var(--admin-card-border)' }}>
                                    <input type="number" min="0" step="1" value={variantStock[key] ?? 0} onChange={(e) => setCell(size, color, e.target.value)} className="w-24 px-2 py-1 text-center" style={inputStyle} />
                                  </td>
                                );
                              })}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
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
              <div>
                <FieldLabel>Costo promedio</FieldLabel>
                <input type="number" min="0" value={averageCost} onChange={(e) => setAverageCost(e.target.value)} className="w-full px-3 py-2" style={inputStyle} />
              </div>
              <div>
                <FieldLabel>IVA %</FieldLabel>
                <input type="number" min="0" max="100" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} className="w-full px-3 py-2" style={inputStyle} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input id="taxIncluded" type="checkbox" checked={taxIncluded} onChange={(e) => setTaxIncluded(e.target.checked)} className="h-5 w-5 accent-pink-500" />
                <label htmlFor="taxIncluded" className="text-sm font-semibold">Precio incluye IVA</label>
              </div>
              <div>
                <FieldLabel>Punto de pedido</FieldLabel>
                <input type="number" min="0" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} className="w-full px-3 py-2" style={inputStyle} disabled={!trackInventory} />
              </div>
              <div>
                <FieldLabel>Reposición sugerida</FieldLabel>
                <input type="number" min="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} className="w-full px-3 py-2" style={inputStyle} disabled={!trackInventory} />
              </div>
              <div>
                <FieldLabel>Ubicación bodega</FieldLabel>
                <input value={warehouseLocation} onChange={(e) => setWarehouseLocation(e.target.value)} className="w-full px-3 py-2" style={inputStyle} disabled={!trackInventory} placeholder="Estante A-3" />
              </div>
              <div>
                <FieldLabel>Peso gramos</FieldLabel>
                <input type="number" min="0" value={weightGrams} onChange={(e) => setWeightGrams(e.target.value)} className="w-full px-3 py-2" style={inputStyle} />
              </div>
              <div className="md:col-span-2">
                <FieldLabel>Dimensiones cm</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min="0" value={dimL} onChange={(e) => setDimL(e.target.value)} placeholder="Largo" className="px-3 py-2" style={inputStyle} />
                  <input type="number" min="0" value={dimW} onChange={(e) => setDimW(e.target.value)} placeholder="Ancho" className="px-3 py-2" style={inputStyle} />
                  <input type="number" min="0" value={dimH} onChange={(e) => setDimH(e.target.value)} placeholder="Alto" className="px-3 py-2" style={inputStyle} />
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <FieldLabel>Marca</FieldLabel>
              <input value={brand} onChange={(e) => setBrand(e.target.value)} className="w-full px-3 py-2" style={inputStyle} />
            </div>
            <div className="space-y-2">
              <FieldLabel>Temporada / colección</FieldLabel>
              <input value={season} onChange={(e) => setSeason(e.target.value)} className="w-full px-3 py-2" style={inputStyle} />
            </div>
            <div className="space-y-2">
              <FieldLabel>Proveedor</FieldLabel>
              <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className="w-full px-3 py-2" style={inputStyle} />
            </div>

            <div className="space-y-2 md:col-span-3">
              <FieldLabel>Categorías adicionales</FieldLabel>
              <div className="flex gap-2">
                <input list="categoriasOptions" value={catInput} onChange={(e) => setCatInput(e.target.value)} onKeyDown={handleCatInputKey} placeholder="Escribe y presiona Enter" className="flex-1 px-3 py-2" style={inputStyle} />
                <button type="button" onClick={() => { addCatChip(catInput); setCatInput(''); }} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: 'var(--admin-button-bg)', color: 'var(--admin-button-text)' }}>Añadir</button>
              </div>
              {categoriesExtra.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {categoriesExtra.map((cat) => (
                    <span key={cat} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary-soft-text)' }}>
                      {cat}
                      <button type="button" onClick={() => removeCatChip(cat)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Imagen portada</h3>
                <p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Se mostrará primero en la tienda.</p>
              </div>
              <div className="p-5">
                <label className="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary-soft-text)' }}>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen(e.target.files?.[0], false)} />
                  Elegir portada
                </label>
                <div className="mt-4 h-64 overflow-hidden rounded-xl border" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                  {imagen ? (
                    <div className="relative h-full w-full">
                      <img src={imagen} alt="Portada del producto" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setImagen('')} className="absolute right-2 top-2 rounded-full border bg-white/90 px-2 py-1 text-xs text-slate-700 shadow">Quitar</button>
                    </div>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>Sin portada seleccionada</div>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div className="border-b px-5 py-4" style={{ borderColor: 'var(--admin-card-border)', background: 'var(--admin-soft-bg)' }}>
                <h3 className="text-sm font-black uppercase tracking-[0.18em]" style={{ color: 'var(--admin-primary)' }}>Galería</h3>
                <p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>Máximo 5 imágenes adicionales.</p>
              </div>
              <div className="p-5">
                <label className="inline-flex cursor-pointer items-center rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: 'var(--admin-primary-soft-border)', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary-soft-text)' }}>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen(e.target.files?.[0], true)} />
                  Añadir imagen
                </label>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {imagenes.length === 0 ? (
                    <div className="col-span-full rounded-xl border border-dashed p-6 text-center text-sm" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-muted-text)' }}>Sin imágenes adicionales</div>
                  ) : (
                    imagenes.map((src, index) => (
                      <Thumb key={`${src}-${index}`} src={src} alt={`Galería ${index + 1}`} index={index} onRemove={() => setImagenes((prev) => prev.filter((_, i) => i !== index))} />
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <FieldLabel>Notas internas</FieldLabel>
            <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2" style={inputStyle} placeholder="Observaciones internas para inventario, compras o finanzas." />
          </section>

          <section className="flex flex-wrap items-center justify-between gap-4 border-t pt-5" style={{ borderColor: 'var(--admin-card-border)' }}>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-5 w-5 accent-pink-500" />
              <span className="text-sm font-semibold">Producto activo en la tienda</span>
            </label>

            <div className="flex gap-3">
              <button type="button" onClick={() => navigate('/admin/productos')} className="rounded-xl border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: 'var(--admin-card-border)', color: 'var(--admin-card-text)' }}>
                Cancelar
              </button>
              <button disabled={cargando || formInvalid} className="rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: 'var(--admin-button-bg)', color: 'var(--admin-button-text)' }}>
                {cargando ? 'Guardando...' : id ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </div>
  );
}
