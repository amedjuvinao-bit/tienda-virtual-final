import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import InstagramSection from '../../../../components/InstagramSection';
import InstagramSectionUI from './InstagramSectionUI';
import { normalizeJournal } from './instagramJournalHelpers';
import { liquidLensPixels } from '../../../../components/instagram/liquidLensMap';

afterEach(cleanup);
const posts = [{ id: 'one', image: '/dress.jpg', link: 'https://instagram.com/p/dress/', alt: 'Vestido', custom: 'original' }];
const theme = { sections: [{ id: 'instagram', config: { posts, journalCardOpacity: 100, journalBlur: 25 } }] };
describe('Vidrio líquido del diario', () => {
  it('es transparente por defecto aunque el acabado anterior tuviera ajustes opacos', () => {
    const { container } = render(<InstagramSection theme={theme} />);
    expect(container.querySelector('.ig-journal')).toHaveAttribute('data-finish', 'liquid');
    expect(container.querySelector('.ig-journal').style.getPropertyValue('--igj-liquid-tint')).toBe('12%');
    expect(container.querySelector('.ig-journal').style.getPropertyValue('--igj-liquid-blur')).toBe('2px');
    expect(container.querySelectorAll('.ig-journal__liquid')).toHaveLength(3);
    expect(screen.getByRole('link', { name: 'Ver publicación: Vestido' })).toHaveAttribute('href', posts[0].link);
    expect(normalizeJournal({ journalGlassFinish: 'invalid' }).journalGlassFinish).toBe('liquid');
  });
  it('construye una lente con centro neutro, bordes opuestos y desplazamiento continuo', () => {
    const width = 100, height = 80, data = liquidLensPixels(width, height, 16, 12);
    const pixel = (x, y) => Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
    expect(pixel(50, 40)).toEqual([128, 128, 128, 255]);
    expect(pixel(1, 40)[0]).toBeGreaterThan(128);
    expect(pixel(98, 40)[0]).toBeLessThan(128);
    expect(pixel(50, 1)[1]).toBeGreaterThan(128);
    expect(pixel(50, 78)[1]).toBeLessThan(128);
    expect(Math.abs(pixel(10, 40)[0] - 128)).toBeLessThan(Math.abs(pixel(1, 40)[0] - 128));
    expect(pixel(5, 5)[0]).toBeGreaterThan(128);
    expect(pixel(5, 5)[1]).toBeGreaterThan(128);
  });
  it('guarda tinte y refracción y conserva las opciones anteriores para volver al esmerilado', () => {
    const save = vi.fn();
    function Editor() { const [value, setValue] = useState(theme); return <><InstagramSectionUI theme={value} setPath={(key, v) => setValue(t => ({ ...t, [key]: v }))} /><button onClick={() => save(value)}>Guardar prueba</button></>; }
    render(<Editor />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Pasos de edición' })).getByRole('button', { name: /Diseño/ }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Diseño de Instagram' })).getByRole('button', { name: 'Cristal' }));
    fireEvent.change(screen.getByLabelText('Tinte del vidrio líquido (%)'), { target: { value: '8' } });
    fireEvent.change(screen.getByLabelText('Editar cristal'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Distorsión del borde líquido (px)'), { target: { value: '36' } });
    fireEvent.change(screen.getByLabelText('Editar cristal'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Acabado del cristal'), { target: { value: 'frosted' } });
    expect(screen.getByLabelText('Opacidad del cristal (%)')).toHaveValue(100);
    fireEvent.change(screen.getByLabelText('Acabado del cristal'), { target: { value: 'liquid' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar prueba' }));
    expect(save.mock.calls[0][0].sections[0].config).toMatchObject({ journalGlassFinish: 'liquid', journalLiquidOpacity: 8, journalLiquidRefraction: 36, journalCardOpacity: 100, posts });
  });
  it('desmonta las lentes cuando se desactiva el cristal o se selecciona el esmerilado', () => {
    const { container, rerender } = render(<InstagramSection theme={theme} />);
    rerender(<InstagramSection theme={{ sections: [{ ...theme.sections[0], config: { posts, journalGlassFinish: 'frosted' } }] }} />);
    expect(container.querySelector('.ig-journal__liquid')).toBeNull();
    rerender(<InstagramSection theme={{ sections: [{ ...theme.sections[0], config: { posts, journalGlassEnabled: false } }] }} />);
    expect(container.querySelector('.ig-journal__liquid')).toBeNull();
  });
});
