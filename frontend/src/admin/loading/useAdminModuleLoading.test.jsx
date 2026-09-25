import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import api, { adminFetch } from '../../lib/api';
import useAdminModuleLoading from './useAdminModuleLoading';

function ModuleStatus({ pathname }) {
  const loading = useAdminModuleLoading(pathname);
  return <span>{loading ? 'Cargando módulo…' : 'Módulo listo'}</span>;
}

function deferredRequest() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    adapter: (config) => promise.then(
      () => ({ data: {}, status: 200, statusText: 'OK', headers: {}, config }),
      (error) => Promise.reject(Object.assign(error, { config })),
    ),
    resolve,
    reject,
  };
}

describe('indicador de carga de módulos', () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
    vi.unstubAllGlobals();
  });

  it('acompaña la lectura real de datos y se apaga cuando termina', async () => {
    window.history.replaceState({}, '', '/admin/productos');
    render(<ModuleStatus pathname="/admin/productos" />);
    const request = deferredRequest();
    const result = api.get('/api/products/admin', { adapter: request.adapter });

    await waitFor(() => expect(screen.getByText('Cargando módulo…')).toBeInTheDocument());
    await act(async () => { request.resolve(); await result; });
    expect(screen.getByText('Módulo listo')).toBeInTheDocument();
  });

  it('ignora otras rutas y lecturas de fondo, y libera el indicador tras un error', async () => {
    window.history.replaceState({}, '', '/admin/ordenes');
    const { rerender } = render(<ModuleStatus pathname="/admin/ordenes" />);
    const background = deferredRequest();
    const ignored = api.get('/api/products/admin/reviews', {
      adapter: background.adapter,
      skipAdminRouteLoader: true,
    });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Módulo listo')).toBeInTheDocument();

    const request = deferredRequest();
    const failed = api.get('/api/orders/admin', { adapter: request.adapter }).catch(() => {});
    await waitFor(() => expect(screen.getByText('Cargando módulo…')).toBeInTheDocument());
    rerender(<ModuleStatus pathname="/admin/productos" />);
    expect(screen.getByText('Módulo listo')).toBeInTheDocument();

    await act(async () => {
      request.reject(new Error('Sin conexión'));
      background.resolve();
      await Promise.all([failed, ignored]);
    });
  });

  it('observa también las páginas que usan fetch sin retrasar su respuesta', async () => {
    window.history.replaceState({}, '', '/admin/paginas');
    render(<ModuleStatus pathname="/admin/paginas" />);
    let finish;
    vi.stubGlobal('fetch', vi.fn(() => new Promise((resolve) => { finish = resolve; })));

    const result = adminFetch('/api/pages');
    await waitFor(() => expect(screen.getByText('Cargando módulo…')).toBeInTheDocument());
    await act(async () => { finish({ ok: true }); await result; });
    expect(screen.getByText('Módulo listo')).toBeInTheDocument();
  });
});
