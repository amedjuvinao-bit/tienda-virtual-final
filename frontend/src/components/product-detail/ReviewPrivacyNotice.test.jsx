import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import api from '../../lib/api';
import ReviewPrivacyNotice from './ReviewPrivacyNotice';
import useReviewPrivacy from './useReviewPrivacy';
vi.mock('../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const policy = { ready: true, version: 'review-1',
  text: 'Autorizo a Tienda de prueba a publicar mi nombre, calificación y comentario. Estos datos serán visibles en la página del producto.',
  seller: { legalName: 'Tienda de prueba', notificationAddress: 'Calle de prueba', email: 'ayuda@example.com', phone: '3000000000' },
};
function Harness({ productKey = 'p1', preview = false }) {
  const state = useReviewPrivacy(!preview, productKey);
  return <><ReviewPrivacyNotice state={state} preview={preview}/>
    <output aria-label="Decisión de reseña">{String(state.authorized)}</output>
    <button onClick={state.retry}>Actualizar información</button></>;
}
beforeEach(() => { vi.clearAllMocks(); api.get.mockResolvedValue({ data: { policy } }); });
afterEach(cleanup);
it('explica los datos públicos y el responsable sin marcar ni enviar una autorización al cargar', async () => {
  render(<Harness/>);
  const checkbox = await screen.findByRole('checkbox', { name: policy.text });
  expect(checkbox).not.toBeChecked();
  expect(screen.getByText(/Responsable: Tienda de prueba/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Datos personales y derechos' })).toHaveAttribute('href', '/privacidad');
  fireEvent.click(checkbox);
  expect(screen.getByLabelText('Decisión de reseña')).toHaveTextContent('true');
  expect(api.post).not.toHaveBeenCalled();
});
it('no toma la decisión antes de cargar la información ni la conserva después de actualizarla', async () => {
  let complete;
  api.get.mockReturnValueOnce(new Promise(resolve => { complete = resolve; }));
  render(<Harness/>);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  await act(async () => complete({ data: { policy } }));
  fireEvent.click(await screen.findByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar información' }));
  expect(await screen.findByRole('checkbox')).not.toBeChecked();
});
it('no reutiliza una decisión al abrir otro producto', async () => {
  const view = render(<Harness/>);
  fireEvent.click(await screen.findByRole('checkbox'));
  view.rerender(<Harness productKey="p2"/>);
  await waitFor(() => expect(screen.getByLabelText('Decisión de reseña')).toHaveTextContent('false'));
  expect(await screen.findByRole('checkbox')).not.toBeChecked();
});
it('permite recuperar una carga fallida sin conceder permisos', async () => {
  api.get.mockRejectedValueOnce(new Error('network'));
  render(<Harness/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar');
  fireEvent.click(screen.getByRole('button', { name: 'Reintentar información de reseñas' }));
  expect(await screen.findByRole('checkbox')).not.toBeChecked();
});
it('una tienda incompleta conserva la consulta sin presentar una decisión ficticia', async () => {
  api.get.mockResolvedValueOnce({ data: { policy: { ...policy, ready: false } } });
  render(<Harness/>);
  expect(await screen.findByText(/La tienda debe completar su información de privacidad/)).toHaveTextContent('Puedes consultar las reseñas existentes');
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
it('la vista previa no solicita políticas ni publica reseñas', () => {
  render(<Harness preview/>);
  expect(screen.getByText(/La vista previa no publica reseñas/)).toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});
