import React from 'react';
import InstagramEditorialUI from './InstagramEditorialUI';
import InstagramJournalUI from './InstagramJournalUI';
import { normalizeInstagramSection } from './instagramSectionHelpers';
import { JournalSelect } from './JournalFields';

export default function InstagramSectionUI(props) {
  const current = props.theme?.sections || [];
  const section = normalizeInstagramSection(current.find(s => s?.id === 'instagram' || s?.type === 'instagram'));
  const layout = section.config.instagramLayout === 'editorial' ? 'editorial' : 'journal';
  const change = value => {
    const next = { ...section, config: { ...section.config, instagramLayout: value } };
    const found = current.some(s => s?.id === 'instagram' || s?.type === 'instagram');
    props.setPath?.('sections', found ? current.map(s => s.id === 'instagram' || s.type === 'instagram' ? next : s) : [...current, next]);
  };
  return <div className="space-y-4">
    <JournalSelect label="Diseño de la sección Instagram" value={layout} onChange={change} options={[["journal", "Perfil social · cristal"], ["editorial", "Muro editorial"]]} />
    {layout === 'journal' ? <InstagramJournalUI {...props} /> : <InstagramEditorialUI {...props} />}
  </div>;
}
