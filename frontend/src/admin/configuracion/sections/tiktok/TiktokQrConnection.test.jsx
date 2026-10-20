import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TiktokQrConnection from './TiktokQrConnection';
import TiktokSettings from '../TiktokSection';
import api from '../../../../lib/api';
vi.mock('../../../../lib/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }));
const BASE = '/api/admin/tiktok-settings';
const qr = () => ({ qrToken: 'a'.repeat(64), qrImage: 'data:image/png;base64,iVBORw0KGgo=', expiresAt: new Date(Date.now() + 600000).toISOString(), status: 'new' });
const connected = { revision: 2, connected: true, enabled: true, account: { name: 'Empresa' } };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); api.post.mockImplementation(async path => ({ data: path === `${BASE}/qr` ? qr() : { status: 'new' } })); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function start(props = {}) {
  const onWaiting = vi.fn(), onConnected = vi.fn();
  const result = render(<TiktokQrConnection revision={1} onWaiting={onWaiting} onConnected={onConnected} {...props} />);
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generar QR de TikTok' })));
  return { ...result, onWaiting, onConnected };
}
it('generates a QR, polls scanned state and installs confirmed settings without a browser popup', async () => {
  const popup = vi.spyOn(window, 'open');
  const { onConnected, onWaiting } = await start();
  expect(api.post).toHaveBeenCalledWith(`${BASE}/qr`, { revision: 1 }, expect.any(Object));
  expect(screen.getByAltText('Código QR para conectar la cuenta de TikTok')).toHaveAttribute('src', qr().qrImage);
  api.post.mockImplementation(async path => ({ data: path.endsWith('/check') ? { status: 'scanned' } : {} }));
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole('status')).toHaveTextContent('Confirma los permisos');
  api.post.mockResolvedValue({ data: { status: 'confirmed', settings: connected } });
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(onConnected).toHaveBeenCalledWith(connected); expect(onWaiting).toHaveBeenLastCalledWith(false);
  expect(screen.queryByAltText('Código QR para conectar la cuenta de TikTok')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Cuenta conectada'); expect(popup).not.toHaveBeenCalled(); popup.mockRestore();
});
it('replaces an expired QR with a fresh code instead of polling forever', async () => {
  await start(); api.post.mockResolvedValue({ data: { status: 'expired' } });
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole('status')).toHaveTextContent('caducó'); expect(screen.queryByRole('img')).toBeNull();
  const count = api.post.mock.calls.length; await act(async () => vi.advanceTimersByTimeAsync(30000)); expect(api.post).toHaveBeenCalledTimes(count);
  api.post.mockResolvedValue({ data: qr() });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generar nuevo QR' })));
  expect(screen.getByRole('img')).toBeTruthy();
});
it('cancels server authorization and ignores a late confirmed polling response', async () => {
  const { onConnected } = await start(); let finish;
  api.post.mockImplementation(path => path.endsWith('/check') ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ data: { status: 'cancelled' } }));
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar conexión QR' })));
  expect(api.post).toHaveBeenCalledWith(`${BASE}/qr/cancel`, { qrToken: 'a'.repeat(64) }, expect.any(Object));
  await act(async () => finish({ data: { status: 'confirmed', settings: connected } }));
  expect(onConnected).not.toHaveBeenCalledWith(connected); expect(screen.getByRole('button', { name: 'Generar QR de TikTok' })).toBeTruthy();
});
it('shows provider errors and lets the administrator generate another code', async () => {
  const { onWaiting } = await start();
  api.post.mockRejectedValue({ response: { status: 422, data: { message: 'Activa video.list en tu app.' } } });
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole('alert')).toHaveTextContent('Activa video.list'); expect(onWaiting).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole('button', { name: 'Generar nuevo QR' })).toBeEnabled();
});
it('keeps authorization visible if a cancellation request fails', async () => {
  await start(); api.post.mockRejectedValue({ response: { status: 503 } });
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancelar conexión QR' })));
  expect(screen.getByRole('img')).toBeTruthy(); expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cancelar');
});
it('stops polling and cancels on unmount', async () => {
  const { unmount } = await start(); unmount();
  expect(api.post).toHaveBeenCalledWith(`${BASE}/qr/cancel`, { qrToken: 'a'.repeat(64) }, expect.any(Object));
  const count = api.post.mock.calls.length; await act(async () => vi.advanceTimersByTimeAsync(30000)); expect(api.post).toHaveBeenCalledTimes(count);
});
it('enables QR for saved credentials with no return URL and keeps web authorization optional', async () => {
  api.get.mockResolvedValue({ data: { settings: { revision: 1, connected: false, enabled: true, encryptionReady: true, hasClientSecret: true, clientKey: 'client-key', redirectUri: '' } } });
  await act(async () => render(<TiktokSettings />));
  expect(screen.getByRole('button', { name: 'Generar QR de TikTok' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Conectar con TikTok en ventana web', hidden: true })).toBeDisabled();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generar QR de TikTok' })));
  expect(api.post).toHaveBeenCalledWith(`${BASE}/qr`, { revision: 1 }, expect.any(Object));
});
