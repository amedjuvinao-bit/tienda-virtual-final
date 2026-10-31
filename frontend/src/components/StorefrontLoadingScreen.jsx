import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import GlobalPageLoader from './GlobalPageLoader';
import { StorefrontSettingsContext } from '../context/StorefrontSettingsContext';
import useStorefrontBackdrop from './useStorefrontBackdrop';
import {
  readLoadingAppearance,
  rememberedLoadingBackdrop,
} from '../theme/storefrontLoadingAppearance';
import './storefrontLoadingScreen.css';

import {
  StorefrontLoadingContext as LoadingContext,
  useStorefrontPending,
} from './storefrontLoadingContext';

export function StorefrontLoadingBoundary({
  children,
  config,
  loading = false,
}) {
  const { pathname } = useLocation();
  const [pending, setPending] = useState(new Set());
  const register = useCallback((token) => {
    setPending((current) => new Set(current).add(token));
    return () =>
      setPending((current) => {
        const next = new Set(current);
        next.delete(token);
        return next;
      });
  }, []);
  useLayoutEffect(() => {
    delete document.documentElement.dataset.storefrontBoot;
  }, []);
  const publicRoute = !pathname.startsWith('/admin');
  return (
    <LoadingContext.Provider value={register}>
      {children}
      {publicRoute && (
        <GlobalPageLoader
          config={config || readLoadingAppearance().loader}
          visible={loading || pending.size > 0}
        />
      )}
    </LoadingContext.Provider>
  );
}

export default function StorefrontLoadingScreen({
  message = 'Cargando página',
  presentation,
  pageBg,
  theme,
}) {
  const settings = useContext(StorefrontSettingsContext);
  const register = useContext(LoadingContext);
  const { pathname } = useLocation();
  const backdrop = useStorefrontBackdrop(
    presentation || { backgroundMode: 'continuity' },
    pageBg,
    theme
  );
  const currentTheme = theme || settings?.theme;
  const mobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const remembered = rememberedLoadingBackdrop(pathname, mobile);
  const useCurrent =
    !(remembered.custom && !presentation) &&
    (currentTheme || presentation?.backgroundMode === 'custom');
  const color = useCurrent ? backdrop.color : remembered.color;
  const image = useCurrent ? backdrop.image : remembered.image;
  useStorefrontPending(true);
  return (
    <div
      className="storefront-loading-screen"
      aria-busy="true"
      aria-label={message}
      style={{
        backgroundColor: color || 'var(--color-bg, Canvas)',
        backgroundImage: image ? `url(${JSON.stringify(image)})` : 'none',
      }}
    >
      <span className="sr-only">{message}</span>
      {!register && (
        <GlobalPageLoader
          config={
            currentTheme?.global?.loader || readLoadingAppearance().loader
          }
          visible
        />
      )}
    </div>
  );
}
