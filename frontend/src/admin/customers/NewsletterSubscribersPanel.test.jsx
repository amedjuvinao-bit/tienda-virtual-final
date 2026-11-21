import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/adminSubscriptionsApi', () => ({
  getAdminSubscriptions: vi.fn(), getAdminSubscription: vi.fn(),
}));
import { getAdminSubscriptions, getAdminSubscription } from '../api/adminSubscriptionsApi';
import NewsletterSubscribersPanel from './NewsletterSubscribersPanel';

const id = '6892bf18921919cef60becbb';
const subscriber = { id, email: 'persona@example.com', status: 'withdrawn', decisionAt: '2026-11-03T05:30:00Z' };
const proof = { status: 'withdrawn', method: 'email_code', recordedAt: subscriber.decisionAt,
  proofReference: 'newsletter:reference', version: 'aviso-v1', text: 'Retiro de comunicaciones comerciales.' };
function list(overrides = {}) { return { subscribers: [subscriber], total: 1, page: 1, pages: 1, ...overrides }; }
function detail(overrides = {}) { return { subscriber: { ...subscriber, consent: proof },
  events: [{ id: 'event-1', proof }], total: 1, page: 1, pages: 1, ...overrides }; }
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  getAdminSubscriptions.mockResolvedValue(list());
  getAdminSubscription.mockResolvedValue(detail());
});

describe('consulta de suscriptores desde Clientes', () => {
  it('consulta un correo sin ficha de cliente y muestra el retiro y su evidencia', async () => {
    render(<NewsletterSubscribersPanel initialSearch="persona@example.com" />);
    expect(await screen.findByText(subscriber.email)).toBeInTheDocument();
    expect(getAdminSubscriptions).toHaveBeenCalledWith(
      { q: subscriber.email, status: 'all', page: 1 }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(screen.getByText('Retiradas', { selector: 'span' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: `Ver evidencia de ${subscriber.email}` }));
    const panel = await screen.findByRole('region', { name: 'Detalle de suscripción' });
    expect(await within(panel).findByText(/Esta persona retiró/)).toBeInTheDocument();
    expect(within(panel).getAllByText('Código enviado al correo')).toHaveLength(2);
    expect(within(panel).getByText('Retiro', { selector: 'strong' })).toBeInTheDocument();
    fireEvent.click(within(panel).getByRole('button', { name: 'Volver al listado' }));
    expect(screen.queryByRole('region', { name: 'Detalle de suscripción' })).not.toBeInTheDocument();
  });

  it('filtra y pagina en el servidor; una búsqueda nueva vuelve a la primera página', async () => {
    getAdminSubscriptions.mockImplementation(({ page }) => Promise.resolve(list({ page, pages: 3, total: 45 })));
    render(<NewsletterSubscribersPanel />);
    await screen.findByText(subscriber.email);
    fireEvent.click(screen.getByRole('button', { name: 'Suscriptores: siguiente' }));
    await waitFor(() => expect(getAdminSubscriptions).toHaveBeenLastCalledWith(
      { q: '', status: 'all', page: 2 }, expect.anything()));
    await screen.findByText('Página 2 de 3');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'otro+correo@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar' }));
    await waitFor(() => expect(getAdminSubscriptions).toHaveBeenLastCalledWith(
      { q: 'otro+correo@example.com', status: 'all', page: 1 }, expect.anything()));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'withdrawn' } });
    await waitFor(() => expect(getAdminSubscriptions).toHaveBeenLastCalledWith(
      { q: 'otro+correo@example.com', status: 'withdrawn', page: 1 }, expect.anything()));
  });

  it('Actualizar vuelve a consultar tanto el listado como la evidencia abierta', async () => {
    getAdminSubscription.mockResolvedValueOnce(detail({ subscriber: { ...subscriber, status: 'granted', consent: { ...proof, status: 'granted' } } }));
    render(<NewsletterSubscribersPanel />);
    fireEvent.click(await screen.findByRole('button', { name: `Ver evidencia de ${subscriber.email}` }));
    await screen.findByText(/La autorización para recibir/);
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar suscriptores' }));
    expect(await screen.findByText(/Esta persona retiró/)).toBeInTheDocument();
    expect(getAdminSubscription).toHaveBeenCalledTimes(2);
    expect(getAdminSubscriptions).toHaveBeenCalledTimes(2);
  });

  it('muestra el error del servidor y permite reintentar sin presentarlo como lista vacía', async () => {
    getAdminSubscriptions.mockRejectedValueOnce(new Error('La consulta requiere acceso administrativo global.'));
    render(<NewsletterSubscribersPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('acceso administrativo global');
    expect(screen.queryByText(/No se encontraron/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar suscriptores' }));
    expect(await screen.findByText(subscriber.email)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('una respuesta antigua no reemplaza los resultados del filtro actual', async () => {
    let resolveOld;
    getAdminSubscriptions.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    render(<NewsletterSubscribersPanel />);
    const firstSignal = getAdminSubscriptions.mock.calls[0][1].signal;
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'withdrawn' } });
    expect(await screen.findByText(subscriber.email)).toBeInTheDocument();
    expect(firstSignal.aborted).toBe(true);
    resolveOld(list({ subscribers: [{ ...subscriber, email: 'antiguo@example.com' }] }));
    await waitFor(() => expect(screen.queryByText('antiguo@example.com')).not.toBeInTheDocument());
  });

  it('permite recorrer el historial durable y consultar el aviso comunicado', async () => {
    getAdminSubscription.mockImplementation((_id, { page }) => Promise.resolve(detail({
      page, pages: 2, total: 21,
      events: [{ id: `event-${page}`, proof: { ...proof, status: page === 1 ? 'withdrawn' : 'granted',
        privacyText: 'Aviso informado antes de confirmar.' } }],
    })));
    render(<NewsletterSubscribersPanel />);
    fireEvent.click(await screen.findByRole('button', { name: `Ver evidencia de ${subscriber.email}` }));
    await screen.findByText('Retiro', { selector: 'strong' });
    fireEvent.click(screen.getByRole('button', { name: 'Historial: siguiente' }));
    await screen.findByText('Autorización', { selector: 'strong' });
    expect(getAdminSubscription).toHaveBeenLastCalledWith(id, { page: 2 }, expect.anything());
    expect(screen.getByText('Aviso informado antes de confirmar.')).toBeInTheDocument();
  });
});
