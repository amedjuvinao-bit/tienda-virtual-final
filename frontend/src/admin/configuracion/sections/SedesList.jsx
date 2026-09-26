import { useEffect, useState } from 'react';
import { CheckCircle2, Edit3, MoreHorizontal, Star, Trash2 } from 'lucide-react';

const TYPES = {
  store: 'Tienda física', warehouse: 'Bodega', office: 'Oficina',
  pickup_point: 'Punto de recogida', virtual: 'Sede virtual',
};
const STATUSES = {
  active: 'Activa', inactive: 'Inactiva', closed: 'Cerrada', maintenance: 'Mantenimiento',
};

export default function SedesList({
  branches, total, loading, canEdit, canDisable,
  onEdit, onToggleStatus, onMarkAsMain, onMarkAsOnlineDefault, onDelete,
}) {
  const [openId, setOpenId] = useState('');
  useEffect(() => setOpenId(''), [branches]);

  const surface = {
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
    <section aria-label="Listado de sedes" className="overflow-hidden rounded-2xl border backdrop-blur-xl" style={surface}>
      <div className="flex items-center justify-between border-b px-4 py-3 sm:px-5" style={{ borderColor: 'var(--admin-glass-border)' }}>
        <h3 className="text-sm font-bold">Sedes registradas</h3>
        <span className="text-xs" style={muted}>{total} sedes</span>
      </div>

      <div className="hidden gap-3 border-b px-5 py-2 text-xs font-semibold md:grid md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_105px_150px]"
        style={{ borderColor: 'var(--admin-glass-border)', ...muted }}>
        <span>Sede</span><span>Tipo y ubicación</span><span>Estado</span><span className="text-right">Acciones</span>
      </div>

      {loading && <p className="px-5 py-8 text-sm">Cargando sedes...</p>}
      {!loading && branches.length === 0 && (
        <p className="px-5 py-8 text-center text-sm">No hay sedes para los filtros seleccionados.</p>
      )}
      {!loading && branches.map((branch) => {
        const id = String(branch._id || branch.id || branch.code);
        const expanded = openId === id;
        const inactive = branch.active !== true;
        const status = inactive ? 'Inactiva' : (STATUSES[branch.status] || branch.status);
        const location = [branch.address?.city, branch.address?.department].filter(Boolean).join(', ');
        const hasActions = canEdit || canDisable;

        return (
          <div key={id} className="border-b last:border-b-0" style={{ borderColor: 'var(--admin-glass-border)' }}>
            <div className="grid gap-2.5 px-4 py-3 sm:px-5 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_105px_150px] md:items-center md:gap-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <strong className="truncate text-sm" title={branch.name}>{branch.name}</strong>
                  {branch.isMain && <span className="shrink-0 text-xs font-semibold" style={{ color: 'var(--admin-primary-soft-text)' }}>Principal</span>}
                </div>
                <div className="mt-0.5 truncate text-xs" style={muted}>Código: {branch.code || 'Sin código'}</div>
              </div>

              <div className="min-w-0 text-xs sm:text-sm">
                <div className="truncate">{TYPES[branch.type] || branch.type || 'Sin tipo'}</div>
                <div className="mt-0.5 truncate text-xs" style={muted} title={location || undefined}>
                  {location || 'Ubicación sin registrar'}{branch.isDefaultForOnlineOrders ? ' · Pedidos online' : ''}
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: inactive ? 'var(--admin-danger)' : 'var(--admin-primary-soft-text)' }} />
                {status}
              </span>

              {hasActions && <div className="flex items-center gap-1.5 md:justify-end">
                {canEdit && <button type="button" onClick={() => onEdit(branch)} aria-label={`Editar ${branch.name}`}
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={button}>
                  <span className="inline-flex items-center gap-1"><Edit3 className="h-3.5 w-3.5" />Editar</span>
                </button>}
                <button type="button" onClick={() => setOpenId(expanded ? '' : id)}
                  aria-label={`Opciones de ${branch.name}`} aria-expanded={expanded} aria-controls={`sede-opciones-${id}`}
                  className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={button}>
                  <span className="inline-flex items-center gap-1"><MoreHorizontal className="h-3.5 w-3.5" />Más</span>
                </button>
              </div>}
            </div>

            {expanded && hasActions && <div id={`sede-opciones-${id}`} className="flex flex-wrap gap-2 border-t px-4 py-2.5 sm:px-5" style={{ borderColor: 'var(--admin-glass-border)', background: 'var(--admin-button-soft-bg)' }}>
              {canEdit && !branch.isMain && <button type="button" onClick={() => onMarkAsMain(branch)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={button}>
                <Star className="h-3.5 w-3.5" />Hacer sede principal
              </button>}
              {canEdit && !branch.isDefaultForOnlineOrders && <button type="button" onClick={() => onMarkAsOnlineDefault(branch)}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={button}>
                <CheckCircle2 className="h-3.5 w-3.5" />Usar para pedidos online
              </button>}
              {canDisable && <button type="button" onClick={() => onToggleStatus(branch)}
                aria-label={`${inactive ? 'Activar' : 'Desactivar'} ${branch.name}`}
                className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold" style={button}>
                {inactive ? 'Activar sede' : 'Desactivar sede'}
              </button>}
              {canDisable && <button type="button" onClick={() => onDelete(branch)}
                aria-label={`Eliminar ${branch.name}`}
                className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
                style={{ color: 'var(--admin-danger-text)', background: 'var(--admin-danger-soft-bg)', borderColor: 'var(--admin-danger)' }}>
                <Trash2 className="h-3.5 w-3.5" />Eliminar sede
              </button>}
            </div>}
          </div>
        );
      })}
    </section>
  );
}
