import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import api from '../../../lib/api';
import { API_BASE_URL } from '../../../config/apiBaseUrl';

export default function MediaBackupSection({ maintenance, enabled, onStarted = () => {} }) {
  const frontendCloud = String(import.meta.env.VITE_CLOUDINARY_CLOUD || '').trim();
  const [readiness, setReadiness] = useState(null);
  const [runs, setRuns] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [downloaded, setDownloaded] = useState(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const formRef = useRef(null);

  async function refresh() {
    try {
      const [ready, history] = await Promise.all([
        api.get('/api/admin/backup-preferences/media-readiness'),
        api.get('/api/admin/backup-preferences/media-runs'),
      ]);
      setReadiness(ready.data);
      setRuns(history.data.runs || []);
      setError('');
    } catch (failure) {
      setError(failure?.response?.data?.message || 'No se pudo consultar las copias de archivos.');
    }
  }

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (['completado', 'fallido'].includes(maintenance?.phase)) refresh();
  }, [maintenance?.phase]);
  useEffect(() => {
    if (selected) {
      formRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
      formRef.current?.querySelector('input[type="password"]')?.focus({ preventScroll: true });
    }
  }, [selected]);

  async function start(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api.post('/api/admin/backup-preferences/media-start', {
        currentPassword: password, twoFactorCode: code, frontendCloud,
      });
      setStartOpen(false);
      onStarted();
    } catch (failure) {
      setError(failure?.response?.data?.message || 'No se pudo iniciar la copia de archivos.');
    } finally { setPassword(''); setCode(''); setBusy(false); }
  }

  async function download(event) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      const record = runs.find((run) => run.id === selected);
      const filename = `media-${selected}.bundle.enc`;
      if (typeof window.showSaveFilePicker === 'function') {
        // Chromium writes the response to disk as it arrives; large media copies
        // must not be held in a single browser Blob.
        const file = await window.showSaveFilePicker({ suggestedName: filename,
          types: [{ description: 'Copia cifrada', accept: { 'application/octet-stream': ['.enc'] } }] });
        const headers = { 'Content-Type': 'application/json' };
        const session = localStorage.getItem('session_id');
        if (session) headers['X-Session-Id'] = session;
        const response = await fetch(`${API_BASE_URL}/api/admin/backup-preferences/media-runs/${selected}/download`, {
          method: 'POST', credentials: 'include', headers,
          body: JSON.stringify({ currentPassword: password, twoFactorCode: code }),
        });
        if (!response.ok || !response.body) {
          const details = await response.json().catch(() => null);
          throw new Error(details?.message || 'No se pudo descargar la copia. Comprueba tus credenciales.');
        }
        const writer = await file.createWritable();
        let size = 0;
        try {
          for await (const chunk of response.body) {
            size += chunk.length;
            if (size > record.size) throw new Error('El archivo descargado está incompleto.');
            await writer.write(chunk);
          }
          if (size !== record.size) throw new Error('El archivo descargado está incompleto.');
          await writer.close();
        } catch (failure) { await writer.abort().catch(() => {}); throw failure; }
      } else {
        // A short-lived HttpOnly ticket lets the browser stream the attachment
        // to Downloads without buffering a large Blob or changing browsers.
        const response = await api.post(`/api/admin/backup-preferences/media-runs/${selected}/native-download`,
          { currentPassword: password, twoFactorCode: code });
        const url = new URL(response.data?.url || '', API_BASE_URL);
        if (url.origin !== new URL(API_BASE_URL).origin ||
            url.pathname !== `/api/admin/backup-preferences/media-runs/${selected}/file`) {
          throw new Error('El servidor devolvió una ruta de descarga inválida.');
        }
        const link = document.createElement('a');
        link.href = url.href;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setDownloaded(selected);
      setSelected(null);
    } catch (failure) {
      if (failure?.name === 'AbortError') return;
      let message = failure.message || 'No se pudo descargar. Comprueba tus credenciales.';
      if (failure?.response?.data instanceof Blob) {
        try { message = JSON.parse(await failure.response.data.text()).message || message; } catch { /* Non-JSON response. */ }
      }
      setError(message);
    } finally { setPassword(''); setCode(''); setBusy(false); }
  }

  async function downloadRecord(id) {
    try {
      const response = await api.get(`/api/admin/backup-preferences/media-runs/${id}/record`);
      const url = URL.createObjectURL(new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `media-${id}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (failure) { setError(failure?.response?.data?.message || 'No se pudo descargar el registro.'); }
  }

  return <div className="rounded-2xl border p-4 text-sm">
    <h2 className="font-semibold">Imágenes y archivos</h2>
    <p className="mt-2">Esta copia incluye los originales de Cloudinary (imágenes, videos y archivos) y el contenido de <code>backend/uploads</code>. Se cifra, se prueba la extracción y se registra cada archivo. La copia de MongoDB se descarga por separado.</p>
    <p className="mt-2">La tienda se pausa durante el proceso. También debes detener cualquier carga directa desde fuera de la tienda; Cloudinary puede recibir archivos aunque el backend esté pausado.</p>
    {frontendCloud && readiness?.cloudName && frontendCloud !== readiness.cloudName &&
      <p role="alert" className="mt-2 text-red-700">La cuenta Cloudinary de productos no coincide con la del backend. Corrige la configuración antes de copiar.</p>}
    {readiness && !readiness.ready && <p className="mt-2 text-amber-700">Preparación pendiente: {(readiness.checks || []).join(' ')}</p>}
    {error && !selected && <p role="alert" className="mt-2 text-red-700">{error}</p>}
    <button type="button" disabled={!enabled || !readiness?.ready || maintenance?.maintenance || busy ||
      (frontendCloud && readiness?.cloudName && frontendCloud !== readiness.cloudName)}
      onClick={() => { setStartOpen(true); setSelected(null); }}
      className="mt-3 rounded-xl bg-slate-950 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Crear copia de archivos</button>
    {startOpen && <form onSubmit={start} className="mt-3 space-y-3 rounded-xl border p-4">
      <strong>Confirmar pausa y copia de archivos</strong>
      <label className="block">Contraseña para copia de archivos<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block">Código de seguridad para archivos<input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <button type="submit" disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">Pausar y crear copia de archivos</button>
      <button type="button" className="ml-3 underline" onClick={() => { setStartOpen(false); setPassword(''); setCode(''); }}>Cancelar</button>
    </form>}
    <h3 className="mt-5 font-semibold">Historial de archivos</h3>
    {!runs.length && <p className="mt-2">Aún no hay copias de archivos en este servidor.</p>}
    <ul className="mt-2 space-y-3">{runs.map((run) => <li key={run.id} className="rounded-xl border p-3">
      <strong>{run.status === 'verificado' ? 'Verificado' : run.status === 'fallido' ? 'Fallido' : 'En proceso'}</strong>
      <p>{new Date(run.startedAt).toLocaleString('es-CO')} · {run.id}</p>
      {run.status === 'verificado' && <p>{run.cloudinaryCount} de Cloudinary · {run.localCount} del servidor</p>}
      {run.sha256 && <p className="break-all">SHA-256: <code>{run.sha256}</code></p>}
      {run.status === 'verificado' && !run.available && <p className="text-red-700">El archivo no está disponible en este servidor.</p>}
      <ol className="mt-2 list-inside list-decimal text-xs opacity-75">{run.steps.map((step, index) => <li key={index}>{step.name}</li>)}</ol>
      {run.status === 'verificado' && run.available && <button type="button" className="mt-2 inline-flex items-center gap-1 underline" onClick={() => { setSelected(run.id); setStartOpen(false); setError(''); }}><Download size={14} /> Descargar archivos cifrados</button>}
      {selected === run.id && <form ref={formRef} onSubmit={download} className="mt-3 space-y-3 rounded-xl border p-4">
        <strong>Confirmar descarga de archivos</strong>
        <label className="block">Contraseña para descarga de archivos<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="block">Código para descarga de archivos<input inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={(event) => setCode(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">Confirmar descarga de archivos</button>
        <button type="button" className="ml-3 underline" onClick={() => { setSelected(null); setPassword(''); setCode(''); setError(''); }}>Cancelar</button>
      </form>}
      {downloaded === run.id && <div role="status" className="mt-3 rounded-xl border p-3">
        <p>Comprueba que el archivo cifrado esté en Descargas. Guarda también su inventario para poder recuperarlo.</p>
        <button type="button" className="mt-2 inline-flex items-center gap-1 underline" onClick={() => downloadRecord(run.id)}><Download size={14} /> Descargar inventario de archivos</button>
      </div>}
    </li>)}</ul>
  </div>;
}
