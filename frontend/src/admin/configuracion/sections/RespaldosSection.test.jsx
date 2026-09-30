import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RespaldosSection from './RespaldosSection';
import api from '../../../lib/api';

vi.mock('../../../lib/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

describe('preferencia de respaldos', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation(async (path) => {
      if (path.endsWith('/runs')) return { data: { runs: [] } };
      if (path.endsWith('/readiness')) return { data: { ready: true, checks: [] } };
      if (path.endsWith('/status')) return { data: { phase: 'inactivo', maintenance: false } };
      return { data: { strategy: null, revision: 0, backupVerified: false } };
    });
  });

  it('advierte que la elección no crea una copia y guarda la preferencia con su revisión', async () => {
    api.put.mockResolvedValue({ data: { strategy: 'free_manual', revision: 1, backupVerified: false } });
    render(<RespaldosSection />);

    await waitFor(() => expect(screen.getAllByText('Sin copia verificada en este servidor')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: 'Crear copia ahora' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '1. Método' }));
    const freeOption = await screen.findByRole('radio', { name: /Atlas Free/ });
    fireEvent.click(freeOption);
    expect(screen.getByText(/Atlas Free no ofrece copias administradas/)).toBeInTheDocument();
    expect(screen.getAllByText('Ventajas')).toHaveLength(1);
    expect(screen.getAllByText('Riesgos y límites')).toHaveLength(1);
    fireEvent.click(screen.getByRole('radio', { name: /Atlas de pago/ }));
    expect(screen.getByText(/Flex no ofrece recuperación a un instante preciso/)).toBeInTheDocument();
    fireEvent.click(freeOption);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar método elegido' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/backup-preferences', {
      strategy: 'free_manual', revision: 0,
    }));
    expect(await screen.findByText(/Método guardado/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Resumen' }));
    expect(screen.getByText('Atlas Free configurado')).toBeInTheDocument();
    expect(screen.getAllByText('Sin copia verificada en este servidor')).toHaveLength(2);
  });

  it('expone el conflicto entre dos sesiones sin afirmar que se guardó', async () => {
    api.put.mockRejectedValue({ response: { data: { message: 'La preferencia cambió en otra sesión. Actualiza la página.' } } });
    render(<RespaldosSection />);

    fireEvent.click(screen.getByRole('tab', { name: '1. Método' }));
    fireEvent.click(await screen.findByRole('radio', { name: /Atlas de pago/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar método elegido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La preferencia cambió en otra sesión');
    expect(screen.queryByText(/Preferencia guardada/)).not.toBeInTheDocument();
  });

  it('muestra la evidencia de restauración y exige reautenticación antes de descargar', async () => {
    const id = 'a'.repeat(24);
    api.get.mockImplementation(async (path) => path.endsWith('/backup-preferences/runs')
      ? { data: { runs: [{ id, status: 'verificado', available: true, database: 'tienda_virtual',
        startedAt: '2026-09-29T00:00:00.000Z', completedAt: '2026-09-29T00:01:00.000Z',
        sha256: 'b'.repeat(64), restoreTest: { collections: 2, documents: 10, indexes: 3 }, steps: [] }] } }
      : { data: { strategy: 'free_manual', revision: 1, backupVerified: false } });
    render(<RespaldosSection />);
    expect(await screen.findByText(/Verificada ·/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '2. Base de datos' }));
    fireEvent.click(screen.getByText('Ver prueba e información técnica'));
    expect(screen.getByText(/2 colecciones, 10 documentos y 3 índices/)).toBeInTheDocument();
    const downloadButton = screen.getByRole('button', { name: 'Descargar copia cifrada' });
    fireEvent.click(downloadButton);
    expect(downloadButton.closest('li')).toContainElement(screen.getByRole('heading', { name: 'Confirmar descarga' }));
    expect(screen.getByLabelText('Contraseña actual')).toBeRequired();
    expect(screen.getByLabelText('Código de 6 dígitos')).toBeRequired();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('descarga el archivo tras confirmar y deja el registro para una segunda acción explícita', async () => {
    const id = 'a'.repeat(24);
    const run = { id, status: 'verificado', available: true, size: 3, database: 'tienda_virtual',
      startedAt: '2026-09-29T00:00:00.000Z', completedAt: '2026-09-29T00:01:00.000Z',
      sha256: 'b'.repeat(64), restoreTest: { collections: 2, documents: 10, indexes: 3 }, steps: [] };
    api.get.mockImplementation(async (path) => path.endsWith('/backup-preferences/runs') ? { data: { runs: [run] } }
      : { data: { strategy: 'free_manual', revision: 1 } });
    api.post.mockResolvedValue({ data: new Blob(['abc']) });
    const createObjectURL = vi.fn(() => 'blob:backup-test');
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<RespaldosSection />);
      fireEvent.click(screen.getByRole('tab', { name: '2. Base de datos' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Descargar copia cifrada' }));
      fireEvent.change(screen.getByLabelText('Contraseña actual'), { target: { value: 'correcta' } });
      fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y descargar' }));
      await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/api/admin/backup-preferences/runs/${id}/download`,
        { currentPassword: 'correcta', twoFactorCode: '123456' }, { responseType: 'blob', timeout: 0 }));
      expect(await screen.findByRole('button', { name: 'Descargar registro de la copia' })).toBeInTheDocument();
      expect(click).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Descargar registro de la copia' }));
      expect(click).toHaveBeenCalledTimes(2);
      expect(createObjectURL).toHaveBeenCalledTimes(2);
    } finally {
      click.mockRestore();
      delete URL.createObjectURL;
      delete URL.revokeObjectURL;
    }
  });

  it('inicia la pausa desde el panel con contraseña y TOTP del propietario', async () => {
    api.get.mockImplementation(async (path) => {
      if (path.endsWith('/runs')) return { data: { runs: [] } };
      if (path.endsWith('/readiness')) return { data: { ready: true, checks: [] } };
      if (path.endsWith('/status')) return { data: { phase: 'inactivo', maintenance: false } };
      return { data: { strategy: 'free_manual', revision: 1 } };
    });
    api.post.mockResolvedValue({ data: { id: 'a'.repeat(24) } });
    render(<RespaldosSection />);
    fireEvent.click(screen.getByRole('tab', { name: '2. Base de datos' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Crear copia ahora' }));
    fireEvent.change(screen.getByLabelText('Contraseña del propietario'), { target: { value: 'contraseña-segura' } });
    fireEvent.change(screen.getByLabelText('Código de 6 dígitos'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pausar tienda y crear copia' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/admin/backup-preferences/start', {
      currentPassword: 'contraseña-segura', twoFactorCode: '123456',
    }));
    expect(await screen.findByText('Tienda en mantenimiento')).toBeInTheDocument();
  });

  it('muestra el proceso en una vista corta y permite navegar con teclado', async () => {
    render(<RespaldosSection />);
    expect(screen.getByRole('tabpanel', { name: 'Resumen' })).toBeVisible();
    expect(screen.getByRole('button', { name: /Paso 1 · Elección/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paso 2 · Datos/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paso 3 · Archivos/ })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Resumen' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '1. Método' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: '1. Método' })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: '3. Imágenes y archivos' }));
    expect(await screen.findByRole('heading', { name: 'Copia de imágenes y archivos' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear copia ahora' })).not.toBeInTheDocument();
  });

  it('resume el historial y permite consultar las copias anteriores', async () => {
    const runs = Array.from({ length: 4 }, (_, index) => ({
      id: String(index).repeat(24), status: 'fallido', database: 'tienda_virtual',
      startedAt: '2026-09-29T00:00:00.000Z', steps: [],
    }));
    api.get.mockImplementation(async (path) => path.endsWith('/backup-preferences/runs')
      ? { data: { runs } } : path.endsWith('/media-runs') ? { data: { runs: [] } }
        : { data: { strategy: 'free_manual', revision: 1 } });
    render(<RespaldosSection />);
    fireEvent.click(screen.getByRole('tab', { name: '2. Base de datos' }));
    await waitFor(() => expect(screen.getAllByText('Ver prueba e información técnica')).toHaveLength(3));
    fireEvent.click(screen.getByRole('button', { name: 'Ver 1 copia anterior' }));
    expect(screen.getAllByText('Ver prueba e información técnica')).toHaveLength(4);
  });
});
