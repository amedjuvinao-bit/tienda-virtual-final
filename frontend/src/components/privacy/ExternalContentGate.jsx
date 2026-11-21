import { ShieldCheck } from 'lucide-react';
import usePrivacyPreferences from './usePrivacyPreferences';
import { openPrivacyPreferences, PRIVACY_PREFERENCES_POLICY as policy } from '../../lib/privacyPreferences';
import './privacyPreferences.css';

export default function ExternalContentGate({ category, title, children, preview = false }) {
  const decision = usePrivacyPreferences();
  if (preview || decision?.choices[category] === true) return children;
  const information = policy.categories[category];
  return (
    <section className="privacy-content-gate" aria-label={title || information.label}>
      <ShieldCheck size={28} aria-hidden="true" />
      <div><h2>{title || information.label}</h2><p>{information.description}</p>
        <button type="button" onClick={openPrivacyPreferences}>Configurar preferencias</button>
      </div>
    </section>
  );
}
