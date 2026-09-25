import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RouteLoaderEffect from './RouteLoaderEffect';

function Navigation({ setLoadingPage }) {
  const navigate = useNavigate();
  return (
    <>
      <RouteLoaderEffect setLoadingPage={setLoadingPage} readyForRouteLoader />
      <button onClick={() => navigate('/admin/ordenes')}>Órdenes</button>
      <button onClick={() => navigate('/admin/productos')}>Productos</button>
      <button onClick={() => navigate('/carrito')}>Carrito</button>
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe('carga visual entre rutas', () => {
  it('navega entre módulos admin sin imponer la pantalla de espera global', () => {
    vi.useFakeTimers();
    const setLoadingPage = vi.fn();
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navigation setLoadingPage={setLoadingPage} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Órdenes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Productos' }));
    act(() => vi.advanceTimersByTime(500));
    expect(setLoadingPage).not.toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: 'Carrito' }));
    expect(setLoadingPage).toHaveBeenLastCalledWith(true);
    act(() => vi.advanceTimersByTime(400));
    expect(setLoadingPage).toHaveBeenLastCalledWith(false);
  });
});
