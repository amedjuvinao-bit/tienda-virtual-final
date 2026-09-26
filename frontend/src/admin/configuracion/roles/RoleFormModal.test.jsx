import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import RoleFormModal from './RoleFormModal';

const catalog = [
  { key: 'appearance', label: 'Apariencia / diseño', permissions: [{ key: 'appearance:sections', label: 'Editar secciones', description: 'Editar la página de inicio.' }] },
  { key: 'customers', label: 'Clientes', permissions: [{ key: 'customers:view', label: 'Ver clientes', description: 'Consultar clientes.' }] },
  { key: 'finance', label: 'Finanzas', permissions: [{ key: 'finance:expenses:approve', label: 'Aprobar gastos', description: 'Autorizar gastos registrados.' }] },
  { key: 'pos', label: 'POS / ventas físicas', permissions: [{ key: 'pos:sell', label: 'Realizar ventas POS', description: 'Registrar ventas físicas.' }] },
];

afterEach(cleanup);

it('muestra primero los módulos asignados y permite agregar permisos con nombres comprensibles', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <RoleFormModal open mode="edit" role={{ _id: 'aux', name: 'Auxiliar', code: 'auxiliar', scope: 'branch', level: 50, status: 'active', permissions: ['customers:view'] }} availablePermissions={catalog.flatMap((module) => module.permissions.map((item) => item.key))} permissionCatalog={catalog} onSubmit={onSubmit} />
  );

  const modules = screen.getByRole('navigation', { name: 'Módulos para asignar permisos' });
  expect(within(modules).getByRole('button', { name: /Clientes/ })).toBeInTheDocument();
  expect(within(modules).queryByRole('button', { name: /Finanzas/ })).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Explorar todos (4)' }));
  await user.type(screen.getByRole('searchbox', { name: 'Buscar módulos' }), 'finanzas');
  await user.click(within(modules).getByRole('button', { name: /Finanzas/ }));
  await user.click(screen.getByRole('button', { name: /Aprobar gastos/ }));
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    code: 'auxiliar',
    permissions: ['customers:view', 'finance:expenses:approve'],
  }));
});

it('genera el código completo al crear un perfil aunque el campo técnico esté plegado', async () => {
  const user = userEvent.setup();
  const onSubmit = vi.fn();
  render(
    <RoleFormModal open mode="create" availablePermissions={['customers:view']} permissionCatalog={catalog} onSubmit={onSubmit} />
  );
  await user.type(screen.getByRole('textbox', { name: 'Nombre' }), 'Auxiliar de ventas');
  await user.click(screen.getByRole('button', { name: /Ver clientes/ }));
  await user.click(screen.getByRole('button', { name: 'Crear perfil' }));
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Auxiliar de ventas',
    code: 'auxiliar-de-ventas',
    permissions: ['customers:view'],
  }));
});
