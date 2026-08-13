// src/context/FavoritesContext.jsx
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import api from '../lib/api';
import {
  buildFavoriteAccessHeaders,
  ensureFavoriteAccess,
  getFavoriteAccess,
} from '../utils/favoriteAccess';

const FavoritesContext = createContext();

function clean(value) {
  return String(value || '').trim();
}

function toFavItem(raw = {}) {
  const product = raw.product && typeof raw.product === 'object' ? raw.product : null;
  const productId =
    raw.productId || raw._id || raw.id || product?._id || raw.product || '';
  const imageCandidate =
    [raw.image, raw.img, raw.cover, raw?.images?.[0], product?.image].find(
      (value) => typeof value === 'string' && value.trim()
    ) || '';

  return {
    productId: clean(productId),
    variantKey: clean(
      raw.variantKey || raw.variantId || raw.selectedVariantKey || raw.selectedVariantId
    ),
    variantLabel: clean(raw.variantLabel || raw.selectedVariant?.label),
    variantAttributes: Array.isArray(raw.variantAttributes)
      ? raw.variantAttributes.slice(0, 4)
      : Array.isArray(raw.attributes)
        ? raw.attributes.slice(0, 4)
        : [],
    title: clean(raw.title || raw.name || product?.title),
    image: clean(imageCandidate),
    price: Math.max(0, Number(raw.price ?? product?.price ?? 0) || 0),
    color: clean(raw.colorValue || raw.color),
    size: clean(raw.size),
    slug: clean(raw.slug || product?.slug),
    sku: clean(raw.sku || product?.sku),
    category: clean(raw.category || product?.category),
  };
}

function favKey(item) {
  const favorite = toFavItem(item);
  const variant = favorite.variantKey || `${favorite.size}__${favorite.color}`;
  return `${favorite.productId}|||${variant}`;
}

function normalizeFavs(list) {
  const result = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((raw) => {
    const item = toFavItem(raw);
    if (!item.productId) return;
    const key = favKey(item);
    if (seen.has(key)) return;
    seen.add(key);
    result.push(item);
  });
  return result;
}

function readLocalFavorites() {
  try {
    return normalizeFavs(JSON.parse(localStorage.getItem('favorites') || '[]'));
  } catch {
    return [];
  }
}

function sameFavorites(left, right) {
  const a = normalizeFavs(left);
  const b = normalizeFavs(right);
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return (
      favKey(item) === favKey(other) &&
      item.title === other.title &&
      item.image === other.image &&
      Number(item.price) === Number(other.price)
    );
  });
}

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState(readLocalFavorites);
  const [access, setAccess] = useState(getFavoriteAccess);
  const [isInitialized, setIsInitialized] = useState(false);
  const favoritesRef = useRef(favorites);
  const hydrationRef = useRef(0);

  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  useEffect(() => {
    if (access || favorites.length === 0) return undefined;
    let cancelled = false;
    ensureFavoriteAccess(api)
      .then((issuedAccess) => {
        if (!cancelled) setAccess(issuedAccess);
      })
      .catch((error) => {
        console.error(
          'No fue posible iniciar favoritos:',
          error?.userMessage || error?.message
        );
      });
    return () => {
      cancelled = true;
    };
  }, [access, favorites.length]);

  useEffect(() => {
    const hydrationId = hydrationRef.current + 1;
    hydrationRef.current = hydrationId;

    if (!access?.sessionId || !access?.token) {
      setIsInitialized(true);
      return undefined;
    }

    let cancelled = false;
    setIsInitialized(false);
    const headers = buildFavoriteAccessHeaders(access);

    api
      .get(`/api/favorites/${encodeURIComponent(access.sessionId)}`, { headers })
      .then(({ data }) => {
        if (cancelled || hydrationRef.current !== hydrationId) return;
        const serverItems = normalizeFavs(data?.items || []);
        const merged = normalizeFavs([...serverItems, ...favoritesRef.current]);
        favoritesRef.current = merged;
        setFavorites(merged);
        if (!sameFavorites(serverItems, merged)) {
          return api.put(
            `/api/favorites/${encodeURIComponent(access.sessionId)}`,
            { items: merged },
            { headers }
          );
        }
        return null;
      })
      .catch((error) => {
        if (cancelled || hydrationRef.current !== hydrationId) return;
        if (error?.response?.status === 404 && favoritesRef.current.length) {
          return api.put(
            `/api/favorites/${encodeURIComponent(access.sessionId)}`,
            { items: favoritesRef.current },
            { headers }
          );
        }
        if (error?.response?.status !== 404) {
          console.error('No fue posible cargar favoritos:', error?.userMessage || error?.message);
        }
        return null;
      })
      .finally(() => {
        if (!cancelled && hydrationRef.current === hydrationId) setIsInitialized(true);
      });

    return () => {
      cancelled = true;
    };
  }, [access?.sessionId, access?.token]);

  useEffect(() => {
    if (!isInitialized) return;
    try {
      localStorage.setItem('favorites', JSON.stringify(favorites));
    } catch {
      // El almacenamiento local es un respaldo de interfaz, no la autoridad.
    }
  }, [favorites, isInitialized]);

  useEffect(() => {
    if (!isInitialized || !access?.sessionId || !access?.token) return undefined;
    const timer = window.setTimeout(() => {
      api
        .put(
          `/api/favorites/${encodeURIComponent(access.sessionId)}`,
          { items: favorites },
          { headers: buildFavoriteAccessHeaders(access) }
        )
        .catch((error) => {
          console.error(
            'No fue posible sincronizar favoritos:',
            error?.userMessage || error?.message
          );
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [favorites, isInitialized, access?.sessionId, access?.token]);

  const isFavorite = (productOrItem) => {
    const key = favKey(productOrItem);
    return favorites.some((favorite) => favKey(favorite) === key);
  };

  const addToFavorites = (productOrItem) => {
    const item = toFavItem(productOrItem);
    if (!item.productId) return;
    setFavorites((previous) => normalizeFavs([...previous, item]));
  };

  const removeFromFavorites = (productOrItem) => {
    const key = favKey(productOrItem);
    setFavorites((previous) => previous.filter((favorite) => favKey(favorite) !== key));
  };

  const toggleFavorite = (productOrItem) => {
    if (isFavorite(productOrItem)) removeFromFavorites(productOrItem);
    else addToFavorites(productOrItem);
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isInitialized,
        addToFavorites,
        removeFromFavorites,
        isFavorite,
        toggleFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
