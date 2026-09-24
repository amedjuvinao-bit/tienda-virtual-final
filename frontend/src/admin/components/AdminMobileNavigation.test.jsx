import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  UserRound,
} from 'lucide-react';
import { afterEach, describe, expect, it } from 'vitest';
import AdminMobileNavigation from './AdminMobileNavigation';

afterEach(cleanup);

const primaryLinks = [
  { to: '/admin/dashboard', label: 'Dashboard', mobileLabel: 'Inicio', icon: LayoutDashboard },
  { to: '/admin/productos', label: 'Productos', icon: Package },
  { to: '/admin/ordenes', label: 'Órdenes', icon: ClipboardList },
];

const groups = [
  {
    label: 'Operación',
    links: [{ to: '/admin/clientes', label: 'Clientes', icon: UserRound }],
  },
  {
    label: 'Configuración',
    links: [{ to: '/admin/configuracion/panel-admin', label: 'Panel admin', icon: Settings }],
  },
];

function renderNavigation(initialEntry = '/admin/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AdminMobileNavigation primaryLinks={primaryLinks} groups={groups} />
    </MemoryRouter>,
  );
}

describe('AdminMobileNavigation', () => {
  it('mantiene únicamente tres destinos primarios y el acceso Más', () => {
    renderNavigation();

    const navigation = screen.getByRole('navigation', { name: 'Navegación móvil principal' });
    expect(navigation).toHaveTextContent('Inicio');
    expect(navigation).toHaveTextContent('Productos');
    expect(navigation).toHaveTextContent('Órdenes');
    expect(navigation).toHaveTextContent('Más');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('abre una bandeja accesible y permite filtrar módulos', () => {
    renderNavigation('/admin/clientes');

    const moreButton = screen.getByRole('button', { name: 'Más' });
    expect(moreButton).toHaveAttribute('data-active', 'true');
    fireEvent.click(moreButton);

    expect(screen.getByRole('dialog', { name: 'Módulos del panel' })).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Buscar un módulo del panel' });
    fireEvent.change(search, { target: { value: 'panel' } });

    expect(screen.getByRole('link', { name: 'Panel admin' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Clientes' })).not.toBeInTheDocument();
  });

  it('cierra la bandeja después de navegar a un módulo', async () => {
    renderNavigation();
    fireEvent.click(screen.getByRole('button', { name: 'Más' }));
    fireEvent.click(screen.getByRole('link', { name: 'Clientes' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
