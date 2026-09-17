import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  LayoutTemplate,
  Loader2,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Store,
  Upload,
} from 'lucide-react';

import {
  getAdminLoginSettings,
  updateAdminLoginSettings,
  uploadAdminLoginBackground,
} from '../../api/adminLoginSettingsApi';
import {
  DEFAULT_LOGIN_SETTINGS,
  loginSettingsEqual,
  normalizeLoginSettings,
  safeLoginImageUrl,
} from '../../login/loginSettings';
import { LOGIN_LAYOUTS, LOGIN_THEMES } from '../../login/loginThemes';
import './LoginAdminSection.css';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function apiMessage(error, fallback) {
  return error?.response?.data?.message || error?.userMessage || fallback;
}

function LoginPreview({ settings, store }) {
  const theme = LOGIN_THEMES[settings.theme] || LOGIN_THEMES[DEFAULT_LOGIN_SETTINGS.theme];
  const layout = LOGIN_LAYOUTS[settings.layout] || LOGIN_LAYOUTS[DEFAULT_LOGIN_SETTINGS.layout];
  const background = settings.background;
  const previewImage = safeLoginImageUrl(background.image);
  const imageMode = background.mode === 'image' && previewImage;
  const pageBackground = background.mode === 'color' ? background.color : theme.pageBg;

  return (
    <div className="login-settings-preview-wrap">
      <div className="login-settings-preview-title">
        <div>
          <span>VISTA PREVIA</span>
          <strong>{layout.name}</strong>
        </div>
        <a href="/admin/login" target="_blank" rel="noreferrer">
          Ver login real <ExternalLink size={15} />
        </a>
      </div>

      <div className={`login-settings-preview layout-${settings.layout}`} style={{ background: pageBackground }}>
        {imageMode ? (
          <>
            <div
              className="login-settings-preview-image"
              style={{ backgroundImage: `url("${previewImage}")`, opacity: background.imageOpacity }}
            />
            <div
              className="login-settings-preview-overlay"
              style={{ background: `rgba(0,0,0,${background.overlay})` }}
            />
          </>
        ) : null}

        <div className="login-settings-preview-brand" style={{ color: theme.titleColor }}>
          <span style={{ background: theme.brandBadgeBg, color: theme.brandBadgeColor }}>
            {store?.logo ? <img src={store.logo} alt="" /> : <Store size={22} />}
          </span>
          <div>
            <small>ACCESO ADMINISTRATIVO</small>
            <b>{store?.name || 'Tu tienda'}</b>
          </div>
        </div>

        <div
          className="login-settings-preview-card"
          style={{
            background: theme.cardBg,
            borderColor: theme.cardBorder,
            boxShadow: theme.cardShadow,
            color: theme.textColor,
          }}
        >
          <ShieldCheck style={{ color: theme.brandBadgeColor }} />
          <strong style={{ color: theme.titleColor }}>Iniciar sesión</strong>
          <small style={{ color: theme.mutedColor }}>Accede al panel de {store?.name || 'tu tienda'}</small>
          <i style={{ background: theme.inputBg, borderColor: theme.inputBorder }} />
          <i style={{ background: theme.inputBg, borderColor: theme.inputBorder }} />
          <button type="button" style={{ background: theme.buttonBg, color: theme.buttonText }}>
            Ingresar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginAdminSection() {
  const [form, setForm] = useState(() => clone(DEFAULT_LOGIN_SETTINGS));
  const [saved, setSaved] = useState(() => clone(DEFAULT_LOGIN_SETTINGS));
  const [revision, setRevision] = useState(0);
  const [meta, setMeta] = useState({ themes: [], layouts: [], backgroundModes: [], defaults: DEFAULT_LOGIN_SETTINGS });
  const [store, setStore] = useState({ name: 'Tu tienda', logo: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const dirty = useMemo(() => !loginSettingsEqual(form, saved), [form, saved]);
  const themeOptions = meta.themes.length
    ? meta.themes
    : Object.values(LOGIN_THEMES).map((item) => ({ value: item.id, label: item.name, description: item.description }));
  const layoutOptions = meta.layouts.length
    ? meta.layouts
    : Object.values(LOGIN_LAYOUTS).map((item) => ({ value: item.id, label: item.name, description: item.description }));

  function applyResponse(response) {
    const next = normalizeLoginSettings(response?.settings || DEFAULT_LOGIN_SETTINGS);
    setForm(next);
    setSaved(clone(next));
    setRevision(Number(response?.revision || 0));
    setMeta(response?.meta || meta);
    setStore(response?.store || store);
    setFieldErrors({});
  }

  async function load() {
    try {
      setLoading(true);
      setFeedback(null);
      applyResponse(await getAdminLoginSettings());
    } catch (error) {
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo cargar el diseño del acceso.') });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function setRoot(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  function setBackground(key, value) {
    setForm((current) => ({
      ...current,
      background: { ...current.background, [key]: value },
    }));
    setFieldErrors((current) => ({ ...current, [`background.${key}`]: '' }));
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', message: 'Selecciona un archivo de imagen.' });
      return;
    }
    try {
      setBusy('upload');
      const url = await uploadAdminLoginBackground(file);
      if (!url) throw new Error('UPLOAD_URL_MISSING');
      setForm((current) => ({
        ...current,
        background: { ...current.background, image: url, mode: 'image' },
      }));
      setFeedback({ type: 'success', message: 'Imagen cargada. Guarda para aplicarla al login.' });
    } catch (error) {
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo subir la imagen.') });
    } finally {
      setBusy('');
    }
  }

  async function save() {
    try {
      setBusy('save');
      setFeedback(null);
      const response = await updateAdminLoginSettings({ revision, settings: form });
      applyResponse(response);
      window.dispatchEvent(new CustomEvent('admin-login-settings-updated', { detail: response.settings }));
      setFeedback({ type: 'success', message: response.message || 'Diseño guardado.' });
    } catch (error) {
      const details = error?.response?.data?.details || [];
      setFieldErrors(Object.fromEntries(details.map((item) => [item.field, item.message])));
      setFeedback({ type: 'error', message: apiMessage(error, 'No se pudo guardar el diseño.') });
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return <div className="login-settings-loading"><Loader2 className="animate-spin" /> Cargando diseño del acceso…</div>;
  }

  return (
    <section className="login-settings-shell">
      <header className="login-settings-hero">
        <div className="login-settings-hero-icon"><ShieldCheck /></div>
        <div>
          <p>ACCESO SEGURO DE LA TIENDA</p>
          <h2>Login de {store.name || 'tu tienda'}</h2>
          <span>Elige una apariencia clara y guárdala una sola vez para todos los dispositivos.</span>
        </div>
        <div className={`login-settings-state ${dirty ? 'pending' : 'synced'}`}>
          {dirty ? 'Cambios sin guardar' : <><Check size={16} /> Sincronizado</>}
        </div>
      </header>

      {feedback ? <div className={`login-settings-feedback ${feedback.type}`}>{feedback.message}</div> : null}

      <div className="login-settings-workspace">
        <div className="login-settings-controls">
          <div className="login-settings-control-heading">
            <div><Palette /><span><b>Apariencia</b><small>Tema, estructura y fondo</small></span></div>
            <button type="button" onClick={load} disabled={Boolean(busy)} title="Recargar"><RefreshCw size={17} /></button>
          </div>

          <div className="login-settings-grid-two">
            <label>
              <span>Tema visual</span>
              <select aria-label="Tema visual" value={form.theme} onChange={(event) => setRoot('theme', event.target.value)}>
                {themeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <small>{themeOptions.find((item) => item.value === form.theme)?.description}</small>
              {fieldErrors.theme ? <em>{fieldErrors.theme}</em> : null}
            </label>

            <label>
              <span>Estructura</span>
              <select aria-label="Estructura" value={form.layout} onChange={(event) => setRoot('layout', event.target.value)}>
                {layoutOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <small>{layoutOptions.find((item) => item.value === form.layout)?.description}</small>
              {fieldErrors.layout ? <em>{fieldErrors.layout}</em> : null}
            </label>
          </div>

          <div className="login-settings-background">
            <div className="login-settings-subtitle"><ImageIcon /><span><b>Fondo</b><small>Escoge una sola opción</small></span></div>
            <div className="login-settings-segments">
              {(meta.backgroundModes || []).map((mode) => (
                <button
                  type="button"
                  key={mode.value}
                  className={form.background.mode === mode.value ? 'active' : ''}
                  onClick={() => setBackground('mode', mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {form.background.mode === 'color' ? (
              <label className="login-settings-color-row">
                <span>Color del fondo</span>
                <input type="color" value={form.background.color} onChange={(event) => setBackground('color', event.target.value)} />
                <input value={form.background.color} onChange={(event) => setBackground('color', event.target.value)} />
                {fieldErrors['background.color'] ? <em>{fieldErrors['background.color']}</em> : null}
              </label>
            ) : null}

            {form.background.mode === 'image' ? (
              <div className="login-settings-image-fields">
                <label>
                  <span>Imagen publicada</span>
                  <input value={form.background.image} onChange={(event) => setBackground('image', event.target.value)} placeholder="https://..." />
                  {fieldErrors['background.image'] ? <em>{fieldErrors['background.image']}</em> : null}
                </label>
                <label className="login-settings-upload">
                  <input type="file" accept="image/*" onChange={uploadImage} />
                  {busy === 'upload' ? <Loader2 className="animate-spin" /> : <Upload />}
                  {busy === 'upload' ? 'Subiendo…' : 'Subir imagen'}
                </label>
                <div className="login-settings-range-grid">
                  <label><span>Visibilidad: {Math.round(form.background.imageOpacity * 100)}%</span><input type="range" min="0.1" max="1" step="0.05" value={form.background.imageOpacity} onChange={(event) => setBackground('imageOpacity', Number(event.target.value))} /></label>
                  <label><span>Capa oscura: {Math.round(form.background.overlay * 100)}%</span><input type="range" min="0" max="0.85" step="0.05" value={form.background.overlay} onChange={(event) => setBackground('overlay', Number(event.target.value))} /></label>
                </div>
              </div>
            ) : null}
          </div>

          <button type="button" className="login-settings-default" onClick={() => setForm(normalizeLoginSettings(meta.defaults || DEFAULT_LOGIN_SETTINGS))}>
            <RotateCcw size={16} /> Recuperar diseño recomendado
          </button>
        </div>

        <LoginPreview settings={form} store={store} />
      </div>

      <footer className="login-settings-footer">
        <div><LayoutTemplate /><span><b>Configuración compartida</b><small>Versión {revision} · se aplicará al login real después de guardar.</small></span></div>
        <div>
          <button type="button" onClick={() => { setForm(clone(saved)); setFieldErrors({}); setFeedback(null); }} disabled={!dirty || Boolean(busy)}>Descartar</button>
          <button type="button" className="primary" onClick={save} disabled={!dirty || Boolean(busy)}>
            {busy === 'save' ? <Loader2 className="animate-spin" /> : <Save />}
            {busy === 'save' ? 'Guardando…' : 'Guardar diseño'}
          </button>
        </div>
      </footer>
    </section>
  );
}
