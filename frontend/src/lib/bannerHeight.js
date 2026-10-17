export const BANNER_HEIGHT_DEVICES = Object.freeze({
  desktop: { label: 'Escritorio', modeKey: 'heightMode', heightKey: 'heightPx', defaultMode: 'auto', defaultHeight: 520 },
  tablet: { label: 'Tableta', modeKey: 'tabletHeightMode', heightKey: 'tabletHeightPx', defaultMode: 'fullscreen', defaultHeight: 1180 },
  mobile: { label: 'Móvil', modeKey: 'mobileHeightMode', heightKey: 'mobileHeightPx', defaultMode: 'fullscreen', defaultHeight: 844 },
});

export function getBannerHeightSettings(banner, device) {
  const settings = BANNER_HEIGHT_DEVICES[device] || BANNER_HEIGHT_DEVICES.desktop;
  const raw = Number(banner?.[settings.heightKey]);
  return {
    ...settings,
    mode: banner?.[settings.modeKey] === 'auto' ? 'auto' : banner?.[settings.modeKey] === 'fullscreen' ? 'fullscreen' : settings.defaultMode,
    heightPx: banner?.[settings.heightKey] !== null && banner?.[settings.heightKey] !== undefined && Number.isFinite(raw)
      ? Math.max(240, Math.min(1200, raw)) : settings.defaultHeight,
  };
}

export function getBannerHeightStyle(banner, device) {
  const { mode, heightPx } = getBannerHeightSettings(banner, device);
  return { height: mode === 'fullscreen' ? (device === 'desktop' ? '100vh' : '100dvh') : `${heightPx}px` };
}
