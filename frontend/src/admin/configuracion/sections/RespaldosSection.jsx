import { useEffect, useState } from 'react';
import { DatabaseBackup, Download, ExternalLink, ShieldAlert } from 'lucide-react';
import api from '../../../lib/api';

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

export default function RespaldosSection() {
  const [saved, setSaved] = useState(null);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [runs, setRuns] = useState([]);
  const [runsError, setRunsError] = useState('');
  const [selectedRun, setSelectedRun] = useState(null);
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [downloading, setDownloading] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/api/admin/backup-preferences');
      setSaved(data);
      setStrategy(data.strategy);
      try {
        const history = await api.get('/api/admin/backup-preferences/runs');
        setRuns(history.data.runs || []);
        setRunsError('');
      } catch (historyError) {
        setRunsError(historyError?.response?.data?.message || 'No se pudo consultar el historial de copias.');
      }
    } catch (failure) {
      setError(failure?.response?.data?.message || failure?.userMessage || 'No se pudo consultar la preferencia de respaldo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function download(event) {
    event.preventDefault();
    if (!selectedRun || downloading) return;
    setDownloading(true);
    setError('');
    try {
      const response = await api.post(`/api/admin/backup-preferences/runs/${selectedRun}/download`,
        { currentPassword: password, twoFactorCode }, { responseType: 'blob', timeout: 0 });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup-${selectedRun}.archive.gz.enc`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      const record = runs.find((run) => run.id === selectedRun);
      const manifestUrl = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
      const manifestLink = document.createElement('a');
      manifestLink.href = manifestUrl;
      manifestLink.download = `backup-${selectedRun}.json`;
      document.body.appendChild(manifestLink);
      manifestLink.click();
      manifestLink.remove();
      setTimeout(() => URL.revokeObjectURL(manifestUrl), 60000);
      setSelectedRun(null);
      setNotice('Descarga de la copia y su registro iniciada. Guarda ambos archivos y la clave de cifrado en lugares seguros y separados.');
    } catch (failure) {
      let message = 'No se pudo descargar el respaldo. Comprueba tus credenciales y vuelve a intentar.';
      if (failure?.response?.data instanceof Blob) {
        try { message = JSON.parse(await failure.response.data.text()).message || message; } catch { /* respuesta no JSON */ }
      }
      setError(message);
    } finally {
      setPassword('');
      setTwoFactorCode('');
      setDownloading(false);
    }
  }

  const latestVerified = runs.find((run) => run.status === 'verificado' && run.available);

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
      setNotice('Preferencia guardada. El respaldo sigue pendiente hasta verificar una copia y su restauración.');
    } catch (failure) {
      setError(failure?.response?.data?.message || failure?.userMessage || 'No se pudo guardar. Actualiza la página e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-5 rounded-3xl border p-4 shadow-sm sm:p-6" style={cardStyle}>
      <div className="flex items-start gap-3">
        <DatabaseBackup className="mt-1 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-xl font-bold">Respaldo de la base de datos</h1>
          <p className="mt-1 text-sm opacity-75">Solo el propietario puede elegir el método de respaldo.</p>
        </div>
      </div>

      <div role="status" className="flex items-start gap-3 rounded-2xl border border-amber-500/60 bg-amber-500/10 p-4 text-sm">
        <ShieldAlert className="shrink-0" size={20} aria-hidden="true" />
        <div>
          <strong>{latestVerified ? 'Última copia verificada' : 'Respaldo sin verificar'}</strong>
          <p className="mt-1">{latestVerified
            ? `Copia ${latestVerified.id} verificada el ${new Date(latestVerified.completedAt).toLocaleString('es-CO')}. Comprueba que tengas también una copia fuera del servidor y la clave de cifrado.`
            : 'Aún no hay una copia con restauración de prueba registrada. Elegir un método no crea un respaldo ni cambia tu suscripción a Atlas.'}</p>
        </div>
      </div>

      {loading ? <p>Cargando configuración…</p> : saved ? (
        <form onSubmit={save} className="space-y-4">
          <fieldset className="space-y-3">
            <legend className="mb-2 font-semibold">¿Qué método vas a configurar?</legend>
            {OPTIONS.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-2xl border p-4" style={cardStyle}>
                <input type="radio" name="backup-strategy" value={option.value} checked={strategy === option.value}
                  onChange={() => { setStrategy(option.value); setNotice(''); }} className="mt-1" disabled={saving} />
                <span className="min-w-0 flex-1">
                  <strong>{option.title}</strong>
                  <span className="mt-1 block text-sm opacity-75">{option.detail}</span>
                  <span className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <span className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                      <strong className="block">Ventajas</strong>
                      <span className="mt-1 block">{option.advantage}</span>
                    </span>
                    <span className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-3">
                      <strong className="block">Riesgos y límites</strong>
                      <span className="mt-1 block">{option.risk}</span>
                    </span>
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          <button type="submit" disabled={!strategy || strategy === saved.strategy || saving}
            className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar método elegido'}
          </button>
          {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}
        </form>
      ) : null}

      {error && <div role="alert" className="rounded-xl border border-red-500/50 p-3 text-sm">
        {error} <button type="button" onClick={load} className="ml-2 underline">Reintentar</button>
      </div>}

      <div className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Hacer una copia en Atlas Free</h2>
        <p className="mt-2">Programa una pausa, detén el backend y cualquier otro proceso que escriba en esta base. Desde la carpeta <code>backend</code> ejecuta:</p>
        <code className="mt-2 block overflow-x-auto rounded-lg bg-slate-900 p-3 text-white">npm run backup:free</code>
        <p className="mt-2">La API mostrará mantenimiento durante la copia. El programa compara huellas de los documentos e índices, ensaya la restauración en otro servidor, cifra el archivo y registra cada paso. Al terminar, inicia el backend y descarga la copia aquí. Se requieren MongoDB Database Tools y las variables del instructivo de respaldo.</p>
      </div>

      <div className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Historial de copias</h2>
        {runsError && <p role="alert" className="mt-2 text-red-700">{runsError}</p>}
        {runs.length === 0 ? <p className="mt-2">Todavía no hay intentos registrados en este servidor.</p> : (
          <ul className="mt-3 space-y-3">
            {runs.map((run) => <li key={run.id} className="rounded-xl border p-3">
              <strong>{run.status === 'verificado' ? 'Verificado' : run.status === 'fallido' ? 'Fallido' : 'En proceso'}</strong>
              <span className="ml-2">{new Date(run.startedAt).toLocaleString('es-CO')} · {run.database} · {run.id}</span>
              {run.sha256 && <p className="mt-1 break-all">SHA-256 del archivo cifrado: <code>{run.sha256}</code></p>}
              {run.status === 'verificado' && !run.available && <p className="text-red-700">Archivo ausente o tamaño distinto. Revisa el almacenamiento externo.</p>}
              {run.restoreTest && <p>Restauración: {run.restoreTest.collections} colecciones, {run.restoreTest.documents} documentos y {run.restoreTest.indexes} índices en servidor separado.</p>}
              {run.restoreTest?.contentSha256 && <p className="break-all">Huella del contenido restaurado: <code>{run.restoreTest.contentSha256}</code></p>}
              <ol className="mt-2 list-inside list-decimal text-xs opacity-75">{run.steps.map((step, index) => <li key={index}>{step.name} · {new Date(step.at).toLocaleString('es-CO')}</li>)}</ol>
              {run.status === 'verificado' && run.available && <button type="button" className="mt-2 inline-flex items-center gap-1 underline" onClick={() => setSelectedRun(run.id)}><Download size={14} /> Descargar copia cifrada</button>}
            </li>)}
          </ul>
        )}
      </div>

      {selectedRun && <form onSubmit={download} className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Confirmar descarga de {selectedRun}</h2>
        <p className="mt-1">Solo el propietario puede descargar. Confirma tu contraseña y el código actual de la aplicación de seguridad.</p>
        <label className="mt-3 block">Contraseña actual<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <label className="mt-3 block">Código de 6 dígitos<input inputMode="numeric" pattern="[0-9]{6}" required value={twoFactorCode} onChange={(event) => setTwoFactorCode(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
        <button type="submit" disabled={downloading} className="mt-3 rounded-lg bg-slate-950 px-4 py-2 font-semibold text-white disabled:opacity-50">{downloading ? 'Descargando…' : 'Confirmar y descargar'}</button>
        <button type="button" onClick={() => { setSelectedRun(null); setPassword(''); setTwoFactorCode(''); }} className="ml-3 underline">Cancelar</button>
      </form>}

      <div className="rounded-2xl border p-4 text-sm" style={cardStyle}>
        <h2 className="font-semibold">Cambio de plan en Atlas</h2>
        <p className="mt-2">El propietario cambia el plan y configura las copias en la consola de MongoDB Atlas. Es una operación de facturación externa: esta selección solo registra el método previsto en la tienda.</p>
        <a className="mt-3 inline-flex items-center gap-1 underline" href="https://cloud.mongodb.com/" target="_blank" rel="noreferrer">
          Abrir MongoDB Atlas <ExternalLink size={14} aria-hidden="true" />
        </a>
        <p className="mt-2">Antes de usar producción, comprueba una copia reciente y restaúrala en una base aislada. Incluye por separado los archivos subidos y los secretos del servidor.</p>
        <a className="mt-3 inline-flex items-center gap-1 underline" href="https://www.mongodb.com/docs/atlas/backup/cloud-backup/" target="_blank" rel="noreferrer">
          Documentación de respaldos de Atlas <ExternalLink size={14} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
