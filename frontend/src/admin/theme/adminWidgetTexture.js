export const DEFAULT_ADMIN_WIDGET_TEXTURE = 'softGlass';

export const ADMIN_WIDGET_TEXTURES = Object.freeze([
  {
    value: 'softGlass',
    label: 'Cristal suave',
    description: 'Transparencia ligera y profundidad equilibrada.',
  },
  {
    value: 'liquidGlass',
    label: 'Vidrio líquido',
    description: 'Reflejos luminosos, volumen y efecto fluido.',
  },
  {
    value: 'frostedGlass',
    label: 'Cristal esmerilado',
    description: 'Mayor desenfoque para una lectura serena.',
  },
  {
    value: 'pearl',
    label: 'Perlado',
    description: 'Brillo nacarado y elegante con relieve sutil.',
  },
  {
    value: 'solidPremium',
    label: 'Sólido premium',
    description: 'Superficie firme, limpia y con sombra refinada.',
  },
  {
    value: 'minimal',
    label: 'Minimalista',
    description: 'Bordes finos, poco relieve y máxima claridad.',
  },
]);

const TEXTURE_VALUES = new Set(ADMIN_WIDGET_TEXTURES.map((item) => item.value));

const TEXTURE_TOKENS = Object.freeze({
  softGlass: {
    bg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 64%, transparent), color-mix(in srgb, var(--admin-primary) 10%, transparent))',
    strongBg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 78%, transparent), color-mix(in srgb, var(--admin-primary) 14%, transparent))',
    softBg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 50%, transparent), color-mix(in srgb, var(--admin-primary) 7%, transparent))',
    inputBg: 'color-mix(in srgb, var(--admin-input-bg) 76%, transparent)',
    border: 'color-mix(in srgb, var(--admin-card-border) 62%, rgba(255,255,255,0.68))',
    shadow: '0 20px 56px rgba(15,23,42,0.10), 0 10px 28px color-mix(in srgb, var(--admin-primary) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.58)',
    shadowHover: '0 28px 74px rgba(15,23,42,0.15), 0 16px 38px color-mix(in srgb, var(--admin-primary) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.70)',
    highlight: 'rgba(255,255,255,0.66)',
    overlay: 'radial-gradient(circle at 16% 0%, rgba(255,255,255,0.34), transparent 34%), linear-gradient(145deg, color-mix(in srgb, var(--admin-primary) 7%, transparent), transparent 48%)',
    blur: '24px',
    saturation: '1.5',
  },
  liquidGlass: {
    bg: 'radial-gradient(circle at 16% -8%, rgba(255,255,255,0.72), transparent 34%), linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 42%, transparent), color-mix(in srgb, var(--admin-card-bg) 66%, var(--admin-primary) 15%))',
    strongBg: 'radial-gradient(circle at 12% 0%, rgba(255,255,255,0.78), transparent 32%), linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 52%, transparent), color-mix(in srgb, var(--admin-primary) 22%, var(--admin-card-bg)))',
    softBg: 'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 34%, transparent), color-mix(in srgb, var(--admin-primary) 13%, transparent))',
    inputBg: 'linear-gradient(135deg, color-mix(in srgb, var(--admin-input-bg) 58%, transparent), color-mix(in srgb, var(--admin-primary) 8%, transparent))',
    border: 'color-mix(in srgb, var(--admin-primary) 34%, rgba(255,255,255,0.76))',
    shadow: '0 26px 70px rgba(15,23,42,0.14), 0 12px 34px color-mix(in srgb, var(--admin-primary) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.82), inset 0 -1px 0 color-mix(in srgb, var(--admin-primary) 16%, transparent)',
    shadowHover: '0 34px 88px rgba(15,23,42,0.18), 0 18px 44px color-mix(in srgb, var(--admin-primary) 24%, transparent), inset 0 1px 0 rgba(255,255,255,0.92)',
    highlight: 'rgba(255,255,255,0.88)',
    overlay: 'radial-gradient(ellipse at 18% -12%, rgba(255,255,255,0.62), transparent 38%), radial-gradient(circle at 94% 18%, color-mix(in srgb, var(--admin-primary) 18%, transparent), transparent 28%), linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.18) 48%, transparent 68%)',
    blur: '34px',
    saturation: '1.72',
  },
  frostedGlass: {
    bg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 78%, transparent), color-mix(in srgb, var(--admin-card-bg) 68%, var(--admin-primary) 7%))',
    strongBg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 88%, transparent), color-mix(in srgb, var(--admin-card-bg) 78%, var(--admin-primary) 8%))',
    softBg: 'color-mix(in srgb, var(--admin-card-bg) 68%, transparent)',
    inputBg: 'color-mix(in srgb, var(--admin-input-bg) 82%, transparent)',
    border: 'color-mix(in srgb, var(--admin-card-border) 48%, rgba(255,255,255,0.76))',
    shadow: '0 18px 48px rgba(15,23,42,0.09), inset 0 1px 0 rgba(255,255,255,0.70)',
    shadowHover: '0 25px 66px rgba(15,23,42,0.13), inset 0 1px 0 rgba(255,255,255,0.82)',
    highlight: 'rgba(255,255,255,0.78)',
    overlay: 'linear-gradient(145deg, rgba(255,255,255,0.22), transparent 52%), radial-gradient(circle at 82% 8%, color-mix(in srgb, var(--admin-primary) 10%, transparent), transparent 35%)',
    blur: '42px',
    saturation: '1.18',
  },
  pearl: {
    bg: 'radial-gradient(circle at 18% 6%, rgba(255,255,255,0.78), transparent 34%), linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 88%, #f5eaff 12%), color-mix(in srgb, var(--admin-card-bg) 82%, #e6f6ff 18%))',
    strongBg: 'radial-gradient(circle at 16% 2%, rgba(255,255,255,0.90), transparent 35%), linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 84%, #f7e8ff 16%), color-mix(in srgb, var(--admin-card-bg) 80%, #e7f7ff 20%))',
    softBg: 'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 82%, #f7e8ff 18%), color-mix(in srgb, var(--admin-card-bg) 86%, #e7f7ff 14%))',
    inputBg: 'color-mix(in srgb, var(--admin-input-bg) 88%, #f8efff 12%)',
    border: 'color-mix(in srgb, var(--admin-card-border) 58%, rgba(255,255,255,0.82))',
    shadow: '0 20px 54px rgba(74,65,110,0.11), 0 8px 24px color-mix(in srgb, var(--admin-primary) 9%, transparent), inset 0 1px 0 rgba(255,255,255,0.88)',
    shadowHover: '0 28px 72px rgba(74,65,110,0.16), 0 12px 32px color-mix(in srgb, var(--admin-primary) 14%, transparent), inset 0 1px 0 #ffffff',
    highlight: 'rgba(255,255,255,0.92)',
    overlay: 'linear-gradient(112deg, transparent 15%, rgba(255,225,246,0.22) 38%, rgba(222,246,255,0.30) 58%, transparent 82%)',
    blur: '18px',
    saturation: '1.34',
  },
  solidPremium: {
    bg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 97%, var(--admin-primary) 3%), var(--admin-card-bg))',
    strongBg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 94%, var(--admin-primary) 6%), var(--admin-card-bg))',
    softBg: 'color-mix(in srgb, var(--admin-card-bg) 96%, var(--admin-primary) 4%)',
    inputBg: 'var(--admin-input-bg)',
    border: 'var(--admin-card-border)',
    shadow: '0 14px 36px rgba(15,23,42,0.10), 0 4px 12px color-mix(in srgb, var(--admin-primary) 7%, transparent)',
    shadowHover: '0 20px 48px rgba(15,23,42,0.15), 0 8px 18px color-mix(in srgb, var(--admin-primary) 10%, transparent)',
    highlight: 'rgba(255,255,255,0.34)',
    overlay: 'linear-gradient(145deg, rgba(255,255,255,0.08), transparent 45%)',
    blur: '0px',
    saturation: '1',
  },
  minimal: {
    bg: 'color-mix(in srgb, var(--admin-card-bg) 96%, transparent)',
    strongBg: 'var(--admin-card-bg)',
    softBg: 'color-mix(in srgb, var(--admin-card-bg) 90%, transparent)',
    inputBg: 'var(--admin-input-bg)',
    border: 'color-mix(in srgb, var(--admin-card-border) 78%, transparent)',
    shadow: '0 1px 2px rgba(15,23,42,0.05)',
    shadowHover: '0 8px 22px rgba(15,23,42,0.08)',
    highlight: 'rgba(255,255,255,0.24)',
    overlay: 'none',
    blur: '0px',
    saturation: '1',
  },
});

export function normalizeAdminWidgetTexture(value) {
  return TEXTURE_VALUES.has(value) ? value : DEFAULT_ADMIN_WIDGET_TEXTURE;
}

export function applyAdminWidgetTexture(value) {
  const texture = normalizeAdminWidgetTexture(value);
  const tokens = TEXTURE_TOKENS[texture];
  const root = document.documentElement;

  root.dataset.adminWidgetTexture = texture;
  root.style.setProperty('--admin-widget-surface-bg', tokens.bg);
  root.style.setProperty('--admin-widget-surface-strong-bg', tokens.strongBg);
  root.style.setProperty('--admin-widget-surface-soft-bg', tokens.softBg);
  root.style.setProperty('--admin-widget-input-bg', tokens.inputBg);
  root.style.setProperty('--admin-widget-surface-border', tokens.border);
  root.style.setProperty('--admin-widget-surface-shadow', tokens.shadow);
  root.style.setProperty('--admin-widget-surface-shadow-hover', tokens.shadowHover);
  root.style.setProperty('--admin-widget-surface-highlight', tokens.highlight);
  root.style.setProperty('--admin-widget-surface-overlay', tokens.overlay);
  root.style.setProperty('--admin-widget-surface-blur', tokens.blur);
  root.style.setProperty('--admin-widget-surface-saturation', tokens.saturation);

  return texture;
}
