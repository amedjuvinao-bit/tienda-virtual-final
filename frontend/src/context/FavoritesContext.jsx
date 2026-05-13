// src/context/FavoritesContext.jsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import api, { setSessionId as setApiSessionId } from '../lib/api';
import { getSessionId } from '../utils/getSessionId';

const FavoritesContext = createContext();

/* ---------------- Helpers ---------------- */

// Convierte cualquier objeto "producto" o "item" a la forma estándar
// que tu backend espera en /api/favorites: { productId, title, image, price, color, size }
function toFavItem(raw = {}) {
  const productId =
    raw.productId ||
    raw._id ||
    raw.id ||
    (typeof raw.product === 'object' ? raw.product?._id : raw.product) ||
    '';

  // Intenta escoger una imagen válida (string no vacío)
  const imageCandidate =
    [raw.image, raw.img, raw.cover, raw?.images?.[0]].find(
      (v) => typeof v === 'string' && v.trim().length > 0
    ) || '';

  return {
    productId: String(productId || '').trim(),
    title: String(raw.title || raw.name || '').trim(),
    image: String(imageCandidate).trim(),
    price: Number(raw.price || 0) || 0,
    color: String(raw.color || '').trim(),
    size: String(raw.size || '').trim(),
  };
}

// Clave única para evitar duplicados (si no manejas color/talla, igual funciona)
function favKey(item) {
  const i = toFavItem(item);
  return `${i.productId}|||${i.color}|||${i.size}`;
}

// Normaliza un array y quita duplicados
function normalizeFavs(list) {
  const out = [];
  const seen = new Set();
  (Array.isArray(list) ? list : []).forEach((x) => {
    const i = toFavItem(x);
    if (!i.productId) return;
    const key = favKey(i);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(i);
    }
  });
  return out;
}

/* ---------------- Context ---------------- */

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([]);        // SIEMPRE forma estándar
  const [isInitialized, setIsInitialized] = useState(false);

  // Asegura que el X-Session-Id esté presente para todas las llamadas
  useEffect(() => {
    try {
      const sid = getSessionId();
      setApiSessionId(sid);
    } catch {}
  }, []);

  // 0) (Opcional) precarga desde localStorage para que la UI no vea parpadeo
  useEffect(() => {
    try {
      const raw = localStorage.getItem('favorites');
      if (raw) {
        const local = normalizeFavs(JSON.parse(raw));
        if (local.length) setFavorites(local);
      }
    } catch {}
  }, []);

  // 1) Cargar desde MongoDB al iniciar (si hay documento)
  useEffect(() => {
    const sessionId = getSessionId();

    api
      .get(`/api/favorites/${encodeURIComponent(sessionId)}`)
      .then((res) => {
        const serverItems = normalizeFavs(res.data?.items || []);
        setFavorites(serverItems);
      })
      .catch((err) => {
        // 404 => aún no existe documento; dejamos lista tal como esté (localStorage o vacía)
        if (err?.response?.status !== 404) {
          console.error('❌ Error real al conectar con MongoDB:', err?.message || err);
        }
      })
      .finally(() => {
        setIsInitialized(true);
      });
  }, []);

  // 2) Sincronizar con MongoDB cada vez que cambie la lista (solo tras inicializar)
  useEffect(() => {
    if (!isInitialized) return;
    const sessionId = getSessionId();

    api
      .put(`/api/favorites/${encodeURIComponent(sessionId)}`, {
        items: favorites, // ya está en la forma {productId,title,image,price,color,size}
      })
      .then(() => {
        // console.log('🟢 Favoritos sincronizados con MongoDB');
      })
      .catch((err) => {
        console.error('❌ Error al sincronizar favoritos:', err?.message || err);
      });
  }, [favorites, isInitialized]);

  // 3) Guardar también en localStorage (opcional)
  useEffect(() => {
    if (isInitialized) {
      try {
        localStorage.setItem('favorites', JSON.stringify(favorites));
      } catch {
        // ignore
      }
    }
  }, [favorites, isInitialized]);

  /* --------- Acciones públicas del contexto --------- */

  // Verificar si un producto (o item) ya está en favoritos (comparación por clave)
  const isFavorite = (productOrItem) => {
    const key = favKey(productOrItem);
    return favorites.some((f) => favKey(f) === key);
  };

  // Añadir
  const addToFavorites = (productOrItem) => {
    const item = toFavItem(productOrItem);
    if (!item.productId) return;     // ignora si no hay id
    if (isFavorite(item)) return;    // evita duplicado
    setFavorites((prev) => normalizeFavs([...prev, item]));
  };

  // Remover por productId+color+size
  const removeFromFavorites = (productOrItem) => {
    const key = favKey(productOrItem);
    setFavorites((prev) => prev.filter((f) => favKey(f) !== key));
  };

  // Alternar
  const toggleFavorite = (productOrItem) => {
    isFavorite(productOrItem)
      ? removeFromFavorites(productOrItem)
      : addToFavorites(productOrItem);
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,              // siempre en forma estándar
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

// Hook
export function useFavorites() {
  return useContext(FavoritesContext);
}
