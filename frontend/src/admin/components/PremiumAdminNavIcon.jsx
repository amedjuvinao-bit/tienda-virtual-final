import React from 'react';

const TONE_STYLES = {
  violet: { '--nav-icon-a': '#a855f7', '--nav-icon-b': '#5b21b6', '--nav-icon-glow': 'rgba(168, 85, 247, .42)' },
  sapphire: { '--nav-icon-a': '#38bdf8', '--nav-icon-b': '#1d4ed8', '--nav-icon-glow': 'rgba(56, 189, 248, .42)' },
  amber: { '--nav-icon-a': '#fbbf24', '--nav-icon-b': '#d97706', '--nav-icon-glow': 'rgba(251, 191, 36, .42)' },
  magenta: { '--nav-icon-a': '#f472b6', '--nav-icon-b': '#be185d', '--nav-icon-glow': 'rgba(244, 114, 182, .42)' },
  cyan: { '--nav-icon-a': '#22d3ee', '--nav-icon-b': '#0e7490', '--nav-icon-glow': 'rgba(34, 211, 238, .40)' },
  coral: { '--nav-icon-a': '#fb7185', '--nav-icon-b': '#c2410c', '--nav-icon-glow': 'rgba(251, 113, 133, .40)' },
  emerald: { '--nav-icon-a': '#34d399', '--nav-icon-b': '#047857', '--nav-icon-glow': 'rgba(52, 211, 153, .40)' },
  gold: { '--nav-icon-a': '#fde047', '--nav-icon-b': '#b45309', '--nav-icon-glow': 'rgba(253, 224, 71, .40)' },
  ruby: { '--nav-icon-a': '#fb7185', '--nav-icon-b': '#9f1239', '--nav-icon-glow': 'rgba(244, 63, 94, .42)' },
  teal: { '--nav-icon-a': '#2dd4bf', '--nav-icon-b': '#0f766e', '--nav-icon-glow': 'rgba(45, 212, 191, .40)' },
  indigo: { '--nav-icon-a': '#818cf8', '--nav-icon-b': '#4338ca', '--nav-icon-glow': 'rgba(129, 140, 248, .42)' },
  rose: { '--nav-icon-a': '#fb7185', '--nav-icon-b': '#db2777', '--nav-icon-glow': 'rgba(251, 113, 133, .42)' },
  prism: { '--nav-icon-a': '#e879f9', '--nav-icon-b': '#7c3aed', '--nav-icon-glow': 'rgba(232, 121, 249, .42)' },
  sky: { '--nav-icon-a': '#60a5fa', '--nav-icon-b': '#0369a1', '--nav-icon-glow': 'rgba(96, 165, 250, .40)' },
  graphite: { '--nav-icon-a': '#94a3b8', '--nav-icon-b': '#475569', '--nav-icon-glow': 'rgba(148, 163, 184, .36)' },
};

export default function PremiumAdminNavIcon({ icon: Icon, tone = 'violet', compact = false }) {
  return (
    <span
      className={`admin-premium-nav-icon${compact ? ' admin-premium-nav-icon--compact' : ''}`}
      style={TONE_STYLES[tone] || TONE_STYLES.violet}
      aria-hidden="true"
    >
      <span className="admin-premium-nav-icon__halo" />
      <span className="admin-premium-nav-icon__gem">
        <Icon strokeWidth={2.15} />
      </span>
      <span className="admin-premium-nav-icon__spark" />
    </span>
  );
}
