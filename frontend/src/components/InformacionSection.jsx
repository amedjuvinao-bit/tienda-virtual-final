import React from 'react';
import { isInfoSection, normalizeInfoSection } from '../admin/appearance/sections/info/infoSectionHelpers';
import InfoGlass from './information/InfoGlass';
import InfoClassic from './information/InfoClassic';

export default function InformacionSection({ theme }) {
  const section = normalizeInfoSection(Array.isArray(theme?.sections) ? theme.sections.find(isInfoSection) : null);
  if (!section.enabled) return null;
  return section.config.layout === 'classic' ? <InfoClassic theme={theme} /> : <InfoGlass section={section} theme={theme} />;
}
