import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
export default function JournalLightbox({ post, onClose }) {
  const dialog = useRef(null), [index, setIndex] = useState(0);
  const slides = post.album?.length ? post.album : [{ image: post.image, videoUrl: post.videoUrl }];
  const slide = slides[index] || slides[0];
  useEffect(() => {
    const el = dialog.current, previous = document.activeElement;
    el.showModal?.();
    if (!el.open) el.setAttribute('open', '');
    return () => { el.close?.(); previous?.focus?.({ preventScroll: true }); };
  }, []);
  return <dialog className="ig-journal__lightbox" ref={dialog} aria-label={post.alt || 'Publicación en grande'} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }} onKeyDown={e => {
    if (slides.length > 1 && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); setIndex(i => (i + (e.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length); }
  }}>
    <div className="ig-journal__lightbox-content"><button type="button" className="ig-journal__lightbox-close" onClick={onClose} aria-label="Cerrar publicación"><X /></button>
      {slide.videoUrl ? <video key={`${post.id}:${index}`} src={slide.videoUrl} controls playsInline poster={slide.image} /> : <img src={slide.image} alt={post.alt || 'Publicación'} />}
      {slides.length > 1 && <nav aria-label="Fotos de esta publicación"><button type="button" onClick={() => setIndex(i => (i - 1 + slides.length) % slides.length)} aria-label="Foto anterior"><ChevronLeft /></button><span>{index + 1} / {slides.length}</span><button type="button" onClick={() => setIndex(i => (i + 1) % slides.length)} aria-label="Foto siguiente"><ChevronRight /></button></nav>}
      {post.caption && <p>{post.caption}</p>}
    </div>
  </dialog>;
}
