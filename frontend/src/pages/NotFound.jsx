import React, { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config/apiBaseUrl";
import { StorefrontSettingsContext } from "../context/StorefrontSettingsContext";
import StorefrontLoadingScreen from "../components/StorefrontLoadingScreen";
import NotFoundPageView from "../components/not-found/NotFoundPageView";
import { buildSafeNotFoundPageConfig } from "../components/not-found/notFoundPageConfig";
import { rememberPageLoadingAppearance } from "../theme/storefrontLoadingAppearance";
export default function NotFound() {
  const [page, setPage] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const settings = useContext(StorefrontSettingsContext),
    { pathname } = useLocation();
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${API_BASE_URL}/api/pages/not-found`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("No pudimos cargar esta página por completo.");
        const data = await response.json();
        if (!controller.signal.aborted) setPage(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(
            "No pudimos cargar esta página por completo. Puedes volver al inicio o reintentar.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const config = buildSafeNotFoundPageConfig(
    page?.enabled === false ? {} : page?.notFoundPageConfig,
  );
  useEffect(() => {
    if (page)
      rememberPageLoadingAppearance(
        pathname,
        settings?.theme,
        config.presentation,
        config.pageBg,
      );
  }, [page, pathname, settings?.theme]);
  if (loading)
    return (
      <StorefrontLoadingScreen
        message="Cargando página"
        presentation={page ? config.presentation : undefined}
        pageBg={page ? config.pageBg : undefined}
      />
    );
  return (
    <NotFoundPageView
      page={page || { useHeader: false, useFooter: false }}
      configError={error}
      onRetry={() => setRetry((value) => value + 1)}
    />
  );
}
