import React, { useState } from 'react';
import './sectionEditorSteps.css';

// Panels stay mounted when another group is selected, including pending uploads.
export default function SectionEditorSubgroups({ label, labels, children }) {
  const [active, setActive] = useState(0);
  const panels = React.Children.toArray(children);
  return <div className="section-editor-subgroups">
    <label className="section-editor-subgroups__select">{label}
      <select value={active} onChange={(event) => {
        setActive(Number(event.target.value));
        event.currentTarget.closest('[data-section-modal-scroll]')?.scrollTo?.({ top: 0, behavior: 'auto' });
      }}>
        {labels.map((name, index) => <option key={name} value={index}>{name}</option>)}
      </select>
    </label>
    {panels.map((panel, index) => <div key={panel.key || index} hidden={active !== index}>{panel}</div>)}
  </div>;
}
