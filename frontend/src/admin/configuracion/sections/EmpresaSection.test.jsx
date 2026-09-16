import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EmpresaSection from './EmpresaSection';
import {
  fetchStoreCities,
  fetchStoreRegions,
  fetchStoreSettings,
  saveStoreSettings,
} from '../api/storeSettingsApi';

vi.mock('../api/storeSettingsApi', () => ({
  fetchStoreSettings: vi.fn(),
  saveStoreSettings: vi.fn(),
  fetchStoreRegions: vi.fn(),
  fetchStoreCities: vi.fn(),
}));

const INITIAL_STORE = {
  name: 'Rosa Boutique',
  businessName: 'Rosa Boutique S.A.S.',
  email: 'contacto@rosa.example',
  phone: '+573001234567',
  whatsapp: '+573017654321',
  supportEmail: 'soporte@rosa.example',
  website: 'https://rosa.example',
  address: 'Calle 20 # 4-15',
  city: 'Santa Marta',
  cityCode: '47001',
  department: 'Magdalena',
  departmentCode: '47',
  country: 'CO',
  timezone: 'America/Bogota',
  locale: 'es-CO',
  customerServiceHours: 'Lunes a sábado, 8:00 a. m. a 6:00 p. m.',
  weeklySchedule: null,
};

function settings(overrides = {}) {
  return {
    ok: true,
    store: { ...INITIAL_STORE, ...overrides },
    revision: 7,
    updatedAt: '2026-09-15T12:00:00.000Z',
    updatedBy: 'owner',
  };
}

describe('EmpresaSection', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    fetchStoreSettings.mockResolvedValue(settings());
    fetchStoreRegions.mockResolvedValue([{ code: '47', name: 'Magdalena' }]);
    fetchStoreCities.mockResolvedValue([
      { code: '47001', name: 'Santa Marta' },
      { code: '47189', name: 'Ciénaga' },
    ]);
    saveStoreSettings.mockResolvedValue({
      ...settings({ name: 'Rosa Boutique Premium' }),
      revision: 8,
    });
  });

  it('organiza Tienda en tres secciones compactas sin mezclar datos fiscales', async () => {
    const user = userEvent.setup();
    render(<EmpresaSection />);

    expect(await screen.findByText('Identidad de la tienda')).toBeInTheDocument();
    expect(screen.queryByText('Canales de contacto')).not.toBeInTheDocument();
    expect(screen.getByText(/datos fiscales continúan exclusivamente en Facturación/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Contacto/i }));
    expect(screen.getByText('Canales de contacto')).toBeInTheDocument();
    expect(screen.queryByText('Identidad de la tienda')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Operación/i }));
    expect(screen.getByText('Operación principal')).toBeInTheDocument();
    expect(screen.getByLabelText(/Zona horaria/i)).toHaveValue('America/Bogota');
  });

  it('guarda sólo el contrato de Tienda con la revisión vigente', async () => {
    const user = userEvent.setup();
    render(<EmpresaSection />);

    const name = await screen.findByLabelText(/Nombre comercial/i);
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();

    await user.clear(name);
    await user.type(name, 'Rosa Boutique Premium');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(saveStoreSettings).toHaveBeenCalledTimes(1));
    expect(saveStoreSettings).toHaveBeenCalledWith({
      store: { ...INITIAL_STORE, name: 'Rosa Boutique Premium' },
      revision: 7,
    });
    expect(await screen.findByText(/quedaron guardados y sincronizados/i)).toBeInTheDocument();
    expect(screen.getByText('Versión 8')).toBeInTheDocument();
  });

  it('bloquea datos inválidos y lleva al administrador al campo pendiente', async () => {
    const user = userEvent.setup();
    render(<EmpresaSection />);

    await screen.findByText('Identidad de la tienda');
    await user.click(screen.getByRole('button', { name: /Contacto/i }));
    const phone = screen.getByLabelText(/Teléfono principal/i);
    await user.clear(phone);
    await user.type(phone, 'teléfono inválido');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(saveStoreSettings).not.toHaveBeenCalled();
    expect(screen.getByText('Escribe un teléfono principal válido.')).toBeInTheDocument();
    expect(phone).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/Hay datos pendientes/i)).toBeInTheDocument();
  });

  it('informa conflictos y permite recargar la versión más reciente', async () => {
    const user = userEvent.setup();
    saveStoreSettings.mockRejectedValue({
      response: {
        data: {
          error: 'STORE_SETTINGS_CONFLICT',
          message: 'Otra persona actualizó los datos de la tienda.',
        },
      },
    });
    render(<EmpresaSection />);

    const name = await screen.findByLabelText(/Nombre comercial/i);
    await user.clear(name);
    await user.type(name, 'Cambio local');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText(/Otra persona actualizó/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Recargar versión actual' }));
    await waitFor(() => expect(fetchStoreSettings).toHaveBeenCalledTimes(2));
  });

  it('recupera códigos históricos y ofrece municipio dependiente del departamento', async () => {
    const user = userEvent.setup();
    fetchStoreSettings.mockResolvedValue(settings({ departmentCode: '', cityCode: '' }));
    render(<EmpresaSection />);

    await screen.findByText('Identidad de la tienda');
    await user.click(screen.getByRole('button', { name: /Operación/i }));

    const department = await screen.findByLabelText(/^Departamento/i);
    await waitFor(() => expect(department).toHaveValue('47'));
    expect(fetchStoreRegions).toHaveBeenCalledWith('CO');
    await waitFor(() => expect(fetchStoreCities).toHaveBeenCalledWith('CO', '47'));
    await waitFor(() => expect(screen.getByLabelText(/^Municipio/i)).toHaveValue('47001'));

    await user.selectOptions(screen.getByLabelText(/^Municipio/i), '47189');
    expect(screen.getByLabelText(/^Municipio/i)).toHaveValue('47189');
  });

  it('configura un horario semanal rápido y permite jornada dividida', async () => {
    const user = userEvent.setup();
    render(<EmpresaSection />);

    await screen.findByText('Identidad de la tienda');
    await user.click(screen.getByRole('button', { name: /Operación/i }));
    await user.click(screen.getByRole('button', { name: 'Lun–Sáb' }));

    expect(screen.getByLabelText(/Hora de apertura del lunes, turno 1/i)).toHaveValue('08:00');
    expect(screen.getAllByText(/Lunes a sábado: 8:00 a. m. – 6:00 p. m./i)).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Segundo turno' })[0]);
    expect(screen.getByLabelText(/Hora de cierre del lunes, turno 1/i)).toHaveValue('12:00');
    expect(screen.getByLabelText(/Hora de apertura del lunes, turno 2/i)).toHaveValue('14:00');
  });
});
