import React, { useEffect, useRef, useState } from 'react';
import { Instagram, RefreshCw, ExternalLink, Link2, ShieldCheck } from 'lucide-react';
import api from '../../../lib/api';
const BASE = '/api/admin/instagram-settings';
const blank = { appId: '', appSecret: '', apiVersion: 'v24.0', redirectUri: '', enabled: false };
const fieldClass = 'mt-1 w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900';
export default function InstagramSettingsSection() {
  const [data, setData] = useState(null), [draft, setDraft] = useState(blank), [token, setToken] = useState('');
  const [tab, setTab] = useState('account'), [waiting, setWaiting] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const mounted = useRef(true), popup = useRef(null), timer = useRef(null);
  const read = async (replace = false) => {
    try {
      const { data: result } = await api.get(BASE);
      if (!mounted.current) return;
      setData(result.settings);
      if (replace) setDraft({ ...blank, ...result.settings, appSecret: '' });
      return result.settings;
    } catch (e) { if (mounted.current) setError(e.response?.data?.message || 'No se pudo cargar Instagram.'); }
  };
  useEffect(() => {
    mounted.current = true; read(true);
    const focus = () => { if (popup.current) read(false); };
    window.addEventListener('focus', focus);
    return () => { mounted.current = false; clearInterval(timer.current); window.removeEventListener('focus', focus); };
  }, []);
  const dirty = data && ['appId', 'apiVersion', 'redirectUri', 'enabled'].some(k => draft[k] !== data[k]) || Boolean(draft.appSecret);
  const run = async (path, payload, success, method = 'post') => {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data: result } = await api[method](BASE + path, payload);
      if (!mounted.current) return null;
      if (result.settings) { setData(result.settings); setDraft({ ...blank, ...result.settings, appSecret: '' }); }
      setMessage(success); return result;
    } catch (e) { if (mounted.current) setError(e.response?.data?.message || 'No se pudo completar la operación.'); return null; }
    finally { if (mounted.current) { setBusy(false); setToken(''); setDraft(d => ({ ...d, appSecret: '' })); } }
  };
  const connect = async () => {
    const opened = window.open('about:blank', 'boutique-instagram', 'width=640,height=760');
    if (!opened) { setError('Permite abrir la ventana de Instagram en el navegador y vuelve a intentar.'); return; }
    popup.current = opened;
    const result = await run('/authorize', { revision: data.revision }, 'Autoriza la cuenta en la ventana de Instagram.');
    if (!result) { opened.close(); popup.current = null; return; }
    opened.location.href = result.url;
    const started = Date.now(), revision = data.revision;
    clearInterval(timer.current); setWaiting(true);
    let checking = false;
    timer.current = setInterval(async () => {
      if (checking) return;
      if (Date.now() - started > 10 * 60000) {
        clearInterval(timer.current); popup.current = null; setWaiting(false);
        setMessage('La espera terminó. Puedes volver a conectar si la autorización quedó pendiente.'); return;
      }
      // Cross-Origin-Opener-Policy can mark a live OAuth popup as closed.
      // Check the server connection instead of trusting window.closed.
      checking = true;
      try {
        const fresh = await read(false);
        if (fresh && fresh.revision !== revision) {
          clearInterval(timer.current); popup.current = null; setWaiting(false);
          setDraft({ ...blank, ...fresh, appSecret: '' });
          setMessage(fresh.connected ? 'Cuenta conectada. Ya puedes usarla en la sección de Instagram.' : 'La conexión cambió. Revisa el estado de la cuenta.');
        }
      } finally { checking = false; }
    }, 3000);
  };
  const field = (label, name, type = 'text', placeholder = '') => <label className="block text-sm font-medium">{label}<input className={fieldClass} type={type} autoComplete="off" value={draft[name]} placeholder={placeholder} onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))} disabled={busy} /></label>;
  const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold disabled:opacity-40';
  if (!data) return <div className="rounded-2xl border p-6"><p role="status">{error || 'Cargando conexión de Instagram…'}</p>{error && <button className={button} onClick={() => read(true)}>Reintentar</button>}</div>;
  return <div className="space-y-4">
    <header className="rounded-2xl border p-5" style={{ background: 'var(--admin-card-bg,white)', color: 'var(--admin-card-text,#29202a)' }}><div className="flex items-center gap-3"><Instagram className="h-7 w-7" /><div><h1 className="text-xl font-semibold">Instagram</h1><p className="text-sm opacity-70">Conecta la cuenta y controla su acceso desde un solo lugar.</p></div></div></header>
    <nav className="flex flex-wrap gap-2" aria-label="Ajustes de Instagram">{[['account', 'Cuenta'], ['credentials', 'Credenciales'], ['help', 'Mostrar en la tienda']].map(([value, title]) => <button key={value} type="button" className={button} aria-pressed={tab === value} onClick={() => setTab(value)} style={tab === value ? { background: 'var(--admin-primary,#790d2d)', color: 'white' } : {}}>{title}</button>)}</nav>
    <section className="rounded-2xl border p-4 md:p-6 space-y-4" style={{ background: 'var(--admin-card-bg,white)', color: 'var(--admin-card-text,#29202a)' }}>
      {tab === 'account' && <>
        <div className="flex flex-wrap items-center gap-4">{data.account?.avatar && <img className="h-16 w-16 rounded-full object-cover" src={data.account.avatar} alt="Foto de perfil de Instagram" />}<div><h2 className="font-semibold">{data.account ? `@${data.account.username}` : 'Conecta tu cuenta profesional'}</h2><p className="text-sm opacity-70">{data.connected ? data.enabled ? 'Cuenta conectada · disponible para la tienda' : 'Cuenta conectada · pausada en la tienda' : 'Empresa o creador. La cuenta personal no admite esta integración.'}</p></div></div>
        {data.account && <div className="flex flex-wrap gap-4 text-sm"><span>{data.account.mediaCount} publicaciones</span><span>{data.account.followers} seguidores</span><a className="inline-flex items-center gap-1 underline" href={data.account.url} target="_blank" rel="noopener noreferrer">Ver perfil <ExternalLink size={14} /></a></div>}
        {data.lastError && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{data.lastError}</p>}
        {!data.encryptionReady && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Antes de guardar credenciales, configura INSTAGRAM_ENCRYPTION_KEY (mínimo 32 caracteres) en el .env del backend y reinícialo. También se admite MAIL_ENCRYPTION_KEY si ya tiene esa longitud.</p>}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={busy || waiting || dirty || !data.encryptionReady || !data.appId || !data.hasAppSecret || !data.redirectUri} onClick={connect}><Link2 size={17} />{data.connected ? 'Volver a conectar' : 'Conectar con Instagram'}</button>
          <button className={button} onClick={() => setTab('credentials')}>Configurar credenciales</button>
          {waiting && <button className={button} onClick={() => { clearInterval(timer.current); popup.current = null; setWaiting(false); setMessage('Espera detenida. Vuelve a conectar cuando estés listo.'); }}>Dejar de esperar</button>}
          {data.connected && <><button className={button} disabled={busy || dirty} onClick={() => run('/sync', {}, 'Perfil y publicaciones actualizados.')}><RefreshCw size={16} />Actualizar ahora</button>
          <button className={button} disabled={busy || dirty} onClick={() => run('/disconnect', { revision: data.revision }, 'Cuenta desconectada de la tienda. Las fotos manuales se conservan.')}>Desconectar de la tienda</button></>}</div>
        {dirty && <p className="text-sm">Guarda los cambios de credenciales antes de conectar o actualizar.</p>}
        {data.connected && <p className="text-xs opacity-70">Última actualización: {data.syncedAt ? new Date(data.syncedAt).toLocaleString('es') : 'Pendiente'}. {data.expiresAt ? `Acceso válido hasta ${new Date(data.expiresAt).toLocaleDateString('es')}. Se intentará renovar antes de que caduque.` : 'El token manual no informa su vencimiento: vuelve a conectar si Meta revoca o caduca el acceso.'}</p>}
      </>}
      {tab === 'credentials' && <>
        <h2 className="font-semibold">Acceso de la app de Meta</h2><p className="text-sm opacity-70">Usa los datos de Instagram API con Instagram Login. Nunca la contraseña personal de Instagram.</p>
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); run('', { appId: draft.appId, appSecret: draft.appSecret, apiVersion: draft.apiVersion, redirectUri: draft.redirectUri, enabled: draft.enabled, revision: data.revision }, 'Credenciales guardadas de forma privada.', 'put'); }}>
          <div className="grid gap-4 md:grid-cols-2">{field('Instagram App ID', 'appId', 'text', 'ID numérico de la app')}{field('Instagram App Secret', 'appSecret', 'password', data.hasAppSecret ? 'Guardado · déjalo vacío para conservarlo' : 'Secreto de la app')}{field('URL de retorno del backend', 'redirectUri', 'url', 'https://api.tutienda.com/api/instagram/callback')}{field('Versión de Graph API', 'apiVersion', 'text', 'v24.0')}</div>
          <p className="text-xs opacity-70">Registra exactamente esta URL de retorno en Meta. En desarrollo puedes usar http://localhost:5000/api/instagram/callback si Meta acepta esa URL para tu app.</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.enabled} disabled={busy} onChange={e => setDraft(d => ({ ...d, enabled: e.target.checked }))} />Permitir mostrar la cuenta conectada en la tienda</label>
          <button type="submit" className={button} disabled={busy || !dirty || (!data.encryptionReady && Boolean(draft.appSecret))}>{busy ? 'Guardando…' : 'Guardar ajustes'}</button>
        </form>
        <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">Ya tengo un token de acceso de Meta</summary><form className="mt-3 space-y-3" onSubmit={async e => { e.preventDefault(); await run('/connect-token', { revision: data.revision, accessToken: token }, 'Token comprobado y cuenta conectada.'); }}><p className="text-sm opacity-70">Pega un token de Instagram Login con instagram_business_basic. Se comprobará la cuenta y el acceso a sus publicaciones antes de conectarla. No necesitas el secreto de la app para este método.</p><label className="block text-sm">Token de acceso<input className={fieldClass} type="password" autoComplete="off" value={token} onChange={e => setToken(e.target.value)} disabled={busy} /></label><button className={button} type="submit" disabled={busy || waiting || dirty || !token.trim() || !data.encryptionReady}>Comprobar y conectar token</button></form></details>
        <p className="flex items-center gap-2 text-xs opacity-70"><ShieldCheck size={17} />Secreto y token cifrados en el servidor. El panel nunca vuelve a mostrarlos.</p>
      </>}
      {tab === 'help' && <>
        <h2 className="font-semibold">Activa el feed en tu diseño</h2><ol className="list-decimal pl-5 space-y-3 text-sm"><li>Conecta la cuenta en esta pantalla y comprueba su foto de perfil.</li><li>En Apariencia → Instagram → Contenido → Perfil, elige “Cuenta de Instagram conectada”.</li><li>Decide si usar el nombre, avatar y estadísticas de la cuenta; guarda la apariencia.</li></ol>
        <p className="text-sm opacity-70">Cada foto conserva su publicación original. Las publicaciones disponibles en la API se recorren con “Cargar más publicaciones”. El perfil y las páginas consultadas se actualizan al visitarlas, con una caché de una hora. Los álbumes se abren completos y los videos disponibles tienen reproducción.</p>
        <p className="text-sm opacity-70">Me gusta y comentarios abren Instagram. El marcador guarda en el navegador del visitante. No se envían acciones a su cuenta desde la tienda.</p>
        <a className={button} href="/admin/apariencia">Ir a Apariencia <ExternalLink size={16} /></a>
        <a className="block text-sm underline" href="https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login" target="_blank" rel="noopener noreferrer">Guía oficial de Meta: app, cuenta profesional, permisos y revisión</a>
      </>}
    </section>
    {message && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p>}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </div>;
}
