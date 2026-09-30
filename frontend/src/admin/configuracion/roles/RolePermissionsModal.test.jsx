import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import RolePermissionsModal from './RolePermissionsModal';

it('permite revisar los módulos sin apilar todos los permisos y cerrar con Escape', async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <RolePermissionsModal
      open
      role={{
        _id: 'cashier',
        name: 'Cajero',
        code: 'cashier',
        permissions: ['customers:view', 'customers:create', 'inventory:view', 'orders:view'],
      }}
      onClose={onClose}
    />
  );

  const dialog = screen.getByRole('dialog', { name: 'Permisos de Cajero' });
  expect(dialog).toHaveTextContent('4 permisos en 3 módulos');
  expect(within(dialog).getByRole('navigation', { name: 'Módulos del perfil' })).toBeInTheDocument();
  expect(within(dialog).getByRole('region', { name: 'Permisos de Clientes' })).toHaveTextContent('Crear');
  expect(within(dialog).queryByRole('region', { name: 'Permisos de Órdenes' })).not.toBeInTheDocument();

  await user.click(within(dialog).getByRole('button', { name: 'Órdenes 1' }));
  expect(within(dialog).getByRole('region', { name: 'Permisos de Órdenes' })).toHaveTextContent('Ver');
  expect(within(dialog).queryByText('orders:view')).not.toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledOnce();
});
