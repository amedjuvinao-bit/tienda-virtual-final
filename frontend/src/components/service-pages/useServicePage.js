import { useContext, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { API_BASE_URL } from "../../config/apiBaseUrl";
import { StorefrontSettingsContext } from "../../context/StorefrontSettingsContext";
import { rememberPageLoadingAppearance } from "../../theme/storefrontLoadingAppearance";
import {
  buildServicePageConfig,
  SERVICE_PAGE_DEFINITIONS,
} from "./servicePageConfig";
export default function useServicePage(type) {
  const [state, setState] = useState({ page: null, loading: true, error: "" }),
    [retry, setRetry] = useState(0);
  const settings = useContext(StorefrontSettingsContext),
    { pathname } = useLocation();
  const definition = SERVICE_PAGE_DEFINITIONS[type];
  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    fetch(`${API_BASE_URL}/api/pages/${definition.slug}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("No pudimos cargar la configuración de esta página.");
        const page = await response.json();
        if (page.pageType !== type)
          throw new Error("La configuración no corresponde a esta página.");
        if (!controller.signal.aborted)
          setState({ page, loading: false, error: "" });
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setState((current) => ({
            ...current,
            loading: false,
            error: failure.message,
          }));
      });
    return () => controller.abort();
  }, [definition.slug, type, retry]);
  const config = buildServicePageConfig(
    state.page?.enabled === false ? {} : state.page?.[definition.key],
    type,
  );
  useEffect(() => {
    if (state.page)
      rememberPageLoadingAppearance(
        pathname,
        settings?.theme,
        config.presentation,
        config.style.pageBg,
      );
  }, [state.page, pathname, settings?.theme]);
  return { ...state, config, retry: () => setRetry((value) => value + 1) };
}
