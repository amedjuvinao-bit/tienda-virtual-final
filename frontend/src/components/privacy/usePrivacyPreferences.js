import { useSyncExternalStore } from 'react';
import { getPrivacyPreference, subscribePrivacyPreferences } from '../../lib/privacyPreferences';

export default function usePrivacyPreferences() {
  return useSyncExternalStore(subscribePrivacyPreferences, getPrivacyPreference, () => null);
}
