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
  SlidersHorizontal,
  Type,
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
import {
  CURATED_LOGIN_THEME_IDS,
  getLoginThemeCustomization,
  LOGIN_THEMES,
} from '../../login/loginThemes';
import {
  AuroraOrbitMark,
  NoirGalleryMark,
  PaperStudioMark,
} from '../../login/LoginThemeMarks';
import RosaCoutureMark from '../../login/RosaCoutureMark';
import './LoginAdminSection.css';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function apiMessage(error, fallback) {
  return error?.response?.data?.message || error?.userMessage || fallback;
}

const COLOR_CONTROLS = [
  { field: 'primary', label: 'Color principal' },
  { field: 'secondary', label: 'Color complementario' },
  { field: 'accent', label: 'Color de acento' },
  { field: 'surface', label: 'Fondo y superficie' },
];

const STORY_TEXT_CONTROLS = [
  { field: 'eyebrow', label: 'Texto pequeño', maxLength: 48 },
  { field: 'headline', label: 'Título principal', maxLength: 48 },
  { field: 'highlight', label: 'Título destacado', maxLength: 48 },
  { field: 'description', label: 'Descripción', maxLength: 180, multiline: true },
];

const ACCESS_TEXT_CONTROLS = [
  { field: 'welcomeTitle', label: 'Título del acceso', maxLength: 48 },
  { field: 'welcomeSubtitle', label: 'Texto de bienvenida', maxLength: 100 },
  { field: 'buttonText', label: 'Texto del botón', maxLength: 32 },
];

function ThemeMark({ themeId, size = 30 }) {
  if (themeId === 'noirGallery') return <NoirGalleryMark size={size} />;
  if (themeId === 'auroraMotion') return <AuroraOrbitMark size={size} />;
  if (themeId === 'paperStudio') return <PaperStudioMark size={size} />;
  return <RosaCoutureMark size={size} />;
}

function LoginPreview({ settings, store }) {
  const theme = LOGIN_THEMES[settings.theme] || LOGIN_THEMES[DEFAULT_LOGIN_SETTINGS.theme];
  const background = settings.background;
  const customization = settings.customizations?.[theme.id] || getLoginThemeCustomization(theme.id);
  const previewImage = safeLoginImageUrl(background.image);
  const imageMode = background.mode === 'image' && previewImage;
  const pageBackground = background.mode === 'color' ? background.color : theme.pageBg;

  return (
    <div className="login-settings-preview-wrap">
      <div className="login-settings-preview-title">
        <div>
          <span>VISTA PREVIA</span>
          <strong>{theme.name} · composición exclusiva</strong>
        </div>
        <a href="/admin/login" target="_blank" rel="noreferrer">
          Ver login real <ExternalLink size={15} />
        </a>
      </div>

      <div
        className="login-settings-preview curated-preview"
        data-preview-theme={theme.id}
        style={{
          background: pageBackground,
          '--preview-glow': theme.glowSoft,
          '--preview-strong': theme.glowStrong,
          '--preview-accent': theme.glowColor,
          '--preview-inner': theme.cardInnerBorder,
          '--preview-font': theme.displayFont,
          '--login-primary': customization.primary,
          '--login-secondary': customization.secondary,
          '--login-accent': customization.accent,
          '--login-surface': customization.surface,
        }}
      >
        <div className="login-settings-preview-aura aura-one" style={{ background: theme.deco1 }} />
        <div className="login-settings-preview-aura aura-two" style={{ background: theme.deco2 }} />
        <div
          className="login-settings-preview-pattern"
          style={{ backgroundImage: theme.pagePattern, backgroundSize: theme.patternSize }}
        />
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

        <div className="login-settings-curated-scene">
          <div className="login-settings-curated-story">
            <div className="login-settings-curated-brand">
              <ThemeMark themeId={theme.id} size={32} />
              <b>{store?.name || 'Tu tienda'}</b>
            </div>
            <div className="login-settings-curated-copy">
              <small>{customization.eyebrow}</small>
              <strong>{customization.headline}<em>{customization.highlight}</em></strong>
              <p>{customization.description}</p>
            </div>
            <ThemeMark themeId={theme.id} size={150} />
          </div>
          <div className="login-settings-curated-access">
            <ThemeMark themeId={theme.id} size={31} />
            <strong>{customization.welcomeTitle}</strong>
            <small>{customization.welcomeSubtitle}</small>
            <i /><i />
            <button type="button"><span>{customization.buttonText}</span><b>→</b></button>
          </div>
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
    : CURATED_LOGIN_THEME_IDS.map((themeId) => LOGIN_THEMES[themeId]).map((item) => ({ value: item.id, label: item.name, description: item.description }));
  const currentCustomization = form.customizations?.[form.theme] || getLoginThemeCustomization(form.theme);

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

  function setCustomization(key, value) {
    setForm((current) => ({
      ...current,
      customizations: {
        ...current.customizations,
        [current.theme]: {
          ...(current.customizations?.[current.theme] || getLoginThemeCustomization(current.theme)),
          [key]: value,
        },
      },
    }));
    setFieldErrors((current) => ({
      ...current,
      [`customizations.${form.theme}.${key}`]: '',
    }));
  }

  function resetCurrentTheme() {
    setForm((current) => ({
      ...current,
      customizations: {
        ...current.customizations,
        [current.theme]: getLoginThemeCustomization(current.theme),
      },
    }));
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

          <div className="login-theme-picker" role="radiogroup" aria-label="Tema visual">
            {themeOptions.map((option) => {
              const selected = option.value === form.theme;
              const palette = form.customizations?.[option.value] || getLoginThemeCustomization(option.value);
              return (
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  key={option.value}
                  className={selected ? 'selected' : ''}
                  onClick={() => setRoot('theme', option.value)}
                >
                  <span className="login-theme-card-mark" style={{ '--card-accent': palette.accent }}>
                    <ThemeMark themeId={option.value} size={32} />
                  </span>
                  <span className="login-theme-card-copy">
                    <b>{option.label}</b>
                    <small>{option.description}</small>
                  </span>
                  <span className="login-theme-card-palette" aria-hidden="true">
                    {['primary', 'secondary', 'accent', 'surface'].map((color) => (
                      <i key={color} style={{ background: palette[color] }} />
                    ))}
                  </span>
                  {selected ? <Check className="login-theme-card-check" size={16} /> : null}
                </button>
              );
            })}
          </div>
          {fieldErrors.theme ? <em>{fieldErrors.theme}</em> : null}

          <div className="login-settings-exclusive">
            <ThemeMark themeId={form.theme} size={34} />
            <span><b>Composición exclusiva incluida</b><small>Cada tema cambia estructura, emblema y animación; no es solo otro color.</small></span>
          </div>

          <section className="login-theme-customizer">
            <div className="login-theme-customizer-head">
              <div><SlidersHorizontal /><span><b>Personaliza {LOGIN_THEMES[form.theme]?.name}</b><small>Los cambios aparecen inmediatamente en la vista previa.</small></span></div>
              <button type="button" onClick={resetCurrentTheme}><RotateCcw size={14} /> Restaurar este tema</button>
            </div>

            <div className="login-theme-colors">
              {COLOR_CONTROLS.map((control) => (
                <label key={control.field}>
                  <span>{control.label}</span>
                  <div>
                    <input
                      type="color"
                      aria-label={control.label}
                      value={currentCustomization[control.field]}
                      onChange={(event) => setCustomization(control.field, event.target.value)}
                    />
                    <code>{currentCustomization[control.field]}</code>
                  </div>
                  {fieldErrors[`customizations.${form.theme}.${control.field}`] ? <em>{fieldErrors[`customizations.${form.theme}.${control.field}`]}</em> : null}
                </label>
              ))}
            </div>

            <details className="login-theme-copy-editor">
              <summary><Type size={17} /><span><b>Cambiar textos del diseño</b><small>Títulos, mensaje y botón</small></span><span>Editar</span></summary>
              <div className="login-theme-copy-groups">
                <fieldset>
                  <legend>Presentación de la marca</legend>
                  {STORY_TEXT_CONTROLS.map((control) => (
                    <label key={control.field}>
                      <span>{control.label}</span>
                      {control.multiline ? (
                        <textarea maxLength={control.maxLength} value={currentCustomization[control.field]} onChange={(event) => setCustomization(control.field, event.target.value)} />
                      ) : (
                        <input maxLength={control.maxLength} value={currentCustomization[control.field]} onChange={(event) => setCustomization(control.field, event.target.value)} />
                      )}
                    </label>
                  ))}
                </fieldset>
                <fieldset>
                  <legend>Formulario de acceso</legend>
                  {ACCESS_TEXT_CONTROLS.map((control) => (
                    <label key={control.field}>
                      <span>{control.label}</span>
                      <input maxLength={control.maxLength} value={currentCustomization[control.field]} onChange={(event) => setCustomization(control.field, event.target.value)} />
                    </label>
                  ))}
                </fieldset>
              </div>
            </details>
          </section>

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
