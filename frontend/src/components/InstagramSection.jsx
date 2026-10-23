import React from 'react';
import InstagramEditorialSection from './InstagramEditorialSection';
import InstagramJournal from './instagram/InstagramJournal';

export default function InstagramSection(props) {
  const config = props.theme?.sections?.find(s => s?.id === 'instagram' || s?.type === 'instagram')?.config;
  return config?.instagramLayout === 'editorial'
    ? <InstagramEditorialSection {...props} />
    : <InstagramJournal {...props} />;
}
