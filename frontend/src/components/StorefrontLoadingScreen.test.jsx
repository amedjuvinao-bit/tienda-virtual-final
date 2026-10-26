import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StorefrontLoadingScreen, {
  StorefrontLoadingBoundary,
} from './StorefrontLoadingScreen';
import { useStorefrontPending } from './storefrontLoadingContext';
import { StorefrontSettingsContext } from '../context/StorefrontSettingsContext';
import {
  rememberStorefrontLoadingAppearance,
  rememberPageLoadingAppearance,
} from '../theme/storefrontLoadingAppearance';
const theme = {
  colors: { background: '#e4c5d2' },
  global: {
    loader: {
      type: 'ring',
      icon: 'heart',
      showText: true,
      text: 'Preparando tu tienda',
      color: '#843ba2',
    },
    sectionMotion: { journey: { backgroundImage: '/home-background.webp' } },
  },
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});
const wrap = (children, value = { theme }) => (
  <MemoryRouter initialEntries={['/pagina/novedades']}>
    <StorefrontSettingsContext.Provider value={value}>
      {children}
    </StorefrontSettingsContext.Provider>
  </MemoryRouter>
);
function Request({ pending }) {
  useStorefrontPending(pending);
  return <article>Contenido</article>;
}
it('muestra una sola animación configurada y la conserva mientras siga pendiente cualquier petición', () => {
  vi.useFakeTimers();
  const view = render(
    wrap(
      <StorefrontLoadingBoundary config={theme.global.loader}>
        <StorefrontLoadingScreen />
        <Request pending />
      </StorefrontLoadingBoundary>
    )
  );
  expect(
    screen.getAllByRole('status', { name: 'Cargando tienda' })
  ).toHaveLength(1);
  expect(screen.getByText('Preparando tu tienda')).toBeInTheDocument();
  expect(screen.getByLabelText('Cargando página')).toHaveStyle({
    backgroundColor: '#e4c5d2',
    backgroundImage: 'url("/home-background.webp")',
  });
  act(() => vi.advanceTimersByTime(2000));
  expect(
    screen.getByRole('status', { name: 'Cargando tienda' })
  ).toBeInTheDocument();
  view.rerender(
    wrap(
      <StorefrontLoadingBoundary config={theme.global.loader}>
        <Request pending />
      </StorefrontLoadingBoundary>
    )
  );
  expect(
    screen.getByRole('status', { name: 'Cargando tienda' })
  ).toBeInTheDocument();
  view.rerender(
    wrap(
      <StorefrontLoadingBoundary config={theme.global.loader}>
        <Request pending={false} />
      </StorefrontLoadingBoundary>
    )
  );
  expect(
    screen.queryByRole('status', { name: 'Cargando tienda' })
  ).not.toBeInTheDocument();
});
it('recupera el fondo propio recordado antes de recibir la configuración de la página', () => {
  rememberStorefrontLoadingAppearance(theme);
  rememberPageLoadingAppearance(
    '/pagina/novedades',
    theme,
    { backgroundMode: 'custom', backgroundImage: '/catalog-custom.webp' },
    '#113355'
  );
  render(wrap(<StorefrontLoadingScreen />));
  expect(screen.getByLabelText('Cargando página')).toHaveStyle({
    backgroundColor: '#113355',
    backgroundImage: 'url("/catalog-custom.webp")',
  });
});
it('respeta la opción de desactivar el indicador y no aplica el indicador público en el panel', () => {
  render(
    wrap(
      <StorefrontLoadingBoundary config={{ enabled: false }}>
        <StorefrontLoadingScreen />
      </StorefrontLoadingBoundary>
    )
  );
  expect(
    screen.queryByRole('status', { name: 'Cargando tienda' })
  ).not.toBeInTheDocument();
  cleanup();
  render(
    <MemoryRouter initialEntries={['/admin/productos']}>
      <StorefrontLoadingBoundary loading>
        <div>Panel</div>
      </StorefrontLoadingBoundary>
    </MemoryRouter>
  );
  expect(
    screen.queryByRole('status', { name: 'Cargando tienda' })
  ).not.toBeInTheDocument();
});
