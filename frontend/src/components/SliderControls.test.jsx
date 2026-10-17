import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SliderControls from './SliderControls';

afterEach(cleanup);

describe('SliderControls', () => {
  it('muestra navegación accesible, usa el color configurado y ejecuta las acciones', () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    const { rerender, unmount } = render(<SliderControls count={3} current={1} progress={.5} color="#e9b7cc" theme="orbit" showProgress onPrevious={onPrevious} onNext={onNext} />);
    expect(screen.getByRole('navigation', { name: 'Controles del slider' })).toHaveStyle({ '--rb-slider-color': '#e9b7cc' });
    expect(screen.getByRole('navigation', { name: 'Controles del slider' })).toHaveAttribute('data-theme', 'orbit');
    expect(screen.queryByText('02')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ir a la imagen/ })).not.toBeInTheDocument();
    rerender(<SliderControls count={3} current={1} progress={.5} color="#e9b7cc" theme="orbit" showCounter showProgress onPrevious={onPrevious} onNext={onNext} />);
    expect(screen.getByLabelText('Imagen 2 de 3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imagen anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Imagen siguiente' }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    unmount();
  });

  it('no dibuja controles con una sola imagen y valida el color recibido', () => {
    const { rerender } = render(<SliderControls count={1} current={0} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    rerender(<SliderControls count={2} current={0} color="red; background:blue" />);
    expect(screen.getByRole('navigation')).toHaveStyle({ '--rb-slider-color': '#ffffff' });
  });

  it('distingue los cuatro temas y limita posición y tamaño', () => {
    const { rerender } = render(<SliderControls count={3} current={0} theme="minimal" position="left" size={125} />);
    const controls = screen.getByRole('navigation');
    expect(controls).toHaveAttribute('data-theme', 'minimal');
    expect(controls).toHaveAttribute('data-position', 'left');
    expect(controls).toHaveStyle({ '--rb-slider-scale': '1.25' });
    rerender(<SliderControls count={3} current={0} theme="petal" />);
    expect(controls).toHaveAttribute('data-theme', 'petal');
    rerender(<SliderControls count={3} current={0} theme="editorial" position="bottom" size={200} />);
    expect(controls).toHaveAttribute('data-theme', 'editorial');
    expect(controls).toHaveAttribute('data-position', 'bottom');
    expect(controls).toHaveStyle({ '--rb-slider-scale': '1.4' });
    expect(screen.queryByText('01')).not.toBeInTheDocument();
  });
});
