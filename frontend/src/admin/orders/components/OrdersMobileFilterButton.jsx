import { SlidersHorizontal, X } from 'lucide-react';

export default function OrdersMobileFilterButton({
  activeFilterCount = 0,
  controlsOpen = false,
  onClick,
}) {
  const safeCount = Math.max(0, Number(activeFilterCount) || 0);
  const accessibleLabel = controlsOpen
    ? 'Cerrar búsqueda y filtros'
    : safeCount > 0
      ? `Abrir búsqueda y filtros, ${safeCount} activos`
      : 'Abrir búsqueda y filtros';

  return (
    <button
      type="button"
      className={`orders-mobile-filter-trigger ${controlsOpen ? 'is-open' : ''}`}
      aria-label={accessibleLabel}
      aria-controls="orders-control-panel"
      aria-expanded={controlsOpen}
      title={controlsOpen ? 'Cerrar búsqueda y filtros' : 'Buscar y filtrar órdenes'}
      onClick={onClick}
    >
      {controlsOpen ? (
        <X aria-hidden="true" />
      ) : (
        <SlidersHorizontal aria-hidden="true" />
      )}
      {safeCount > 0 ? (
        <span className="orders-mobile-filter-count" aria-hidden="true">
          {safeCount > 9 ? '9+' : safeCount}
        </span>
      ) : null}
    </button>
  );
}
