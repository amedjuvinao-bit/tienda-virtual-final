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

it('pide municipio y datos fiscales al crear la orden manual', async () => {
  api.get.mockImplementation((url) => {
    if (url.includes('/branches')) return Promise.resolve({ data: { branches: [{ _id: '1', name: 'Principal', code: 'PR' }] } });
    if (url.includes('/products')) return Promise.resolve({ data: { products: [{ _id: 'a', title: 'Producto', price: 10000, variants: [] }] } });
    if (url.includes('/regions')) return Promise.resolve({ data: [{ code: '47', name: 'Magdalena' }] });
    return Promise.resolve({ data: [{ code: '47001', name: 'Santa Marta' }] });
  });
  api.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/quote')
    ? { pricing: { subtotal: 10000, total: 10000 } }
    : { order: { _id: 'order-1', orderNumber: '000257', total: 10000 } } }));

  render(<ManualOrderModal open onClose={vi.fn()} onCreated={vi.fn()} />);
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Ana' } });
  fireEvent.change(screen.getByLabelText('Apellido'), { target: { value: 'Prueba' } });
  fireEvent.change(screen.getByLabelText('Documento'), { target: { value: '123456' } });
  fireEvent.change(screen.getByLabelText('Correo o teléfono'), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText('Correo fiscal'), { target: { value: 'ana@example.com' } });
  fireEvent.change(screen.getByLabelText('Dirección fiscal'), { target: { value: 'Calle 1' } });
  await waitFor(() => expect(screen.getByRole('option', { name: 'Magdalena' })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Departamento fiscal'), { target: { value: '47' } });
  await waitFor(() => expect(screen.getByRole('option', { name: 'Santa Marta' })).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Municipio fiscal'), { target: { value: '47001' } });
  await waitFor(() => expect(screen.getByRole('button', { name: /Producto.*10.000/ })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Producto.*10.000/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Revisar total' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/orders/admin/manual/quote', expect.objectContaining({
    billing: expect.objectContaining({ municipalityCode: '47001', departmentCode: '47', email: 'ana@example.com' }),
  })));
  fireEvent.click(screen.getByRole('button', { name: 'Crear pedido pendiente de pago' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/orders/admin/manual', expect.objectContaining({
    billing: expect.objectContaining({ municipalityCode: '47001', address: 'Calle 1', documentNumber: '123456' }),
  })));
});
