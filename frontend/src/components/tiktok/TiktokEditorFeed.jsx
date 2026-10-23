import React, { createContext } from 'react';
import useTiktokFeed from './useTiktokFeed';

export const TiktokEditorFeed = createContext(null);
export function TiktokEditorFeedProvider({ enabled, children }) {
  const feed = useTiktokFeed(enabled, true);
  return <TiktokEditorFeed.Provider value={enabled ? feed : null}>{children}</TiktokEditorFeed.Provider>;
}
