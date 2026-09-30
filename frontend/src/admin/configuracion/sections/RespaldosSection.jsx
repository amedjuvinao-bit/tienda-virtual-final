import { useEffect, useRef, useState } from 'react';
import { Database, DatabaseBackup, Download, ExternalLink, Images, Settings2, ShieldAlert } from 'lucide-react';
import api from '../../../lib/api';
import MediaBackupSection from './MediaBackupSection';

const OPTIONS = [
  {
    value: 'free_manual',
    title: 'Atlas Free · copia externa',
    detail: 'La base sigue alojada en Atlas. Los respaldos se hacen con mongodump y se guardan fuera del servidor.',
    advantage: 'Sin pago por el plan de Atlas; puedes preparar tus propias copias y ensayar la restauración.',
    risk: 'Atlas Free no ofrece copias administradas. Si no haces copias periódicas, las guardas cifradas y pruebas la restauración, puedes perder pedidos y facturas desde la última copia. Para una copia coherente debes controlar las escrituras durante mongodump.',
  },
  {
    value: 'atlas_managed',
    title: 'Atlas de pago · copias administradas',
    detail: 'Atlas guarda las copias según el plan contratado y la configuración del clúster.',
    advantage: 'Flex incluye una copia diaria; M10+ permite configurar copias y, si se habilita, recuperación a un instante preciso.',
    risk: 'Tiene cobro recurrente. Flex no ofrece recuperación a un instante preciso: los cambios posteriores a la última copia pueden perderse. En M10+ hay que activar y revisar el respaldo; pasar desde Free requiere una pausa y no se puede volver de M10+ a Free.',
  },
];

const cardStyle = {
  background: 'var(--admin-card-bg, #fff)',
  color: 'var(--admin-card-text, #111827)',
  borderColor: 'var(--admin-card-border, #e5e7eb)',
};

const TABS = [
  { id: 'guide', label: 'Resumen' },
  { id: 'method', label: '1. Método' },
  { id: 'database', label: '2. Base de datos' },
  { id: 'media', label: '3. Imágenes y archivos' },
];

export default function RespaldosSection() {
  const [saved, setSaved] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runs, setRuns] = useState([]);
  const [mediaRuns, setMediaRuns] = useState([]);
  const [mediaRunsError, setMediaRunsError] = useState('');
  const [tab, setTab] = useState('guide');
  const [showAllRuns, setShowAllRuns] = useState(false);
  const [runsError, setRunsError] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  const [downloadedRunId, setDownloadedRunId] = useState(null);
  const [downloadError, setDownloadError] = useState('');
  const downloadFormRef = useRef(null);
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  const [starting, setStarting] = useState(false);
  const [showStart, setShowStart] = useState(false);
  const [startPassword, setStartPassword] = useState('');
  const [startCode, setStartCode] = useState('');
  const [previousPhase, setPreviousPhase] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/admin/backup-preferences');
      setSaved(data);
      setStrategy(data.strategy);
      try {
        const ready = await api.get('/api/admin/backup-preferences/readiness');
        setReadiness(ready.data);
      } catch { setReadiness({ ready: false, checks: ['No se pudo comprobar la preparación del servidor.'] }); }
      try {
        const history = await api.get('/api/admin/backup-preferences/runs');
        setRuns(history.data.runs || []);
        setRunsError('');
      } catch (historyError) {
        setRunsError(historyError?.response?.data?.message || 'No se pudo consultar el historial de copias.');
      }
      try {
        const history = await api.get('/api/admin/backup-preferences/media-runs');
        setMediaRuns(history.data.runs || []);
        setMediaRunsError('');
      } catch { setMediaRunsError('No se pudo consultar las copias de archivos.'); }
    } catch (failure) {
      setError(failure?.response?.data?.message || failure?.userMessage || 'No se pudo consultar la preferencia de respaldo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    let mounted = true;
    const poll = async () => {
      try {
        const { data } = await api.get('/api/backup-maintenance/status', { skipAdminRouteLoader: true });
        if (mounted) setMaintenance(data);
      } catch { /* Una interrupción de red no cambia el resultado del servidor. */ }
    };
    poll();
    const timer = setInterval(poll, 3000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (maintenance && previousPhase && maintenance.phase !== previousPhase &&
        ['completado', 'fallido'].includes(maintenance.phase)) load();
    if (maintenance) setPreviousPhase(maintenance.phase);
  }, [maintenance?.phase]);

  useEffect(() => {
    if (!selectedRun) return;
    downloadFormRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    downloadFormRef.current?.querySelector('input[type="password"]')?.focus({ preventScroll: true });
  }, [selectedRun]);

  async function startBackup(event) {
    event.preventDefault();
    if (starting || maintenance?.maintenance) return;
    setStarting(true);
    setError('');
    setNotice('');
    try {
      await api.post('/api/admin/backup-preferences/start', {
        currentPassword: startPassword, twoFactorCode: startCode,
      });
      setShowStart(false);
      setMaintenance({ phase: 'pausando', maintenance: true, progress: 'Pausando la tienda.' });
      setNotice('Copia iniciada. Mantén esta página abierta para ver el resultado.');
    } catch (failure) {
      setError(failure?.response?.data?.message || failure?.userMessage || 'No se pudo iniciar la copia.');
    } finally {
      setStartPassword('');
      setStartCode('');
      setStarting(false);
    }
  }

  async function recoverBackup(event) {
    event.preventDefault();
    setStarting(true);
    setError('');
    try {
      const { data } = await api.post('/api/admin/backup-preferences/recover', {
        currentPassword: startPassword, twoFactorCode: startCode,
      });
      setMaintenance(data);
      setShowStart(false);
      setNotice('La tienda volvió a estar disponible. Revisa el resultado en el historial.');
      load();
    } catch (failure) {
      setError(failure?.response?.data?.message || failure?.userMessage || 'No se pudo reabrir. Revisa el servidor.');
    } finally {
      setStartPassword(''); setStartCode(''); setStarting(false);
    }
  }

  async function download(event) {
    event.preventDefault();
    if (!selectedRun || downloading) return;
    setDownloading(true);
    setDownloadError('');
    try {
      const record = runs.find((run) => run.id === selectedRun);
      const response = await api.post(`/api/admin/backup-preferences/runs/${selectedRun}/download`,
        { currentPassword: password, twoFactorCode }, { responseType: 'blob', timeout: 0 });
      if (!(response.data instanceof Blob) || (record?.size && response.data.size !== record.size)) {
        throw new Error('El archivo recibido está incompleto. No se inició la descarga.');
      }
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${selectedRun}.archive.gz.enc`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setDownloadedRunId(selectedRun);
      setSelectedRun(null);
      setNotice('Comprueba que el archivo cifrado llegó a tu carpeta Descargas. Descarga también su registro desde el historial.');
    } catch (failure) {
      let message = 'No se pudo descargar el respaldo. Comprueba tus credenciales y vuelve a intentar.';
      if (failure?.response?.data instanceof Blob) {
        try { message = JSON.parse(await failure.response.data.text()).message || message; } catch { /* respuesta no JSON */ }
      }
      setDownloadError(failure?.message?.startsWith('El archivo recibido') ? failure.message : message);
    } finally {
      setPassword('');
      setTwoFactorCode('');
      setDownloading(false);
    }
  }

  function downloadManifest(run) {
    const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-${run.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  const latestVerified = runs.find((run) => run.status === 'verificado' && run.available);
  const latestMediaVerified = mediaRuns.find((run) => run.status === 'verificado' && run.available);

  function selectTab(next) {
    if (next === tab) return;
    setTab(next);
    setShowStart(false);
    setSelectedRun(null);
    setPassword('');
    setTwoFactorCode('');
    setStartPassword('');
    setStartCode('');
    setDownloadError('');
  }

  function handleTabKey(event, index) {
    const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!direction && event.key !== 'Home' && event.key !== 'End') return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1
      : (index + direction + TABS.length) % TABS.length;
    selectTab(TABS[next].id);
    document.getElementById(`backup-tab-${TABS[next].id}`)?.focus();
  }

  async function save(event) {
    event.preventDefault();
    if (!strategy || !saved || saving) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.put('/api/admin/backup-preferences', {
        strategy,
        revision: saved.revision,
      });
      setSaved(data);
      setNotice('Método guardado. Consulta el estado de cada copia en Resumen.');
    } catch (failure) {
      setError(failure?.response?.data?.message || failure?.userMessage || 'No se pudo guardar. Actualiza la página e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border p-4 shadow-sm sm:p-6" style={cardStyle}>
      <div className="flex items-start gap-3">
        <DatabaseBackup className="mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold">Respaldos</h1>
          <p className="mt-1 text-sm opacity-75">Configura el método y consulta por separado las copias de datos e imágenes. Solo el propietario puede iniciar o descargar copias.</p>
        </div>
      </div>
      <div role="tablist" aria-label="Pasos del respaldo" className="grid grid-cols-2 gap-2 rounded-2xl border p-2 sm:grid-cols-4" style={cardStyle}>
        {TABS.map((item, index) => <button key={item.id} id={`backup-tab-${item.id}`} type="button"
          role="tab" aria-selected={tab === item.id} aria-controls={`backup-panel-${item.id}`}
          tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => handleTabKey(event, index)}
          onClick={() => selectTab(item.id)}
          className={`rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${tab === item.id ? 'border-current bg-cyan-500/15' : 'border-transparent hover:bg-cyan-500/10'}`}>
          {item.label}
        </button>)}
      </div>

      {maintenance?.maintenance && <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-500/60 bg-amber-500/10 p-4 text-sm">
        <ShieldAlert className="shrink-0" size={20} aria-hidden="true" />
        <div>
          <strong>Tienda en mantenimiento</strong>
          <p>{maintenance.progress || 'Copia en curso…'}</p>
          {maintenance.phase === 'requiere_revision' && <p className="mt-2">El servidor se interrumpió. La tienda sigue pausada para proteger los datos. {maintenance.recoverable ? 'Puedes reabrirla en Base de datos después de revisar el resultado.' : 'Un operador debe comprobar si el proceso sigue activo.'}</p>}
        </div>
      </div>}
      {notice && <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{notice}</p>}
      {error && <div role="alert" className="rounded-xl border border-red-500/50 p-3 text-sm">
        {error} <button type="button" onClick={load} className="ml-2 underline">Reintentar</button>
      </div>}

      <div id="backup-panel-guide" role="tabpanel" aria-labelledby="backup-tab-guide" hidden={tab !== 'guide'} className="space-y-4">
        <p className="text-sm">Para respaldar toda la tienda se necesitan <strong>dos copias separadas</strong>: una de la base de datos y otra de las imágenes y archivos. Elige un paso para ver sus acciones.</p>
        <div className="grid gap-3 lg:grid-cols-3">
          <button type="button" onClick={() => selectTab('method')} className="rounded-2xl border p-4 text-left transition-colors hover:bg-cyan-500/10" style={cardStyle}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Paso 1 · Elección</span>
            <strong className="mt-1 flex items-center gap-2 text-base"><Settings2 size={18} aria-hidden="true" /> Método de respaldo</strong>
            <span className="mt-2 block text-sm">{loading ? 'Consultando…' : saved?.strategy === 'free_manual' ? 'Atlas Free configurado' : saved?.strategy === 'atlas_managed' ? 'Atlas de pago seleccionado' : 'Pendiente de elegir'}</span>
            <span className="mt-3 block text-xs opacity-75">Elegir el método no crea una copia ni cambia el plan de Atlas.</span>
            <span className="mt-3 block text-xs font-semibold underline">Abrir método →</span>
          </button>
          <button type="button" onClick={() => selectTab('database')} className="rounded-2xl border p-4 text-left transition-colors hover:bg-cyan-500/10" style={cardStyle}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Paso 2 · Datos</span>
            <strong className="mt-1 flex items-center gap-2 text-base"><Database size={18} aria-hidden="true" /> Base de datos</strong>
            <span className="mt-2 block text-sm">{loading ? 'Consultando…' : runsError ? 'Estado no disponible' : latestVerified ? `Verificada · ${new Date(latestVerified.completedAt || latestVerified.startedAt).toLocaleString('es-CO')}` : 'Sin copia verificada en este servidor'}</span>
            <span className="mt-3 block text-xs opacity-75">Pedidos, clientes, facturas y configuración.</span>
            <span className="mt-3 block text-xs font-semibold underline">Abrir base de datos →</span>
          </button>
          <button type="button" onClick={() => selectTab('media')} className="rounded-2xl border p-4 text-left transition-colors hover:bg-cyan-500/10" style={cardStyle}>
            <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Paso 3 · Archivos</span>
            <strong className="mt-1 flex items-center gap-2 text-base"><Images size={18} aria-hidden="true" /> Imágenes y archivos</strong>
            <span className="mt-2 block text-sm">{loading ? 'Consultando…' : mediaRunsError ? 'Estado no disponible' : latestMediaVerified ? `Verificada · ${new Date(latestMediaVerified.completedAt || latestMediaVerified.startedAt).toLocaleString('es-CO')}` : 'Sin copia verificada en este servidor'}</span>
            <span className="mt-3 block text-xs opacity-75">Originales de Cloudinary y archivos del servidor.</span>
            <span className="mt-3 block text-xs font-semibold underline">Abrir archivos →</span>
          </button>
        </div>
        {loading && <p className="text-sm">Consultando el estado de las copias…</p>}
        {runsError && <p role="alert" className="text-sm text-red-700">{runsError}</p>}
        {mediaRunsError && <p role="alert" className="text-sm text-red-700">{mediaRunsError}</p>}
      </div>

      <div id="backup-panel-method" role="tabpanel" aria-labelledby="backup-tab-method" hidden={tab !== 'method'} className="space-y-4">
      {loading ? <p>Cargando configuración…</p> : saved ? (
        <form onSubmit={save} className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">Elige cómo se harán las copias de la base de datos</legend>
            {OPTIONS.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4" style={cardStyle}>
                <input type="radio" name="backup-strategy" value={option.value} checked={strategy === option.value}
                  onChange={() => { setStrategy(option.value); setNotice(''); }} className="mt-1" disabled={saving} />
                <span className="min-w-0 flex-1">
                  <strong>{option.title}</strong>
                  <span className="mt-1 block text-sm opacity-75">{option.detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {strategy && <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3"><strong className="block">Ventajas</strong><p className="mt-1">{OPTIONS.find((option) => option.value === strategy)?.advantage}</p></div>
            <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3"><strong className="block">Riesgos y límites</strong><p className="mt-1">{OPTIONS.find((option) => option.value === strategy)?.risk}</p></div>
          </div>}
          <button type="submit" disabled={!strategy || strategy === saved.strategy || saving}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar método elegido'}
          </button>
        </form>
      ) : null}

      <div className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Cambio de plan en Atlas</h2>
        <p className="mt-2">El plan se cambia en MongoDB Atlas. Esta selección registra tu método previsto; no modifica la suscripción.</p>
        <a className="mt-3 inline-flex items-center gap-1 underline" href="https://cloud.mongodb.com/" target="_blank" rel="noreferrer">
          Abrir MongoDB Atlas <ExternalLink size={14} aria-hidden="true" />
        </a>
        <details className="mt-3"><summary className="cursor-pointer underline">Preparación para producción</summary>
          <p className="mt-2">Comprueba una copia reciente y ensaya la restauración en una base aislada. Conserva por separado los archivos subidos y los secretos del servidor.</p>
          <a className="mt-2 inline-flex items-center gap-1 underline" href="https://www.mongodb.com/docs/atlas/backup/cloud-backup/" target="_blank" rel="noreferrer">Documentación de Atlas <ExternalLink size={14} aria-hidden="true" /></a>
        </details>
      </div>
      </div>

      <div id="backup-panel-database" role="tabpanel" aria-labelledby="backup-tab-database" hidden={tab !== 'database'} className="space-y-4">
      <div className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Copia de la base de datos</h2>
        <p className="mt-2">Guarda pedidos, clientes y facturas. Al iniciarla, la tienda se pausa, se ensaya la restauración y se reabre al terminar.</p>
        {latestVerified && <p className="mt-3 text-emerald-700">Última copia verificada: {new Date(latestVerified.completedAt || latestVerified.startedAt).toLocaleString('es-CO')}.</p>}
        {readiness && !readiness.ready && !maintenance?.maintenance && <div className="mt-3 rounded-xl border border-amber-500/60 p-3">El servidor aún necesita preparación para iniciar copias desde aquí. <details className="mt-1"><summary className="cursor-pointer underline">Ver qué falta</summary><ul className="mt-2 list-inside list-disc">{(readiness.checks || []).map((check) => <li key={check}>{check}</li>)}</ul></details></div>}
        {!maintenance?.maintenance && <button type="button" disabled={!readiness?.ready || saved?.strategy !== 'free_manual'}
          onClick={() => setShowStart(true)} className="mt-3 rounded-xl bg-slate-950 px-5 py-2.5 font-semibold text-white disabled:opacity-50">Crear copia ahora</button>}
        {saved?.strategy !== 'free_manual' && <p className="mt-2 opacity-75">Selecciona y guarda “Atlas Free · copia externa” para crearla aquí.</p>}
        {maintenance?.phase === 'requiere_revision' && maintenance.recoverable && <button type="button" className="mt-3 underline" onClick={() => setShowStart(true)}>Reabrir después de revisar</button>}
        {showStart && <form onSubmit={maintenance?.phase === 'requiere_revision' ? recoverBackup : startBackup} className="mt-4 space-y-3 rounded-xl border p-3">
          <strong>{maintenance?.phase === 'requiere_revision' ? 'Confirmar reapertura' : 'Confirmar pausa y copia'}</strong>
          <label className="block">Contraseña del propietario<input type="password" autoComplete="current-password" required value={startPassword} onChange={(event) => setStartPassword(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
          <label className="block">Código de 6 dígitos<input inputMode="numeric" pattern="[0-9]{6}" required value={startCode} onChange={(event) => setStartCode(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
          <button type="submit" disabled={starting} className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">{starting ? 'Procesando…' : maintenance?.phase === 'requiere_revision' ? 'Reabrir tienda' : 'Pausar tienda y crear copia'}</button>
          <button type="button" onClick={() => { setShowStart(false); setStartPassword(''); setStartCode(''); }} className="ml-3 underline">Cancelar</button>
        </form>}
      </div>

      <div className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Historial de la base de datos</h2>
        {runsError && <p role="alert" className="mt-2 text-red-700">{runsError}</p>}
        {runs.length === 0 ? <p className="mt-2">Todavía no hay intentos registrados en este servidor.</p> : (
          <ul className="mt-3 space-y-3">
            {(showAllRuns ? runs : runs.slice(0, 3)).map((run) => <li key={run.id} className="rounded-xl border p-3">
              <strong>{run.status === 'verificado' ? 'Verificado' : run.status === 'fallido' ? 'Fallido' : 'En proceso'}</strong>
              <span className="ml-2">{new Date(run.startedAt).toLocaleString('es-CO')} · {run.database}</span>
              {run.status === 'verificado' && !run.available && <p className="text-red-700">Archivo ausente o tamaño distinto. Revisa el almacenamiento externo.</p>}
              <details className="mt-2 text-xs"><summary className="cursor-pointer underline">Ver prueba e información técnica</summary>
                <p className="mt-2 break-all">ID: {run.id}</p>
                {run.sha256 && <p className="mt-1 break-all">SHA-256 del archivo cifrado: <code>{run.sha256}</code></p>}
                {run.restoreTest && <p>Restauración: {run.restoreTest.collections} colecciones, {run.restoreTest.documents} documentos y {run.restoreTest.indexes} índices en servidor separado.</p>}
                {run.restoreTest?.contentSha256 && <p className="break-all">Huella del contenido restaurado: <code>{run.restoreTest.contentSha256}</code></p>}
                <ol className="mt-2 list-inside list-decimal opacity-75">{(run.steps || []).map((step, index) => <li key={index}>{step.name} · {new Date(step.at).toLocaleString('es-CO')}</li>)}</ol>
              </details>
              {run.status === 'verificado' && run.available && <button type="button" className="mt-2 inline-flex items-center gap-1 underline" onClick={() => {
                setSelectedRun(run.id);
                setDownloadError('');
                if (selectedRun === run.id) downloadFormRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
              }}><Download size={14} /> Descargar copia cifrada</button>}
              {selectedRun === run.id && <form ref={downloadFormRef} onSubmit={download} className="mt-3 space-y-3 rounded-xl border p-4" style={cardStyle}>
                <h3 className="font-semibold">Confirmar descarga</h3>
                <p>Por seguridad, introduce tu contraseña y el código actual de la aplicación. Después comenzará la descarga.</p>
                <label className="block">Contraseña actual<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
                <label className="block">Código de 6 dígitos<input inputMode="numeric" pattern="[0-9]{6}" required value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
                {downloadError && <p role="alert" className="text-red-700">{downloadError}</p>}
                <button type="submit" disabled={downloading} className="rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">{downloading ? 'Descargando…' : 'Confirmar y descargar'}</button>
                <button type="button" onClick={() => { setSelectedRun(null); setPassword(''); setTwoFactorCode(''); setDownloadError(''); }} className="ml-3 underline">Cancelar</button>
              </form>}
              {downloadedRunId === run.id && <div role="status" className="mt-3 rounded-xl border border-emerald-500/50 p-3">
                <p>Comprueba que el archivo cifrado esté en Descargas. Guarda también el registro para comprobarlo después.</p>
                <button type="button" className="mt-2 inline-flex items-center gap-1 underline" onClick={() => downloadManifest(run)}><Download size={14} /> Descargar registro de la copia</button>
              </div>}
            </li>)}
          </ul>
        )}
        {runs.length > 3 && <button type="button" onClick={() => setShowAllRuns((value) => !value)} className="mt-3 underline">
          {showAllRuns ? 'Mostrar solo las 3 más recientes' : `Ver ${runs.length - 3} ${runs.length === 4 ? 'copia anterior' : 'copias anteriores'}`}
        </button>}
      </div>
      </div>

      <div id="backup-panel-media" role="tabpanel" aria-labelledby="backup-tab-media" hidden={tab !== 'media'}>
      {tab === 'media' && <MediaBackupSection maintenance={maintenance} enabled={saved?.strategy === 'free_manual'}
        onStarted={() => setMaintenance({ phase: 'pausando', maintenance: true, progress: 'Pausando la tienda para copiar los archivos.' })} />}
      </div>
    </section>
  );
}
