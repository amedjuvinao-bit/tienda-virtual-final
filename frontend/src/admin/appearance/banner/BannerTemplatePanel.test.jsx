import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BannerTemplatePanel from './BannerTemplatePanel';

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
  return <><output data-testid="state">{JSON.stringify(theme.banner)}</output><button onClick={() => setPath('banner.templateId', 'editorial')}>Editorial</button><button onClick={() => setPath('banner.templateId', 'discovery')}>Descubrimiento</button><BannerTemplatePanel theme={theme} setPath={setPath} uploading={false} setUploading={() => {}} uploadToCloudinaryViaBackend={vi.fn()} /></>;
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
});
