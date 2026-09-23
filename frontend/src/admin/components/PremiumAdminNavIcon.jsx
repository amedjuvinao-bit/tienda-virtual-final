import React, { useEffect, useState } from 'react';

export default function PremiumAdminNavIcon({ icon: Icon, artwork, compact = false }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [artwork]);

  const showArtwork = Boolean(artwork) && !imageFailed;

  return (
    <span
      className={`admin-premium-nav-icon${compact ? ' admin-premium-nav-icon--compact' : ''}`}
      aria-hidden="true"
    >
      <span className="admin-premium-nav-icon__halo" />
      {showArtwork ? (
        <img
          src={artwork}
          alt=""
          className="admin-premium-nav-icon__miniature"
          draggable="false"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Icon className="admin-premium-nav-icon__fallback" strokeWidth={2.15} />
      )}
    </span>
  );
}
