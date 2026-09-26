import { useEffect, useState } from 'react';
import {
  Building2, CheckCircle2, Edit3, MapPin, MoreHorizontal,
  Star, Trash2, Warehouse,
} from 'lucide-react';

const TYPES = {
  store: 'Tienda física', warehouse: 'Bodega', office: 'Oficina',
  pickup_point: 'Punto de recogida', virtual: 'Sede virtual',
};
const STATUSES = {
  active: 'Activa', inactive: 'Inactiva', closed: 'Cerrada', maintenance: 'Mantenimiento',
};

export default function SedesList({
  branches, loading, canEdit, canDisable,
  onEdit, onToggleStatus, onMarkAsMain, onMarkAsOnlineDefault, onDelete,
}) {
  const [openId, setOpenId] = useState('');
  useEffect(() => setOpenId(''), [branches]);

  const card = {
    background: 'var(--admin-glass-bg)',
    borderColor: 'var(--admin-glass-border)',
    color: 'var(--admin-card-text)',
    boxShadow: 'var(--admin-glass-shadow)',
  };
  const muted = { color: 'var(--admin-card-muted-text)' };
  const button = {
    color: 'var(--admin-card-text)',
    background: 'var(--admin-button-soft-bg)',
    borderColor: 'var(--admin-button-soft-border)',
  };

  return (
    <section aria-label="Listado de sedes" className="space-y-3">
      <h3 className="px-1 text-base font-bold" style={{ color: 'var(--admin-card-text)' }}>Sedes registradas</h3>
      {loading && <p className="rounded-2xl border p-6 text-sm" style={card}>Cargando sedes...</p>}
      {!loading && branches.length === 0 && (
        <div className="rounded-2xl border px-5 py-8 text-center text-sm" style={card}>
          <Building2 className="mx-auto mb-2 h-7 w-7" />
          No hay sedes para los filtros seleccionados.
        </div>
      )}
      {!loading && branches.map((branch) => {
        const id = String(branch._id || branch.id || branch.code);
        const expanded = openId === id;
        const inactive = branch.active !== true;
        const status = inactive ? 'Inactiva' : (STATUSES[branch.status] || branch.status);
        const hasActions = canEdit || canDisable;
        const location = [branch.address?.city, branch.address?.department].filter(Boolean).join(', ');

        return (
          <article key={id} className="rounded-[22px] border px-4 py-3 backdrop-blur-xl sm:px-5" style={card}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={button}>
                  {branch.type === 'warehouse' ? <Warehouse className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                </span>
                <div className="min-w-0">
                  <h4 className="break-words text-sm font-bold leading-5 sm:text-base">{branch.name}</h4>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={muted}>
                    <span>Código: {branch.code || 'Sin código'}</span>
                    <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{location || 'Ubicación sin registrar'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={button}>{TYPES[branch.type] || branch.type}</span>
                <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={inactive
                  ? { color: 'var(--admin-danger-text)', background: 'var(--admin-danger-soft-bg)', borderColor: 'var(--admin-danger)' }
                  : { color: 'var(--admin-primary-soft-text)', background: 'var(--admin-primary-soft-bg)', borderColor: 'var(--admin-primary-soft-border)' }}>
                  {status}
                </span>
                {branch.isMain && <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold" style={button}><Star className="h-3.5 w-3.5" />Principal</span>}
                {branch.isDefaultForOnlineOrders && <span className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={button}>Pedidos online</span>}
                {canEdit && <button type="button" onClick={() => onEdit(branch)} aria-label={`Editar ${branch.name}`}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold" style={button}>
                  <Edit3 className="h-4 w-4" />Editar
                </button>}
                {hasActions && <button type="button" onClick={() => setOpenId(expanded ? '' : id)}
                  aria-label={`Opciones de ${branch.name}`} aria-expanded={expanded}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold" style={button}>
                  <MoreHorizontal className="h-4 w-4" />Opciones
                </button>}
              </div>
            </div>

            {expanded && hasActions && <div className="mt-3 flex flex-wrap gap-2 border-t pt-3" style={{ borderColor: 'var(--admin-glass-border)' }}>
              {canEdit && !branch.isMain && <button type="button" onClick={() => onMarkAsMain(branch)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={button}>
                <Star className="h-4 w-4" />Hacer sede principal
              </button>}
              {canEdit && !branch.isDefaultForOnlineOrders && <button type="button" onClick={() => onMarkAsOnlineDefault(branch)}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold" style={button}>
                <CheckCircle2 className="h-4 w-4" />Usar para pedidos online
              </button>}
              {canDisable && <button type="button" onClick={() => onToggleStatus(branch)}
                aria-label={`${inactive ? 'Activar' : 'Desactivar'} ${branch.name}`}
                className="rounded-xl border px-3 py-2 text-xs font-semibold" style={button}>
                {inactive ? 'Activar sede' : 'Desactivar sede'}
              </button>}
              {canDisable && <button type="button" onClick={() => onDelete(branch)}
                aria-label={`Eliminar ${branch.name}`}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold"
                style={{ color: 'var(--admin-danger-text)', background: 'var(--admin-danger-soft-bg)', borderColor: 'var(--admin-danger)' }}>
                <Trash2 className="h-4 w-4" />Eliminar sede
              </button>}
            </div>}
          </article>
        );
      })}
    </section>
  );
}
