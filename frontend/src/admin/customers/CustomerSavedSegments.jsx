import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Loader2, Play, Trash2 } from 'lucide-react';

import {
  createAdminCustomerSavedSegment,
  deleteAdminCustomerSavedSegment,
  getAdminCustomerSavedSegments,
} from '../api/adminCustomersApi';

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
}

export default function CustomerSavedSegments({ filters, onApply }) {
  const [segments, setSegments] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadSegments = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getAdminCustomerSavedSegments();
      setSegments(Array.isArray(response?.segments) ? response.segments : []);
    } catch (err) {
      setError(err?.message || 'No fue posible cargar los segmentos guardados.');
      setSegments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSegments();
  }, []);

  const saveCurrent = async () => {
    const safeName = cleanName(name);
    if (safeName.length < 3) return;
    try {
      setSaving(true);
      setError('');
      const response = await createAdminCustomerSavedSegment({
        name: safeName,
        filters,
      });
      if (response?.segment) {
        setSegments((current) => [...current, response.segment].sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''), 'es')
        ));
      }
      setName('');
    } catch (err) {
      setError(err?.message || 'No fue posible guardar el segmento.');
    } finally {
      setSaving(false);
    }
  };

  const removeSegment = async (segmentId) => {
    try {
      setError('');
      await deleteAdminCustomerSavedSegment(segmentId);
      setSegments((current) => current.filter((segment) => segment.id !== segmentId));
    } catch (err) {
      setError(err?.message || 'No fue posible eliminar el segmento.');
    }
  };

  return (
    <section className="rounded-[24px] border bg-white/70 p-4" style={{ borderColor: 'rgba(236,72,153,0.16)' }}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: 'var(--admin-card-muted-text)' }}>Segmentos guardados</p>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--admin-card-text)' }}>Guarda la combinación actual de origen, etapa, prioridad y responsable.</p>
        </div>
        <div className="flex w-full max-w-xl gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ej: VIP asignados a mí"
            className="min-w-0 flex-1 rounded-2xl border bg-white px-4 py-3 text-sm font-bold outline-none"
            style={{ borderColor: 'rgba(236,72,153,0.20)' }}
          />
          <button
            type="button"
            onClick={saveCurrent}
            disabled={saving || cleanName(name).length < 3}
            className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black text-white disabled:opacity-50"
            style={{ background: 'var(--admin-primary)' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
            Guardar
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {loading ? <span className="inline-flex items-center gap-2 text-xs font-bold"><Loader2 className="h-4 w-4 animate-spin" /> Cargando...</span> : null}
        {!loading && !segments.length ? <span className="text-xs font-bold" style={{ color: 'var(--admin-card-muted-text)' }}>Aún no has guardado segmentos.</span> : null}
        {!loading ? segments.map((segment) => (
          <div key={segment.id} className="inline-flex items-center overflow-hidden rounded-2xl border bg-white" style={{ borderColor: 'rgba(236,72,153,0.20)' }}>
            <button type="button" onClick={() => onApply?.(segment.filters || {})} className="inline-flex items-center gap-2 px-3 py-2 text-xs font-black" style={{ color: 'var(--admin-primary)' }}><Play className="h-3.5 w-3.5" /> {segment.name}</button>
            <button type="button" onClick={() => removeSegment(segment.id)} aria-label={`Eliminar segmento ${segment.name}`} className="border-l p-2 text-slate-500 hover:text-red-600" style={{ borderColor: 'rgba(236,72,153,0.16)' }}><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        )) : null}
      </div>
    </section>
  );
}
