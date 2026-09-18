import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TwoFactorChallengeModal from '../login/TwoFactorChallengeModal';
import SeguridadSection from '../configuracion/sections/SeguridadSection';
import {
  confirmAdminTwoFactorReconfiguration,
  confirmAdminTwoFactorSetup,
  getAdminSecurityCenter,
  getAdminTwoFactorStatus,
  startAdminTwoFactorReconfiguration,
  startAdminTwoFactorSetup,
  verifyAdminTwoFactor,
} from '../api/adminAuthApi';

vi.mock('../api/adminAuthApi', () => ({
  cancelAdminTwoFactorChallenge: vi.fn().mockResolvedValue({ ok: true }),
  confirmAdminTwoFactorReconfiguration: vi.fn(),
  confirmAdminTwoFactorSetup: vi.fn(),
  disableAdminTwoFactor: vi.fn(),
  getAdminTwoFactorStatus: vi.fn(),
  getAdminSecurityCenter: vi.fn(),
  revokeAdminSession: vi.fn(),
  revokeAllAdminSessions: vi.fn(),
  revokeOtherAdminSessions: vi.fn(),
  regenerateAdminRecoveryCodes: vi.fn(),
  startAdminTwoFactorReconfiguration: vi.fn(),
  startAdminTwoFactorSetup: vi.fn(),
  verifyAdminTwoFactor: vi.fn(),
}));

describe('Seguridad administrativa 2FA', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminTwoFactorStatus.mockResolvedValue({
      ok: true,
      twoFactor: { enabled: false, recoveryCodesRemaining: 0 },
    });
    getAdminSecurityCenter.mockResolvedValue({
      ok: true,
      security: {
        summary: {
          activeSessions: 1,
          knownDevices: 1,
          failedAttempts24Hours: 0,
          pendingAlerts: 0,
        },
        sessions: [],
        alerts: [],
        activity: [],
      },
    });
  });

  afterEach(cleanup);

  it('no completa el login hasta validar el código de seis dígitos', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    verifyAdminTwoFactor.mockResolvedValue({
      ok: true,
      user: { username: 'owner', twoFactorEnabled: true },
    });

    render(
      <TwoFactorChallengeModal
        open
        user={{ username: 'owner', displayName: 'Propietaria' }}
        onSuccess={onSuccess}
        onCancel={vi.fn()}
      />
    );

    await user.type(screen.getByPlaceholderText('000000'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verificar e ingresar' }));

    await waitFor(() => expect(verifyAdminTwoFactor).toHaveBeenCalledWith('123456'));
    expect(onSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.objectContaining({ username: 'owner' }) })
    );
  });

  it('activa TOTP mediante QR y muestra los códigos de recuperación una sola vez', async () => {
    const user = userEvent.setup();
    startAdminTwoFactorSetup.mockResolvedValue({
      ok: true,
      setup: {
        qrCodeDataUrl: 'data:image/png;base64,AA==',
        manualSecret: 'JBSWY3DPEHPK3PXP',
      },
    });
    confirmAdminTwoFactorSetup.mockResolvedValue({
      ok: true,
      message: 'Segundo factor activado correctamente.',
      recoveryCodes: ['ABCDE-23456', 'FGHJK-78923'],
      twoFactor: { enabled: true, recoveryCodesRemaining: 2 },
    });

    render(<SeguridadSection />);

    expect(await screen.findByRole('heading', { name: 'Autenticación en dos pasos' })).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText('Contraseña actual'), 'Password!123');
    await user.click(screen.getByRole('button', { name: 'Configurar 2FA' }));

    expect(await screen.findByAltText('Código QR para configurar autenticación en dos pasos')).toBeInTheDocument();
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Código de 6 dígitos'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar y activar' }));

    expect(await screen.findByText('ABCDE-23456')).toBeInTheDocument();
    expect(screen.getByText(/Solo se muestran una vez/)).toBeInTheDocument();
  });

  it('cambia la aplicación 2FA sin desactivar la protección anterior', async () => {
    const user = userEvent.setup();
    getAdminTwoFactorStatus.mockResolvedValue({
      ok: true,
      twoFactor: {
        enabled: true,
        required: true,
        compliant: true,
        recoveryCodesRemaining: 8,
      },
    });
    startAdminTwoFactorReconfiguration.mockResolvedValue({
      ok: true,
      message: 'Escanea el nuevo código QR.',
      setup: {
        qrCodeDataUrl: 'data:image/png;base64,BB==',
        manualSecret: 'NEWSECRET2345678',
      },
    });
    confirmAdminTwoFactorReconfiguration.mockResolvedValue({
      ok: true,
      message: 'Aplicación 2FA cambiada correctamente.',
      recoveryCodes: ['NEWCD-23456'],
      twoFactor: { enabled: true, recoveryCodesRemaining: 1 },
    });

    render(<SeguridadSection />);

    await user.click(await screen.findByRole('button', { name: 'Cambiar aplicación 2FA' }));
    await user.type(screen.getByPlaceholderText('Contraseña actual'), 'Password!123');
    await user.type(screen.getByPlaceholderText('Código TOTP o de recuperación'), '654321');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await waitFor(() => {
      expect(startAdminTwoFactorReconfiguration).toHaveBeenCalledWith({
        currentPassword: 'Password!123',
        code: '654321',
      });
    });
    expect(await screen.findByAltText('Nuevo código QR para cambiar la aplicación 2FA')).toBeInTheDocument();
    expect(screen.getByText('NEWSECRET2345678')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Código nuevo de 6 dígitos'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar cambio seguro' }));

    await waitFor(() => {
      expect(confirmAdminTwoFactorReconfiguration).toHaveBeenCalledWith('123456');
    });
    expect(await screen.findByText('NEWCD-23456')).toBeInTheDocument();
  });
});
