import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/adminCustomersApi', () => ({
  getAdminCustomerCrmAssignees: vi.fn(),
  getAdminCustomerCrmQueue: vi.fn(),
  recordAdminCustomerFollowUpResult: vi.fn(),
  updateAdminCustomerFollowUp: vi.fn(),
}));

import {
  getAdminCustomerCrmAssignees,
  getAdminCustomerCrmQueue,
  recordAdminCustomerFollowUpResult,
  updateAdminCustomerFollowUp,
} from '../api/adminCustomersApi';
import CustomerCrmWorkspace from './CustomerCrmWorkspace';

const followUp = {
  id: 'follow-up-1',
  customerId: 'customer-1',
  customer: { id: 'customer-1', fullName: 'Cliente CRM' },
  type: 'call',
  typeLabel: 'Llamada',
  status: 'pending',
  statusLabel: 'Pendiente',
  priority: 'urgent',
  priorityLabel: 'Urgente',
  note: 'Confirmar pago pendiente',
  nextAction: 'Llamar hoy',
  dueAt: '2026-08-31T15:00:00.000Z',
  assignedToAdmin: { id: 'admin-1', name: 'Asesora Principal' },
};

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  getAdminCustomerCrmAssignees.mockResolvedValue({
    ok: true,
    assignees: [{ id: 'admin-1', name: 'Asesora Principal' }],
  });
  getAdminCustomerCrmQueue.mockResolvedValue({
    ok: true,
    page: 1,
    pages: 1,
    total: 1,
    summary: { pending: 1, overdue: 1, today: 0, upcoming: 0, unscheduled: 0 },
    followUps: [followUp],
  });
  updateAdminCustomerFollowUp.mockResolvedValue({ ok: true });
  recordAdminCustomerFollowUpResult.mockResolvedValue({ ok: true });
});

describe('CustomerCrmWorkspace Etapa 3', () => {
  it('centraliza vencidos y exige un resultado verificable para cerrar', async () => {
    const onOpenCustomer = vi.fn();
    render(<CustomerCrmWorkspace onOpenCustomer={onOpenCustomer} />);

    expect(await screen.findByText('Cliente CRM')).toBeInTheDocument();
    expect(screen.getByText('Confirmar pago pendiente')).toBeInTheDocument();
    expect(screen.getAllByText('Urgente').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Cliente CRM' }));
    expect(onOpenCustomer).toHaveBeenCalledWith(followUp.customer);

    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog').parentElement).toBe(document.body);
    fireEvent.change(screen.getByLabelText('Resultado de la gestión'), {
      target: { value: 'payment_confirmed' },
    });
    fireEvent.change(screen.getByLabelText('Evidencia del resultado'), {
      target: { value: 'Cliente confirmó el pago por WhatsApp' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }));
    await waitFor(() => {
      expect(recordAdminCustomerFollowUpResult).toHaveBeenCalledWith(
        'customer-1',
        'follow-up-1',
        {
          outcome: 'payment_confirmed',
          outcomeNote: 'Cliente confirmó el pago por WhatsApp',
          nextAction: '',
          dueAt: null,
        }
      );
    });
    expect(updateAdminCustomerFollowUp).not.toHaveBeenCalledWith(
      'customer-1',
      'follow-up-1',
      expect.objectContaining({ status: 'done' })
    );
  });

  it('mantiene pendiente un intento sin respuesta y exige reprogramación', async () => {
    render(<CustomerCrmWorkspace />);
    expect(await screen.findByText('Cliente CRM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Registrar resultado' }));
    fireEvent.change(screen.getByLabelText('Resultado de la gestión'), {
      target: { value: 'no_answer' },
    });
    fireEvent.change(screen.getByLabelText('Evidencia del resultado'), {
      target: { value: 'Se llamó dos veces y no respondió' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }));

    expect(
      await screen.findByText(/Indica la siguiente acción/i)
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Siguiente acción'), {
      target: { value: 'Volver a llamar' },
    });
    fireEvent.change(screen.getByLabelText('Nueva fecha'), {
      target: { value: '2099-09-01T10:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar resultado' }));

    await waitFor(() => {
      expect(recordAdminCustomerFollowUpResult).toHaveBeenCalledWith(
        'customer-1',
        'follow-up-1',
        expect.objectContaining({
          outcome: 'no_answer',
          nextAction: 'Volver a llamar',
          dueAt: '2099-09-01T10:00',
        })
      );
    });
  });

  it('reinicia la cola al elegir vencidos y conserva paginación segura', async () => {
    render(<CustomerCrmWorkspace />);
    expect(await screen.findByText('Cliente CRM')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Vencidos/i }));
    await waitFor(() => {
      expect(getAdminCustomerCrmQueue).toHaveBeenLastCalledWith(
        expect.objectContaining({ dueScope: 'overdue', page: 1, limit: 25 })
      );
    });
  });
});
