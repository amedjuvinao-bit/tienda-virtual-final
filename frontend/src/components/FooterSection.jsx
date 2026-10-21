import React from 'react';
import FooterEditorial from './footer/FooterEditorial';
import FooterClassic from './footer/FooterClassic';

export default function FooterSection(props) {
  return props.theme?.footer?.layout === 'classic' ? <FooterClassic {...props}/> : <FooterEditorial {...props}/>;
}
