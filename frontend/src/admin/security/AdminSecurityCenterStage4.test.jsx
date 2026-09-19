import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import SeguridadSection from '../configuracion/sections/SeguridadSection';
import {
  getAdminSecurityCenter,
  getAdminTwoFactorStatus,
  revokeAdminSession,
} from '../api/adminAuthApi';

vi.mock('../api/adminAuthApi', () => ({
  confirmAdminTwoFactorReconfiguration: vi.fn(),
  confirmAdminTwoFactorSetup: vi.fn(),
  disableAdminTwoFactor: vi.fn(),
  getAdminSecurityCenter: vi.fn(),
  getAdminTwoFactorStatus: vi.fn(),
  regenerateAdminRecoveryCodes: vi.fn(),
  revokeAdminSession: vi.fn(),
  revokeAllAdminSessions: vi.fn(),
  revokeOtherAdminSessions: vi.fn(),
  startAdminTwoFactorReconfiguration: vi.fn(),
  startAdminTwoFactorSetup: vi.fn(),
}));

const center = {
  summary: {
    activeSessions: 2,
    knownDevices: 2,
    failedAttempts24Hours: 1,
    pendingAlerts: 1,
  },
  sessions: [
    {
      id: 'session-current',
      isCurrent: true,
      active: true,
      status: 'active',
      device: { label: 'Google Chrome · Windows', type: 'Computador' },
      ip: '127.0.0.1',
      createdAt: '2026-09-18T10:00:00.000Z',
      lastSeenAt: '2026-09-18T10:05:00.000Z',
      expiresAt: '2026-09-25T10:00:00.000Z',
    },
    {
      id: '507f1f77bcf86cd799439011',
      isCurrent: false,
      active: true,
      status: 'active',
      device: { label: 'Safari · iOS', type: 'Teléfono' },
      ip: '192.0.2.50',
      createdAt: '2026-09-18T09:00:00.000Z',
      lastSeenAt: '2026-09-18T09:05:00.000Z',
      expiresAt: '2026-09-25T09:00:00.000Z',
    },
  ],
  alerts: [
    {
      id: 'new-device:1',
      severity: 'medium',
      title: 'Nuevo dispositivo detectado',
      detail: 'Safari · iOS inició una sesión.',
      occurredAt: '2026-09-18T09:00:00.000Z',
    },
  ],
  activity: [
    {
      id: 'login:1',
      title: 'Inicio de sesión correcto',
      detail: 'Acceso correcto con autenticador',
      ip: '127.0.0.1',
      occurredAt: '2026-09-18T10:00:00.000Z',
    },
  ],
};

describe('Centro de seguridad administrativa Etapa 4', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminTwoFactorStatus.mockResolvedValue({
      ok: true,
      twoFactor: {
        enabled: true,
        required: true,
        compliant: true,
        recoveryCodesRemaining: 8,
      },
    });
    getAdminSecurityCenter.mockResolvedValue({ ok: true, security: center });
    revokeAdminSession.mockResolvedValue({
      ok: true,
      message: 'Sesión cerrada correctamente.',
    });
  });

  afterEach(cleanup);

  it('muestra sesiones, alertas e historial y protege el cierre con reautenticación', async () => {
    const user = userEvent.setup();
    render(<SeguridadSection />);

    expect(await screen.findByRole('heading', { name: 'Tu seguridad, en un solo vistazo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Sesiones/ }));
    expect(await screen.findByRole('heading', { name: 'Sesiones y dispositivos' })).toBeInTheDocument();
    expect(screen.getByText('Safari · iOS')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await user.type(screen.getByPlaceholderText('Contraseña para cerrar sesiones'), 'Password!123');
    await user.type(screen.getByPlaceholderText('Código de seguridad para cerrar sesiones'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar cierre' }));

    await waitFor(() => {
      expect(revokeAdminSession).toHaveBeenCalledWith(
        '507f1f77bcf86cd799439011',
        { currentPassword: 'Password!123', code: '123456' }
      );
    });

    await user.click(screen.getByRole('button', { name: /Alertas/ }));
    expect(await screen.findByText('Nuevo dispositivo detectado')).toBeInTheDocument();
    expect(screen.getByText('Inicio de sesión correcto')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Autenticación/ }));
    expect(screen.queryByRole('button', { name: 'Desactivar 2FA' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar aplicación 2FA' })).toBeInTheDocument();
  });
});
