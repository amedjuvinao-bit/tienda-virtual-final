import React from 'react';

export default function OrdersBulkActions({
  selectedCount,
  canBulk,
  canExport,
  busy,
  status,
  statusOptions,
  tags,
  tagsMode,
  onClearSelection,
  onStatusChange,
  onRunStatus,
  onTagsModeChange,
  onTagsChange,
  onRunTags,
  onExportSelected,
}) {
  if (selectedCount <= 0) return null;

  return (
    <section className="orders-bulk-actions" aria-label="Acciones masivas">
      <div className="text-xs">
        {selectedCount} seleccionada{selectedCount === 1 ? '' : 's'}
        <button
          type="button"
          className="orders-bulk-clear ml-2 underline"
          onClick={onClearSelection}
        >
          Limpiar selección
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canBulk ? (
          <>
            <div className="flex items-center gap-1">
              <select
                className="orders-bulk-field border rounded px-2 py-1 text-xs h-8"
                value={status}
                onChange={(event) => onStatusChange(event.target.value)}
                disabled={busy}
              >
                {statusOptions.map((option) => (
                  <option
                    key={option.code}
                    value={option.code}
                    disabled={option.disabled === true}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="orders-primary-action h-8 rounded px-2.5 py-1 text-xs disabled:opacity-50"
                onClick={onRunStatus}
                disabled={busy}
              >
                Cambiar estado
              </button>
            </div>

            <div className="flex items-center gap-1">
              <select
                className="orders-bulk-field border rounded px-2 py-1 text-xs h-8"
                value={tagsMode}
                onChange={(event) =>
                  onTagsModeChange(event.target.value === 'remove' ? 'remove' : 'add')
                }
                disabled={busy}
              >
                <option value="add">Añadir tags</option>
                <option value="remove">Quitar tags</option>
              </select>
              <input
                className="orders-bulk-field border rounded px-2 py-1 text-xs h-8 w-56"
                placeholder="vip, urgente…"
                value={tags}
                onChange={(event) => onTagsChange(event.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                className="orders-primary-action h-8 rounded px-2.5 py-1 text-xs disabled:opacity-50"
                onClick={onRunTags}
                disabled={busy || !tags.trim()}
              >
                Aplicar tags
              </button>
            </div>
          </>
        ) : null}

        {canExport ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="orders-primary-action h-8 rounded px-2.5 py-1 text-xs disabled:opacity-50"
              onClick={onExportSelected}
              disabled={busy || selectedCount === 0}
            >
              Exportar seleccionadas (CSV)
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
