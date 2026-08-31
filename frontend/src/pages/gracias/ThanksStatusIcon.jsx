export default function ThanksStatusIcon({ meta, accent }) {
  if (meta.showSuccessCheck) {
    return <div className="gp-check-wrap">
      <div className="gp-pulse-ring" style={{ borderColor: accent, opacity: 0.3 }} />
      <div className="gp-check-icon" style={{
        width: 56, height: 56, borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${accent}, #d4af37)`,
        boxShadow: `0 8px 24px ${accent}44`,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>;
  }
  return <div className="gp-check-wrap">
    <div className="gp-check-icon" style={{
      width: 56, height: 56, borderRadius: '50%', display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: meta.badgeBg,
      boxShadow: `0 8px 24px ${meta.badgeText}22`,
    }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M8 8l8 8M16 8l-8 8" stroke={meta.badgeText} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  </div>;
}
