import { ORDER_DETAIL_THEME } from './orderDetailTheme';

export function planField(label, control) {
  return (
    <label style={{ display: 'grid', gap: 5, minWidth: 0 }}>
      <span style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900 }}>
        {label}
      </span>
      {control}
    </label>
  );
}

export function SummaryCard({ label, value, tone = 'default' }) {
  const tones = {
    default: ['var(--admin-card-bg)', 'var(--admin-card-text)'],
    primary: ['var(--admin-primary-soft-bg)', 'var(--admin-primary)'],
    warning: ['#fff7ed', '#c2410c'],
    danger: ['#fff1f2', '#be123c'],
    success: ['#ecfdf5', '#047857'],
  };
  const [background, color] = tones[tone] || tones.default;
  return (
    <div
      style={{
        border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
        borderRadius: 16,
        padding: '11px 12px',
        background,
        minWidth: 0,
      }}
    >
      <div style={{ color: ORDER_DETAIL_THEME.mutedText, fontSize: 9, fontWeight: 900, letterSpacing: '.12em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ marginTop: 5, color, fontSize: 18, fontWeight: 950 }}>
        {value}
      </div>
    </div>
  );
}

export function inputStyle() {
  return {
    border: `1px solid ${ORDER_DETAIL_THEME.cardBorder}`,
    borderRadius: 10,
    minHeight: 38,
    padding: '0 10px',
    background: ORDER_DETAIL_THEME.cardBg,
    color: ORDER_DETAIL_THEME.cardText,
    fontSize: 11,
    fontWeight: 700,
  };
}

export function primaryButtonStyle() {
  return { border: 0, borderRadius: 12, minHeight: 38, padding: '0 14px', background: 'var(--admin-primary)', color: '#fff', fontSize: 11, fontWeight: 900, cursor: 'pointer' };
}

export function secondaryButtonStyle() {
  return { border: '1px solid var(--admin-primary)', borderRadius: 12, minHeight: 36, padding: '0 12px', background: 'var(--admin-primary-soft-bg)', color: 'var(--admin-primary)', fontSize: 10, fontWeight: 900, cursor: 'pointer' };
}

export function dangerButtonStyle() {
  return { border: '1px solid #fecdd3', borderRadius: 10, minHeight: 38, padding: '0 12px', background: '#fff1f2', color: '#be123c', fontSize: 10, fontWeight: 900, cursor: 'pointer' };
}
