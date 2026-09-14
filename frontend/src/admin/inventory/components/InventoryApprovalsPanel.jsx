import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  ArrowRightLeft,
  Check,
  Clock3,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../../lib/api';
import useAdminPermissions from '../../security/useAdminPermissions';

const TYPE_LABELS = {
  initial_stock: 'Stock inicial',
  purchase_in: 'Entrada por compra',
  return_in: 'Entrada por devolución',
  return_out: 'Salida por devolución',
  adjustment_in: 'Ajuste positivo',
  adjustment_out: 'Ajuste negativo',
  transfer: 'Traslado',
  damage_out: 'Salida por daño',
  loss_out: 'Salida por pérdida',
};

const styles = {
  trigger: {
    borderRadius: '999px',
    border: '1px solid var(--admin-button-soft-border)',
    background: 'var(--admin-button-soft-bg)',
    color: 'var(--admin-button-soft-text)',
  },
  count: {
    borderRadius: '999px',
    background: 'var(--admin-primary)',
    color: 'var(--admin-primary-text)',
  },
  overlay: { background: 'var(--admin-modal-overlay)' },
  modal: {
    width: 'min(1080px, calc(100vw - 32px))',
    maxHeight: 'calc(100vh - 32px)',
    borderRadius: 'calc(var(--admin-radius) + 12px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-modal-bg)',
    color: 'var(--admin-modal-text)',
    boxShadow: '0 34px 110px rgba(15, 23, 42, 0.34)',
  },
  card: {
    borderRadius: 'calc(var(--admin-radius) + 7px)',
    border: '1px solid var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  },
  soft: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
  },
  primary: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-button-bg)',
    background: 'var(--admin-button-bg)',
    color: 'var(--admin-button-text)',
  },
  danger: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-danger)',
    background: 'var(--admin-danger-soft-bg)',
    color: 'var(--admin-danger-text)',
  },
  input: {
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-input-border)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  },
};

function getRows(response) {
  const data = response?.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function getId(value) {
  return String(value?._id || value?.id || value || '');
}

function getName(user) {
  return (
    user?.displayName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    user?.username ||
    'Usuario administrativo'
  );
}

function getProduct(movement) {
  return movement?.product?.title || movement?.productSnapshot?.title || 'Producto sin nombre';
}

function getBranch(movement, side) {
  const branch = movement?.[side];
  const snapshot = movement?.[`${side}Snapshot`];
  return branch?.name || snapshot?.name || 'Sin sede';
}

function getImpact(movement) {
  if (movement?.direction === 'transfer') {
    return `${getBranch(movement, 'branchFrom')} → ${getBranch(movement, 'branchTo')}`;
  }
  if (movement?.direction === 'in') {
    return `Entrará a ${getBranch(movement, 'branchTo')}`;
  }
  return `Saldrá de ${getBranch(movement, 'branchFrom')}`;
}

function formatDate(value) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function InventoryApprovalsPanel({ onChanged }) {
  const { can } = useAdminPermissions();
  const canApprove = can('inventory:approve');
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selection, setSelection] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [saving, setSaving] = useState(false);

  const loadApprovals = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/api/admin/inventory/approvals', {
        params: { page: 1, limit: 100 },
      });
      setRows(getRows(response));
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudieron cargar las solicitudes pendientes.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
  }, [open]);

  const beginDecision = (movement, action) => {
    setSelection({ id: getId(movement), action });
    setReviewNote('');
    setError('');
  };

  const submitDecision = async () => {
    if (!selection) return;
    if (selection.action === 'reject' && !reviewNote.trim()) {
      setError('Escribe el motivo del rechazo.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await api.post(
        `/api/admin/inventory/movements/${selection.id}/${selection.action}`,
        { reviewNote: reviewNote.trim() }
      );
      setSelection(null);
      setReviewNote('');
      await loadApprovals();
      if (typeof onChanged === 'function') await onChanged();
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.userMessage ||
          'No se pudo resolver la solicitud.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          loadApprovals();
        }}
        className="inline-flex items-center gap-2 px-5 py-3 text-sm font-black transition"
        style={styles.trigger}
      >
        <ShieldCheck size={17} />
        Aprobaciones
        {rows.length > 0 && (
          <span className="inline-flex min-w-6 items-center justify-center px-2 py-0.5 text-xs" style={styles.count}>
            {rows.length}
          </span>
        )}
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 md:p-5" role="dialog" aria-modal="true">
          <div className="absolute inset-0 backdrop-blur-sm" style={styles.overlay} />
          <section className="relative z-[100000] flex w-full flex-col overflow-hidden" style={styles.modal}>
            <header className="flex items-start justify-between gap-4 border-b px-6 py-5" style={{ borderColor: 'var(--admin-card-border)' }}>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: 'var(--admin-primary)' }}>
                  Control de inventario
                </p>
                <h2 className="mt-2 text-2xl font-black">Solicitudes por aprobar</h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--admin-modal-muted-text)' }}>
                  El stock solo cambia cuando una solicitud es aprobada.
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} disabled={saving} className="p-3" style={styles.soft} aria-label="Cerrar">
                <X size={19} />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6" style={{ background: 'var(--admin-page-bg)' }}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4" style={styles.soft}>
                <div className="flex items-center gap-3">
                  <Clock3 size={20} />
                  <div>
                    <p className="font-black">{rows.length} pendiente(s)</p>
                    <p className="text-xs">En orden desde la solicitud más antigua.</p>
                  </div>
                </div>
                <button type="button" onClick={loadApprovals} disabled={loading || saving} className="inline-flex items-center gap-2 px-4 py-2 text-sm font-black" style={styles.soft}>
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 p-4 text-sm font-bold" style={styles.danger}>
                  <AlertCircle size={18} className="mt-0.5 shrink-0" /> {error}
                </div>
              )}

              {!loading && rows.length === 0 && (
                <div className="p-10 text-center" style={styles.card}>
                  <PackageCheck size={34} className="mx-auto" style={{ color: 'var(--admin-primary)' }} />
                  <p className="mt-3 text-lg font-black">Todo está al día</p>
                  <p className="mt-1 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>No hay movimientos esperando aprobación.</p>
                </div>
              )}

              <div className="space-y-4">
                {rows.map((movement) => {
                  const id = getId(movement);
                  const active = selection?.id === id;
                  return (
                    <article key={id} className="p-5" style={styles.card}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 text-xs font-black" style={styles.soft}>{TYPE_LABELS[movement.type] || movement.type}</span>
                            <span className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>{movement.movementNumber}</span>
                          </div>
                          <h3 className="mt-3 text-lg font-black">{getProduct(movement)}</h3>
                          <p className="mt-1 text-sm font-semibold">{getImpact(movement)}</p>
                          <p className="mt-2 text-sm" style={{ color: 'var(--admin-card-muted-text)' }}>
                            {movement.quantity} unidad(es) · Solicitó {getName(movement.requestedBy || movement.createdBy)} · {formatDate(movement.requestedAt || movement.createdAt)}
                          </p>
                          <p className="mt-2 text-sm"><b>Motivo:</b> {movement.reason || 'Sin motivo registrado'}</p>
                        </div>

                        {canApprove ? (
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button type="button" onClick={() => beginDecision(movement, 'approve')} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black" style={styles.primary}>
                              <Check size={16} /> Aprobar
                            </button>
                            <button type="button" onClick={() => beginDecision(movement, 'reject')} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black" style={styles.danger}>
                              <X size={16} /> Rechazar
                            </button>
                          </div>
                        ) : (
                          <span className="px-3 py-2 text-xs font-bold" style={styles.soft}>Solo lectura</span>
                        )}
                      </div>

                      {active && (
                        <div className="mt-4 border-t pt-4" style={{ borderColor: 'var(--admin-card-border)' }}>
                          <label className="text-sm font-black">
                            {selection.action === 'reject' ? 'Motivo del rechazo (obligatorio)' : 'Nota de aprobación (opcional)'}
                          </label>
                          <textarea
                            rows={3}
                            value={reviewNote}
                            onChange={(event) => setReviewNote(event.target.value)}
                            disabled={saving}
                            className="mt-2 w-full resize-none px-4 py-3 text-sm"
                            style={styles.input}
                            placeholder={selection.action === 'reject' ? 'Explica por qué no debe aplicarse...' : 'Agrega una observación para el historial...'}
                          />
                          <div className="mt-3 flex flex-wrap justify-end gap-2">
                            <button type="button" onClick={() => setSelection(null)} disabled={saving} className="px-4 py-2.5 text-sm font-black" style={styles.soft}>Cancelar</button>
                            <button type="button" onClick={submitDecision} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-black disabled:opacity-60" style={selection.action === 'reject' ? styles.danger : styles.primary}>
                              {saving && <RefreshCw size={15} className="animate-spin" />}
                              {selection.action === 'reject' ? 'Confirmar rechazo' : 'Aprobar y aplicar'}
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
