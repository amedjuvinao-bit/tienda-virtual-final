import React, { useState } from 'react';
import { categoryArtwork, categoryPhotoSource } from '../admin/appearance/sections/categorias/categoriasFanHelpers';

function Photo({ src, backup, fallback, className, alt, style }) {
  const [failures, setFailures] = useState(0);
  const sources = [...new Set([src, backup].filter(Boolean))];
  const currentSrc = sources[failures];
  return <span className={`category-artwork ${className || ''}`} style={style}>
    <span className="category-artwork__fallback" aria-hidden="true" style={{
      backgroundImage: `url(${JSON.stringify(fallback.image)})`,
      backgroundSize: fallback.atlas ? '400% 100%' : 'cover', backgroundPosition: `${fallback.position} center`,
    }} />
    {currentSrc && <img src={currentSrc} alt={alt} loading="lazy" decoding="async" onError={() => setFailures((count) => count + 1)} />}
  </span>;
}
export default function CategoriaArtwork({ slide, mobile = false, className = '' }) {
  const src = categoryPhotoSource(mobile ? slide.mobileImage || slide.image : slide.image);
  const backup = mobile ? categoryPhotoSource(slide.image) : "";
  return <Photo key={`${slide.id}:${src}:${backup}`} src={src} backup={backup} fallback={categoryArtwork(slide)} className={className}
    alt={slide.imageAlt || slide.title} style={{ '--category-photo-position': `${slide.imagePositionX}% ${slide.imagePositionY}%`, '--category-photo-zoom': slide.imageScale }} />;
}
