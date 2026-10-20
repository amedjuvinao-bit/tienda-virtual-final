import React, { createContext } from 'react';
import useInstagramFeed from './useInstagramFeed';

export const InstagramEditorFeed = createContext(null);
export function InstagramEditorFeedProvider({ enabled, children }) {
  const feed = useInstagramFeed(enabled, true);
  return <InstagramEditorFeed.Provider value={enabled ? feed : null}>{children}</InstagramEditorFeed.Provider>;
}
