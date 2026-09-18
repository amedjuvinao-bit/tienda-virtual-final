import { useEffect, useMemo, useState } from 'react';
import galleryImmersiveDefault from '../../../assets/login/gallery-immersive-default.webp';
import galleryImmersiveLightBlue from '../../../assets/login/gallery-immersive-light-blue.webp';
import galleryImmersiveRoseGold from '../../../assets/login/gallery-immersive-rose-gold.webp';
import liquidGlassDefault from '../../../assets/login/liquid-glass-default.webp';
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
  getLoginGalleryImageTone,
  getLoginThemeCustomization,
  LOGIN_GALLERY_IMAGE_TONES,
  LOGIN_THEMES,
} from '../../login/loginThemes';
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

const PALETTE_PRESETS = [
  { name: 'Océano', primary: '#07132f', secondary: '#183b73', accent: '#64f5d2', surface: '#f2fbff' },
  { name: 'Violeta', primary: '#160b2d', secondary: '#5b3bbd', accent: '#ff82c8', surface: '#fff7fd' },
  { name: 'Tierra', primary: '#2c1d16', secondary: '#9a5d38', accent: '#efc56a', surface: '#fff8ea' },
  { name: 'Esmeralda', primary: '#06271f', secondary: '#14735b', accent: '#b7f34a', surface: '#f3fff8' },
  { name: 'Grafito', primary: '#151719', secondary: '#555b61', accent: '#e8ff45', surface: '#f5f5f0' },
  { name: 'Coral', primary: '#351824', secondary: '#bb4162', accent: '#ffbd68', surface: '#fff6f1' },
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

const GALLERY_IMAGE_ASSETS = Object.freeze({
  black: galleryImmersiveDefault,
  roseGold: galleryImmersiveRoseGold,
  lightBlue: galleryImmersiveLightBlue,
});

function ThemeMark({ themeId, size = 30 }) {
  const Icon = LOGIN_THEMES[themeId]?.icon || LOGIN_THEMES[DEFAULT_LOGIN_SETTINGS.theme].icon;
  return <Icon size={size} aria-hidden="true" />;
}

function StoreLogo({ store, className = '' }) {
  const name = store?.name || 'Tu tienda';
  return (
    <span className={`login-store-logo ${className}`.trim()}>
      {store?.logo ? <img src={store.logo} alt={`Logo de ${name}`} /> : <b aria-label={`Inicial de ${name}`}>{name.trim().charAt(0).toUpperCase() || 'T'}</b>}
    </span>
  );
}

function LoginPreview({ settings, store }) {
  const theme = LOGIN_THEMES[settings.theme] || LOGIN_THEMES[DEFAULT_LOGIN_SETTINGS.theme];
  const background = settings.background;
  const customization = settings.customizations?.[theme.id] || getLoginThemeCustomization(theme.id);
  const galleryTone = getLoginGalleryImageTone(customization.imageTone);
  const previewImage = safeLoginImageUrl(background.image);
  const imageMode = background.mode === 'image' && previewImage;
  const defaultThemeImages = {
    liquidGlass: liquidGlassDefault,
    immersiveGallery: GALLERY_IMAGE_ASSETS[galleryTone.id],
    smokeGlass: '',
  };
  const resolvedPreviewImage = imageMode ? previewImage : defaultThemeImages[theme.id] || '';
  const lightTheme = theme.id === 'liquidGlass' || theme.id === 'smokeGlass';
  const defaultOverlay = theme.id === 'liquidGlass' ? 0.05 : theme.id === 'smokeGlass' ? 0.08 : 0.18;
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
        data-gallery-tone={theme.id === 'immersiveGallery' ? galleryTone.id : undefined}
        data-custom-image={theme.id === 'smokeGlass' && imageMode ? 'true' : undefined}
        style={{
          background: pageBackground,
          '--login-primary': customization.primary,
          '--login-secondary': customization.secondary,
          '--login-accent': customization.accent,
          '--login-surface': customization.surface,
        }}
      >
        {resolvedPreviewImage ? (
          <>
            <div
              className="login-settings-preview-image"
              style={{ backgroundImage: `url("${resolvedPreviewImage}")`, opacity: imageMode ? background.imageOpacity : 1 }}
            />
            <div
              className="login-settings-preview-overlay"
              style={{
                background: `${lightTheme ? 'rgba(255,255,255' : 'rgba(0,0,0'},${imageMode ? background.overlay : defaultOverlay})`,
              }}
            />
          </>
        ) : null}

        <div className="login-settings-curated-scene">
          <div className="login-settings-theme-motion" aria-hidden="true">
            {theme.id === 'smokeGlass' && imageMode ? null : <><i /><i /></>}
          </div>
          <div className="login-settings-curated-story">
            <div className="login-settings-curated-brand">
              <StoreLogo store={store} />
            </div>
            <div className="login-settings-curated-copy">
              <small>{customization.eyebrow}</small>
              <strong>{customization.headline}<em>{customization.highlight}</em></strong>
              <p>{customization.description}</p>
            </div>
          </div>
          <div className="login-settings-curated-access">
            {theme.id === 'smokeGlass' ? <StoreLogo store={store} className="access" /> : null}
            <span className="login-settings-editorial-rail" aria-hidden="true"><i /><i /><i /></span>
            <em className="login-settings-editorial-kicker">ACCESO</em>
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
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const dirty = useMemo(() => !loginSettingsEqual(form, saved), [form, saved]);
  const themeOptions = CURATED_LOGIN_THEME_IDS.map((themeId) => LOGIN_THEMES[themeId]).map((item) => ({ value: item.id, label: item.name, description: item.description }));
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

  function setPalette(palette) {
    setForm((current) => ({
      ...current,
      customizations: {
        ...current.customizations,
        [current.theme]: {
          ...(current.customizations?.[current.theme] || getLoginThemeCustomization(current.theme)),
          primary: palette.primary,
          secondary: palette.secondary,
          accent: palette.accent,
          surface: palette.surface,
        },
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

          <section className="login-theme-selector">
            <div className="login-theme-selector-step"><span>1</span><div><b>Escoge el diseño</b><small>Cada opción cambia por completo la estructura y el movimiento.</small></div></div>
            <div className="login-theme-selector-current">
              <span className="login-theme-selector-mark" style={{ '--card-accent': currentCustomization.accent }}><ThemeMark themeId={form.theme} size={46} /></span>
              <span className="login-theme-selector-copy"><b>{LOGIN_THEMES[form.theme]?.name}</b><small>{LOGIN_THEMES[form.theme]?.description}</small></span>
              <span className="login-theme-selector-palette" aria-hidden="true">{['primary', 'secondary', 'accent', 'surface'].map((color) => <i key={color} style={{ background: currentCustomization[color] }} />)}</span>
            </div>
            <label className="login-theme-select-field">
              <span>Diseño del login</span>
              <select aria-label="Tema visual" value={form.theme} onChange={(event) => { setRoot('theme', event.target.value); setCustomizerOpen(false); }}>
                {themeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <button type="button" className="login-theme-customize-button" onClick={() => setCustomizerOpen((open) => !open)}>
              <SlidersHorizontal size={17} /> {customizerOpen ? 'Cerrar personalización' : 'Personalizar este tema'}
            </button>
          </section>
          {fieldErrors.theme ? <em>{fieldErrors.theme}</em> : null}

          {customizerOpen ? <section className="login-theme-customizer">
            <div className="login-theme-customizer-head">
              <div><SlidersHorizontal /><span><b>Personaliza {LOGIN_THEMES[form.theme]?.name}</b><small>Los cambios aparecen inmediatamente en la vista previa.</small></span></div>
              <button type="button" onClick={resetCurrentTheme}><RotateCcw size={14} /> Restaurar este tema</button>
            </div>

            {form.theme === 'immersiveGallery' ? <div className="login-gallery-tone-picker">
              <div className="login-theme-preset-heading"><b>Color real de la imagen</b><small>Cada opción carga la tela terminada en ese material.</small></div>
              <div className="login-gallery-tone-options">
                {LOGIN_GALLERY_IMAGE_TONES.map((tone) => <button
                  type="button"
                  key={tone.id}
                  className={currentCustomization.imageTone === tone.id ? 'selected' : ''}
                  aria-label={`Usar tonalidad ${tone.name}`}
                  aria-pressed={currentCustomization.imageTone === tone.id}
                  onClick={() => setCustomization('imageTone', tone.id)}
                >
                  <i style={{ backgroundImage: `url("${GALLERY_IMAGE_ASSETS[tone.id]}")` }} aria-hidden="true" />
                  <span>{tone.name}</span>
                  {currentCustomization.imageTone === tone.id ? <Check size={14} aria-hidden="true" /> : null}
                </button>)}
              </div>
            </div> : null}

            <div className="login-theme-preset-heading"><b>Paletas listas</b><small>Escoge una combinación o crea la tuya debajo.</small></div>
            <div className="login-theme-presets">
              {PALETTE_PRESETS.map((palette) => <button type="button" key={palette.name} onClick={() => setPalette(palette)} aria-label={`Usar paleta ${palette.name}`} title={palette.name}>
                <span>{[palette.primary, palette.secondary, palette.accent, palette.surface].map((color) => <i key={color} style={{ background: color }} />)}</span><b>{palette.name}</b>
              </button>)}
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
          </section> : null}

          {customizerOpen ? <div className="login-settings-background">
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
          </div> : null}

          {customizerOpen ? <button type="button" className="login-settings-default" onClick={() => setForm(normalizeLoginSettings(meta.defaults || DEFAULT_LOGIN_SETTINGS))}>
            <RotateCcw size={16} /> Recuperar diseño recomendado
          </button> : null}
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
