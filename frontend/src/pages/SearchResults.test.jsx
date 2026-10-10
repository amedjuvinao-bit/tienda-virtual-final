import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SearchResults from './SearchResults';

vi.mock('../components/Header', () => ({ default: () => <div>Header</div> }));
vi.mock('../components/FooterSection', () => ({ default: () => <div>Footer</div> }));
vi.mock('../components/ProductCard', () => ({ default: ({ product }) => <article>{product.title}</article> }));

beforeEach(() => { global.fetch = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mount = (url) => render(<MemoryRouter initialEntries={[url]}><Routes><Route path="/buscar" element={<SearchResults />} /></Routes></MemoryRouter>);

describe('resultados de búsqueda pública', () => {
  it('consulta productos publicados con la búsqueda codificada y muestra paginación', async () => {
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ products: [{ _id: 'p1', title: 'Vestido Rosa' }], pagination: { page: 1, limit: 24, totalProducts: 25, totalPages: 2, hasNextPage: true } }) });
    mount('/buscar?q=vestido%20rosa');
    expect(await screen.findByText('Vestido Rosa')).toBeInTheDocument();
    expect(global.fetch.mock.calls[0][0]).toContain('/api/products?q=vestido+rosa&page=1&limit=24');
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeEnabled();
  });

  it('explica cuando no hay coincidencias y no consulta si la búsqueda está vacía', async () => {
    mount('/buscar');
    expect(screen.getByText('Escribe una palabra para explorar el catálogo.')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    cleanup();
    global.fetch.mockResolvedValue({ ok: true, json: async () => ({ products: [], pagination: { page: 1, limit: 24, totalProducts: 0, totalPages: 0 } }) });
    mount('/buscar?q=inexistente');
    await waitFor(() => expect(screen.getByText(/No encontramos productos/)).toBeInTheDocument());
  });

  it('permite reintentar después de un fallo de red', async () => {
    global.fetch.mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ products: [{ _id: 'p2', title: 'Bolso' }], pagination: { page: 1, limit: 24, totalProducts: 1, totalPages: 1 } }) });
    mount('/buscar?q=bolso');
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los resultados');
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Bolso')).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
