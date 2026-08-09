import React, { StrictMode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const { apiGet, apiPut, toastError, toastSuccess } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  default: {
    get: apiGet,
    post: vi.fn(),
    put: apiPut,
  },
}));

vi.mock('react-toastify', () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

import FormularioProducto, {
  formatProductSaveError,
  normalizeLoadedVariants,
  shouldPreserveLegacyEmptyVariants,
} from './FormularioProducto';

describe('FormularioProducto: carga de edición', () => {
  it('acepta la doble ejecución de StrictMode sin mostrar un falso error de carga', async () => {
    const productId = '6a6bcb06c53f1f9391483ee9';
    const product = {
      _id: productId,
      sku: 'DEMO-TECH-001',
      title: 'DEMO Smartphone Pro · 4 atributos',
      price: 1250000,
      category: 'Tecnología',
      productType: 'physical',
      trackInventory: true,
      variantPreset: 'tech',
      variantAxes: [
        { key: 'capacidad', label: 'Capacidad', values: ['256GB', '512GB'] },
        { key: 'ram', label: 'RAM', values: ['12GB', '16GB'] },
        { key: 'color', label: 'Color', values: ['Azul', 'Negro'] },
        { key: 'conectividad', label: 'Conectividad', values: ['5G', 'eSIM + 5G'] },
      ],
      variants: [
        {
          variantKey:
            'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb',
          size: '256GB',
          color: 'Azul',
          attributes: [
            { key: 'capacidad', label: 'Capacidad', value: '256GB' },
            { key: 'ram', label: 'RAM', value: '12GB' },
            { key: 'color', label: 'Color', value: 'Azul' },
            { key: 'conectividad', label: 'Conectividad', value: '5G' },
          ],
          active: true,
        },
        {
          variantKey:
            'v2__capacidad=512gb__color=negro__conectividad=esim%20%2b%205g__ram=16gb',
          size: '512GB',
          color: 'Negro',
          attributes: [
            { key: 'capacidad', label: 'Capacidad', value: '512GB' },
            { key: 'ram', label: 'RAM', value: '16GB' },
            { key: 'color', label: 'Color', value: 'Negro' },
            { key: 'conectividad', label: 'Conectividad', value: 'eSIM + 5G' },
          ],
          active: true,
        },
      ],
    };

    apiGet.mockImplementation((url) => {
      if (url === `/api/products/admin/${productId}`) {
        return Promise.resolve({ data: product });
      }
      if (url === '/api/products/admin/taxonomy') {
        return Promise.resolve({
          data: { categories: [], collections: [], legacyCategories: [] },
        });
      }
      return Promise.reject(new Error(`Solicitud inesperada: ${url}`));
    });

    render(
      <StrictMode>
        <MemoryRouter initialEntries={[`/admin/productos/editar/${productId}`]}>
          <Routes>
            <Route
              path="/admin/productos/editar/:id"
              element={<FormularioProducto />}
            />
            <Route path="/admin/productos" element={<div>Lista</div>} />
          </Routes>
        </MemoryRouter>
      </StrictMode>
    );

    expect(
      await screen.findByDisplayValue('DEMO Smartphone Pro · 4 atributos')
    ).toBeInTheDocument();

    await waitFor(() => {
      const productRequests = apiGet.mock.calls.filter(
        ([url]) => url === `/api/products/admin/${productId}`
      );
      expect(productRequests).toHaveLength(2);
    });

    expect(toastError).not.toHaveBeenCalled();

    apiPut.mockResolvedValueOnce({ data: { ok: true } });
    fireEvent.change(
      screen.getByPlaceholderText(
        'Observaciones internas para inventario, compras o finanzas.'
      ),
      { target: { value: 'Cambio comprobado' } }
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(1));
    const [url, payload] = apiPut.mock.calls[0];
    expect(url).toBe(`/api/products/${productId}?mode=replace`);
    expect(payload.notes).toBe('Cambio comprobado');
    expect(payload.variants).toHaveLength(2);
    expect(payload.variants.map((variant) => variant.variantKey)).toEqual([
      'v2__capacidad=256gb__color=blue__conectividad=5g__ram=12gb',
      'v2__capacidad=512gb__color=black__conectividad=esim%20%2b%205g__ram=16gb',
    ]);
    payload.variants.forEach((variant) => {
      expect(['Azul', 'Negro']).not.toContain(variant.color);
      expect(variant.variantKey).not.toMatch(/color=(azul|negro)/);
      const colorAttribute = variant.attributes.find(
        (attribute) => attribute.key === 'color'
      );
      expect(['Azul', 'Negro']).not.toContain(colorAttribute?.value);
    });
  });

  it('reconstruye una clave heredada traducida usando la autoridad central', () => {
    const [variant] = normalizeLoadedVariants({
      variants: [
        {
          variantKey:
            'v2__capacidad=256gb__color=azul__conectividad=5g__ram=12gb',
          size: '256GB',
          color: 'Azul',
          attributes: [
            { key: 'capacidad', label: 'Capacidad', value: '256GB' },
            { key: 'ram', label: 'RAM', value: '12GB' },
            { key: 'color', label: 'Color', value: 'Azul' },
            { key: 'conectividad', label: 'Conectividad', value: '5G' },
          ],
        },
      ],
    });

    expect(variant.variantKey).toBe(
      'v2__capacidad=256gb__color=blue__conectividad=5g__ram=12gb'
    );
    expect(variant.color).toBe('blue');
    expect(
      variant.attributes.find((attribute) => attribute.key === 'color')?.value
    ).toBe('blue');
  });

  it('muestra el campo y mensaje devueltos por PRODUCT_VALIDATION_FAILED', () => {
    const message = formatProductSaveError({
      response: {
        status: 400,
        data: {
          error: 'PRODUCT_VALIDATION_FAILED',
          message: 'La información del producto no es válida.',
          errors: [
            {
              field: 'variants.0.color',
              code: 'CANONICAL_VALUE_REQUIRED',
              message:
                'El color debe usar su valor canónico interno, no la etiqueta visible.',
            },
            {
              field: 'variants.0.variantKey',
              code: 'VARIANT_KEY_MISMATCH',
              message:
                'variantKey no corresponde con los valores canónicos de la variante.',
            },
          ],
        },
      },
    });

    expect(message).toContain('variants.0.color:');
    expect(message).toContain('variants.0.variantKey:');
    expect(message).not.toBe('La información del producto no es válida.');
  });

  it('conserva variants vacío mientras no cambien los ejes de un producto legado', () => {
    expect(
      shouldPreserveLegacyEmptyVariants({
        isEditing: true,
        loadedHadExplicitVariants: false,
        loadedAxesSignature: JSON.stringify([]),
        currentAxes: [],
      })
    ).toBe(true);

    expect(
      shouldPreserveLegacyEmptyVariants({
        isEditing: true,
        loadedHadExplicitVariants: false,
        loadedAxesSignature: JSON.stringify([]),
        currentAxes: [
          { key: 'color', label: 'Color', values: ['Azul'] },
        ],
      })
    ).toBe(false);
  });
});
