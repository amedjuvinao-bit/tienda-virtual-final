import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SliderControls from './SliderControls';

describe('SliderControls', () => {
  it('muestra navegación accesible, usa el color configurado y ejecuta las acciones', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const onChoose = vi.fn();
    const { container, unmount } = render(<SliderControls count={3} current={1} progress={.5} color="#e9b7cc" showProgress onPrevious={onPrevious} onNext={onNext} onChoose={onChoose} />);
    expect(screen.getByRole('navigation', { name: 'Controles del slider' })).toHaveStyle({ '--rb-slider-color': '#e9b7cc' });
    expect(screen.getByRole('button', { name: 'Ir a la imagen 2' })).toHaveAttribute('aria-current', 'true');
    expect(container.querySelector('.rb-slider-controls__page[aria-current="true"] .rb-slider-controls__dot').style.backgroundImage).toContain('180deg');
    fireEvent.click(screen.getByRole('button', { name: 'Imagen anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Imagen siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ir a la imagen 3' }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(onChoose).toHaveBeenCalledWith(2);
    unmount();
  });

  it('no dibuja controles con una sola imagen y valida el color recibido', () => {
    const { rerender } = render(<SliderControls count={1} current={0} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(<SliderControls count={2} current={0} color="red; background:blue" />);
    expect(screen.getByRole('navigation')).toHaveStyle({ '--rb-slider-color': '#ffffff' });
  });
});
