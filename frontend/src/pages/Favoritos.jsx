import React, { useContext, useEffect, useRef, useState } from "react";
import { API_BASE_URL } from "../config/apiBaseUrl";
import { useFavorites } from "../context/FavoritesContext";
import { useCart } from "../context/CartContext";
import { StorefrontSettingsContext } from "../context/StorefrontSettingsContext";
import StorefrontLoadingScreen from "../components/StorefrontLoadingScreen";
import FavoritesPageView from "../components/favorites/FavoritesPageView";
import { buildSafeFavoritesPageConfig } from "../components/favorites/favoritesPageConfig";
import { rememberPageLoadingAppearance } from "../theme/storefrontLoadingAppearance";
export default function Favoritos() {
  const favorites = useFavorites(),
    cart = useCart(),
    settings = useContext(StorefrontSettingsContext);
  const [page, setPage] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const sync = useRef(favorites.syncFavorites);
  sync.current = favorites.syncFavorites;
  useEffect(() => {
    void sync.current?.();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${API_BASE_URL}/api/pages/favoritos`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error("No pudimos cargar la presentación de favoritos.");
        if (!controller.signal.aborted) setPage(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const config = buildSafeFavoritesPageConfig(page?.favoritesPageConfig);
  useEffect(() => {
    if (page)
      rememberPageLoadingAppearance(
        "/favoritos",
        settings?.theme,
        config.presentation,
        config.style.pageBg,
      );
  }, [page, settings?.theme]);
  if (loading || !favorites.isInitialized)
    return (
      <StorefrontLoadingScreen
        message="Cargando favoritos"
        presentation={page ? config.presentation : undefined}
        pageBg={page ? config.style.pageBg : undefined}
      />
    );
  return (
    <FavoritesPageView
      page={page || { useHeader: false, useFooter: false }}
      favoritesState={favorites}
      cartState={cart}
      configError={error}
      onRetryConfig={() => setRetry((value) => value + 1)}
    />
  );
}
