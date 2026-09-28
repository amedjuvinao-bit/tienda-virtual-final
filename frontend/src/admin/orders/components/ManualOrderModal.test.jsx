import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import api from '../../../lib/api';
import ManualOrderModal from './ManualOrderModal';

vi.mock('../../../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('explica el plazo antes de crear, conserva el foco y cierra con Escape', async () => {
  api.get.mockResolvedValue({ data: { branches: [{ _id: '1', name: 'Principal', code: 'PR' }], products: [] } });
  const onClose = vi.fn();
  const opener = document.createElement('button');
  document.body.appendChild(opener);
  opener.focus();
  const view = render(<ManualOrderModal open onClose={onClose} onCreated={vi.fn()} />);

  const dialog = screen.getByRole('dialog', { name: 'Pedido pendiente de pago' });
  expect(dialog).toHaveTextContent('20 minutos');
  expect(dialog).toHaveTextContent('Confirma el pago solo cuando compruebes que lo recibiste.');
  expect(document.activeElement).toHaveAttribute('aria-label', 'Cerrar');
  expect(api.post).not.toHaveBeenCalled();
  await waitFor(() => expect(api.get).toHaveBeenCalled());

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalledOnce();
  view.rerender(<ManualOrderModal open={false} onClose={onClose} onCreated={vi.fn()} />);
  expect(document.activeElement).toBe(opener);
  opener.remove();
});
