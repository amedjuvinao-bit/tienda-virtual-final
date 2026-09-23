import React from 'react';

export default function PremiumAdminNavIcon({ icon: Icon, compact = false }) {
  return (
    <span
      className={`admin-premium-nav-icon${compact ? ' admin-premium-nav-icon--compact' : ''}`}
      aria-hidden="true"
    >
      <span className="admin-premium-nav-icon__halo" />
      <span className="admin-premium-nav-icon__glass" />
      <span className="admin-premium-nav-icon__tint" />
      <Icon className="admin-premium-nav-icon__glyph" strokeWidth={1.65} />
      <span className="admin-premium-nav-icon__shine" />
    </span>
  );
}
