// frontend/src/admin/inventory/components/InventoryKardexModal.jsx

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRightLeft,
  ArrowUpRight,
  BadgeCheck,
  BookOpen,
  Boxes,
  FileText,
  Gauge,
  Layers,
  Loader2,
  MapPin,
  PackageSearch,
  Scale,
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
    width: 'min(1360px, calc(100vw - 28px))',
    maxHeight: 'calc(100vh - 28px)',
    borderRadius: 'calc(var(--admin-radius) + 14px)',
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
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-modal-bg) 86%, var(--admin-primary) 14%), var(--admin-modal-bg))',
  },

  body: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--admin-page-bg) 92%, var(--admin-primary) 8%), var(--admin-page-bg))',
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

  muted: {
    color: 'var(--admin-modal-muted-text)',
  },

  card: {
    borderRadius: 'calc(var(--admin-radius) + 10px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },

  hero: {
    borderRadius: 'calc(var(--admin-radius) + 14px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 78%, var(--admin-primary) 22%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow: '0 20px 48px color-mix(in srgb, var(--admin-primary) 16%, transparent)',
  },

  cardTitle: {
    color: 'var(--admin-card-text)',
  },

  cardMuted: {
    color: 'var(--admin-card-muted-text)',
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

  statusBadge: {
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

  entryText: {
    color: 'var(--admin-primary)',
  },

  exitText: {
    color: 'var(--admin-danger)',
  },

  warningText: {
    color: 'var(--admin-warning-text)',
  },

  infoBox: {
    borderRadius: 'calc(var(--admin-radius) + 6px)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-card-text)',
  },

  movementCard: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 92%, var(--admin-primary) 8%), var(--admin-card-bg))',
    color: 'var(--admin-card-text)',
    boxShadow: '0 12px 28px color-mix(in srgb, var(--admin-primary) 8%, transparent)',
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
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function getObjectIdValue(value) {
  if (!value) return '';

  if (typeof value === 'object') {
    return String(value._id || value.id || '');
  }

  return String(value || '');
}

function getProductId(row) {
  return getObjectIdValue(
    row?.product ||
      row?.productId ||
      row?.productSnapshot?._id ||
      row?.productSnapshot?.id
  );
}

function getBranchId(row) {
  return getObjectIdValue(
    row?.branch ||
      row?.branchId ||
      row?.branchSnapshot?._id ||
      row?.branchSnapshot?.id
  );
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

function getBranchName(row) {
  return (
    row?.branch?.name ||
    row?.branchSnapshot?.name ||
    row?.branchName ||
    'Sede no definida'
  );
}

function getVariantSize(row) {
  return row?.variant?.size || row?.size || '—';
}

function getVariantColor(row) {
  return row?.variant?.color || row?.color || '—';
}

function getVariantLabel(row) {
  const explicit = String(
    row?.variant?.label || row?.variantLabel || ''
  ).trim();
  if (explicit) return explicit;

  const attributes = Array.isArray(row?.variant?.attributes)
    ? row.variant.attributes
        .map((attribute) => String(attribute?.value || '').trim())
        .filter(Boolean)
    : [];

  return (
    attributes.join(' / ') ||
    [getVariantSize(row), getVariantColor(row)]
      .filter((value) => value && value !== '—')
      .join(' / ') ||
    'Presentación general'
  );
}

function getMovementTypeLabel(type) {
  return MOVEMENT_TYPE_LABELS[type] || type || 'Movimiento';
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '—';
}

function getDirectionIcon(effect, direction) {
  if (effect === 'in') return <ArrowDownLeft size={18} />;
  if (effect === 'out') return <ArrowUpRight size={18} />;
  if (direction === 'transfer') return <ArrowRightLeft size={18} />;

  return <BookOpen size={18} />;
}

function getBranchPath(movement) {
  const from = movement?.branchFrom?.name || '';
  const to = movement?.branchTo?.name || '';

  if (from && to) return `${from} → ${to}`;
  if (from) return from;
  if (to) return to;

  return '—';
}

function buildKardexParams(stockRow) {
  return {
    productId: getProductId(stockRow),
    branchId: getBranchId(stockRow),
    variantKey: stockRow?.variantKey || '',
    size: getVariantSize(stockRow),
    color: getVariantColor(stockRow),
  };
}

function getDifferenceStatus(difference) {
  const value = Number(difference || 0);

  if (value === 0) {
    return {
      label: 'Cuadrado',
      text: 'El saldo Kardex coincide con el stock físico actual.',
      icon: <BadgeCheck size={18} />,
      style: {
        border: '1px solid color-mix(in srgb, #22c55e 60%, var(--admin-card-border))',
        background: 'color-mix(in srgb, #22c55e 12%, var(--admin-card-bg))',
        color: 'var(--admin-card-text)',
      },
    };
  }

  return {
    label: 'Diferencia detectada',
    text: 'El saldo Kardex no coincide con el stock físico. Revisa movimientos o ajustes pendientes.',
    icon: <AlertCircle size={18} />,
    style: {
      border: '1px solid var(--admin-warning)',
      background: 'var(--admin-warning-soft-bg)',
      color: 'var(--admin-warning-text)',
    },
  };
}

export default function InventoryKardexModal({ open, onClose, stockRow }) {
  const [kardex, setKardex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const params = useMemo(() => buildKardexParams(stockRow), [stockRow]);

  const loadKardex = useCallback(async () => {
    if (!open || !stockRow) return;

    if (!params.productId || !params.branchId || !params.size || !params.color) {
      setError(
        'No se pudo consultar el Kardex porque faltan datos del producto, sede, talla o color.'
      );
      setKardex(null);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await api.get('/api/admin/inventory/kardex', {
        params,
      });

      setKardex(response?.data?.data || null);
    } catch (err) {
      console.error('❌ Error cargando Kardex de inventario:', err);

      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo cargar el Kardex del inventario.'
      );
    } finally {
      setLoading(false);
    }
  }, [open, params, stockRow]);

  useEffect(() => {
    if (!open) return;

    setKardex(null);
    setError('');
    loadKardex();
  }, [open, loadKardex]);

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

  const summary = kardex?.summary || {};
  const stock = kardex?.stock || {};
  const movements = Array.isArray(kardex?.movements) ? kardex.movements : [];
  const differenceStatus = getDifferenceStatus(summary.differenceWithCurrentStock);

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
                Kardex de inventario
              </p>

              <h2
                className="mt-2 text-2xl font-black tracking-tight md:text-3xl"
                style={styles.title}
              >
                Control de movimientos y saldo acumulado
              </h2>

              <p className="mt-2 max-w-4xl text-sm leading-6" style={styles.muted}>
                Vista ejecutiva del producto seleccionado: entradas, salidas, traslados, reversos, saldo Kardex y comparación contra el stock físico actual.
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
            <div className="flex flex-col gap-4">
              {error && (
                <div
                  className="flex items-start gap-3 px-4 py-3 text-sm font-semibold"
                  style={styles.errorBox}
                >
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <section className="p-5 md:p-6" style={styles.hero}>
                <div className="flex flex-col gap-5 xl:flex-row xl:items-stretch xl:justify-between">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <div
                      className="flex h-14 w-14 shrink-0 items-center justify-center"
                      style={{
                        borderRadius: 'var(--admin-radius)',
                        background: 'var(--admin-primary-soft-bg)',
                        color: 'var(--admin-primary)',
                        border: '1px solid var(--admin-primary-soft-border)',
                      }}
                    >
                      <PackageSearch size={24} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-black md:text-2xl" style={styles.cardTitle}>
                          {kardex?.product?.title || getProductTitle(stockRow)}
                        </h3>

                        <span className="px-3 py-1 text-xs font-black" style={styles.primaryBadge}>
                          SKU: {kardex?.product?.sku || getProductSku(stockRow)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-wide">
                        <span className="inline-flex items-center gap-2 px-3 py-2" style={styles.primaryBadge}>
                          <MapPin size={14} />
                          {kardex?.branch?.name || getBranchName(stockRow)}
                        </span>

                        <span className="inline-flex items-center gap-2 px-3 py-2" style={styles.primaryBadge}>
                          <Layers size={14} />
                          Variante {getVariantLabel({
                            variant: kardex?.variant || stockRow?.variant,
                            variantLabel: kardex?.variant?.label,
                          })}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <KpiPill label="Stock físico" value={formatNumber(stock.physicalStock)} icon={<Boxes size={17} />} />
                        <KpiPill label="Reservado" value={formatNumber(stock.reservedStock)} icon={<Gauge size={17} />} />
                        <KpiPill label="Disponible" value={formatNumber(stock.availableStock)} icon={<BadgeCheck size={17} />} />
                      </div>
                    </div>
                  </div>

                  <div
                    className="flex min-w-[260px] max-w-full flex-col justify-between gap-3 p-4"
                    style={{
                      borderRadius: 'calc(var(--admin-radius) + 8px)',
                      ...differenceStatus.style,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {differenceStatus.icon}
                      <p className="text-sm font-black uppercase tracking-wide">
                        {differenceStatus.label}
                      </p>
                    </div>

                    <p className="text-sm leading-6">
                      {differenceStatus.text}
                    </p>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <MiniBalance label="Saldo Kardex" value={formatNumber(summary.closingBalance)} />
                      <MiniBalance label="Diferencia" value={formatNumber(summary.differenceWithCurrentStock)} />
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-4">
                <SummaryInfo
                  label="Entradas"
                  value={`+${formatNumber(summary.totalIn)}`}
                  icon={<ArrowDownLeft size={20} />}
                  valueStyle={styles.entryText}
                />
                <SummaryInfo
                  label="Salidas"
                  value={`-${formatNumber(summary.totalOut)}`}
                  icon={<ArrowUpRight size={20} />}
                  valueStyle={styles.exitText}
                />
                <SummaryInfo
                  label="Saldo Kardex"
                  value={formatNumber(summary.closingBalance)}
                  icon={<Scale size={20} />}
                />
                <SummaryInfo
                  label="Movimientos"
                  value={formatNumber(movements.length)}
                  icon={<BookOpen size={20} />}
                />
              </section>

              <section className="p-5" style={styles.card}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h3 className="text-lg font-black" style={styles.cardTitle}>
                      Línea de tiempo Kardex
                    </h3>

                    <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                      Cada movimiento muestra su impacto en la sede seleccionada. El motivo y la nota se ven completos.
                    </p>
                  </div>

                  {loading && (
                    <div
                      className="inline-flex items-center gap-2 text-sm font-black"
                      style={styles.cardMuted}
                    >
                      <Loader2 size={17} className="animate-spin" />
                      Cargando Kardex...
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  {loading && (
                    <div className="py-10 text-center" style={styles.cardMuted}>
                      <div className="inline-flex items-center gap-2 text-sm font-black">
                        <Loader2 size={18} className="animate-spin" />
                        Cargando movimientos del Kardex...
                      </div>
                    </div>
                  )}

                  {!loading && movements.length === 0 && (
                    <div className="py-10 text-center" style={styles.cardMuted}>
                      No hay movimientos para este producto, sede, talla y color.
                    </div>
                  )}

                  {!loading &&
                    movements.map((movement, index) => (
                      <article
                        key={movement.id}
                        className="inventory-kardex-card p-4 md:p-5"
                        style={styles.movementCard}
                      >
                        <div className="grid gap-4 xl:grid-cols-[minmax(260px,1.1fr)_minmax(260px,1fr)_minmax(360px,1.2fr)] xl:items-start">
                          <div className="min-w-0">
                            <div className="flex items-start gap-3">
                              <span
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
                                style={{
                                  borderRadius: 'var(--admin-radius)',
                                  background: 'var(--admin-primary-soft-bg)',
                                  color: 'var(--admin-primary)',
                                  border: '1px solid var(--admin-primary-soft-border)',
                                }}
                              >
                                {getDirectionIcon(movement.effect, movement.direction)}
                              </span>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-black" style={styles.cardTitle}>
                                    {movement.movementNumber || 'Sin número'}
                                  </p>

                                  <span className="px-2.5 py-1 text-[11px] font-black" style={styles.statusBadge}>
                                    {getStatusLabel(movement.status)}
                                  </span>
                                </div>

                                <p className="mt-1 text-sm" style={styles.cardMuted}>
                                  {formatDate(movement.date)}
                                </p>

                                <p className="mt-2 text-xs font-black uppercase tracking-wide" style={styles.cardMuted}>
                                  Movimiento #{index + 1}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[11px] font-black uppercase tracking-wide" style={styles.cardMuted}>
                              Tipo y ruta
                            </p>

                            <p className="mt-2 text-sm font-black" style={styles.cardTitle}>
                              {getMovementTypeLabel(movement.type)}
                            </p>

                            <p className="mt-2 break-words text-sm leading-6" style={styles.cardMuted}>
                              {getBranchPath(movement)}
                            </p>

                            {movement.reference && (
                              <p className="mt-2 break-words text-xs font-semibold" style={styles.cardMuted}>
                                Ref: {movement.reference}
                              </p>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="grid grid-cols-3 gap-2">
                              <MovementValue
                                label="Entrada"
                                value={movement.entry > 0 ? `+${formatNumber(movement.entry)}` : '—'}
                                style={styles.entryText}
                              />
                              <MovementValue
                                label="Salida"
                                value={movement.exit > 0 ? `-${formatNumber(movement.exit)}` : '—'}
                                style={styles.exitText}
                              />
                              <MovementValue
                                label="Saldo"
                                value={formatNumber(movement.balance)}
                              />
                            </div>

                            <div className="mt-4" style={styles.infoBox}>
                              <div className="p-3">
                                <p className="text-[11px] font-black uppercase tracking-wide" style={styles.cardMuted}>
                                  Motivo
                                </p>

                                <p className="mt-1 break-words text-sm font-bold leading-6" style={styles.cardTitle}>
                                  {movement.reason || '—'}
                                </p>

                                {movement.notes && (
                                  <p className="mt-2 break-words text-sm leading-6" style={styles.cardMuted}>
                                    {movement.notes}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                </div>
              </section>

              <section className="p-5" style={styles.infoBox}>
                <div className="flex items-start gap-3">
                  <FileText
                    size={18}
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--admin-primary)' }}
                  />

                  <div>
                    <p className="text-sm font-black" style={styles.cardTitle}>
                      Lectura rápida
                    </p>

                    <p className="mt-1 text-sm leading-6" style={styles.cardMuted}>
                      La línea de tiempo conserva todos los movimientos, incluidos reversos. Si la diferencia es 0, el saldo calculado coincide con el stock físico actual.
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <footer className="shrink-0 px-5 py-4 md:px-8" style={styles.footer}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm" style={styles.muted}>
                Kardex filtrado por producto, sede, talla y color seleccionado.
              </p>

              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex items-center justify-center px-6 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60"
                style={styles.softButton}
              >
                Cerrar
              </button>
            </div>
          </footer>
        </div>

        <style>
          {`
            .inventory-kardex-card:hover {
              transform: translateY(-1px);
              border-color: color-mix(in srgb, var(--admin-primary) 42%, var(--admin-card-border));
            }

            @media (max-width: 720px) {
              div[style*="width: min(1360px, calc(100vw - 28px))"] {
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

function KpiPill({ label, value, icon }) {
  return (
    <div
      className="inline-flex min-w-[150px] items-center gap-3 px-4 py-3"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: '1px solid var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <span style={{ color: 'var(--admin-primary)' }}>{icon}</span>

      <span>
        <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
          {label}
        </p>
        <p className="text-lg font-black" style={styles.cardTitle}>
          {value || '0'}
        </p>
      </span>
    </div>
  );
}

function MiniBalance({ label, value }) {
  return (
    <div
      className="px-3 py-2"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: '1px solid color-mix(in srgb, currentColor 18%, transparent)',
        background: 'color-mix(in srgb, currentColor 6%, transparent)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-wide opacity-75">
        {label}
      </p>
      <p className="text-lg font-black">
        {value || '0'}
      </p>
    </div>
  );
}

function SummaryInfo({ label, value, icon, valueStyle }) {
  return (
    <article className="p-5" style={styles.card}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-black uppercase tracking-wide" style={styles.cardMuted}>
          {label}
        </p>
        <span style={{ color: 'var(--admin-primary)' }}>{icon}</span>
      </div>

      <p className="mt-2 text-2xl font-black" style={valueStyle || styles.cardTitle}>
        {value || '0'}
      </p>
    </article>
  );
}

function MovementValue({ label, value, style }) {
  return (
    <div
      className="px-3 py-3 text-right"
      style={{
        borderRadius: 'var(--admin-radius)',
        border: '1px solid var(--admin-card-border)',
        background: 'var(--admin-card-bg)',
        color: 'var(--admin-card-text)',
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-wide" style={styles.cardMuted}>
        {label}
      </p>
      <p className="mt-1 text-lg font-black" style={style || styles.cardTitle}>
        {value || '—'}
      </p>
    </div>
  );
}
