import React, { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BannerTemplatePanel from './BannerTemplatePanel';

afterEach(cleanup);

function Editor() {
  const [theme, setTheme] = useState({ banner: { templateId: 'discovery' }, sections: [{ id: 'categorias', config: { slides: [
    { id: 'hogar', title: 'Hogar', href: '/categoria/hogar', enabled: true },
    { id: 'regalos', title: 'Regalos', href: '/categoria/regalos', enabled: true },
  ] } }] });
  const setPath = (path, value) => setTheme((previous) => {
    const draft = structuredClone(previous);
    const keys = path.split('.');
    let cursor = draft;
    for (const key of keys.slice(0, -1)) cursor = cursor[key] ||= {};
    cursor[keys.at(-1)] = value;
    return draft;
  });
  const [placingCard, setPlacingCard] = useState(null);
  return <><output data-testid="state">{JSON.stringify(theme.banner)}</output><button onClick={() => setPath('banner.templateId', 'editorial')}>Editorial</button><button onClick={() => setPath('banner.templateId', 'discovery')}>Descubrimiento</button><button onClick={() => setPath('banner.templateId', 'atelier')}>Vitrina</button><BannerTemplatePanel theme={theme} setPath={setPath} uploading={false} setUploading={() => {}} uploadToCloudinaryViaBackend={vi.fn()} placingCard={placingCard} onStartPlacing={setPlacingCard} /></>;
}

describe('editor de plantillas', () => {
  it('conserva el texto de cada diseño al cambiar y solo ofrece categorías existentes', () => {
    render(<Editor />);
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi portada' } });
    fireEvent.click(screen.getByRole('button', { name: /Editorial/ }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Mi editorial' } });
    fireEvent.click(screen.getByRole('button', { name: /Descubrimiento/ }));
    expect(screen.getByLabelText('Título').value).toBe('Mi portada');
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    const select = screen.getByLabelText('Usar esta categoría');
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(['Hogar', 'Regalos']);
    expect(screen.getAllByLabelText('Usar esta categoría')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Acceso 2/ }));
    fireEvent.change(screen.getByLabelText('Texto visible'), { target: { value: 'Un regalo' } });
    fireEvent.click(screen.getByRole('button', { name: '② Botones' }));
    fireEvent.change(screen.getByLabelText('Texto del botón'), { target: { value: 'Comprar' } });
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.editorial.title).toBe('Mi editorial');
    expect(saved.templateConfigs.discovery.cards[1].text).toBe('Un regalo');
    expect(saved.templateConfigs.discovery.primary.text).toBe('Comprar');
  });

  it('guarda la posición y el color de cada punto de la vitrina', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: 'Vitrina' }));
    fireEvent.click(screen.getByRole('button', { name: '③ Categorías' }));
    fireEvent.click(screen.getByRole('button', { name: 'Señalar lugar en la imagen' }));
    expect(screen.getByText(/Ahora haz clic en el objeto/)).toHaveTextContent('vista previa');
    fireEvent.change(screen.getByLabelText('Punto horizontal %'), { target: { value: '31' } });
    fireEvent.change(screen.getByLabelText('Punto vertical %'), { target: { value: '62' } });
    fireEvent.change(screen.getByLabelText('Color de línea y punto'), { target: { value: '#de468a' } });
    const saved = JSON.parse(screen.getByTestId('state').textContent);
    expect(saved.templateConfigs.atelier.cards[0]).toEqual(expect.objectContaining({ x: 31, y: 62, lineColor: '#de468a' }));
    expect(saved.templateConfigs.atelier.cards[1]).toEqual(expect.objectContaining({ x: 74, y: 52 }));
  });

  it('explica por qué un botón visible no abre nada hasta configurar su enlace', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: '② Botones' }));
    expect(screen.getByText(/Este botón aún no abre ninguna página/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Al hacer clic, ir a'), { target: { value: '/categoria/hogar' } });
    expect(screen.queryByText(/Este botón aún no abre ninguna página/)).toBeNull();
  });
});
