import { createContext } from 'react';

// undefined: standalone header; null: the app is still loading its settings.
export const StorefrontSettingsContext = createContext(undefined);
