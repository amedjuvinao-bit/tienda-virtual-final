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
    radius: '22px',
    controlRadius: '14px',
    borderWidth: '1px',
    buttonBg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 60%, transparent), color-mix(in srgb, var(--admin-primary) 12%, transparent))',
    buttonOverlay: 'linear-gradient(135deg, rgba(255,255,255,0.34), transparent 48%)',
    buttonShadow: '0 12px 28px color-mix(in srgb, var(--admin-primary) 16%, transparent), inset 0 1px 0 rgba(255,255,255,0.62)',
    textureFilter: 'none',
  },
  liquidGlass: {
    // Clean mirror glass: transparent tint and edge reflections without
    // metallic bands that can read as grey stains on pale themes.
    bg: 'linear-gradient(180deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.15) 42%, color-mix(in srgb, var(--admin-primary) 8%, rgba(255,255,255,0.10)) 100%)',
    strongBg: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.19) 42%, color-mix(in srgb, var(--admin-primary) 10%, rgba(255,255,255,0.12)) 100%)',
    softBg: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.10) 58%, color-mix(in srgb, var(--admin-primary) 6%, rgba(255,255,255,0.07)) 100%)',
    inputBg: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.12) 64%, color-mix(in srgb, var(--admin-primary) 5%, rgba(255,255,255,0.08)))',
    border: 'rgba(255,255,255,0.90)',
    shadow: '0 14px 34px color-mix(in srgb, var(--admin-primary) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.98), inset 0 -1px 0 color-mix(in srgb, var(--admin-primary) 12%, transparent)',
    shadowHover: '0 20px 46px color-mix(in srgb, var(--admin-primary) 18%, transparent), inset 0 1px 0 #ffffff, inset 0 -1px 0 color-mix(in srgb, var(--admin-primary) 16%, transparent)',
    highlight: 'rgba(255,255,255,0.95)',
    overlay: 'linear-gradient(180deg, rgba(255,255,255,0.42) 0%, rgba(255,255,255,0.12) 13%, transparent 32%, transparent 100%)',
    blur: '9px',
    saturation: '1.18',
    backdropContrast: '1.04',
    innerBorder: 'rgba(255,255,255,0.52)',
    innerBorderOffset: '-4px',
    pageWashOpacity: '0',
    radius: '30px',
    controlRadius: '19px',
    borderWidth: '1px',
    buttonBg: 'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.13) 58%, color-mix(in srgb, var(--admin-primary) 10%, rgba(255,255,255,0.08)))',
    buttonOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.44), rgba(255,255,255,0.08) 28%, transparent 60%)',
    buttonShadow: '0 10px 24px color-mix(in srgb, var(--admin-primary) 18%, transparent), inset 0 1px 0 rgba(255,255,255,0.96), inset 0 -1px 0 color-mix(in srgb, var(--admin-primary) 16%, transparent)',
    textureFilter: 'none',
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
    radius: '20px',
    controlRadius: '12px',
    borderWidth: '1px',
    buttonBg: 'color-mix(in srgb, var(--admin-card-bg) 76%, transparent)',
    buttonOverlay: 'linear-gradient(145deg, rgba(255,255,255,0.48), transparent 64%)',
    buttonShadow: '0 8px 20px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.78)',
    textureFilter: 'saturate(.86)',
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
    radius: '26px',
    controlRadius: '18px',
    borderWidth: '1px',
    buttonBg: 'linear-gradient(125deg, color-mix(in srgb, var(--admin-card-bg) 80%, #ffe8f6 20%), color-mix(in srgb, var(--admin-card-bg) 78%, #e2f6ff 22%))',
    buttonOverlay: 'linear-gradient(112deg, transparent 12%, rgba(255,225,246,0.44) 42%, rgba(220,246,255,0.50) 62%, transparent 88%)',
    buttonShadow: '0 14px 30px rgba(88,70,120,0.16), inset 0 1px 0 #ffffff',
    textureFilter: 'saturate(1.08)',
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
    radius: '14px',
    controlRadius: '10px',
    borderWidth: '1px',
    buttonBg: 'linear-gradient(145deg, color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 10%), var(--admin-card-bg))',
    buttonOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.14), transparent 56%)',
    buttonShadow: '0 9px 18px rgba(15,23,42,0.16), inset 0 1px 0 rgba(255,255,255,0.30)',
    textureFilter: 'contrast(1.02)',
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
    radius: '6px',
    controlRadius: '5px',
    borderWidth: '1px',
    buttonBg: 'var(--admin-card-bg)',
    buttonOverlay: 'none',
    buttonShadow: 'none',
    textureFilter: 'none',
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
  root.style.setProperty('--admin-widget-surface-contrast', tokens.backdropContrast ?? '1');
  root.style.setProperty('--admin-widget-surface-radius', tokens.radius);
  root.style.setProperty('--admin-widget-control-radius', tokens.controlRadius);
  root.style.setProperty('--admin-widget-surface-border-width', tokens.borderWidth);
  root.style.setProperty('--admin-widget-button-bg', tokens.buttonBg);
  root.style.setProperty('--admin-widget-button-overlay', tokens.buttonOverlay);
  root.style.setProperty('--admin-widget-button-shadow', tokens.buttonShadow);
  root.style.setProperty('--admin-widget-texture-filter', tokens.textureFilter);
  root.style.setProperty('--admin-widget-inner-border', tokens.innerBorder ?? 'transparent');
  root.style.setProperty('--admin-widget-inner-border-offset', tokens.innerBorderOffset ?? '0px');
  root.style.setProperty('--admin-widget-page-wash-opacity', tokens.pageWashOpacity ?? '0.72');

  return texture;
}
