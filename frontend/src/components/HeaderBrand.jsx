import { useEffect, useState } from 'react';

export default function HeaderBrand({ src, alternateSrc, style, className = '', onUnavailable }) {
  const [failed, setFailed] = useState([]);
  useEffect(() => setFailed([]), [src, alternateSrc]);
  const sources = [...new Set([src, alternateSrc].filter(Boolean))];
  const active = sources.find((source) => !failed.includes(source));

  if (!active) {
    return <span className={`header-brand-text ${className}`} style={style} role="img" aria-label="Rosa Boutique">Rosa <small>Boutique</small></span>;
  }

  return <img src={active} alt="Logo Rosa Boutique" style={style} className={className}
    onError={() => {
      setFailed((previous) => previous.includes(active) ? previous : [...previous, active]);
      onUnavailable?.(active);
    }} />;
}
