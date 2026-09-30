import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import MediaBackupSection from './MediaBackupSection';
import api from '../../../lib/api';

vi.mock('../../../lib/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

describe('copia de imágenes y archivos', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (url) => url.endsWith('/media-readiness')
      ? { data: { ready: true, checks: [] } } : { data: { runs: [] } });
  });

  it('requiere confirmación del propietario antes de pausar la tienda', async () => {
    api.post.mockResolvedValue({ data: { id: 'a'.repeat(24) } });
    render(<MediaBackupSection enabled maintenance={{ phase: 'inactivo', maintenance: false }} />);
    const button = await screen.findByRole('button', { name: 'Crear copia de archivos' });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Contraseña para copia de archivos'), { target: { value: 'correcta' } });
    fireEvent.change(screen.getByLabelText('Código de seguridad para archivos'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar y crear copia de archivos' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/admin/backup-preferences/media-start',
      { currentPassword: 'correcta', twoFactorCode: '123456', frontendCloud: import.meta.env.VITE_CLOUDINARY_CLOUD || '' }));
  });

  it('descarga archivo cifrado y después el inventario con dos acciones separadas', async () => {
    const id = 'b'.repeat(24);
    const run = { id, status: 'verificado', available: true, size: 3, sha256: 'c'.repeat(64),
      startedAt: '2026-09-30T10:00:00Z', cloudinaryCount: 2, localCount: 1, steps: [] };
    api.get.mockImplementation(async (url) => url.endsWith('/media-readiness')
      ? { data: { ready: true, checks: [] } } : url.endsWith('/media-runs')
        ? { data: { runs: [run] } } : { data: { ...run, inventory: [] } });
    api.post.mockResolvedValue({ data: { url: `/api/admin/backup-preferences/media-runs/${id}/file` } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = vi.fn(() => 'blob:media-test');
    URL.revokeObjectURL = vi.fn();
    try {
      render(<MediaBackupSection enabled maintenance={{ phase: 'inactivo', maintenance: false }} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Descargar archivos cifrados' }));
      fireEvent.change(screen.getByLabelText('Contraseña para descarga de archivos'), { target: { value: 'correcta' } });
      fireEvent.change(screen.getByLabelText('Código para descarga de archivos'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar descarga de archivos' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/admin/backup-preferences/media-runs/${id}/native-download`,
        { currentPassword: 'correcta', twoFactorCode: '123456' }));
      await waitFor(() => expect(click).toHaveBeenCalledOnce());
      expect(click.mock.instances[0].href).toBe(`http://localhost:5000/api/admin/backup-preferences/media-runs/${id}/file`);
      fireEvent.click(await screen.findByRole('button', { name: 'Descargar inventario de archivos' }));
      await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
      expect(URL.createObjectURL).toHaveBeenCalledOnce();
    } finally {
      click.mockRestore();
      delete URL.createObjectURL;
      delete URL.revokeObjectURL;
    }
  });

  it('escribe copias grandes por fragmentos cuando el navegador permite guardar en disco', async () => {
    const id = 'c'.repeat(24);
    const run = { id, status: 'verificado', available: true, size: 3,
      startedAt: '2026-09-30T10:00:00Z', cloudinaryCount: 1, localCount: 0, steps: [] };
    api.get.mockImplementation(async (url) => url.endsWith('/media-readiness')
      ? { data: { ready: true, checks: [] } } : { data: { runs: [run] } });
    const writer = { write: vi.fn(), close: vi.fn(), abort: vi.fn() };
    window.showSaveFilePicker = vi.fn(async () => ({ createWritable: async () => writer }));
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async () => ({ ok: true, body: new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array([1, 2])); controller.enqueue(new Uint8Array([3])); controller.close(); },
    }) }));
    try {
      render(<MediaBackupSection enabled maintenance={{ phase: 'inactivo', maintenance: false }} />);
      fireEvent.click(await screen.findByRole('button', { name: 'Descargar archivos cifrados' }));
      fireEvent.change(screen.getByLabelText('Contraseña para descarga de archivos'), { target: { value: 'correcta' } });
      fireEvent.change(screen.getByLabelText('Código para descarga de archivos'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar descarga de archivos' }));
      await waitFor(() => expect(writer.close).toHaveBeenCalledOnce());
      expect(writer.write).toHaveBeenCalledTimes(2);
      expect(api.post).not.toHaveBeenCalled();
    } finally { delete window.showSaveFilePicker; global.fetch = originalFetch; }
  });

  it('resume el historial de archivos y muestra los detalles solo al solicitarlos', async () => {
    const runs = Array.from({ length: 4 }, (_, index) => ({
      id: String(index).repeat(24), status: 'verificado', available: true,
      startedAt: '2026-09-30T10:00:00Z', cloudinaryCount: 2, localCount: 1,
      sha256: 'f'.repeat(64), steps: [{ name: 'Extracción comprobada' }],
    }));
    api.get.mockImplementation(async (url) => url.endsWith('/media-readiness')
      ? { data: { ready: true, checks: [] } } : { data: { runs } });
    render(<MediaBackupSection enabled maintenance={{ phase: 'inactivo', maintenance: false }} />);
    await waitFor(() => expect(screen.getAllByText('Ver prueba e información técnica')).toHaveLength(3));
    expect(screen.getAllByText('Ver prueba e información técnica')[0].closest('details')).not.toHaveAttribute('open');
    fireEvent.click(screen.getByRole('button', { name: 'Ver 1 copia anterior' }));
    expect(screen.getAllByText('Ver prueba e información técnica')).toHaveLength(4);
    fireEvent.click(screen.getAllByText('Ver prueba e información técnica')[0]);
    expect(screen.getAllByText('Ver prueba e información técnica')[0].closest('details')).toHaveAttribute('open');
    expect(screen.getAllByText('Ver prueba e información técnica')[0].closest('details')).toHaveTextContent('Extracción comprobada');
  });
});
