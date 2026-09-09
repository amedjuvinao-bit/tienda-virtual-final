import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  certifyFinancePeriod,
  getFinanceClosingControl,
} from './api/financeApi';
import FinanceClosingPanel from './FinanceClosingPanel';

vi.mock('./api/financeApi', () => ({
  certifyFinancePeriod: vi.fn(),
  exportFinanceClosingCsv: vi.fn(),
  getFinanceClosingControl: vi.fn(),
}));

vi.mock('react-toastify', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const branch = { _id: 'branch-1', code: 'MAIN', name: 'Principal' };

function closingFixture(overrides = {}) {
  return {
    period: { periodKey: '2026-09', label: 'Corte provisional', status: 'provisional' },
    branch,
    snapshotHash: 'a'.repeat(64),
    drifted: false,
    close: null,
    readiness: {
      status: 'ready',
      okCount: 2,
      warningCount: 0,
      blockerCount: 0,
      checks: [
        { code: 'net-profit', label: 'Ecuación de utilidad', status: 'ok', message: 'La utilidad neta está conciliada.' },
        { code: 'cash', label: 'Diferencia de caja', status: 'ok', message: 'No hay diferencias de caja.' },
      ],
    },
    financial: { kpis: { revenue: 100000, netProfit: 25000 } },
    budget: { summary: { availableAmount: 30000, exceededCount: 0 } },
    treasury: { summary: { accountsReceivable: 40000, accountsPayable: 15000, projectedNet30: 25000 } },
    ...overrides,
  };
}

beforeEach(() => {
  getFinanceClosingControl.mockResolvedValue(closingFixture());
  certifyFinancePeriod.mockResolvedValue({ revision: 0, unchanged: false });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Cierre financiero mensual', () => {
  it('presenta cifras, controles y huella de la sede seleccionada', async () => {
    render(
      <FinanceClosingPanel
        selectedBranchId="branch-1"
        branches={[branch]}
        canCertify
        canExport
      />
    );

    expect(await screen.findByText('Listo para certificar')).toBeInTheDocument();
    expect(screen.getByText('Ecuación de utilidad')).toBeInTheDocument();
    expect(screen.getByText('Diferencia de caja')).toBeInTheDocument();
    expect(screen.getByText(/Huella: a{16}/)).toBeInTheDocument();
    expect(getFinanceClosingControl).toHaveBeenCalledWith({
      periodKey: '2026-09',
      branchId: 'branch-1',
    });
  });

  it('certifica con sede, periodo y una clave idempotente', async () => {
    const onDataChanged = vi.fn();
    render(
      <FinanceClosingPanel
        selectedBranchId="branch-1"
        branches={[branch]}
        canCertify
        onDataChanged={onDataChanged}
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Certificar corte' }));
    const dialog = screen.getByRole('dialog', { name: 'Certificar cierre financiero' });
    fireEvent.change(screen.getByLabelText('Nota del responsable'), {
      target: { value: 'Cifras revisadas por la administración.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar certificación' }));

    await waitFor(() => expect(certifyFinancePeriod).toHaveBeenCalledTimes(1));
    expect(certifyFinancePeriod.mock.calls[0][0]).toMatchObject({
      branchId: 'branch-1',
      periodKey: '2026-09',
      notes: 'Cifras revisadas por la administración.',
    });
    expect(certifyFinancePeriod.mock.calls[0][0].requestKey.length).toBeGreaterThanOrEqual(16);
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('impide certificar diferencias críticas sin autorización excepcional', async () => {
    getFinanceClosingControl.mockResolvedValueOnce(closingFixture({
      readiness: {
        status: 'blocked',
        okCount: 1,
        warningCount: 0,
        blockerCount: 1,
        checks: [{ code: 'cash-open', label: 'Sesiones de caja', status: 'blocker', message: 'Existe una sesión abierta.' }],
      },
    }));

    render(
      <FinanceClosingPanel
        selectedBranchId="branch-1"
        branches={[branch]}
        canCertify
        canOverride={false}
      />
    );

    const certifyButton = await screen.findByRole('button', { name: 'Certificar corte' });
    expect(certifyButton).toBeDisabled();
    expect(screen.getByText(/requieren el permiso de autorización excepcional/i)).toBeInTheDocument();
    fireEvent.click(certifyButton);
    expect(certifyFinancePeriod).not.toHaveBeenCalled();
  });

  it('usa una sola justificación al recertificar con una excepción', async () => {
    getFinanceClosingControl.mockResolvedValueOnce(closingFixture({
      close: { revision: 2, snapshotHash: 'b'.repeat(64) },
      drifted: true,
      readiness: {
        status: 'blocked',
        okCount: 1,
        warningCount: 0,
        blockerCount: 1,
        checks: [{ code: 'cash-open', label: 'Sesiones de caja', status: 'blocker', message: 'Existe una sesión abierta.' }],
      },
    }));

    render(
      <FinanceClosingPanel
        selectedBranchId="branch-1"
        branches={[branch]}
        canCertify
        canOverride
      />
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Actualizar certificación' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Justificación excepcional obligatoria'), {
      target: { value: 'Cierre autorizado mientras se corrige la diferencia.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar certificación' }));

    await waitFor(() => expect(certifyFinancePeriod).toHaveBeenCalledTimes(1));
    expect(certifyFinancePeriod.mock.calls[0][0]).toMatchObject({
      expectedRevision: 2,
      notes: 'Cierre autorizado mientras se corrige la diferencia.',
      overrideReason: 'Cierre autorizado mientras se corrige la diferencia.',
    });
  });

  it('solicita una sede específica antes de preparar el cierre', () => {
    render(<FinanceClosingPanel branches={[branch]} canCertify />);

    expect(screen.getByText('Selecciona una sede')).toBeInTheDocument();
    expect(getFinanceClosingControl).not.toHaveBeenCalled();
  });
});
