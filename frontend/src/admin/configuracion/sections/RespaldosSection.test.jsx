import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RespaldosSection from './RespaldosSection';
import api from '../../../lib/api';

vi.mock('../../../lib/api', () => ({ default: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));

describe('preferencia de respaldos', () => {
  afterEach(cleanup);
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { strategy: null, revision: 0, backupVerified: false } });
  });

  it('advierte que la elección no crea una copia y guarda la preferencia con su revisión', async () => {
    api.put.mockResolvedValue({ data: { strategy: 'free_manual', revision: 1, backupVerified: false } });
    render(<RespaldosSection />);

    expect(screen.getByText('Respaldo sin verificar')).toBeInTheDocument();
    const freeOption = await screen.findByRole('radio', { name: /Atlas Free/ });
    expect(screen.getByText(/Atlas Free no ofrece copias administradas/)).toBeInTheDocument();
    expect(screen.getByText(/Flex no ofrece recuperación a un instante preciso/)).toBeInTheDocument();
    expect(screen.getAllByText('Ventajas')).toHaveLength(2);
    expect(screen.getAllByText('Riesgos y límites')).toHaveLength(2);
    fireEvent.click(freeOption);
    fireEvent.click(screen.getByRole('button', { name: 'Guardar método elegido' }));

    await waitFor(() => expect(api.put).toHaveBeenCalledWith('/api/admin/backup-preferences', {
      strategy: 'free_manual', revision: 0,
    }));
    expect(await screen.findByText(/El respaldo sigue pendiente/)).toBeInTheDocument();
    expect(screen.getByText('Respaldo sin verificar')).toBeInTheDocument();
  });

  it('expone el conflicto entre dos sesiones sin afirmar que se guardó', async () => {
    api.put.mockRejectedValue({ response: { data: { message: 'La preferencia cambió en otra sesión. Actualiza la página.' } } });
    render(<RespaldosSection />);

    fireEvent.click(await screen.findByRole('radio', { name: /Atlas de pago/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar método elegido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('La preferencia cambió en otra sesión');
    expect(screen.queryByText(/Preferencia guardada/)).not.toBeInTheDocument();
  });

  it('muestra la evidencia de restauración y exige reautenticación antes de descargar', async () => {
    const id = 'a'.repeat(24);
    api.get.mockImplementation(async (path) => path.endsWith('/runs')
      ? { data: { runs: [{ id, status: 'verificado', available: true, database: 'tienda_virtual',
        startedAt: '2026-09-29T00:00:00.000Z', completedAt: '2026-09-29T00:01:00.000Z',
        sha256: 'b'.repeat(64), restoreTest: { collections: 2, documents: 10, indexes: 3 }, steps: [] }] } }
      : { data: { strategy: 'free_manual', revision: 1, backupVerified: false } });
    render(<RespaldosSection />);
    expect(await screen.findByText('Última copia verificada')).toBeInTheDocument();
    expect(screen.getByText(/2 colecciones, 10 documentos y 3 índices/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descargar copia cifrada' }));
    expect(screen.getByLabelText('Contraseña actual')).toBeRequired();
    expect(screen.getByLabelText('Código de 6 dígitos')).toBeRequired();
    expect(api.post).not.toHaveBeenCalled();
  });
});
