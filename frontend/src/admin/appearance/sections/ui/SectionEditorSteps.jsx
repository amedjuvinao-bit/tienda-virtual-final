import React, { createContext, useContext } from 'react';
import './sectionEditorSteps.css';

export const SectionEditorStepContext = createContext(null);

// Shared navigation for the section editors. Keep the editor mounted when changing
// steps so file uploads and local form state are not discarded.
export default function SectionEditorSteps({ value, onChange, items, sectionName }) {
  const notifyStep = useContext(SectionEditorStepContext);
  const active = items.find((item) => item.value === value) || items[0];
  return (
    <div className="section-editor-guide">
      <div className="section-editor-guide__intro">
        <strong>{sectionName ? `Diseña ${sectionName}` : 'Edita esta sección'}</strong>
        <span>Completa el contenido, ajusta el diseño y comprueba el resultado. Después, guarda los cambios desde el panel.</span>
      </div>
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
            notifyStep?.(id);
            const scrollArea = event.currentTarget.closest('[data-section-modal-scroll]');
            scrollArea?.scrollTo?.({ top: 0, behavior: 'auto' });
          }}
        >
          <span className="section-editor-steps__number" aria-hidden="true">{index + 1}</span>
          <span>{label}</span>
        </button>
        ))}
      </nav>
      <p className="section-editor-guide__hint" role="status"><b>{active?.label}:</b> {active?.hint || 'Configura este paso y continúa con el siguiente.'}</p>
    </div>
  );
}
