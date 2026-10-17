import React, { useState } from 'react';
import './sectionEditorSteps.css';

// Keep every group mounted so edits and pending file inputs survive tab changes.
export default function SectionEditorCardTabs({ labels, children, label = 'Opciones de edición', value, onChange }) {
  const cards = React.Children.toArray(children);
  const [activeIndex, setActiveIndex] = useState(0);
  const current = Math.min(value ?? activeIndex, cards.length - 1);

  if (cards.length <= 1) return <>{children}</>;

  return (
    <div className="section-card-tabs">
      <nav className="section-card-tabs__nav" aria-label={label}>
        {cards.map((card, index) => (
          <button key={card.key || index} type="button" aria-pressed={current === index}
            onClick={(event) => {
              setActiveIndex(index);
              onChange?.(index);
              event.currentTarget.closest('[data-section-modal-scroll]')?.scrollTo?.({ top: 0, behavior: 'auto' });
            }}>
            {labels[index] || `Grupo ${index + 1}`}
          </button>
        ))}
      </nav>
      <div className="section-card-tabs__panels">
        {cards.map((card, index) => (
          <div key={card.key || index} hidden={current !== index}>{card}</div>
        ))}
      </div>
    </div>
  );
}
