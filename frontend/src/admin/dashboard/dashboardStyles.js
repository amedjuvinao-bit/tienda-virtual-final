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
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.78)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.96), rgba(255,239,246,0.42) 50%, rgba(255,255,255,0.88))',
    boxShadow:
      '0 16px 30px rgba(148,68,92,0.10), 0 5px 12px rgba(148,68,92,0.05), inset 0 1px 0 rgba(255,255,255,0.98)',
    backdropFilter: 'blur(18px)',
  },

  kpiGlass: {
    border: '1.5px solid rgba(255,255,255,0.86)',
    background:
      'linear-gradient(136deg, rgba(255,255,255,0.66) 0%, rgba(255,248,251,0.48) 50%, rgba(255,238,245,0.32) 100%)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.94), inset 0 -20px 38px rgba(255,255,255,0.18), inset 0 0 28px rgba(255,255,255,0.22)',
    backdropFilter: 'blur(22px) saturate(140%)',
  },

  kpiInnerBorder: {
    border: '1px solid rgba(255,255,255,0.46)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
  },

  kpiTopLight: {
    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.96), transparent)',
  },

  kpiShine: {
    background:
      'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 28%, rgba(255,255,255,0.82) 50%, rgba(255,255,255,0.16) 70%, transparent 100%)',
    filter: 'blur(0.45px)',
    opacity: 0.82,
  },

  kpiGlow: {
    background: 'radial-gradient(circle, rgba(236,72,153,0.22) 0%, transparent 68%)',
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
    border: '1.5px solid rgba(255,255,255,0.82)',
    background:
      'radial-gradient(circle at 26% 20%, rgba(255,255,255,0.98), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.68), rgba(255,241,248,0.44))',
    color: 'var(--admin-primary)',
    boxShadow:
      '0 11px 20px rgba(219,39,119,0.14), inset 0 1px 0 rgba(255,255,255,0.96), inset 0 -10px 20px rgba(219,39,119,0.07)',
    backdropFilter: 'blur(14px)',
  },

  warningIcon: {
    border: '1.5px solid rgba(255,255,255,0.84)',
    background:
      'radial-gradient(circle at 26% 20%, rgba(255,255,255,0.98), transparent 34%), linear-gradient(145deg, rgba(255,255,255,0.70), rgba(255,247,225,0.46))',
    color: '#f59e0b',
    boxShadow:
      '0 11px 20px rgba(251,146,60,0.14), inset 0 1px 0 rgba(255,255,255,0.96), inset 0 -10px 20px rgba(245,158,11,0.07)',
    backdropFilter: 'blur(14px)',
  },

  kpiTrendArrow: {
    color: '#ea8a2f',
  },

  kpiTrendText: {
    color: '#4fbd72',
    textShadow: '0 1px 0 rgba(255,255,255,0.72)',
  },

  kpiHelperText: {
    color: 'rgba(15,23,42,0.76)',
    textShadow: '0 1px 0 rgba(255,255,255,0.62)',
  },

  kpiWarningMark: {
    color: '#f59e0b',
  },

  kpiWarningText: {
    color: 'var(--admin-primary)',
    textShadow: '0 1px 0 rgba(255,255,255,0.72)',
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
