// frontend/src/admin/dashboard/dashboardStyles.js

const GLASS_BORDER = '1px solid rgba(255, 255, 255, 0.72)';
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
  },

  hero: {
    borderRadius: '26px',
    border: GLASS_BORDER,
    background:
      'linear-gradient(105deg, rgba(255,255,255,0.86) 0%, rgba(255,246,249,0.82) 48%, rgba(255,231,238,0.70) 100%)',
    boxShadow: SOFT_SHADOW,
    backdropFilter: 'blur(20px)',
    overflow: 'hidden',
  },

  card: {
    borderRadius: '24px',
    border: GLASS_BORDER,
    background: CARD_BG,
    boxShadow: SOFT_SHADOW,
    backdropFilter: 'blur(18px)',
  },

  compactCard: {
    borderRadius: '22px',
    border: GLASS_BORDER,
    background: CARD_BG,
    boxShadow: '0 14px 34px rgba(148,68,92,0.09), inset 0 1px 0 rgba(255,255,255,0.80)',
    backdropFilter: 'blur(18px)',
  },

  kpiFrame: {
    borderRadius: '26px',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(255,213,229,0.38) 48%, rgba(255,255,255,0.70))',
    boxShadow:
      '0 18px 34px rgba(148,68,92,0.11), 0 4px 12px rgba(148,68,92,0.06), inset 0 1px 0 rgba(255,255,255,0.96)',
  },

  kpiGlass: {
    border: '1px solid rgba(255,255,255,0.82)',
    background:
      'linear-gradient(138deg, rgba(255,255,255,0.74) 0%, rgba(255,247,250,0.66) 47%, rgba(255,231,240,0.46) 100%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.96), inset 0 -24px 46px rgba(255,255,255,0.26), inset 0 0 28px rgba(255,255,255,0.26)',
    backdropFilter: 'blur(22px) saturate(135%)',
  },

  kpiTopLight: {
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)',
  },

  kpiShine: {
    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.32) 38%, rgba(255,255,255,0.76) 50%, rgba(255,255,255,0.26) 62%, transparent 100%)',
    filter: 'blur(0.4px)',
    opacity: 0.74,
  },

  kpiGlow: {
    background:
      'radial-gradient(circle, color-mix(in srgb, var(--admin-primary) 24%, transparent) 0%, transparent 68%)',
    filter: 'blur(2px)',
    opacity: 0.62,
  },

  chartCard: {
    borderRadius: '24px',
    border: GLASS_BORDER,
    background: CARD_BG,
    boxShadow: SOFT_SHADOW,
    backdropFilter: 'blur(18px)',
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

  kpiIcon: {
    border: '1px solid rgba(255,255,255,0.86)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.90), rgba(255,240,246,0.72)), radial-gradient(circle at 30% 20%, rgba(255,255,255,0.96), transparent 38%)',
    color: 'var(--admin-primary)',
    boxShadow:
      '0 13px 28px rgba(219,39,119,0.16), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -10px 18px rgba(219,39,119,0.07)',
  },

  warningIcon: {
    border: '1px solid rgba(255,255,255,0.88)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.92), rgba(255,247,222,0.74)), radial-gradient(circle at 30% 20%, rgba(255,255,255,0.96), transparent 38%)',
    color: '#f59e0b',
    boxShadow:
      '0 13px 28px rgba(251,146,60,0.17), inset 0 1px 0 rgba(255,255,255,0.95), inset 0 -10px 18px rgba(245,158,11,0.08)',
  },

  kpiTrendPill: {
    border: '1px solid rgba(255,255,255,0.82)',
    background: 'rgba(255,255,255,0.58)',
    color: '#16a34a',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86), 0 8px 16px rgba(22,163,74,0.08)',
  },

  kpiWarningPill: {
    border: '1px solid rgba(255,255,255,0.82)',
    background: 'rgba(255,255,255,0.62)',
    color: '#d97706',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.86), 0 8px 16px rgba(217,119,6,0.08)',
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
