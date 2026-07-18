// src/components/ColorBarPicker.jsx
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { getColorDisplayName, getColorVisualValue } from '../utils/colorDisplay';

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
    const value = getColorVisualValue(c).trim();
    if (!value) return;
    if (selected.length >= max) return;
    const exists = selected.some((s) => getColorVisualValue(s).toLowerCase() === value.toLowerCase());
    if (exists) return;
    onChange([...selected, value]);
    setCustom('');
  };

  const removeColor = (c) => {
    const value = getColorVisualValue(c).toLowerCase();
    onChange(selected.filter((s) => getColorVisualValue(s).toLowerCase() !== value));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {colors.map((c, idx) => {
          const label = getColorDisplayName(c);
          const visual = getColorVisualValue(c);
          return (
            <button
              key={`${visual}-${idx}`}
              type="button"
              title={label}
              aria-label={`Agregar color ${label}`}
              className="h-6 w-6 rounded-full border transition-transform hover:scale-110 disabled:opacity-50"
              style={{
                backgroundColor: visual,
                borderColor: 'var(--admin-card-border)',
              }}
              onClick={() => addColor(visual)}
              disabled={selected.length >= max}
            />
          );
        })}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Añadir color por nombre o código"
          className="flex-1 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2"
          style={{
            borderColor: 'var(--admin-input-border)',
            background: 'var(--admin-input-bg)',
            color: 'var(--admin-input-text)',
            '--tw-ring-color': 'color-mix(in srgb, var(--admin-primary) 32%, transparent)',
          }}
        />
        <button
          type="button"
          onClick={() => addColor(custom)}
          className="rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
          style={{
            border: '1px solid var(--admin-button-border)',
            background: 'var(--admin-button-bg)',
            color: 'var(--admin-button-text)',
          }}
          disabled={selected.length >= max}
        >
          Añadir
        </button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {selected.map((c, idx) => {
            const label = getColorDisplayName(c);
            const visual = getColorVisualValue(c);
            return (
              <div
                key={`${visual}-${idx}`}
                className="flex items-center gap-2 rounded-full border px-2 py-1"
                style={{
                  borderColor: 'var(--admin-card-border)',
                  background: 'var(--admin-card-bg)',
                  color: 'var(--admin-card-text)',
                }}
              >
                <span
                  className="inline-block h-4 w-4 rounded-full border"
                  style={{
                    backgroundColor: visual,
                    borderColor: 'var(--admin-card-border)',
                  }}
                  title={label}
                  aria-label={label}
                />
                <span className="text-xs font-semibold">{label}</span>
                <button
                  type="button"
                  onClick={() => removeColor(c)}
                  className="transition hover:opacity-75"
                  aria-label={`Quitar color ${label}`}
                  title="Quitar"
                  style={{ color: 'var(--admin-card-muted-text)' }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--admin-card-muted-text)' }}>
        Puedes seleccionar hasta {max} colores. Se mostrará el nombre del color en la tienda, no el código hexadecimal.
      </p>
    </div>
  );
}
