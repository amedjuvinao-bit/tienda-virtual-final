// src/components/ColorBarPicker.jsx
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';

/**
 * ColorBarPicker
 * - selected: string[] (hex o nombres CSS)
 * - onChange: (string[]) => void
 * - max: número máximo (default 10)
 * - palette: string[] opcional (si no se pasa, usa una paleta por defecto)
 */
export default function ColorBarPicker({
  selected = [],
  onChange,
  max = 10,
  palette,
}) {
  const defaultPalette = useMemo(
    () => [
      '#000000', '#FFFFFF',
      '#FFCDD2', '#F8BBD0', '#E1BEE7', '#D1C4E9', '#C5CAE9',
      '#BBDEFB', '#B2EBF2', '#B2DFDB', '#C8E6C9', '#DCEDC8',
      '#FFF9C4', '#FFE0B2', '#FFCCBC', '#D7CCC8',
      '#F48FB1', '#CE93D8', '#9FA8DA', '#90CAF9', '#80DEEA',
      '#80CBC4', '#A5D6A7', '#E6EE9C', '#FFE082', '#FFAB91',
      '#D4AF37', // dorado
      'pink', 'hotpink', 'fuchsia', 'crimson', 'salmon',
      'skyblue', 'royalblue', 'navy', 'teal', 'turquoise',
      'seagreen', 'limegreen', 'olive', 'khaki', 'coral',
      'chocolate', 'sienna', 'gray', 'lightgray'
    ],
    []
  );

  const colors = palette && palette.length ? palette : defaultPalette;
  const [custom, setCustom] = useState('');

  const addColor = (c) => {
    const value = (c || '').trim();
    if (!value) return;
    if (selected.length >= max) return;
    // evita duplicados (case-insensitive)
    const exists = selected.some((s) => s.toLowerCase() === value.toLowerCase());
    if (exists) return;
    onChange([...selected, value]);
    setCustom('');
  };

  const removeColor = (c) => {
    onChange(selected.filter((s) => s.toLowerCase() !== c.toLowerCase()));
  };

  return (
    <div className="space-y-2">
      {/* Barra de colores */}
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c, idx) => (
          <button
            key={`${c}-${idx}`}
            type="button"
            title={c}
            aria-label={`Agregar color ${c}`}
            className="w-6 h-6 rounded-full border border-gray-300 hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}
            onClick={() => addColor(c)}
            disabled={selected.length >= max}
          />
        ))}
      </div>

      {/* Entrada manual */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Añadir color (p. ej. #f0c o 'pink')"
          className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
        <button
          type="button"
          onClick={() => addColor(custom)}
          className="px-3 py-2 text-sm rounded-md bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-50"
          disabled={selected.length >= max}
        >
          Añadir
        </button>
      </div>

      {/* Seleccionados */}
      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((c, idx) => (
            <div
              key={`${c}-${idx}`}
              className="flex items-center gap-2 border border-gray-200 rounded-full px-2 py-1"
            >
              <span
                className="inline-block w-4 h-4 rounded-full border border-gray-300"
                style={{ backgroundColor: c }}
                title={c}
              />
              <span className="text-xs text-gray-700">{c}</span>
              <button
                type="button"
                onClick={() => removeColor(c)}
                className="text-gray-400 hover:text-gray-600"
                aria-label={`Quitar color ${c}`}
                title="Quitar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Límite */}
      <p className="text-xs text-gray-500">
        Puedes seleccionar hasta {max} colores. Haz clic en un color de la barra o añádelo manualmente.
      </p>
    </div>
  );
}
