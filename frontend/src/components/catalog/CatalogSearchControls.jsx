import React, { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { CATALOG_SORTS } from "./catalogQuery";
export default function CatalogSearchControls({
  config,
  query,
  onSearch,
  onSort,
}) {
  const [text, setText] = useState(query.q);
  useEffect(() => setText(query.q), [query.q]);
  useEffect(() => {
    if (text === query.q) return;
    const timer = setTimeout(() => onSearch(text), 350);
    return () => clearTimeout(timer);
  }, [text, query.q, onSearch]);
  return (
    <div className="cpv-discovery">
      {config.showSearch && (
        <form
          role="search"
          aria-label="Buscar en este catálogo"
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(text);
          }}
        >
          <Search size={17} />
          <input
            aria-label="Buscar productos"
            maxLength={160}
            placeholder={config.collection?.searchPlaceholder || "Buscar en este catálogo…"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {text && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => {
                setText("");
                onSearch("");
              }}
            >
              <X size={16} />
            </button>
          )}
        </form>
      )}
      {config.showSort && (
        <label>
          <span className="cpv-sort-label">Ordenar por</span>
          <select
            aria-label="Ordenar productos"
            value={query.sort}
            onChange={(e) => onSort(e.target.value)}
          >
            {CATALOG_SORTS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
