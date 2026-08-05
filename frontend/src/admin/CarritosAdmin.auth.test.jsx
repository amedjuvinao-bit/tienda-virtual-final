import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const state = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    adminToken: null,
    authLoading: false,
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => state.auth,
}));
vi.mock('../lib/api', () => ({ default: state.api }));
vi.mock('react-toastify', () => ({ toast: state.toast }));

import CarritosAdmin from './CarritosAdmin';

describe('CarritosAdmin con sesion administrativa legitima', () => {
  beforeEach(() => {
    state.auth = {
      isAuthenticated: false,
      adminToken: null,
      authLoading: false,
    };
    state.api.get.mockReset();
    state.api.post.mockReset();
    state.api.patch.mockReset();
    state.api.put.mockReset();
    state.api.delete.mockReset();
    state.toast.error.mockReset();
    state.toast.success.mockReset();
    state.toast.info.mockReset();
    state.api.get.mockResolvedValue({
      data: { data: [], total: 0, totalPages: 1 },
    });
  });

  afterEach(() => cleanup());

  it('sin sesion valida no consulta ningun endpoint administrativo', async () => {
    render(<CarritosAdmin />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'sesion administrativa no es valida'
    );
    expect(state.api.get).not.toHaveBeenCalled();
    expect(state.api.post).not.toHaveBeenCalled();
    expect(state.api.patch).not.toHaveBeenCalled();
    expect(state.api.put).not.toHaveBeenCalled();
    expect(state.api.delete).not.toHaveBeenCalled();
  });

  it('una sesion validada por AuthContext conserva el listado', async () => {
    state.auth = {
      isAuthenticated: true,
      adminToken: 'header.payload.valid-admin-signature',
      authLoading: false,
    };
    render(<CarritosAdmin />);

    await waitFor(() => expect(state.api.get).toHaveBeenCalledTimes(2));
    expect(state.api.get.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining(['/api/cart/admin', '/api/cart/admin/summary'])
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('no quedan literales ni mecanismos alternativos en archivos de ejecucion', () => {
    const sourceRoot = path.resolve(process.cwd(), 'src');
    const files = [];
    const collect = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(target);
        else if (/\.(?:js|jsx)$/.test(entry.name)) files.push(target);
      }
    };
    collect(sourceRoot);
    const runtimeSource = files
      .filter((file) => !file.endsWith('.test.js') && !file.endsWith('.test.jsx'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');

    expect(runtimeSource).not.toContain('rosa_boutique_123_secreto');
    expect(runtimeSource).not.toMatch(/\bVITE_ADMIN_TOKEN\b/);
    expect(runtimeSource).not.toMatch(/x-admin-token/i);
  });

  it('las rutas administrativas conservan permisos y operaciones', () => {
    const require = createRequire(import.meta.url);
    const permissionMap = require(
      path.resolve(process.cwd(), '../backend/security/adminRoutePermissionMap.js')
    );
    const expected = [
      ['GET', 'carts:view', false, false],
      ['PUT', 'carts:delete', true, true],
      ['DELETE', 'carts:delete', true, true],
    ];
    for (const [method, permission, audit, danger] of expected) {
      const rule = permissionMap.findAdminRoutePermission(
        method,
        '/api/cart/admin/sess_admin_test'
      );
      expect(rule?.permission).toBe(permission);
      expect(rule?.audit === true).toBe(audit);
      expect(rule?.danger === true).toBe(danger);
    }

    const routeSource = fs.readFileSync(
      path.resolve(process.cwd(), '../backend/routes/cartRoutes.js'),
      'utf8'
    );
    expect(routeSource).toContain("router.get('/admin/:sessionId'");
    expect(routeSource).toContain("router.put('/admin/:sessionId'");
    expect(routeSource).toContain("router.delete('/admin/:sessionId'");
  });
});
