import React from 'react';

export default function PremiumAdminNavIcon({ icon: Icon, artwork, compact = false }) {
  return (
    <span
      className={`admin-premium-nav-icon${compact ? ' admin-premium-nav-icon--compact' : ''}`}
      aria-hidden="true"
    >
      <span className="admin-premium-nav-icon__halo" />
      {artwork ? (
        <span className="admin-premium-nav-icon__miniature">{artwork}</span>
      ) : (
        <Icon className="admin-premium-nav-icon__fallback" strokeWidth={2.15} />
      )}
      <span className="admin-premium-nav-icon__facet" />
    </span>
  );
}
