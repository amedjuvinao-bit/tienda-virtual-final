import { normalizeLoginSettings } from '../login/loginSettings';

export const ADMIN_LOADER_MODELS = Object.freeze([
  { id: 'halo', label: 'Halo', description: 'Anillo fino que gira suavemente.' },
  { id: 'pulse', label: 'Pulso', description: 'Tres puntos que aparecen en secuencia.' },
  { id: 'orbit', label: 'Órbita', description: 'Puntos discretos en movimiento circular.' },
  { id: 'wave', label: 'Onda', description: 'Cinco barras que se mueven con calma.' },
  { id: 'linear', label: 'Línea', description: 'Indicador horizontal de carga.' },
]);

export const DEFAULT_ADMIN_LOADER = 'halo';
export const ADMIN_LOADER_STORAGE_KEY = 'rb_admin_loader_model';
export const ADMIN_LOADER_LOGIN_COLOR_KEY = 'rb_admin_loader_login_color';
export const ADMIN_LOADER_PANEL_COLOR_KEY = 'rb_admin_loader_panel_color';

function safeThemeColor(color) {
  return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? String(color).toLowerCase() : null;
}

export function rememberAdminLoadingColors(settings = {}) {
  const login = settings.loginAdmin ? normalizeLoginSettings(settings.loginAdmin) : null;
  const loginColor = login ? safeThemeColor(login.customizations[login.theme].primary) : null;
  const panelColor = safeThemeColor(settings.admin?.theme?.primary);

  for (const [color, key, cssVariable] of [
    [loginColor, ADMIN_LOADER_LOGIN_COLOR_KEY, '--rb-loader-login-color'],
    [panelColor, ADMIN_LOADER_PANEL_COLOR_KEY, '--rb-loader-panel-color'],
  ]) {
    if (!color) continue;
    document.documentElement.style.setProperty(cssVariable, color);
    try { localStorage.setItem(key, color); } catch { /* El color se aplica en esta sesión. */ }
  }
}

export function normalizeAdminLoader(value) {
  const model = typeof value === 'string' ? value : value?.model;
  return ADMIN_LOADER_MODELS.some((option) => option.id === model) ? model : DEFAULT_ADMIN_LOADER;
}

export function rememberAdminLoader(value) {
  const model = normalizeAdminLoader(value);
  try {
    localStorage.setItem(ADMIN_LOADER_STORAGE_KEY, model);
  } catch {
    // El valor guardado en el servidor sigue siendo la fuente de verdad.
  }
  window.dispatchEvent(new CustomEvent('admin-loader-updated', { detail: model }));
}

export function getRememberedAdminLoader() {
  try {
    return normalizeAdminLoader(localStorage.getItem(ADMIN_LOADER_STORAGE_KEY));
  } catch {
    return DEFAULT_ADMIN_LOADER;
  }
}
