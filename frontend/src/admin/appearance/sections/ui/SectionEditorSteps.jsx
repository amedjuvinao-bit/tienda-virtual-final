import React from 'react';
import './sectionEditorSteps.css';

// Shared navigation for the section editors. Keep the editor mounted when changing
// steps so file uploads and local form state are not discarded.
export default function SectionEditorSteps({ value, onChange, items }) {
  return (
    <nav className="section-editor-steps" aria-label="Pasos de edición">
      {items.map(({ value: id, label, hint }, index) => (
        <button
          key={id}
          type="button"
          className="section-editor-steps__item"
          aria-current={value === id ? 'step' : undefined}
          title={hint}
          onClick={() => onChange(id)}
        >
          <span className="section-editor-steps__number" aria-hidden="true">{index + 1}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
