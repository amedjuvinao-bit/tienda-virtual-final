import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import CorreoSection from './CorreoSection';
import {
  getAdminMailSettings,
  sendAdminMailTest,
  updateAdminMailSettings,
} from '../../api/adminMailSettingsApi';

vi.mock('../../api/adminMailSettingsApi', () => ({
  getAdminMailSettings: vi.fn(),
  sendAdminMailTest: vi.fn(),
  updateAdminMailSettings: vi.fn(),
}));

function response(overrides = {}) {
  const readiness = overrides.readiness || {
    ready: false,
    canTest: true,
    tested: false,
    active: false,
    completed: 4,
    required: 5,
    checks: [
      { key: 'identity', label: 'Nombre de la tienda', ready: true },
      { key: 'sender', label: 'Correo remitente', ready: true },
      { key: 'server', label: 'Servidor de correo', ready: true },
      { key: 'credentials', label: 'Acceso protegido', ready: true },
      { key: 'test', label: 'Prueba recibida', ready: false },
    ],
  };
  return {
    ok: true,
    settings: {
      enabled: false,
      provider: 'gmail',
      fromName: 'Rosa Boutique',
      fromEmail: 'ventas@rosa.com',
      replyToEmail: 'soporte@rosa.com',
      smtpHost: 'smtp.gmail.com',
      smtpPort: 465,
      smtpSecurity: 'ssl',
      smtpUser: 'ventas@rosa.com',
      hasSmtpPassword: true,
      testEmail: 'owner@rosa.com',
      lastTestStatus: 'none',
      lastTestMessage: '',
      ...overrides.settings,
    },
    store: {
      name: 'Rosa Boutique',
      businessName: 'Rosa Boutique S.A.S.',
      email: 'rosa@gmail.com',
      supportEmail: 'soporte@rosa.com',
    },
    readiness,
    revision: overrides.revision ?? 3,
    meta: {
      providers: [
        { value: 'gmail', label: 'Gmail', description: 'Cuenta de Google.' },
        { value: 'smtp', label: 'Otro correo', description: 'Correo corporativo.' },
      ],
      securityTypes: [
        { value: 'ssl', label: 'SSL / TLS' },
        { value: 'starttls', label: 'STARTTLS' },
      ],
      presetDefaults: {
        gmail: { smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpSecurity: 'ssl' },
        smtp: { smtpHost: '', smtpPort: 465, smtpSecurity: 'ssl' },
      },
    },
    message: overrides.message,
  };
}

describe('CorreoSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    getAdminMailSettings.mockResolvedValue(response());
    updateAdminMailSettings.mockResolvedValue(response({ revision: 4, message: 'Configuración guardada.' }));
    sendAdminMailTest.mockResolvedValue(response({
      revision: 4,
      settings: {
        lastTestStatus: 'success',
        lastTestMessage: 'Prueba recibida en owner@rosa.com.',
      },
      readiness: {
        ready: true,
        canTest: true,
        tested: true,
        active: false,
        completed: 5,
        required: 5,
        checks: [
          { key: 'identity', label: 'Nombre de la tienda', ready: true },
          { key: 'sender', label: 'Correo remitente', ready: true },
          { key: 'server', label: 'Servidor de correo', ready: true },
          { key: 'credentials', label: 'Acceso protegido', ready: true },
          { key: 'test', label: 'Prueba recibida', ready: true },
        ],
      },
      message: 'Prueba recibida en owner@rosa.com.',
    }));
  });

  it('usa la identidad dinámica de Tienda y muestra solo una vista a la vez', async () => {
    const user = userEvent.setup();
    render(<CorreoSection />);

    expect(await screen.findByRole('heading', { name: 'Correo de Rosa Boutique' })).toBeInTheDocument();
    expect(screen.getByText('Nombre tomado de Configuración → Tienda')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '¿Quién envía los mensajes?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Acceso a la cuenta' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Abrir Acceso' }));
    expect(screen.getByRole('heading', { name: 'Acceso a la cuenta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '¿Quién envía los mensajes?' })).not.toBeInTheDocument();
  });

  it('reconoce la clave guardada sin mostrar su valor', async () => {
    const user = userEvent.setup();
    render(<CorreoSection />);
    await screen.findByRole('heading', { name: 'Correo de Rosa Boutique' });
    await user.click(screen.getByRole('button', { name: 'Abrir Acceso' }));

    expect(screen.getByLabelText(/Cambiar clave/)).toHaveValue('');
    expect(screen.getByLabelText(/Cambiar clave/)).toHaveAttribute('placeholder', '•••••••• configurada');
    expect(screen.getByText('Clave protegida')).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/encrypted|secret|password/i)).not.toBeInTheDocument();
  });

  it('guarda la configuración usando la revisión vigente', async () => {
    const user = userEvent.setup();
    render(<CorreoSection />);
    await screen.findByRole('heading', { name: 'Correo de Rosa Boutique' });

    const sender = screen.getByLabelText(/Correo remitente/);
    await user.clear(sender);
    await user.type(sender, 'pedidos@rosa.com');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await waitFor(() => expect(updateAdminMailSettings).toHaveBeenCalledTimes(1));
    expect(updateAdminMailSettings).toHaveBeenCalledWith(expect.objectContaining({
      revision: 3,
      settings: expect.objectContaining({
        fromEmail: 'pedidos@rosa.com',
        smtpPassword: '',
      }),
    }));
  });

  it('exige prueba recibida antes de ofrecer la activación', async () => {
    const user = userEvent.setup();
    render(<CorreoSection />);
    await screen.findByRole('heading', { name: 'Correo de Rosa Boutique' });
    await user.click(screen.getByRole('button', { name: 'Abrir Comprobar' }));

    expect(screen.getByRole('button', { name: 'Activar correos' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Enviar prueba' }));
    await waitFor(() => expect(sendAdminMailTest).toHaveBeenCalledWith({
      testEmail: 'owner@rosa.com',
      revision: 3,
    }));
    expect((await screen.findAllByText('Prueba recibida en owner@rosa.com.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Activar correos' })).toBeEnabled();
  });
});
