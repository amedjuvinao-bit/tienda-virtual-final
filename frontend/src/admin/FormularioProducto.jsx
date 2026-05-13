// src/admin/FormularioProducto.jsx
import React, { useState, useEffect, useMemo } from "react";
import api from "../lib/api";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import ColorBarPicker from "../components/ColorBarPicker.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Cloudinary (variables públicas Vite)
const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD;
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_PRESET;
const UPLOAD_FOLDER = import.meta.env.VITE_CLOUDINARY_FOLDER;

// ---------- Helpers ----------
function Thumb({ src, alt, onRemove, index, onClick }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative rounded-xl overflow-hidden border border-[#E9D6AA] transition-transform duration-300 hover:scale-[1.02] hover:shadow-lg group">
      <img
        src={src}
        alt={alt}
        onLoad={() => setLoaded(true)}
        className={`w-full h-20 object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
        onClick={onClick}
      />
      <div className="absolute top-1 left-1 text-[10px] bg-white/90 px-1.5 py-0.5 rounded">{index + 1}</div>
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-white/90 hover:bg-white border shadow opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        title="Quitar"
      >
        Quitar
      </button>
    </div>
  );
}

function makeSku(category) {
  const words = String(category || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  let base = "SKU";
  if (words.length >= 2) base = (words[0][0] + words[1][0]).toUpperCase();
  else if (words.length === 1) base = words[0].slice(0, 3).toUpperCase();

  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rnd = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);

  return `${base}-${y}${m}-${rnd}`;
}

// Normalizador de arrays string (trim + sin duplicados, case-insensitive)
function normalizeStringArray(arr, max = Infinity) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const v = String(item || "").trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(v);
      if (out.length >= max) break;
    }
  }
  return out;
}

// Valida duplicados (color+size) en inventory (front)
function hasInventoryDuplicatesFront(inv) {
  const set = new Set();
  for (const r of inv) {
    const key = `${(r.color || "").toLowerCase()}|${(r.size || "").toLowerCase()}`;
    if (set.has(key)) return true;
    set.add(key);
  }
  return false;
}

const SUGERIDAS = [
  "Vestidos cortos",
  "Vestidos largos",
  "Conjuntos",
  "Pantalones",
  "Jeans",
  "Shorts",
  "Faldas",
  "Blusas",
  "Pijamas",
  "Abrigos",
  "Accesorios",
];

const SIZE_SUGGESTIONS = ["0-3M", "3-6M", "6-9M", "9-12M", "12-18M", "18-24M", "2", "4", "6", "8", "10", "12", "14"];

// ---------- Componente ----------
export default function FormularioProducto() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Básicos
  const [sku, setSku] = useState("");
  const [titulo, setTitulo] = useState("");
  const [precio, setPrecio] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [imagen, setImagen] = useState("");
  const [imagenes, setImagenes] = useState([]);
  const [activo, setActivo] = useState(true);
  const [cargando, setCargando] = useState(false);

  // Categoría principal + adicionales
  const [categoria, setCategoria] = useState("");
  const [originalCategoria, setOriginalCategoria] = useState(""); // para detectar cambio
  const [catOptions, setCatOptions] = useState([]);
  const [categoriesExtra, setCategoriesExtra] = useState([]); // chips
  const [catInput, setCatInput] = useState("");

  // Colores
  const [colorsArr, setColorsArr] = useState([]);
  const [colorsText, setColorsText] = useState("");

  // Inventario simple
  const [stock, setStock] = useState(0);
  const [sizes, setSizes] = useState([]);
  const [sizeInput, setSizeInput] = useState("");

  // Inventario por variantes (talla + color)
  // key: `${size}|||${color}`
  const [variantStock, setVariantStock] = useState({});

  // Inventario avanzado + Contabilidad (opcionales)
  const [reorderPoint, setReorderPoint] = useState(0);
  const [reorderQty, setReorderQty] = useState(0);
  const [warehouseLocation, setWarehouseLocation] = useState("");
  const [weightGrams, setWeightGrams] = useState(0);
  const [dimL, setDimL] = useState(0);
  const [dimW, setDimW] = useState(0);
  const [dimH, setDimH] = useState(0);

  const [cost, setCost] = useState(0);
  const [averageCost, setAverageCost] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxIncluded, setTaxIncluded] = useState(true);

  const [brand, setBrand] = useState("");
  const [season, setSeason] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [barcode, setBarcode] = useState("");
  const [notes, setNotes] = useState("");

  const colorKeys = useMemo(() => {
    return (Array.isArray(colorsArr) ? colorsArr : [])
      .map((c) => (typeof c === "string" ? c : c?.hex || c?.value || c?.name || ""))
      .filter(Boolean);
  }, [colorsArr]);

  // ====== Carga edición ======
  useEffect(() => {
    if (!id) return;
    api.get(`/api/products/${id}`)
      .then(({ data }) => {
        const p = data || {};
        setSku(p.sku || "");
        setTitulo(p.title || "");
        setPrecio(p.price || "");
        setDescripcion(p.description || "");
        setImagen(p.image || "");
        setImagenes(Array.isArray(p.images) ? p.images : []);
        setActivo(p.active !== false);
        setCategoria(p.category || "");
        setOriginalCategoria(p.category || ""); // original

        // categorías adicionales (normalizadas)
        const catsNorm = normalizeStringArray(p.categories || []);
        setCategoriesExtra(catsNorm);

        // colores
        let normalizedColors = [];
        if (Array.isArray(p.colors) && p.colors.length) {
          normalizedColors = normalizeStringArray(
            p.colors.map((c) => (typeof c === "string" ? c : c?.hex || c?.value || c?.name || "")),
            10
          );
        }
        // Derivar colores desde inventory si no llegaron en colors
        if ((!normalizedColors || normalizedColors.length === 0) && Array.isArray(p.inventory)) {
          normalizedColors = normalizeStringArray(
            p.inventory.map((row) => String(row.color || "").trim()),
            10
          );
        }
        setColorsArr(normalizedColors);
        setColorsText((normalizedColors || []).join(", "));

        // tallas e inventory
        const initialSizes = normalizeStringArray(p.sizes || []);
        const derivedSizes =
          initialSizes.length
            ? initialSizes
            : Array.isArray(p.inventory)
            ? normalizeStringArray(p.inventory.map((row) => String(row.size || "").trim()))
            : [];
        setSizes(derivedSizes);

        if (Array.isArray(p.inventory)) {
          const map = {};
          p.inventory.forEach((row) => {
            const key = `${row.size || ""}|||${row.color || ""}`;
            map[key] = Number(row.stock || 0);
          });
          setVariantStock(map);
        } else {
          setVariantStock({});
        }

        setStock(Number(p.stock ?? 0));

        // Opcionales
        setReorderPoint(Number(p.reorderPoint ?? 0));
        setReorderQty(Number(p.reorderQty ?? 0));
        setWarehouseLocation(p.warehouseLocation || "");
        setWeightGrams(Number(p.weightGrams ?? 0));
        setDimL(Number(p.dimensionsCm?.l ?? 0));
        setDimW(Number(p.dimensionsCm?.w ?? 0));
        setDimH(Number(p.dimensionsCm?.h ?? 0));

        setCost(Number(p.cost ?? 0));
        setAverageCost(Number(p.averageCost ?? 0));
        setTaxRate(Number(p.taxRate ?? 0));
        setTaxIncluded(p.taxIncluded !== false);

        setBrand(p.brand || "");
        setSeason(p.season || "");
        setSupplierName(p.supplier?.name || "");
        setBarcode(p.barcode || "");
        setNotes(p.notes || "");
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          toast.error("Este producto no existe (o fue eliminado).");
          navigate("/admin/productos");
        } else {
          toast.error("Error al cargar producto");
        }
      });
  }, [id, navigate]);

  // ====== Cargar opciones de categorías existentes ======
  useEffect(() => {
    api.get(`/api/products`, { params: { _: Date.now() } })
      .then(({ data }) => {
        const set = new Set();
        (Array.isArray(data) ? data : []).forEach((p) => {
          const cats = Array.isArray(p?.categories) && p.categories.length ? p.categories : p?.category ? [p.category] : [];
          cats.forEach((c) => {
            const v = String(c || "").trim();
            if (v) set.add(v);
          });
        });
        setCatOptions([...set]);
      })
      .catch(() => {});
  }, []);

  // ====== SKU auto por categoría ======
  useEffect(() => {
    if (!categoria) {
      if (!id) setSku("");
      return;
    }
    if (!id) {
      // Creación: autogenera
      setSku(makeSku(categoria));
    } else {
      // Edición: si cambia la categoría respecto a la original, mostramos PREVIEW del nuevo SKU
      if (originalCategoria && categoria !== originalCategoria) {
        setSku(makeSku(categoria));
      }
      // Si vuelven a la original, mantenemos el SKU actual de DB (no lo tocamos aquí)
    }
  }, [categoria, id, originalCategoria]);

  // ====== Subida Cloudinary ======
  const subirImagen = async (file, isGallery = false) => {
    if (!file) return;
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      toast.error("Cloudinary no está configurado (CLOUD_NAME / UPLOAD_PRESET).");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESET);
    if (UPLOAD_FOLDER) formData.append("folder", UPLOAD_FOLDER);

    try {
      const res = await axios.post(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, formData);
      const url = res.data.secure_url;

      if (isGallery) {
        setImagenes((prev) => {
          const next = [...prev];
          if (!next.includes(url)) next.push(url);
          if (next.length > 5) next.length = 5; // cap
          return next;
        });
      } else {
        setImagen(url);
      }
    } catch (e) {
      console.error("Cloudinary upload error:", e?.response?.data || e.message);
      toast.error("Error al subir imagen");
    }
  };

  const eliminarImagenGaleria = (index) => setImagenes((prev) => prev.filter((_, i) => i !== index));

  // ====== Tallas ======
  const toggleSize = (s) => {
    const val = String(s || "").trim();
    if (!val) return;
    setSizes((prev) => {
      const exists = prev.some((x) => x.toLowerCase() === val.toLowerCase());
      const next = exists ? prev.filter((x) => x.toLowerCase() !== val.toLowerCase()) : [...prev, val];
      // limpiar entradas de variante que ya no existan
      const map = {};
      Object.entries(variantStock).forEach(([k, v]) => {
        const [sz] = k.split("|||");
        if (next.some((x) => x.toLowerCase() === sz.toLowerCase())) map[k] = v;
      });
      setVariantStock(map);
      return normalizeStringArray(next);
    });
  };

  const addSizesFromInput = () => {
    if (!sizeInput.trim()) return;
    const parts = sizeInput.split(",").map((p) => p.trim()).filter(Boolean);
    setSizes((prev) => normalizeStringArray([...prev, ...parts]));
    setSizeInput("");
  };

  // ====== Categorías extra (chips) ======
  const addCatChip = (val) => {
    const v = String(val || "").trim();
    if (!v) return;
    setCategoriesExtra((prev) => normalizeStringArray([...prev, v]));
  };

  const removeCatChip = (val) => {
    setCategoriesExtra((prev) => prev.filter((x) => x.toLowerCase() !== String(val).toLowerCase()));
  };

  const handleCatInputKey = (e) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCatChip(catInput);
      setCatInput("");
    }
  };

  // ====== Matriz de inventario ======
  const setCell = (size, color, value) => {
    const key = `${size}|||${color}`;
    const n = Math.max(0, Math.floor(Number(value) || 0));
    setVariantStock((prev) => ({ ...prev, [key]: n }));
  };

  const totalFromMatrix = useMemo(() => {
    return Object.values(variantStock).reduce((sum, n) => sum + (Number(n) || 0), 0);
  }, [variantStock]);

  const syncStockFromMatrix = () => {
    setStock(totalFromMatrix);
    toast.info("Stock general sincronizado con la suma de la matriz.");
  };

  const inventoryArray = useMemo(() => {
    const out = [];
    sizes.forEach((sz) => {
      (Array.isArray(colorKeys) ? colorKeys : []).forEach((c) => {
        const key = `${sz}|||${c}`;
        const qty = Math.max(0, Math.floor(Number(variantStock[key] || 0)));
        out.push({ size: sz, color: c, stock: qty });
      });
    });
    // quitamos filas 0 para no ensuciar payload
    return out.filter((r) => r.stock > 0);
  }, [sizes, colorKeys, variantStock]);

  // ====== Reglas mínimas para habilitar submit ======
  const formInvalid = useMemo(() => {
    const p = Number(precio);
    const st = Number(stock);
    if (!titulo.trim()) return true;
    if (!categoria.trim()) return true;
    if (!p || p <= 0 || Number.isNaN(p)) return true;
    if (inventoryArray.length === 0 && (Number.isNaN(st) || st < 0)) return true;
    return false;
  }, [titulo, categoria, precio, stock, inventoryArray.length]);

  // ====== Guardado ======
  const guardarProducto = async (e) => {
    e.preventDefault();
    if (cargando) return; // anti doble-submit

    if (!sku) return toast.error("SKU es obligatorio (elige una categoría)");
    if (!titulo.trim()) return toast.error("El título es obligatorio");

    const p = Number(precio);
    if (!p || p <= 0 || Number.isNaN(p)) return toast.error("El precio debe ser mayor a 0");

    if (!categoria.trim()) return toast.error("La categoría es obligatoria");

    // Normalizar colores de forma determinista (sin depender de setState)
    let finalColors = Array.isArray(colorsArr) ? [...colorsArr] : [];
    if (colorsText && colorsText.trim()) {
      const parsed = colorsText.split(",").map((s) => s.trim()).filter(Boolean);
      finalColors = normalizeStringArray([...finalColors, ...parsed], 10);
    } else {
      finalColors = normalizeStringArray(finalColors, 10);
    }
    if (finalColors.length > 10) {
      toast.error("Máximo 10 colores por producto.");
      return;
    }

    // construir dimensiones solo si hay algo
    const dimensions =
      Number(dimL) || Number(dimW) || Number(dimH)
        ? { l: Number(dimL) || 0, w: Number(dimW) || 0, h: Number(dimH) || 0 }
        : undefined;

    // supplier solo si trae nombre
    const supplier =
      supplierName && supplierName.trim()
        ? { name: supplierName.trim() }
        : undefined;

    // categorías extra normalizadas
    const categoriesNormalized = normalizeStringArray(categoriesExtra);

    // payload base
    const data = {
      sku, // en PUT el backend lo ignora; en POST puede aceptarlo
      title: titulo,
      price: Number(precio),
      description: descripcion,
      image: imagen,
      images: Array.isArray(imagenes) ? imagenes.slice(0, 5) : [],
      active: activo,
      colors: finalColors,
      category: categoria.trim(),
      categories: categoriesNormalized,

      // inventario
      sizes: normalizeStringArray(sizes),
      inventory: inventoryArray,

      // inventario avanzado y contabilidad
      reorderPoint: Math.max(0, Number(reorderPoint || 0)),
      reorderQty: Math.max(0, Number(reorderQty || 0)),
      warehouseLocation: warehouseLocation || "",
      weightGrams: Math.max(0, Number(weightGrams || 0)),
      dimensionsCm: dimensions,

      cost: Math.max(0, Number(cost || 0)),
      averageCost: Math.max(0, Number(averageCost || 0)),
      taxRate: Math.min(100, Math.max(0, Number(taxRate || 0))),
      taxIncluded: Boolean(taxIncluded),

      // comercial
      brand: brand || "",
      season: season || "",
      supplier,
      barcode: barcode || "",

      // notas
      notes: notes || "",
    };

    // reglas de stock:
    // Si hay matriz e 'stock' es 0/undefined, no lo enviamos (el backend recalcula).
    const numericStock = Math.max(0, Math.floor(Number(stock) || 0));
    const shouldOmitStock = (inventoryArray?.length || 0) > 0 && (!numericStock || numericStock <= 0);
    if (!shouldOmitStock) {
      data.stock = numericStock;
    }

    // validación front de duplicados en inventory
    if (hasInventoryDuplicatesFront(inventoryArray)) {
      toast.error("Hay combinaciones duplicadas en (talla + color) en la matriz.");
      return;
    }

    setCargando(true);
    try {
      
      if (id) {
        // Si cambió la categoría respecto a la original, pedimos REGENERAR SKU
        const regen =
          originalCategoria && categoria && categoria !== originalCategoria
            ? "&regenSku=1"
            : "";
        await api.put(`/api/products/${id}?mode=replace${regen}`, data);
        toast.success("Producto actualizado");
      } else {
        await api.post(`/api/products`, data);
        toast.success("Producto creado");
      }
      navigate("/admin/productos");
    } catch (err) {
      if (err?.message === "NO_ADMIN_TOKEN") {
        toast.error("Token de administrador ausente. Inicia sesión de nuevo.");
        return;
      }
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        (status === 401 ? "No autorizado (token inválido o expirado)" : status === 409 ? "Dato único duplicado (SKU/Slug/Barcode)" : "Error al guardar");
      toast.error(msg);
      console.error(err);
    } finally {
      setCargando(false);
    }
  };

  // ---------- UI ----------
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-[#E9D6AA]">
        <div className="px-6 py-5 border-b bg-[#fff8fb] rounded-t-2xl">
          <h2 className="text-2xl font-bold text-pink-600">{id ? "Editar Producto" : "Nuevo Producto"}</h2>
          <p className="text-sm text-gray-500 mt-1">Completa los campos. La portada se mostrará primero; la galería permite hasta 5 fotos.</p>
        </div>

        <form onSubmit={guardarProducto} className="p-6 space-y-8">
          {/* Datos básicos */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* SKU */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                SKU <span className="text-pink-500">*</span>{" "}
                <span className="text-xs text-gray-500">(se genera automáticamente por categoría)</span>
              </label>
              <input
                type="text"
                value={sku}
                readOnly
                disabled
                className="w-full border rounded-xl px-3 py-2 outline-none bg-gray-100 text-gray-700 cursor-not-allowed"
                placeholder="Se generará al elegir categoría"
                required
                aria-readonly="true"
              />
              {id && originalCategoria && categoria && categoria !== originalCategoria && (
                <p className="text-xs text-amber-600">
                  Al guardar se <b>regenerará</b> el SKU según la nueva categoría.
                </p>
              )}
            </div>

            {/* Título */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Título <span className="text-pink-500">*</span>
              </label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="Vestido de algodón para niña"
                required
              />
            </div>

            {/* Precio */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Precio <span className="text-pink-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={precio}
                onChange={(e) => setPrecio(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="89000"
                required
              />
            </div>

            {/* Categoría principal */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Categoría <span className="text-pink-500">*</span>
              </label>
              <input
                list="categoriasOptions"
                value={categoria}
                onChange={(e) => {
                  setCategoria(e.target.value);
                }}
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="Ej. Vestidos largos"
                required
              />
              <datalist id="categoriasOptions">
                {[...new Set([...(catOptions || []), ...SUGERIDAS])].map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              <p className="text-xs text-gray-500">
                En <b>creación</b> se autogenera el SKU al elegir categoría. En <b>edición</b> se regenera si cambias la categoría.
              </p>
            </div>

            {/* Descripción */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Descripción</label>
              <textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="Materiales, cuidados, estilo..."
              />
            </div>

            {/* Categorías adicionales (chips) */}
            <div className="md:col-span-2 space-y-2">
              <label className="text-sm font-medium">Categorías adicionales</label>
              <div className="flex gap-2">
                <input
                  list="categoriasOptions"
                  value={catInput}
                  onChange={(e) => setCatInput(e.target.value)}
                  onKeyDown={handleCatInputKey}
                  placeholder="Escribe y presiona Enter…"
                  className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                />
                <button
                  type="button"
                  onClick={() => {
                    addCatChip(catInput);
                    setCatInput("");
                  }}
                  className="no-glass px-4 py-2 rounded-xl bg-pink-500 text-white hover:bg-pink-600"
                >
                  Añadir
                </button>
              </div>
              {categoriesExtra.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {categoriesExtra.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-amber-50 border border-amber-200 text-amber-700"
                    >
                      {c}
                      <button type="button" className="text-amber-600 hover:text-amber-800" onClick={() => removeCatChip(c)} title="Quitar">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">Estas categorías se sumarán al filtro (campo <code>categories</code>).</p>
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Stock</label>
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                placeholder="0"
              />
            </div>

            {/* Tallas */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tallas</label>
              <div className="flex flex-wrap gap-2">
                {SIZE_SUGGESTIONS.map((s) => {
                  const active = sizes.some((x) => x.toLowerCase() === s.toLowerCase());
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleSize(s)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        active ? "bg-pink-500 text-white border-pink-500" : "bg-white text-gray-700 border-gray-300 hover:border-pink-300"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={sizeInput}
                  onChange={(e) => setSizeInput(e.target.value)}
                  placeholder="Agregar tallas personalizadas (separa por comas)"
                  className="flex-1 border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                />
                <button type="button" onClick={addSizesFromInput} className="px-4 py-2 rounded-xl bg-pink-500 text-white hover:bg-pink-600">
                  Añadir
                </button>
              </div>
              {sizes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {sizes.map((s) => (
                    <span key={s} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs bg-pink-50 border border-pink-200 text-pink-700">
                      {s}
                      <button type="button" className="text-pink-600 hover:text-pink-800" onClick={() => toggleSize(s)} title="Quitar">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Activo */}
            <div className="md:col-span-2">
              <label className="flex items-center gap-3 select-none">
                <input
                  id="active"
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="w-5 h-5 accent-pink-500 cursor-pointer"
                />
                <span className="text-sm font-medium">Activo</span>
                <span className="text-xs text-gray-500">— mostrar producto en la tienda</span>
              </label>
            </div>
          </section>

          {/* Colores */}
          <section className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Colores <span className="ml-1 text-xs text-gray-400">(elige de la barra o añade manualmente)</span>
            </label>

            <ColorBarPicker selected={colorsArr} onChange={setColorsArr} max={10} />

            <div className="mt-2">
              <label className="block text-xs text-gray-500 mb-1">También puedes editar como texto (separados por coma):</label>
              <input
                type="text"
                value={colorsText}
                onChange={(e) => setColorsText(e.target.value)}
                onBlur={() => {
                  const parsed = colorsText.split(",").map((s) => s.trim()).filter(Boolean);
                  const merged = normalizeStringArray([...(colorsArr || []), ...parsed], 10);
                  setColorsArr(merged);
                  setColorsText(merged.join(", "));
                }}
                placeholder="Ej: pink, #f0c, gold"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
              />
            </div>
          </section>

          {/* Matriz inventario por talla x color (opcional) */}
          {(sizes.length > 0 || colorKeys.length > 0) && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Inventario por talla y color (opcional)</h3>
                <div className="text-sm text-gray-600">
                  Total matriz: <b>{totalFromMatrix}</b>{" "}
                  <button type="button" className="ml-3 px-3 py-1.5 rounded-full bg-amber-500 text-white hover:bg-amber-600" onClick={syncStockFromMatrix}>
                    Usar como stock
                  </button>
                </div>
              </div>

              <div className="overflow-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 border-r text-left">Talla \ Color</th>
                      {colorKeys.length === 0 ? (
                        <th className="p-2 text-gray-400">— sin colores —</th>
                      ) : (
                        colorKeys.map((c) => (
                          <th key={c} className="p-2 border-l">
                            <div className="flex items-center gap-2">
                              <span className="inline-block w-4 h-4 rounded-full border" style={{ backgroundColor: c }} />
                              <span className="font-normal">{c}</span>
                            </div>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.length === 0 ? (
                      <tr>
                        <td className="p-3 text-gray-500">— sin tallas —</td>
                      </tr>
                    ) : (
                      sizes.map((sz) => (
                        <tr key={sz} className="even:bg-gray-50/40">
                          <td className="p-2 border-r font-medium">{sz}</td>
                          {colorKeys.length === 0 ? (
                            <td className="p-2 text-center text-gray-400">Agrega colores para usar la matriz</td>
                          ) : (
                            colorKeys.map((c) => {
                              const key = `${sz}|||${c}`;
                              return (
                                <td key={key} className="p-1 border-l">
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={variantStock[key] ?? 0}
                                    onChange={(e) => setCell(sz, c, e.target.value)}
                                    className="w-20 border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-pink-300"
                                  />
                                </td>
                              );
                            })
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-500">
                Si no usas la matriz, solo se tendrá en cuenta el <b>Stock</b> general.
              </p>
            </section>
          )}

          {/* Inventario avanzado y contabilidad (opcional) */}
          <section className="space-y-4 border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Inventario avanzado y contabilidad (opcional)</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">Punto de pedido</label>
                <input
                  type="number"
                  min="0"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Reposición sugerida</label>
                <input
                  type="number"
                  min="0"
                  value={reorderQty}
                  onChange={(e) => setReorderQty(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Ubicación en bodega</label>
                <input
                  type="text"
                  value={warehouseLocation}
                  onChange={(e) => setWarehouseLocation(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Estante A-3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Peso (g)</label>
                <input
                  type="number"
                  min="0"
                  value={weightGrams}
                  onChange={(e) => setWeightGrams(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="0"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium">Dimensiones (cm)</label>
                <div className="grid grid-cols-3 gap-2">
                  <input type="number" min="0" value={dimL} onChange={(e) => setDimL(e.target.value)} placeholder="Largo" className="border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300" />
                  <input type="number" min="0" value={dimW} onChange={(e) => setDimW(e.target.value)} placeholder="Ancho" className="border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300" />
                  <input type="number" min="0" value={dimH} onChange={(e) => setDimH(e.target.value)} placeholder="Alto" className="border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Costo unitario (COP)</label>
                <input
                  type="number"
                  min="0"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Costo promedio (COP)</label>
                <input
                  type="number"
                  min="0"
                  value={averageCost}
                  onChange={(e) => setAverageCost(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">IVA %</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="19"
                />
              </div>

              <div className="flex items-center gap-2">
                <input id="tincluded" type="checkbox" checked={taxIncluded} onChange={(e) => setTaxIncluded(e.target.checked)} className="w-5 h-5 accent-pink-500 cursor-pointer" />
                <label htmlFor="tincluded" className="text-sm">Precio incluye IVA</label>
              </div>

              <div>
                <label className="block text-sm font-medium">Marca</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Marca"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Temporada</label>
                <input
                  type="text"
                  value={season}
                  onChange={(e) => setSeason(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="SS25"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Proveedor (nombre)</label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Proveedor SA"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Código de barras</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="EAN/UPC"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-sm font-medium">Notas internas</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-pink-300"
                  placeholder="Observaciones para inventario/contabilidad"
                />
              </div>
            </div>
          </section>

          {/* Imágenes */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Portada */}
            <div className="rounded-2xl border border-[#E9D6AA] bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-[#fff8fb]">
                <h3 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Imagen portada</h3>
                <p className="text-xs text-gray-500">Se mostrará primero en la página de detalle.</p>
              </div>
              <div className="p-5">
                <label className="inline-flex items-center px-4 py-2 rounded-full border border-pink-200 hover:border-pink-400 cursor-pointer text-pink-600 text-sm bg-pink-50/50">
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => subirImagen(e.target.files?.[0], false)} />
                  Elegir portada
                </label>

                <div className="mt-4">
                  <div
                    className="relative w-full h-64 rounded-xl border-2 border-[#D4AF37] overflow-hidden
                               bg-[linear-gradient(45deg,#f3f4f6_25%,transparent_25%),linear-gradient(-45deg,#f3f4f6_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#f3f4f6_75%),linear-gradient(-45deg,transparent_75%,#f3f4f6_75%)]
                               bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0] transition-transform duration-300 hover:scale-[1.01] hover:shadow-lg"
                  >
                    {imagen ? (
                      <>
                        <img src={imagen} alt="Portada del producto" className="w-full h-full object-cover transition-opacity duration-500 opacity-100" />
                        <span className="absolute top-2 left-2 text-[10px] uppercase tracking-widest bg-[#D4AF37] text-white px-2 py-1 rounded-full shadow">
                          Portada
                        </span>
                        <button
                          type="button"
                          onClick={() => setImagen("")}
                          className="absolute top-2 right-2 text-xs px-2 py-1 rounded-full bg-white/90 hover:bg-white border shadow"
                        >
                          Quitar
                        </button>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">Sin portada seleccionada</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Galería */}
            <div className="rounded-2xl border border-[#E9D6AA] bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b bg-[#fff8fb] flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#D4AF37] tracking-wide">Galería (hasta 5)</h3>
                  <p className="text-xs text-gray-500">Puedes subir varias imágenes.</p>
                </div>
                <span className="text-xs text-gray-500">{imagenes.length} / 5</span>
              </div>

              <div className="p-5">
                <label className="inline-flex items-center px-4 py-2 rounded-full border border-pink-200 hover:border-pink-400 cursor-pointer text-pink-600 text-sm bg-pink-50/50">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (!files.length) return;
                      // sube una a una, respetando cap y sin duplicar
                      let stop = false;
                      files.forEach((f) => {
                        if (stop) return;
                        setImagenes((prev) => {
                          const next = [...prev];
                          if (next.length >= 5) {
                            stop = true;
                            return next;
                          }
                          // Subir este archivo
                          subirImagen(f, true);
                          return next;
                        });
                      });
                      e.target.value = "";
                    }}
                  />
                  Elegir imágenes
                </label>

                <div className="mt-4 grid grid-cols-4 gap-3">
                  {imagenes.map((img, idx) => (
                    <Thumb key={img + idx} src={img} alt={`Galería ${idx + 1}`} index={idx} onRemove={() => eliminarImagenGaleria(idx)} onClick={() => setImagen(img)} />
                  ))}
                </div>

                {imagenes.length === 0 && <p className="mt-3 text-[11px] text-gray-500">Consejo: usa fotos con orientación similar para una cuadrícula más simétrica.</p>}
              </div>
            </div>
          </section>

          {/* Guardar */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={cargando || formInvalid}
              className="bg-pink-500 hover:bg-pink-600 disabled:opacity-60 text-white px-6 py-2.5 rounded-full shadow transition-colors"
            >
              {cargando ? "Guardando..." : "Guardar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}