import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TwoFactorChallengeModal from '../login/TwoFactorChallengeModal';
import SeguridadSection from '../configuracion/sections/SeguridadSection';
import {
  confirmAdminTwoFactorSetup,
  getAdminTwoFactorStatus,
  startAdminTwoFactorSetup,
  verifyAdminTwoFactor,
} from '../api/adminAuthApi';

vi.mock('../api/adminAuthApi', () => ({
  cancelAdminTwoFactorChallenge: vi.fn().mockResolvedValue({ ok: true }),
  confirmAdminTwoFactorSetup: vi.fn(),
  disableAdminTwoFactor: vi.fn(),
  getAdminTwoFactorStatus: vi.fn(),
  regenerateAdminRecoveryCodes: vi.fn(),
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
});
