// frontend/src/admin/dashboard/dashboardStyles.js

const GLASS_BORDER = '1px solid rgba(255, 255, 255, 0.68)';
const SOFT_SHADOW = '0 18px 45px rgba(148, 68, 92, 0.10), inset 0 1px 0 rgba(255,255,255,0.78)';
const CARD_BG = 'linear-gradient(145deg, rgba(255,255,255,0.78), rgba(255,245,248,0.62))';

export const dashboardStyles = {
  page: {
    color: 'var(--admin-card-text)',
  },

  shell: {
    borderRadius: '28px',
    border: GLASS_BORDER,
    background: 'linear-gradient(145deg, rgba(255,255,255,0.48), rgba(255,238,244,0.42))',
    boxShadow: '0 26px 80px rgba(148,68,92,0.12), inset 0 1px 0 rgba(255,255,255,0.72)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  },

  hero: {
    borderRadius: '24px',
    border: GLASS_BORDER,
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.20) 48%, rgba(255,255,255,0.12) 100%)',
    boxShadow:
      '0 10px 28px rgba(148,68,92,0.10), inset 0 1px 0 rgba(255,255,255,0.84), inset 0 -18px 34px rgba(255,255,255,0.08)',
    backdropFilter: 'blur(26px) saturate(170%)',
    WebkitBackdropFilter: 'blur(26px) saturate(170%)',
    overflow: 'hidden',
  },

  heroGlassLayer: {
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.06) 52%, rgba(255,255,255,0.10))',
  },

  heroTopLight: {
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
    opacity: 0.92,
  },

  heroShine: {
    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 24%, rgba(255,255,255,0.64) 48%, rgba(255,255,255,0.16) 68%, transparent 100%)',
    filter: 'blur(0.2px)',
    opacity: 0.78,
  },

  heroIcon: {
    border: '1px solid rgba(255,255,255,0.60)',
    background: 'linear-gradient(145deg, rgba(255,255,255,0.42), rgba(255,255,255,0.14))',
    color: 'var(--admin-primary)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.78), 0 8px 18px rgba(148,68,92,0.08)',
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
  },

  heroDecorPanel: {
    border: '1px solid rgba(255,255,255,0.50)',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.22), rgba(255,255,255,0.08))',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.74), 0 10px 24px rgba(148,68,92,0.08)',
    backdropFilter: 'blur(24px) saturate(170%)',
    WebkitBackdropFilter: 'blur(24px) saturate(170%)',
  },

  heroDecorGlass: {
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.12))',
  },

  heroDecorTopLight: {
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.88), transparent)',
    opacity: 0.88,
  },

  heroDecorShine: {
    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 24%, rgba(255,255,255,0.60) 48%, rgba(255,255,255,0.14) 68%, transparent 100%)',
    opacity: 0.78,
  },

  heroDecorLineStrong: {
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.58), rgba(255,255,255,0.24), transparent)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.38)',
  },

  heroDecorLineSoft: {
    background:
      'linear-gradient(90deg, rgba(255,255,255,0.40), rgba(255,255,255,0.14), transparent)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
  },

  heroDecorFloatingCard: {
    border: '1px solid rgba(255,255,255,0.48)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.28), rgba(255,255,255,0.08))',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.72), 0 8px 18px rgba(148,68,92,0.07)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  },

  heroDecorProgressTrack: {
    display: 'block',
    overflow: 'hidden',
    background: 'rgba(255,255,255,0.18)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
  },

  heroDecorProgressFill: {
    background:
      'linear-gradient(90deg, var(--admin-primary), color-mix(in srgb, var(--admin-primary, #db2777) 42%, white))',
    boxShadow: '0 0 12px rgba(148,68,92,0.16)',
  },

  heroDecorSparkle: {
    color: 'rgba(255,255,255,0.88)',
    textShadow: '0 0 10px rgba(255,255,255,0.35)',
  },

  card: {
    borderRadius: '24px',
    border: GLASS_BORDER,
    background: CARD_BG,
    boxShadow: SOFT_SHADOW,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  },

  compactCard: {
    borderRadius: '22px',
    border: GLASS_BORDER,
    background: CARD_BG,
    boxShadow: '0 14px 34px rgba(148,68,92,0.09), inset 0 1px 0 rgba(255,255,255,0.80)',
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  },

  kpiRow: {
    background: 'transparent',
  },

  kpiRowBackdrop: {
    background: 'transparent',
    filter: 'none',
    opacity: 0,
  },

  kpiFrame: {
    border: '1px solid rgba(255,255,255,0.62)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.72), rgba(255,255,255,0.18) 48%, rgba(255,236,245,0.18))',
    boxShadow:
      '0 10px 30px rgba(190,132,160,0.12), 0 2px 10px rgba(148,68,92,0.05), inset 0 1px 0 rgba(255,255,255,0.78)',
    backdropFilter: 'blur(22px) saturate(160%)',
    WebkitBackdropFilter: 'blur(22px) saturate(160%)',
  },

  kpiGlass: {
    border: '1px solid rgba(255,255,255,0.44)',
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.24) 42%, rgba(255,239,247,0.18) 100%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.86), inset 0 -18px 34px rgba(255,255,255,0.08), inset 0 0 24px rgba(255,255,255,0.10)',
    backdropFilter: 'blur(26px) saturate(175%)',
    WebkitBackdropFilter: 'blur(26px) saturate(175%)',
  },

  kpiInnerBorder: {
    border: '1px solid rgba(255,255,255,0.30)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
  },

  kpiTopLight: {
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.98), transparent)',
    opacity: 0.95,
  },

  kpiCornerHighlight: {
    background:
      'linear-gradient(135deg, rgba(255,255,255,0.52), rgba(255,255,255,0.16) 38%, transparent 72%)',
  },

  kpiShine: {
    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 24%, rgba(255,255,255,0.86) 48%, rgba(255,255,255,0.18) 68%, transparent 100%)',
    filter: 'blur(0.2px)',
    opacity: 0.92,
  },

  kpiGlow: {
    background:
      'radial-gradient(ellipse, rgba(255,255,255,0.64) 0%, rgba(255,255,255,0.18) 42%, transparent 72%)',
    filter: 'blur(4px)',
    opacity: 0.82,
  },

  chartCard: {
    borderRadius: '24px',
    border: GLASS_BORDER,
    background: CARD_BG,
    boxShadow: SOFT_SHADOW,
    backdropFilter: 'blur(18px)',
    WebkitBackdropFilter: 'blur(18px)',
  },

  title: {
    color: 'var(--admin-card-text)',
  },

  muted: {
    color: 'var(--admin-card-muted-text)',
  },

  eyebrow: {
    color: 'var(--admin-primary)',
  },

  actionButton: {
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.76)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.82), rgba(255,241,246,0.70))',
    color: 'var(--admin-card-text)',
    boxShadow: '0 10px 24px rgba(148,68,92,0.08), inset 0 1px 0 rgba(255,255,255,0.86)',
  },

  primaryChip: {
    borderRadius: '999px',
    border: '1px solid rgba(255,255,255,0.78)',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.86), rgba(255,237,244,0.74))',
    color: 'var(--admin-primary)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88)',
  },

  kpiIconChip: {
    border: '1px solid rgba(255,255,255,0.52)',
    backdropFilter: 'blur(18px) saturate(165%)',
    WebkitBackdropFilter: 'blur(18px) saturate(165%)',
  },

  kpiIcon: {
    color: '#ffffff',
  },

  warningIcon: {
    color: '#ffffff',
  },

  kpiTitle: {
    color: 'var(--admin-card-text)',
    textShadow: '0 1px 0 rgba(255,255,255,0.62)',
  },

  kpiValue: {
    color: 'var(--admin-card-text)',
    textShadow: '0 1px 0 rgba(255,255,255,0.68)',
  },

  kpiTrendArrow: {
    color: 'var(--admin-primary)',
  },

  kpiTrendText: {
    color: '#22c55e',
    textShadow: '0 1px 0 rgba(255,255,255,0.78)',
  },

  kpiHelperText: {
    color: 'var(--admin-card-muted-text)',
    textShadow: '0 1px 0 rgba(255,255,255,0.68)',
  },

  kpiWarningMark: {
    color: 'var(--admin-primary)',
  },

  kpiWarningText: {
    color: 'var(--admin-primary)',
    textShadow: '0 1px 0 rgba(255,255,255,0.78)',
  },

  alertItem: {
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.74)',
    background: 'rgba(255,255,255,0.58)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.76)',
  },

  progressTrack: {
    borderRadius: '999px',
    background: 'rgba(15,23,42,0.08)',
  },

  progressFill: {
    borderRadius: '999px',
    background: 'linear-gradient(90deg, #f9a8d4, var(--admin-primary))',
    boxShadow: '0 8px 18px rgba(219,39,119,0.20)',
  },

  statusSuccess: {
    borderRadius: '999px',
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#15803d',
    border: '1px solid rgba(34, 197, 94, 0.20)',
  },

  statusWarning: {
    borderRadius: '999px',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#b45309',
    border: '1px solid rgba(245, 158, 11, 0.20)',
  },

  statusInfo: {
    borderRadius: '999px',
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#1d4ed8',
    border: '1px solid rgba(59, 130, 246, 0.20)',
  },

  statusDanger: {
    borderRadius: '999px',
    background: 'rgba(244, 63, 94, 0.12)',
    color: '#be123c',
    border: '1px solid rgba(244, 63, 94, 0.20)',
  },
};