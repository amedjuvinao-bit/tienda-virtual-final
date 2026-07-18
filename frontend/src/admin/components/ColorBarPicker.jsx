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
      '#D4AF37',
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
    const exists = selected.some((s) => s.toLowerCase() === value.toLowerCase());
    if (exists) return;
    onChange([...selected, value]);
    setCustom('');
  };

  const removeColor = (c) => {
    onChange(selected.filter((s) => s.toLowerCase() !== c.toLowerCase()));
  };

  const inputStyle = {
    border: '1px solid var(--admin-input-border)',
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-input-bg)',
    color: 'var(--admin-input-text)',
    outline: 'none',
  };

  const addButtonStyle = {
    border: '1px solid var(--admin-button-border, var(--admin-primary-soft-border, var(--admin-card-border)))',
    borderRadius: 'var(--admin-radius)',
    background: 'var(--admin-button-bg, var(--admin-primary-soft-bg, var(--admin-card-bg)))',
    color: 'var(--admin-button-text, var(--admin-card-text))',
  };

  const selectedColorStyle = {
    borderColor: 'var(--admin-card-border)',
    background: 'var(--admin-card-bg)',
    color: 'var(--admin-card-text)',
  };

  const mutedTextStyle = {
    color: 'var(--admin-card-muted-text)',
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c, idx) => (
          <button
            key={`${c}-${idx}`}
            type="button"
            title={c}
            aria-label={`Agregar color ${c}`}
            className="h-6 w-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-50"
            style={{ backgroundColor: c, borderColor: 'var(--admin-card-border)' }}
            onClick={() => addColor(c)}
            disabled={selected.length >= max}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Añadir color (p. ej. #f0c o 'pink')"
          className="flex-1 px-3 py-2 text-sm"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => addColor(custom)}
          className="px-3 py-2 text-sm font-semibold disabled:opacity-50"
          style={addButtonStyle}
          disabled={selected.length >= max}
        >
          Añadir
        </button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((c, idx) => (
            <div
              key={`${c}-${idx}`}
              className="flex items-center gap-2 rounded-full border px-2 py-1"
              style={selectedColorStyle}
            >
              <span
                className="inline-block h-4 w-4 rounded-full border"
                style={{ backgroundColor: c, borderColor: 'var(--admin-card-border)' }}
                title={c}
              />
              <span className="text-xs">{c}</span>
              <button
                type="button"
                onClick={() => removeColor(c)}
                className="transition hover:opacity-80"
                style={mutedTextStyle}
                aria-label={`Quitar color ${c}`}
                title="Quitar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs" style={mutedTextStyle}>
        Puedes seleccionar hasta {max} colores. Haz clic en un color de la barra o añádelo manualmente.
      </p>
    </div>
  );
}
