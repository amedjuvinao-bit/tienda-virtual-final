// frontend/src/admin/inventory/components/InventoryTransferModal.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  Info,
  MapPin,
  RefreshCw,
  Save,
  X,
} from 'lucide-react';
import api from '../../../lib/api';

const INITIAL_FORM = {
  sourceStockId: '',
  destinationBranchId: '',
  quantity: '',
  reason: '',
  reference: '',
  notes: '',
};

const styles = {
  overlay: {
    background: 'var(--admin-modal-overlay)',
  },

  modal: {
    width: 'min(1180px, calc(100vw - 34px))',
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

  body: {
    background:
      'radial-gradient(circle at top left, color-mix(in srgb, var(--admin-primary) 10%, transparent), transparent 30%), var(--admin-page-bg)',
  },

  footer: {
    borderTop: '1px solid var(--admin-card-border)',
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

  stockBox: {
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-card-text)',
  },

  branchBox: {
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    border: '1px solid var(--admin-card-border)',
    background: 'color-mix(in srgb, var(--admin-card-bg) 86%, var(--admin-primary) 14%)',
    color: 'var(--admin-card-text)',
  },
};

function cleanText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO').format(number);
}

function getStockRowId(row) {
  return String(row?._id || row?.id || '');
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

function getProductId(row) {
  return String(
    row?.product?._id ||
      row?.product ||
      row?.productSnapshot?._id ||
      row?.productSnapshot?.id ||
      row?.productId ||
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
      row?.branchId ||
      row?._id ||
      row?.id ||
      ''
  );
}

function getBranchCode(row) {
  return row?.branch?.code || row?.branchSnapshot?.code || row?.code || '';
}

function getBranchType(row) {
  const type = String(
    row?.branch?.type ||
      row?.branchSnapshot?.type ||
      row?.type ||
      ''
  )
    .trim()
    .toLowerCase();

  const branchName = getBranchName(row).toLowerCase();

  if (type.includes('warehouse') || type.includes('bodega')) return 'Bodega';
  if (branchName.includes('bodega')) return 'Bodega';

  return 'Sede';
}

function getVariantSize(row) {
  return cleanText(row?.variant?.size || row?.size || '');
}

function getVariantColor(row) {
  return cleanText(row?.variant?.color || row?.color || '');
}

function getAvailableStock(row) {
  if (typeof row?.availableStock === 'number') return row.availableStock;

  const stock = Number(row?.stock || 0);
  const reservedStock = Number(row?.reservedStock || 0);

  return stock - reservedStock;
}

function getBranchesFromResponse(response) {
  const data = response?.data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.branches)) return data.branches;
  if (Array.isArray(data?.data?.branches)) return data.data.branches;
  if (Array.isArray(data?.data?.data)) return data.data.data;

  return [];
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
      code: getBranchCode(branch),
      type: branch?.type || '',
    });
  });

  stockRows.forEach((row) => {
    const branchId = getBranchId(row);

    if (!branchId || branchMap.has(branchId)) return;

    branchMap.set(branchId, {
      _id: branchId,
      name: getBranchName(row),
      code: getBranchCode(row),
      type: row?.branch?.type || row?.branchSnapshot?.type || '',
    });
  });

  return Array.from(branchMap.values()).sort((a, b) =>
    getBranchName(a).localeCompare(getBranchName(b), 'es')
  );
}

function buildSourceOptions(stockRows = []) {
  return stockRows
    .filter((row) => {
      const productId = getProductId(row);
      const branchId = getBranchId(row);
      const size = getVariantSize(row);
      const color = getVariantColor(row);
      const availableStock = Number(getAvailableStock(row) || 0);

      return productId && branchId && size && color && availableStock > 0;
    })
    .sort((a, b) => {
      const productCompare = getProductTitle(a).localeCompare(
        getProductTitle(b),
        'es'
      );

      if (productCompare !== 0) return productCompare;

      return getBranchName(a).localeCompare(getBranchName(b), 'es');
    });
}

function findSourceStock(stockRows = [], sourceStockId = '') {
  return (
    stockRows.find((row) => getStockRowId(row) === String(sourceStockId || '')) ||
    null
  );
}

function buildInitialForm(initialStockRow) {
  return {
    ...INITIAL_FORM,
    sourceStockId: initialStockRow ? getStockRowId(initialStockRow) : '',
  };
}

export default function InventoryTransferModal({
  open,
  onClose,
  stockRows = [],
  initialStockRow = null,
  onSaved,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [branches, setBranches] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(false);
  const [referenceError, setReferenceError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const sourceOptions = useMemo(
    () => buildSourceOptions(stockRows),
    [stockRows]
  );

  const branchOptions = useMemo(
    () => buildMergedBranches(branches, stockRows),
    [branches, stockRows]
  );

  const selectedSourceStock = useMemo(() => {
    const foundStock = findSourceStock(stockRows, form.sourceStockId);

    if (foundStock) return foundStock;

    if (
      initialStockRow &&
      getStockRowId(initialStockRow) === String(form.sourceStockId || '')
    ) {
      return initialStockRow;
    }

    return null;
  }, [stockRows, form.sourceStockId, initialStockRow]);

  const selectedSourceBranchId = selectedSourceStock
    ? getBranchId(selectedSourceStock)
    : '';

  const destinationOptions = useMemo(
    () =>
      branchOptions.filter(
        (branch) => getBranchId(branch) !== selectedSourceBranchId
      ),
    [branchOptions, selectedSourceBranchId]
  );

  const selectedDestinationBranch = useMemo(() => {
    if (!form.destinationBranchId) return null;

    return (
      branchOptions.find(
        (branch) => getBranchId(branch) === form.destinationBranchId
      ) || null
    );
  }, [branchOptions, form.destinationBranchId]);

  const currentAvailableStock = selectedSourceStock
    ? Number(getAvailableStock(selectedSourceStock) || 0)
    : 0;

  const transferQuantity = Number(form.quantity || 0);

  const remainingOriginStock =
    selectedSourceStock && Number.isFinite(transferQuantity)
      ? Math.max(0, currentAvailableStock - transferQuantity)
      : currentAvailableStock;

  const loadReferences = useCallback(async () => {
    try {
      setReferenceLoading(true);
      setReferenceError('');

      const branchesRes = await api.get('/api/admin/branches', {
        params: {
          limit: 100,
          sort: 'name',
        },
      });

      setBranches(getBranchesFromResponse(branchesRes));
    } catch (err) {
      console.error('❌ Error cargando sedes para traslado:', err);

      setReferenceError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudieron cargar las sedes para el traslado.'
      );
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;

    setError('');
    setSuccess('');
    setReferenceError('');
    setForm(buildInitialForm(initialStockRow));
    loadReferences();
  }, [open, loadReferences, initialStockRow]);

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

  const updateSourceStock = (sourceStockId) => {
    setForm((prev) => ({
      ...prev,
      sourceStockId,
      destinationBranchId: '',
      quantity: '',
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!selectedSourceStock) {
      setError('Selecciona el inventario de origen.');
      return;
    }

    if (!form.destinationBranchId) {
      setError('Selecciona la sede o bodega destino.');
      return;
    }

    if (selectedSourceBranchId === form.destinationBranchId) {
      setError('La sede origen y la sede destino no pueden ser la misma.');
      return;
    }

    const quantity = Number(form.quantity);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError('La cantidad debe ser mayor a cero.');
      return;
    }

    if (quantity > currentAvailableStock) {
      setError(
        `No puedes trasladar más unidades de las disponibles. Disponible: ${formatNumber(
          currentAvailableStock
        )}.`
      );
      return;
    }

    if (!cleanText(form.reason)) {
      setError('Escribe el motivo del traslado.');
      return;
    }

    const payload = {
      type: 'transfer',
      productId: getProductId(selectedSourceStock),
      branchFrom: selectedSourceBranchId,
      branchTo: form.destinationBranchId,
      size: getVariantSize(selectedSourceStock),
      color: getVariantColor(selectedSourceStock),
      quantity,
      reason: cleanText(form.reason),
      reference: cleanText(form.reference),
      notes: cleanText(form.notes),
      postNow: true,
    };

    try {
      setSaving(true);

      await api.post('/api/admin/inventory/movements', payload);

      setSuccess('Traslado de inventario creado correctamente.');

      if (typeof onSaved === 'function') {
        await onSaved();
      }

      window.setTimeout(() => {
        onClose();
      }, 650);
    } catch (err) {
      console.error('❌ Error creando traslado de inventario:', err);

      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo crear el traslado de inventario.'
      );
    } finally {
      setSaving(false);
    }
  };

  const canSubmit =
    !saving &&
    !referenceLoading &&
    Boolean(selectedSourceStock) &&
    Boolean(form.destinationBranchId) &&
    Boolean(form.quantity) &&
    Boolean(form.reason);

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
                Traslado entre sedes
              </p>

              <h2
                className="mt-2 text-2xl font-black tracking-tight md:text-3xl"
                style={styles.title}
              >
                Trasladar stock
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
                Mueve unidades desde una sede o bodega origen hacia otra sede o bodega destino.
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
                  <div className="flex items-start gap-3 px-4 py-3 text-sm font-bold" style={styles.successBox}>
                    <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
                    <p>{success}</p>
                  </div>
                )}

                <PanelCard>
                  <PanelTitle
                    icon={<Boxes size={18} />}
                    title="Inventario origen"
                    description="Selecciona la fila exacta que tiene el producto, sede, talla, color y stock disponible."
                  />

                  {referenceLoading && (
                    <div className="mt-4 flex items-center gap-2 text-sm font-bold" style={styles.cardMuted}>
                      <RefreshCw size={16} className="animate-spin" />
                      Cargando sedes...
                    </div>
                  )}

                  <div className="mt-4">
                    <Label>Producto y origen</Label>

                    <select
                      value={form.sourceStockId}
                      onChange={(event) => updateSourceStock(event.target.value)}
                      disabled={saving || sourceOptions.length === 0}
                      className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                      style={styles.input}
                    >
                      <option value="">Seleccionar inventario origen</option>

                      {sourceOptions.map((row) => (
                        <option key={getStockRowId(row)} value={getStockRowId(row)}>
                          {getProductTitle(row)} · {getBranchName(row)} · Talla{' '}
                          {getVariantSize(row)} · Color {getVariantColor(row)} · Disponible{' '}
                          {formatNumber(getAvailableStock(row))}
                        </option>
                      ))}
                    </select>

                    <HelpText>
                      Si abriste desde una ficha, este campo ya vendrá seleccionado.
                    </HelpText>
                  </div>

                  {sourceOptions.length === 0 && (
                    <div className="mt-4 p-4 text-sm font-semibold" style={styles.warningBox}>
                      No hay inventario disponible para trasladar. Primero debes cargar stock inicial o ajuste positivo.
                    </div>
                  )}

                  {selectedSourceStock && (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <StockInfoBox
                        label="Producto"
                        value={getProductTitle(selectedSourceStock)}
                        helper={`SKU: ${getProductSku(selectedSourceStock)}`}
                      />

                      <StockInfoBox
                        label="Origen"
                        value={getBranchName(selectedSourceStock)}
                        helper={`${getBranchType(selectedSourceStock)} · Disponible: ${formatNumber(
                          currentAvailableStock
                        )}`}
                      />

                      <StockInfoBox
                        label="Talla"
                        value={getVariantSize(selectedSourceStock)}
                        helper="Variante exacta"
                      />

                      <StockInfoBox
                        label="Color"
                        value={getVariantColor(selectedSourceStock)}
                        helper="Variante exacta"
                      />
                    </div>
                  )}
                </PanelCard>

                <PanelCard>
                  <PanelTitle
                    icon={<MapPin size={18} />}
                    title="Destino y cantidad"
                    description="El destino debe ser diferente al origen. El sistema descuenta del origen y suma al destino."
                  />

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <Label>Sede o bodega destino</Label>

                      <select
                        value={form.destinationBranchId}
                        onChange={(event) => updateField('destinationBranchId', event.target.value)}
                        disabled={
                          saving ||
                          referenceLoading ||
                          !selectedSourceStock ||
                          destinationOptions.length === 0
                        }
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      >
                        <option value="">Seleccionar destino</option>

                        {destinationOptions.map((branch) => (
                          <option key={getBranchId(branch)} value={getBranchId(branch)}>
                            {getBranchName(branch)}
                          </option>
                        ))}
                      </select>

                      <HelpText>
                        No se permite trasladar hacia la misma sede origen.
                      </HelpText>
                    </div>

                    <div>
                      <Label>Cantidad a trasladar</Label>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        max={currentAvailableStock || undefined}
                        value={form.quantity}
                        onChange={(event) => updateField('quantity', event.target.value)}
                        disabled={saving || !selectedSourceStock}
                        placeholder="Ej: 1"
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      />

                      <HelpText>
                        Máximo disponible para este origen: {formatNumber(currentAvailableStock)}.
                      </HelpText>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="p-4" style={styles.branchBox}>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} style={styles.icon} />
                        <p className="text-xs font-black uppercase tracking-wide" style={styles.cardMuted}>
                          Origen
                        </p>
                      </div>

                      <p className="mt-2 text-lg font-black" style={styles.cardTitle}>
                        {selectedSourceStock ? getBranchName(selectedSourceStock) : 'Sin seleccionar'}
                      </p>

                      <p className="mt-1 text-sm" style={styles.cardMuted}>
                        Quedará con {formatNumber(remainingOriginStock)} disponible(s)
                      </p>
                    </div>

                    <div className="p-4" style={styles.branchBox}>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} style={styles.icon} />
                        <p className="text-xs font-black uppercase tracking-wide" style={styles.cardMuted}>
                          Destino
                        </p>
                      </div>

                      <p className="mt-2 text-lg font-black" style={styles.cardTitle}>
                        {selectedDestinationBranch
                          ? getBranchName(selectedDestinationBranch)
                          : 'Sin seleccionar'}
                      </p>

                      <p className="mt-1 text-sm" style={styles.cardMuted}>
                        Recibirá {form.quantity ? formatNumber(form.quantity) : '0'} unidad(es)
                      </p>
                    </div>
                  </div>
                </PanelCard>

                <PanelCard>
                  <PanelTitle
                    icon={<Info size={18} />}
                    title="Soporte administrativo"
                    description="Esta información quedará guardada en el historial del traslado."
                  />

                  <div className="mt-4">
                    <Label>Motivo</Label>

                    <input
                      type="text"
                      value={form.reason}
                      onChange={(event) => updateField('reason', event.target.value)}
                      disabled={saving}
                      placeholder="Ej: Traslado para surtir sede principal"
                      className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                      style={styles.input}
                    />

                    <HelpText>
                      Campo obligatorio. Explica por qué se mueve este inventario.
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
                        placeholder="Ej: TRASLADO-001"
                        className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      />

                      <HelpText>
                        Puedes usar un código interno, remisión o acta.
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
                        placeholder="Ej: Se traslada mercancía para disponibilidad en tienda..."
                        className="mt-2 w-full resize-none px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                        style={styles.input}
                      />

                      <HelpText>
                        Agrega detalles adicionales si necesitas dejar soporte.
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
                      Impacto del traslado
                    </h3>

                    <p className="mt-3 text-sm leading-6 opacity-85">
                      El sistema restará del origen y sumará al destino en una sola operación.
                    </p>

                    <div className="mt-5 space-y-3">
                      <SummaryRow
                        label="Producto"
                        value={
                          selectedSourceStock
                            ? getProductTitle(selectedSourceStock)
                            : 'Sin seleccionar'
                        }
                      />

                      <SummaryRow
                        label="Origen"
                        value={
                          selectedSourceStock
                            ? getBranchName(selectedSourceStock)
                            : 'Sin seleccionar'
                        }
                      />

                      <SummaryRow
                        label="Destino"
                        value={
                          selectedDestinationBranch
                            ? getBranchName(selectedDestinationBranch)
                            : 'Sin seleccionar'
                        }
                      />

                      <SummaryRow
                        label="Cantidad"
                        value={form.quantity ? formatNumber(form.quantity) : 'Pendiente'}
                      />
                    </div>
                  </div>

                  <PanelCard>
                    <p className="text-sm font-black" style={styles.cardTitle}>
                      Resultado esperado
                    </p>

                    <p className="mt-2 text-sm leading-6" style={styles.cardMuted}>
                      {selectedSourceStock && selectedDestinationBranch && form.quantity
                        ? `${getBranchName(selectedSourceStock)} pierde ${formatNumber(
                            form.quantity
                          )} unidad(es) y ${getBranchName(
                            selectedDestinationBranch
                          )} recibe ${formatNumber(form.quantity)} unidad(es).`
                        : 'Selecciona origen, destino y cantidad para ver el impacto.'}
                    </p>
                  </PanelCard>

                  <div className="p-5" style={styles.warningBox}>
                    <p className="text-sm font-black">
                      Regla del traslado
                    </p>

                    <p className="mt-3 text-sm leading-6">
                      No crea venta ni compra. Solo mueve unidades entre sedes o bodegas.
                    </p>
                  </div>
                </div>
              </aside>
            </div>
          </div>

          <footer className="shrink-0 px-5 py-4 md:px-8" style={styles.footer}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm" style={styles.muted}>
                Verifica origen, destino y cantidad antes de guardar.
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
                      Guardar traslado
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

function StockInfoBox({ label, value, helper }) {
  return (
    <div className="px-4 py-4" style={styles.stockBox}>
      <p
        className="text-[10px] font-black uppercase tracking-wide"
        style={styles.cardMuted}
      >
        {label}
      </p>

      <p className="mt-1 text-base font-black" style={styles.cardTitle}>
        {value || '—'}
      </p>

      {helper && (
        <p className="mt-1 text-xs leading-5" style={styles.cardMuted}>
          {helper}
        </p>
      )}
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