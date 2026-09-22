export const DEFAULT_ADMIN_PANEL_BACKGROUND = Object.freeze({
  enabled: false,
  image: '',
});

export function safeAdminPanelBackgroundUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com') return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function normalizeAdminPanelBackground(value) {
  const image = safeAdminPanelBackgroundUrl(value?.image);

  return {
    enabled: Boolean(value?.enabled && image),
    image,
  };
}

export function applyAdminPanelBackground(value) {
  const background = normalizeAdminPanelBackground(value);
  const root = document.documentElement;

  root.dataset.adminPanelBackground = background.enabled ? 'image' : 'theme';
  root.style.setProperty(
    '--admin-panel-background-image',
    background.enabled ? `url("${background.image}")` : 'none'
  );

  return background;
}
