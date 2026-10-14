import React from 'react';
import './sectionEditorSteps.css';

// Shared navigation for the section editors. Keep the editor mounted when changing
// steps so file uploads and local form state are not discarded.
export default function SectionEditorSteps({ value, onChange, items, sectionName }) {
  const active = items.find((item) => item.value === value) || items[0];
  return (
    <div className="section-editor-guide">
      <nav className="section-editor-steps" aria-label="Pasos de edición">
        {items.map(({ value: id, label, hint }, index) => (
        <button
          key={id}
          type="button"
          className="section-editor-steps__item"
          aria-current={value === id ? 'step' : undefined}
          title={hint}
          onClick={(event) => {
            onChange(id);
            const scrollArea = event.currentTarget.closest('[data-section-modal-scroll]');
            scrollArea?.scrollTo?.({ top: 0, behavior: 'auto' });
          }}
        >
          <span className="section-editor-steps__number" aria-hidden="true">{index + 1}</span>
          <span>{label}</span>
        </button>
        ))}
      </nav>
      <p className="section-editor-guide__hint" role="status">{active?.hint || 'Configura este paso y continúa con el siguiente.'}</p>
    </div>
  );
}
