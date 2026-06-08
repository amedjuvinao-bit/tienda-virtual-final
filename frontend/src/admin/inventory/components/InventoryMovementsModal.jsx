// frontend/src/admin/inventory/components/InventoryMovementsModal.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  FileText,
  History,
  Loader2,
  PackageSearch,
  Search,
  X,
} from 'lucide-react';
import api from '../../../lib/api';

const MOVEMENT_TYPE_LABELS = {
  initial_stock: 'Stock inicial',
  purchase_in: 'Entrada por compra',
  sale_out: 'Salida por venta',
  return_in: 'Entrada por devolución',
  return_out: 'Salida por devolución',
  adjustment_in: 'Ajuste positivo',
  adjustment_out: 'Ajuste negativo',
  transfer: 'Traslado',
  damage_out: 'Salida por daño',
  loss_out: 'Salida por pérdida',
  correction: 'Corrección',
};

const DIRECTION_LABELS = {
  in: 'Entrada',
  out: 'Salida',
  transfer: 'Traslado',
  neutral: 'Neutral',
};

const STATUS_LABELS = {
  draft: 'Borrador',
  posted: 'Aplicado',
  cancelled: 'Cancelado',
  reversed: 'Reversado',
};

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

  input: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },

  closeButton: {
    borderRadius: '999px',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    border: '1px solid var(--admin-button-soft-border)',
  },

  softButton: {
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
    border: '1px solid var(--admin-button-soft-border)',
  },

  primaryBadge: {
    borderRadius: '999px',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
    border: '1px solid var(--admin-primary-soft-border)',
  },

  errorBox: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },

  tableWrap: {
    borderRadius: 'calc(var(--admin-radius) + 4px)',
    border: '1px solid var(--admin-table-border)',
    overflow: 'hidden',
  },

  tableHead: {
    background: 'var(--admin-table-head-bg)',
    color: 'var(--admin-table-head-text)',
  },

  tableBody: {
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-table-text)',
  },

  tableRow: {
    borderTop: '1px solid var(--admin-table-border)',
    color: 'var(--admin-table-text)',
  },
};

function formatNumber(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CO').format(number);
}

function formatDate(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
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

function getMovementProductTitle(movement) {
  return (
    movement?.product?.title ||
    movement?.productSnapshot?.title ||
    'Producto sin nombre'
  );
}

function getMovementProductSku(movement) {
  return (
    movement?.product?.sku ||
    movement?.productSnapshot?.sku ||
    movement?.variant?.sku ||
    '—'
  );
}

function getMovementSize(movement) {
  return movement?.variant?.size || '—';
}

function getMovementColor(movement) {
  return movement?.variant?.color || '—';
}

function normalizeValue(value) {
  return String(value || '').trim().toLowerCase();
}

function getMovementBranchName(movement) {
  if (movement?.direction === 'out') {
    return (
      movement?.branchFrom?.name ||
      movement?.branchFromSnapshot?.name ||
      'Sede origen'
    );
  }

  if (movement?.direction === 'transfer') {
    const from =
      movement?.branchFrom?.name ||
      movement?.branchFromSnapshot?.name ||
      'Origen';

    const to =
      movement?.branchTo?.name ||
      movement?.branchToSnapshot?.name ||
      'Destino';

    return `${from} → ${to}`;
  }

  return (
    movement?.branchTo?.name ||
    movement?.branchToSnapshot?.name ||
    movement?.branchFrom?.name ||
    movement?.branchFromSnapshot?.name ||
    'Sede destino'
  );
}

function getMovementTypeLabel(type) {
  return MOVEMENT_TYPE_LABELS[type] || type || 'Movimiento';
}

function getDirectionLabel(direction) {
  return DIRECTION_LABELS[direction] || direction || '—';
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

function getDirectionIcon(direction) {
  if (direction === 'in') return <ArrowDownLeft size={16} />;
  if (direction === 'out') return <ArrowUpRight size={16} />;
  if (direction === 'transfer') return <ArrowRightLeft size={16} />;
  return <History size={16} />;
}

function getSignedQuantity(movement) {
  const quantity = Number(movement?.quantity || 0);

  if (movement?.direction === 'out') {
    return `-${formatNumber(quantity)}`;
  }

  if (movement?.direction === 'in') {
    return `+${formatNumber(quantity)}`;
  }

  return formatNumber(quantity);
}

function movementMatchesSelectedVariant(movement, selectedStockRow) {
  if (!selectedStockRow) return true;

  const selectedSize = normalizeValue(getVariantSize(selectedStockRow));
  const selectedColor = normalizeValue(getVariantColor(selectedStockRow));

  const movementSize = normalizeValue(getMovementSize(movement));
  const movementColor = normalizeValue(getMovementColor(movement));

  return selectedSize === movementSize && selectedColor === movementColor;
}

export default function InventoryMovementsModal({
  open,
  onClose,
  stockRow,
}) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const productId = useMemo(() => getProductId(stockRow), [stockRow]);
  const branchId = useMemo(() => getBranchId(stockRow), [stockRow]);

  const loadMovements = useCallback(async () => {
    if (!open || !productId || !branchId) return;

    try {
      setLoading(true);
      setError('');

      const response = await api.get('/api/admin/inventory/movements', {
        params: {
          productId,
          branchId,
          limit: 100,
          sort: '-createdAt',
        },
      });

      const rows = Array.isArray(response?.data?.data)
        ? response.data.data
        : [];

      setMovements(rows.filter((item) => movementMatchesSelectedVariant(item, stockRow)));
    } catch (err) {
      console.error('❌ Error cargando movimientos de inventario:', err);

      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo cargar el historial de movimientos.'
      );
    } finally {
      setLoading(false);
    }
  }, [open, productId, branchId, stockRow]);

  useEffect(() => {
    if (!open) return;

    setMovements([]);
    setError('');
    setSearchTerm('');
    loadMovements();
  }, [open, loadMovements]);

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

  const filteredMovements = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    if (!term) return movements;

    return movements.filter((movement) => {
      const text = [
        movement?.movementNumber,
        getMovementTypeLabel(movement?.type),
        getDirectionLabel(movement?.direction),
        getStatusLabel(movement?.status),
        getMovementProductTitle(movement),
        getMovementProductSku(movement),
        getMovementBranchName(movement),
        movement?.reason,
        movement?.reference,
        movement?.notes,
        movement?.orderNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return text.includes(term);
    });
  }, [movements, searchTerm]);

  const summary = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;

    movements.forEach((movement) => {
      const quantity = Number(movement?.quantity || 0);

      if (movement?.direction === 'in') totalIn += quantity;
      if (movement?.direction === 'out') totalOut += quantity;
    });

    return {
      totalMovements: movements.length,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    };
  }, [movements]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed left-0 top-0 z-[99999] flex h-screen w-screen items-center justify-center p-2 md:p-4"
      aria-modal="true"
      role="dialog"
      onClick={(event) => {
        if (event.target === event.currentTarget && !loading) {
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
                Historial de inventario
              </p>

              <h2
                className="mt-2 text-2xl font-black tracking-tight md:text-3xl"
                style={styles.title}
              >
                Movimientos del producto
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6" style={styles.muted}>
                Revisa las entradas, salidas y ajustes registrados para la combinación seleccionada.
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-60"
              style={styles.closeButton}
              title="Cerrar"
            >
              <X size={21} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5" style={styles.body}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <main className="flex min-w-0 flex-col gap-4">
                {error && (
                  <div
                    className="flex items-start gap-3 px-4 py-3 text-sm font-semibold"
                    style={styles.errorBox}
                  >
                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <section className="p-5" style={styles.card}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center"
                          style={{
                            borderRadius: 'var(--admin-radius)',
                            background: 'var(--admin-primary-soft-bg)',
                            color: 'var(--admin-primary)',
                            border: '1px solid var(--admin-primary-soft-border)',
                          }}
                        >
                          <PackageSearch size={18} />
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-lg font-black" style={styles.cardTitle}>
                            {getProductTitle(stockRow)}
                          </h3>

                          <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                            {getBranchName(stockRow)} · Talla {getVariantSize(stockRow)} · Color {getVariantColor(stockRow)}
                          </p>
                        </div>
                      </div>
                    </div>

                    <span className="w-fit px-4 py-2 text-xs font-black uppercase tracking-wide" style={styles.primaryBadge}>
                      SKU: {getProductSku(stockRow)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <MiniInfo label="Movimientos" value={formatNumber(summary.totalMovements)} />
                    <MiniInfo label="Entradas" value={`+${formatNumber(summary.totalIn)}`} />
                    <MiniInfo label="Salidas" value={`-${formatNumber(summary.totalOut)}`} />
                    <MiniInfo label="Balance" value={formatNumber(summary.net)} />
                  </div>
                </section>

                <section className="p-5" style={styles.card}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-black" style={styles.cardTitle}>
                        Historial
                      </h3>

                      <p className="mt-1 text-sm" style={styles.cardMuted}>
                        Últimos movimientos encontrados para esta variante.
                      </p>
                    </div>

                    <div className="relative w-full md:max-w-sm">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--admin-input-placeholder)' }}
                      />

                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder="Buscar movimiento, motivo o referencia..."
                        className="inventory-movements-search w-full py-3 pl-10 pr-4 text-sm font-semibold"
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto" style={styles.tableWrap}>
                    <table className="min-w-full text-sm">
                      <thead
                        className="text-left text-xs font-black uppercase tracking-wide"
                        style={styles.tableHead}
                      >
                        <tr>
                          <th className="px-4 py-3">Movimiento</th>
                          <th className="px-4 py-3">Tipo</th>
                          <th className="px-4 py-3">Sede</th>
                          <th className="px-4 py-3">Cantidad</th>
                          <th className="px-4 py-3">Estado</th>
                          <th className="px-4 py-3">Fecha</th>
                          <th className="px-4 py-3">Motivo</th>
                        </tr>
                      </thead>

                      <tbody style={styles.tableBody}>
                        {loading && (
                          <tr style={styles.tableRow}>
                            <td colSpan="7" className="px-4 py-10 text-center">
                              <div className="inline-flex items-center gap-2" style={styles.cardMuted}>
                                <Loader2 size={18} className="animate-spin" />
                                Cargando movimientos...
                              </div>
                            </td>
                          </tr>
                        )}

                        {!loading && filteredMovements.length === 0 && (
                          <tr style={styles.tableRow}>
                            <td colSpan="7" className="px-4 py-10 text-center" style={styles.cardMuted}>
                              No hay movimientos para mostrar.
                            </td>
                          </tr>
                        )}

                        {!loading &&
                          filteredMovements.map((movement) => (
                            <tr
                              key={movement?._id}
                              className="inventory-movements-row"
                              style={styles.tableRow}
                            >
                              <td className="px-4 py-4">
                                <div className="flex items-center gap-3">
                                  <span
                                    className="inline-flex h-9 w-9 items-center justify-center"
                                    style={{
                                      borderRadius: 'var(--admin-radius)',
                                      background: 'var(--admin-primary-soft-bg)',
                                      color: 'var(--admin-primary)',
                                      border: '1px solid var(--admin-primary-soft-border)',
                                    }}
                                  >
                                    {getDirectionIcon(movement?.direction)}
                                  </span>

                                  <div>
                                    <p className="font-black" style={styles.cardTitle}>
                                      {movement?.movementNumber || 'Sin número'}
                                    </p>
                                    <p className="text-xs" style={styles.cardMuted}>
                                      {getDirectionLabel(movement?.direction)}
                                    </p>
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4">
                                {getMovementTypeLabel(movement?.type)}
                              </td>

                              <td className="px-4 py-4">
                                {getMovementBranchName(movement)}
                              </td>

                              <td
                                className="px-4 py-4 font-black"
                                style={{
                                  color:
                                    movement?.direction === 'out'
                                      ? 'var(--admin-danger)'
                                      : 'var(--admin-primary)',
                                }}
                              >
                                {getSignedQuantity(movement)}
                              </td>

                              <td className="px-4 py-4">
                                <span className="px-3 py-1 text-xs font-black" style={styles.primaryBadge}>
                                  {getStatusLabel(movement?.status)}
                                </span>
                              </td>

                              <td className="px-4 py-4">
                                {formatDate(movement?.postedAt || movement?.createdAt)}
                              </td>

                              <td className="px-4 py-4">
                                <div className="max-w-[260px]">
                                  <p className="font-semibold" style={styles.cardTitle}>
                                    {movement?.reason || '—'}
                                  </p>

                                  {movement?.reference && (
                                    <p className="mt-1 text-xs" style={styles.cardMuted}>
                                      Ref: {movement.reference}
                                    </p>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </main>

              <aside className="min-w-0">
                <div className="sticky top-0 flex flex-col gap-4">
                  <section className="p-5" style={styles.card}>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center"
                        style={{
                          borderRadius: 'var(--admin-radius)',
                          background: 'var(--admin-primary-soft-bg)',
                          color: 'var(--admin-primary)',
                          border: '1px solid var(--admin-primary-soft-border)',
                        }}
                      >
                        <History size={18} />
                      </div>

                      <div>
                        <p className="text-sm font-black" style={styles.cardTitle}>
                          Lectura rápida
                        </p>
                        <p className="text-xs" style={styles.cardMuted}>
                          Cómo interpretar los movimientos
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 text-sm leading-6" style={styles.cardMuted}>
                      <p>
                        <b style={styles.cardTitle}>Entrada:</b> aumenta el inventario disponible.
                      </p>
                      <p>
                        <b style={styles.cardTitle}>Salida:</b> disminuye el inventario disponible.
                      </p>
                      <p>
                        <b style={styles.cardTitle}>Aplicado:</b> el movimiento ya afectó el stock.
                      </p>
                      <p>
                        <b style={styles.cardTitle}>Borrador:</b> todavía no afecta el inventario.
                      </p>
                    </div>
                  </section>

                  <section className="p-5" style={styles.softCard}>
                    <div className="flex items-start gap-3">
                      <FileText
                        size={18}
                        className="mt-0.5 shrink-0"
                        style={{ color: 'var(--admin-primary)' }}
                      />

                      <div>
                        <p className="text-sm font-black" style={styles.cardTitle}>
                          Nota
                        </p>
                        <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                          Este historial muestra los movimientos del producto, sede, talla y color seleccionados. Más adelante podemos agregar filtros por fecha, tipo y exportación.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>
              </aside>
            </div>
          </div>

          <footer className="shrink-0 px-5 py-4 md:px-8" style={styles.footer}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm" style={styles.muted}>
                Historial filtrado por producto, sede, talla y color seleccionado.
              </p>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-black transition"
                style={styles.softButton}
              >
                Cerrar
              </button>
            </div>
          </footer>
        </div>

        <style>
          {`
            .inventory-movements-row:hover {
              background: var(--admin-table-row-hover) !important;
            }

            .inventory-movements-search::placeholder {
              color: var(--admin-input-placeholder);
            }

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