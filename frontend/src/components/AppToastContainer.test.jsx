import React, { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { toast } from 'react-toastify';

import AppToastContainer from './AppToastContainer';

afterEach(() => {
  toast.dismiss();
  cleanup();
});

describe('AppToastContainer', () => {
  it('declara exactamente un ToastContainer en la raíz de la aplicación', () => {
    const sources = [
      resolve('src/main.jsx'),
      resolve('src/App.jsx'),
      resolve('src/components/AppToastContainer.jsx'),
    ].map((file) => readFileSync(file, 'utf8'));

    const declarations = sources.reduce(
      (total, source) =>
        total + (source.match(/<ToastContainer\b/g) || []).length,
      0
    );

    expect(declarations).toBe(1);
  });

  it('mantiene un único host durante el doble montaje de StrictMode', () => {
    render(
      <StrictMode>
        <AppToastContainer />
      </StrictMode>
    );

    act(() => {
      toast.error('Error de prueba', { autoClose: false });
    });

    expect(document.querySelectorAll('.Toastify__toast-container')).toHaveLength(1);
    expect(document.querySelectorAll('.Toastify__toast')).toHaveLength(1);
  });

  it('tolera cierre repetido y limpieza posterior sin removalReason', () => {
    const { unmount } = render(<AppToastContainer />);
    let toastId;

    act(() => {
      toastId = toast.loading('Cargando producto');
    });

    expect(() => {
      act(() => {
        toast.dismiss(toastId);
        toast.dismiss(toastId);
      });
    }).not.toThrow();

    unmount();

    expect(() => toast.dismiss(toastId)).not.toThrow();
  });
});
