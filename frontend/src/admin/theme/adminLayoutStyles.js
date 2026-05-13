// src/admin/theme/adminLayoutStyles.js

export function applyAdminLayoutStyles(theme = {}) {
  const root = document.documentElement;

  const rawLayout = theme.layout && typeof theme.layout === 'object'
    ? theme.layout
    : {};

  const layout = {
    radius: rawLayout.radius ?? theme.radius ?? 24,
    blur: rawLayout.blur ?? theme.blur ?? 20,
    shadow: rawLayout.shadow ?? theme.shadow ?? '0 20px 60px rgba(0,0,0,0.07)',
    sidebarWidth: rawLayout.sidebarWidth ?? theme.sidebarWidth ?? 256,
    headerHeight: rawLayout.headerHeight ?? theme.headerHeight ?? 72,
    density: rawLayout.density ?? theme.density ?? 'comfortable',
    padding: rawLayout.padding ?? theme.padding,
    gap: rawLayout.gap ?? theme.gap,
  };

  root.style.setProperty('--admin-radius', `${layout.radius}px`);
  root.style.setProperty('--admin-blur', `${layout.blur}px`);
  root.style.setProperty('--admin-shadow', layout.shadow);
  root.style.setProperty('--admin-sidebar-width', `${layout.sidebarWidth}px`);
  root.style.setProperty('--admin-header-height', `${layout.headerHeight}px`);

  const densityPadding =
    layout.density === 'compact'
      ? 10
      : layout.density === 'spacious'
        ? 22
        : 16;

  const densityGap =
    layout.density === 'compact'
      ? 10
      : layout.density === 'spacious'
        ? 22
        : 16;

  root.style.setProperty(
    '--admin-padding',
    `${Number(layout.padding ?? densityPadding)}px`
  );

  root.style.setProperty(
    '--admin-gap',
    `${Number(layout.gap ?? densityGap)}px`
  );

  root.style.setProperty(
    '--admin-shadow-sm',
    rawLayout.shadowSm ?? '0 4px 14px rgba(0,0,0,0.08)'
  );

  root.style.setProperty(
    '--admin-shadow-md',
    rawLayout.shadowMd ?? '0 8px 28px rgba(0,0,0,0.12)'
  );

  root.style.setProperty(
    '--admin-shadow-active',
    rawLayout.shadowActive ?? '0 8px 24px rgba(0,0,0,0.12)'
  );

  root.style.setProperty(
    '--admin-shadow-header',
    rawLayout.shadowHeader ?? '0 8px 32px rgba(0,0,0,0.06)'
  );

  root.style.setProperty(
    '--admin-shadow-content',
    rawLayout.shadowContent ?? '0 16px 48px rgba(0,0,0,0.06)'
  );

  root.style.setProperty(
    '--admin-shadow-modal',
    rawLayout.shadowModal ?? '0 32px 80px rgba(0,0,0,0.18)'
  );

  root.style.setProperty(
    '--admin-shadow-badge',
    rawLayout.shadowBadge ?? '0 2px 8px rgba(0,0,0,0.18)'
  );

  /* =========================
     🔥 NUEVO: VARIABLES GLASS REALES
     ========================= */

  root.style.setProperty(
    '--admin-glass-blur',
    `${Math.max(layout.blur, 18)}px`
  );

  root.style.setProperty(
    '--admin-glass-border',
    'color-mix(in srgb, var(--admin-card-border) 60%, transparent)'
  );

  root.style.setProperty(
    '--admin-glass-highlight',
    'rgba(255,255,255,0.35)'
  );

  root.style.setProperty(
    '--admin-glass-shadow',
    '0 18px 50px rgba(0,0,0,0.10)'
  );

  root.style.setProperty(
    '--admin-glass-shadow-hover',
    '0 28px 80px rgba(0,0,0,0.18)'
  );

  root.style.setProperty(
    '--admin-glass-soft-bg',
    'color-mix(in srgb, var(--admin-card-bg) 70%, transparent)'
  );

  root.style.setProperty(
    '--admin-glass-strong-bg',
    'color-mix(in srgb, var(--admin-card-bg) 85%, transparent)'
  );

  root.style.setProperty(
    '--admin-page-glass-overlay',
    'linear-gradient(180deg, transparent, rgba(0,0,0,0.04))'
  );
}