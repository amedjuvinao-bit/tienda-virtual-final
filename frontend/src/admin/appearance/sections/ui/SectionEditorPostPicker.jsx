import React from 'react';
import './sectionEditorSteps.css';

export default function SectionEditorPostPicker({ posts, activeIndex, onSelect, label, itemName = 'publicación' }) {
  if (!posts.length) return <p className="section-post-picker__empty">Agrega una {itemName} para comenzar.</p>;
  return (
    <nav className="section-post-picker" aria-label={`Elegir ${itemName} de ${label}`}>
      {posts.map((post, index) => (
        <button key={post.id || index} type="button" aria-pressed={activeIndex === index}
          aria-label={`Editar ${itemName} ${index + 1}`} onClick={() => onSelect(index)}>
          {post.image || post.thumb ? <img src={post.image || post.thumb} alt="" /> : <span className="section-post-picker__placeholder">{index + 1}</span>}
          <span>{index + 1}{post.enabled === false ? ' · oculta' : ''}</span>
        </button>
      ))}
    </nav>
  );
}
