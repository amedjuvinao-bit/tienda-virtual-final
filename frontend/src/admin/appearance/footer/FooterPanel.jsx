import React from 'react';
import FooterEditorialEditor from './FooterEditorialEditor';
import FooterClassicPanel from './FooterClassicPanel';

export default function FooterPanel(props) {
  return props.theme?.footer?.layout === 'classic' ? <FooterClassicPanel {...props}/> : <FooterEditorialEditor {...props}/>;
}
