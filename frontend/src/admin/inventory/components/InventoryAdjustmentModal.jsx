// frontend/src/admin/inventory/components/InventoryAdjustmentModal.jsx

import { useEffect, useMemo, useState } from 'react';
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
  stockRowId: '',
  type: 'adjustment_in',
  quantity: '',
  reason: '',
  reference: '',
  notes: '',
};

const MOVEMENT_TYPES = [
  {
    value: 'adjustment_in',
    label: 'Ajuste positivo',
    action: 'Suma stock',
    direction: 'in',
    help: 'Úsalo cuando el conteo físico muestra más unidades que las registradas en el sistema.',
  },
  {
    value: 'adjustment_out',
    label: 'Ajuste negativo',
    action: 'Resta stock',
    direction: 'out',
    help: 'Úsalo cuando el conteo físico muestra menos unidades que las registradas en el sistema.',
  },
  {
    value: 'purchase_in',
    label: 'Entrada por compra',
    action: 'Suma stock',
    direction: 'in',
    help: 'Úsalo cuando entra mercancía nueva por compra, proveedor o reposición.',
  },
  {
    value: 'return_in',
    label: 'Entrada por devolución',
    action: 'Suma stock',
    direction: 'in',
    help: 'Úsalo cuando una devolución vuelve a estar disponible para la venta.',
  },
  {
    value: 'damage_out',
    label: 'Salida por daño',
    action: 'Resta stock',
    direction: 'out',
    help: 'Úsalo cuando una prenda no debe seguir disponible por daño, mancha o defecto.',
  },
  {
    value: 'loss_out',
    label: 'Salida por pérdida',
    action: 'Resta stock',
    direction: 'out',
    help: 'Úsalo cuando una unidad no aparece después de una revisión o conteo.',
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

function getProductId(row) {
  return String(
    row?.product?._id ||
      row?.product ||
      row?.productSnapshot?._id ||
      row?.productSnapshot?.id ||
      ''
  );
}

function getBranchName(row) {
  return (
    row?.branch?.name ||
    row?.branchSnapshot?.name ||
    row?.branchName ||
    'Sede no definida'
  );
}

function getBranchId(row) {
  return String(
    row?.branch?._id ||
      row?.branch ||
      row?.branchSnapshot?._id ||
      row?.branchSnapshot?.id ||
      ''
  );
}

function getVariantSize(row) {
  return row?.variant?.size || row?.size || '—';
}

function getVariantColor(row) {
  return row?.variant?.color || row?.color || '—';
}

function getAvailableStock(row) {
  if (typeof row?.availableStock === 'number') return row.availableStock;

  const stock = Number(row?.stock || 0);
  const reservedStock = Number(row?.reservedStock || 0);

  return stock - reservedStock;
}

function buildOptionLabel(row) {
  return `${getProductTitle(row)} · ${getBranchName(row)} · Talla ${getVariantSize(
    row
  )} · Color ${getVariantColor(row)}`;
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

export default function InventoryAdjustmentModal({
  open,
  onClose,
  stockRows = [],
  onSaved,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const stockOptions = useMemo(() => {
    const seen = new Set();

    return stockRows.filter((row) => {
      const productId = getProductId(row);
      const branchId = getBranchId(row);
      const key = `${productId}|${branchId}|${getVariantSize(row)}|${getVariantColor(row)}`;

      if (!productId || !branchId || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
  }, [stockRows]);

  const selectedRow = useMemo(() => {
    if (!form.stockRowId) return null;
    return stockOptions.find((row) => row?._id === form.stockRowId) || null;
  }, [form.stockRowId, stockOptions]);

  const selectedType = useMemo(() => getMovementType(form.type), [form.type]);

  useEffect(() => {
    if (!open) return;

    setError('');
    setSuccess('');
    setForm({
      ...INITIAL_FORM,
      stockRowId: stockOptions[0]?._id || '',
    });
  }, [open, stockOptions]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow || '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!selectedRow) {
      setError('Selecciona un producto con sede, talla y color.');
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

    const productId = getProductId(selectedRow);
    const branchId = getBranchId(selectedRow);

    if (!productId) {
      setError('No se encontró el ID del producto seleccionado.');
      return;
    }

    if (!branchId) {
      setError('No se encontró el ID de la sede seleccionada.');
      return;
    }

    const payload = {
      type: form.type,
      productId,
      branchId,
      size: getVariantSize(selectedRow),
      color: getVariantColor(selectedRow),
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
                Selecciona el producto exacto, define si el inventario aumenta o disminuye y deja el soporte administrativo del movimiento.
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

                {success && (
                  <div className="px-4 py-3 text-sm font-bold" style={styles.successBox}>
                    {success}
                  </div>
                )}

                <PanelCard>
                  <PanelTitle
                    icon={<PackageSearch size={18} />}
                    title="Producto y variante"
                    description="El movimiento se aplica a una combinación exacta: producto, sede, talla y color."
                  />

                  <div className="mt-4">
                    <Label>Producto / sede / talla / color</Label>

                    <select
                      value={form.stockRowId}
                      onChange={(event) => updateField('stockRowId', event.target.value)}
                      disabled={saving || stockOptions.length === 0}
                      className="mt-2 w-full px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-70"
                      style={styles.input}
                    >
                      <option value="">Seleccionar registro de inventario</option>

                      {stockOptions.map((row) => (
                        <option key={row?._id} value={row?._id}>
                          {buildOptionLabel(row)}
                        </option>
                      ))}
                    </select>

                    <HelpText>
                      Revisa bien este campo. Si eliges otra sede, talla o color, modificarás otro inventario.
                    </HelpText>
                  </div>

                  {selectedRow && (
                    <div className="mt-4 p-4" style={styles.softCard}>
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p
                            className="text-xs font-black uppercase tracking-[0.2em]"
                            style={styles.eyebrow}
                          >
                            Producto seleccionado
                          </p>

                          <h3 className="mt-1 text-lg font-black" style={styles.cardTitle}>
                            {getProductTitle(selectedRow)}
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
                          SKU: {getProductSku(selectedRow)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-4">
                        <MiniInfo label="Sede" value={getBranchName(selectedRow)} />
                        <MiniInfo label="Talla" value={getVariantSize(selectedRow)} />
                        <MiniInfo label="Color" value={getVariantColor(selectedRow)} />
                        <MiniInfo
                          label="Disponible"
                          value={formatNumber(getAvailableStock(selectedRow))}
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
                        Entrada o ajuste positivo suma stock. Salida o ajuste negativo resta stock.
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
                        placeholder="Ej: 3"
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
                      placeholder="Ej: Ajuste por conteo físico"
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
                        placeholder="Ej: AJUSTE-ENERO-001"
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
                        placeholder="Ej: Conteo realizado por administración..."
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
                        label="Disponible"
                        value={
                          selectedRow
                            ? formatNumber(getAvailableStock(selectedRow))
                            : 'Sin seleccionar'
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
                        <b>Ajuste positivo:</b> suma unidades por corrección.
                      </li>
                      <li>
                        <b>Ajuste negativo:</b> resta unidades por corrección.
                      </li>
                      <li>
                        <b>Entrada por compra:</b> registra mercancía nueva.
                      </li>
                      <li>
                        <b>Salida por daño o pérdida:</b> retira unidades disponibles.
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
                  disabled={saving || stockOptions.length === 0}
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

        <style>
          {`
            @media (max-width: 1180px) {
              div[style*="grid-template-columns: minmax(0,1fr) 360px"] {
                grid-template-columns: 1fr !important;
              }
            }

            @media (max-width: 720px) {
              div[style*="width: min(1320px, calc(100vw - 34px))"] {
                width: calc(100vw - 18px) !important;
                max-height: calc(100vh - 18px) !important;
                border-radius: 22px !important;
              }
            }
          `}
        </style>
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