import React from 'react';

export default function OrdersPagination({
  page,
  totalPages,
  loading,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}) {
  const previousDisabled = typeof canGoPrevious === 'boolean'
    ? !canGoPrevious
    : page <= 1;
  const nextDisabled = typeof canGoNext === 'boolean'
    ? !canGoNext
    : page >= totalPages;

  return (
    <nav className="orders-pagination" aria-label="Paginación de órdenes">
      <div className="flex items-center gap-2 text-xs">
        <span className="orders-pagination-current">{page}</span>
        <span className="orders-pagination-summary">
          Página <strong>{page}</strong> de <strong>{totalPages}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Página anterior"
          className="orders-pagination-previous group inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={previousDisabled || loading}
          onClick={onPrevious}
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5">
            ←
          </span>
          Anterior
        </button>

        <button
          type="button"
          aria-label="Siguiente página"
          className="orders-pagination-next group inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-semibold shadow-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-45"
          disabled={nextDisabled || loading}
          onClick={onNext}
        >
          Siguiente
          <span className="transition-transform duration-200 group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </nav>
  );
}
