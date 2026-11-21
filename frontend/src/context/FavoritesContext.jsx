import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import api from '../lib/api';
import { createFavoriteStore } from '../utils/favoriteStore';
import { favoriteKey } from '../utils/favoriteModel';
export const FavoritesContext = createContext();
export function FavoritesProvider({ children }) {
  const [store] = useState(() => createFavoriteStore(api));
  const [state, setState] = useState(store.getState);
  useEffect(() => {
    const unsubscribe = store.subscribe(setState);
    store.start();
    return () => {
      unsubscribe();
      store.stop();
    };
  }, [store]);
  const value = useMemo(
    () => ({
      ...state,
      addToFavorites: store.add,
      removeFromFavorites: store.remove,
      toggleFavorite: store.toggle,
      syncFavorites: store.sync,
      isFavorite: (item) =>
        state.favorites.some((row) => favoriteKey(row) === favoriteKey(item)),
    }),
    [state, store]
  );
  return (
    <FavoritesContext.Provider value={value}>
      {children}
    </FavoritesContext.Provider>
  );
}
export function useFavorites() {
  return useContext(FavoritesContext);
}
