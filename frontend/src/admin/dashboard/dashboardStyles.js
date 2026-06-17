// frontend/src/admin/dashboard/dashboardStyles.js

export const dashboardStyles = {
  page: {
    color: 'var(--admin-card-text)',
  },

  glassPanel: {
    borderRadius: 'calc(var(--admin-radius) + 10px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-card-bg) 88%, rgba(255,255,255,0.80) 12%), color-mix(in srgb, var(--admin-primary) 7%, var(--admin-card-bg) 93%))',
    boxShadow:
      '0 24px 80px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.58)',
    backdropFilter: 'blur(18px)',
  },

  hero: {
    borderRadius: 'calc(var(--admin-radius) + 14px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(105deg, rgba(255,255,255,0.86) 0%, color-mix(in srgb, var(--admin-primary) 9%, rgba(255,255,255,0.88)) 52%, rgba(255,245,248,0.92) 100%)',
    boxShadow:
      '0 26px 86px rgba(15, 23, 42, 0.10), inset 0 1px 0 rgba(255,255,255,0.70)',
    overflow: 'hidden',
  },

  heroVisual: {
    background:
      'radial-gradient(circle at 70% 42%, rgba(255,255,255,0.92), transparent 18%), radial-gradient(circle at 76% 50%, color-mix(in srgb, var(--admin-primary) 28%, transparent), transparent 34%), linear-gradient(135deg, color-mix(in srgb, var(--admin-primary) 18%, transparent), rgba(255,255,255,0.25))',
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
    border: '1px solid var(--admin-button-soft-border)',
    background:
      'linear-gradient(135deg, color-mix(in srgb, var(--admin-button-soft-bg) 86%, rgba(255,255,255,0.72) 14%), var(--admin-button-soft-bg))',
    color: 'var(--admin-button-soft-text)',
    boxShadow:
      '0 16px 34px color-mix(in srgb, var(--admin-primary) 12%, transparent), inset 0 1px 0 rgba(255,255,255,0.68)',
  },

  primaryChip: {
    borderRadius: '999px',
    border: '1px solid var(--admin-primary-soft-border)',
    background: 'var(--admin-primary-soft-bg)',
    color: 'var(--admin-primary-soft-text)',
  },

  card: {
    borderRadius: 'calc(var(--admin-radius) + 8px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.76), color-mix(in srgb, var(--admin-card-bg) 90%, var(--admin-primary) 10%))',
    boxShadow:
      '0 22px 64px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.72)',
    backdropFilter: 'blur(18px)',
  },

  kpiIcon: {
    borderRadius: '18px',
    background:
      'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.96), transparent 28%), linear-gradient(135deg, color-mix(in srgb, var(--admin-primary) 78%, #ffffff 22%), color-mix(in srgb, var(--admin-primary) 48%, #0f172a 52%))',
    color: '#ffffff',
    boxShadow:
      '0 16px 34px color-mix(in srgb, var(--admin-primary) 26%, transparent), inset 0 1px 0 rgba(255,255,255,0.50)',
  },

  warningIcon: {
    borderRadius: '18px',
    background:
      'radial-gradient(circle at 30% 22%, rgba(255,255,255,0.96), transparent 28%), linear-gradient(135deg, #fbbf24, #fb7185)',
    color: '#ffffff',
    boxShadow:
      '0 16px 34px rgba(251, 113, 133, 0.22), inset 0 1px 0 rgba(255,255,255,0.50)',
  },

  chartCard: {
    borderRadius: 'calc(var(--admin-radius) + 10px)',
    border: '1px solid var(--admin-card-border)',
    background:
      'linear-gradient(145deg, rgba(255,255,255,0.78), color-mix(in srgb, var(--admin-card-bg) 88%, var(--admin-primary) 12%))',
    boxShadow:
      '0 24px 76px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255,255,255,0.76)',
    backdropFilter: 'blur(20px)',
  },

  chartArea: {
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--admin-primary) 24%, transparent), transparent)',
  },

  softInput: {
    borderRadius: '999px',
    border: '1px solid var(--admin-card-border)',
    background: 'rgba(255,255,255,0.62)',
    color: 'var(--admin-card-text)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55)',
  },

  alertItem: {
    borderRadius: 'calc(var(--admin-radius) + 2px)',
    border: '1px solid var(--admin-card-border)',
    background: 'rgba(255,255,255,0.56)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.64)',
  },

  progressTrack: {
    borderRadius: '999px',
    background: 'color-mix(in srgb, var(--admin-card-border) 50%, rgba(255,255,255,0.70) 50%)',
  },

  progressFill: {
    borderRadius: '999px',
    background:
      'linear-gradient(90deg, color-mix(in srgb, var(--admin-primary) 72%, #ffffff 28%), var(--admin-primary))',
    boxShadow: '0 10px 22px color-mix(in srgb, var(--admin-primary) 24%, transparent)',
  },

  statusSuccess: {
    borderRadius: '999px',
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#15803d',
    border: '1px solid rgba(34, 197, 94, 0.22)',
  },

  statusWarning: {
    borderRadius: '999px',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#b45309',
    border: '1px solid rgba(245, 158, 11, 0.22)',
  },

  statusInfo: {
    borderRadius: '999px',
    background: 'rgba(59, 130, 246, 0.12)',
    color: '#1d4ed8',
    border: '1px solid rgba(59, 130, 246, 0.22)',
  },

  statusDanger: {
    borderRadius: '999px',
    background: 'rgba(244, 63, 94, 0.12)',
    color: '#be123c',
    border: '1px solid rgba(244, 63, 94, 0.22)',
  },
};