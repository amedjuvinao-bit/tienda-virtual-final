import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../context/AuthContext';
import { AdminLogoutGate } from './AdminLogoutPending';

vi.mock('../../context/AuthContext', () => ({ useAuth: vi.fn() }));

afterEach(cleanup);

describe('pantalla de revocación administrativa', () => {
  it('usa el indicador y el color del panel mientras confirma el cierre', () => {
    useAuth.mockReturnValue({ logoutPending: true, logoutInFlight: true });
    render(<MemoryRouter initialEntries={['/admin/logout-pending']}>
      <AdminLogoutGate><div>Panel</div></AdminLogoutGate>
    </MemoryRouter>);

    const indicator = screen.getByRole('status', { name: 'Confirmando cierre seguro…' });
    expect(indicator).toHaveClass('admin-loading--admin');
    expect(indicator).not.toHaveClass('admin-loading--login');
  });

  it('oculta el login, explica el fallo y permite reintentar', () => {
    const retryPendingLogout = vi.fn();
    useAuth.mockReturnValue({
      logoutPending: true,
      logoutInFlight: false,
      logoutError: 'El servidor no confirmó el cierre.',
      retryPendingLogout,
    });
    render(<MemoryRouter initialEntries={['/admin/login']}>
      <AdminLogoutGate><div>Formulario de acceso</div></AdminLogoutGate>
    </MemoryRouter>);

    expect(screen.queryByText('Formulario de acceso')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cierre pendiente' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('El servidor no confirmó el cierre.');
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar cierre' }));
    expect(retryPendingLogout).toHaveBeenCalledTimes(1);
  });

  it('vuelve al login únicamente cuando el cierre ya fue confirmado', async () => {
    useAuth.mockReturnValue({ logoutPending: false, retryPendingLogout: vi.fn() });
    render(<MemoryRouter initialEntries={['/admin/logout-pending']}>
      <Routes>
        <Route path="/admin/login" element={<div>Acceso disponible</div>} />
        <Route path="/admin/logout-pending" element={<AdminLogoutGate><div>Panel</div></AdminLogoutGate>} />
      </Routes>
    </MemoryRouter>);
    expect(await screen.findByText('Acceso disponible')).toBeInTheDocument();
    expect(screen.queryByText('Panel')).not.toBeInTheDocument();
  });
});
