import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalShell } from './SectionsPanelUI';

afterEach(cleanup);

describe('modal de Secciones', () => {
  it('queda por encima del contenedor de Apariencia y conserva el scroll al editar', async () => {
    const onClose = vi.fn();
    const view = render(
      <div style={{ transform: 'translateZ(0)', opacity: 0.5 }}>
        <ModalShell title="Editar sección" onClose={onClose}><p>Contenido</p></ModalShell>
      </div>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Editar sección' });
    expect(dialog.closest('.section-modal')?.parentElement).toBe(document.body);
    const scrollArea = dialog.querySelector('[data-section-modal-scroll]');
    expect(scrollArea).toBeInTheDocument();
    scrollArea.scrollTop = 180;
    view.rerender(<div style={{ transform: 'translateZ(0)', opacity: 0.5 }}>
      <ModalShell title="Editar sección" onClose={onClose}><p>Contenido actualizado</p></ModalShell>
    </div>);
    await waitFor(() => expect(screen.getByText('Contenido actualizado')).toBeInTheDocument());
    expect(scrollArea.scrollTop).toBe(180);
  });

  it('respeta el permiso de edición aunque el modal se dibuje fuera del panel', () => {
    render(<ModalShell title="Editar sección" disabled onClose={vi.fn()}>
      <input aria-label="Título" />
    </ModalShell>);
    expect(screen.getByRole('textbox', { name: 'Título' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeEnabled();
  });
});
