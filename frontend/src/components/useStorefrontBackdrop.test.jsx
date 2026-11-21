import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import useStorefrontBackdrop from './useStorefrontBackdrop';
import { StorefrontSettingsContext } from '../context/StorefrontSettingsContext';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('actualiza el fondo heredado al pasar de escritorio a móvil sin usar el fondo propio del carrito', () => {
  let update;
  const query = {
    matches: false,
    addEventListener: (_event, callback) => {
      update = callback;
    },
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => query)
  );
  const settings = {
    theme: {
      sections: [
        {
          id: 'tendencia',
          config: {
            products: [{ productId: 'p1' }],
            presentation: { mode: 'classic' },
          },
        },
        { id: 'look', enabled: false },
        { id: 'complementos', style: { sectionBackgroundMode: 'color' } },
        {
          id: 'instagram',
          config: {
            posts: [{ image: '/post.webp' }],
            journalBackgroundMode: 'custom',
            journalBackgroundImage: '/home-wide.webp',
            journalMobileBackgroundImage: '/home-phone.webp',
          },
        },
      ],
    },
  };
  const wrapper = ({ children }) => (
    <StorefrontSettingsContext.Provider value={settings}>
      {children}
    </StorefrontSettingsContext.Provider>
  );
  const { result, rerender } = renderHook(
    ({ mode }) =>
      useStorefrontBackdrop(
        {
          backgroundMode: mode,
          backgroundImage: '/cart-wide.webp',
          mobileBackgroundImage: '/cart-phone.webp',
        },
        '#123456'
      ),
    { wrapper, initialProps: { mode: 'continuity' } }
  );
  expect(result.current.image).toBe('/home-wide.webp');
  act(() => {
    query.matches = true;
    update();
  });
  expect(result.current.image).toBe('/home-phone.webp');
  rerender({ mode: 'custom' });
  expect(result.current.image).toBe('/cart-phone.webp');
});
