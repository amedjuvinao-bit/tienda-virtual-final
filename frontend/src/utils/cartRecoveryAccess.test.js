import { describe, expect, it, vi } from 'vitest';
import {
  buildCartRecoveryHeaders,
  clearCartRecoveryFragment,
  readCartRecoveryFragment,
} from './cartRecoveryAccess';

const sessionId = `cart_${'a'.repeat(32)}`;
const credential = `cr1_${'b'.repeat(43)}.${'c'.repeat(43)}`;

describe('acceso por enlace de recuperacion', () => {
  it('lee credenciales exclusivamente del fragmento no enviado al servidor', () => {
    expect(readCartRecoveryFragment({ hash: `#cart=${sessionId}&recovery=${credential}` }))
      .toEqual({ sessionId, recoveryToken: credential });
  });

  it('rechaza una sesion o firma manipulada', () => {
    expect(readCartRecoveryFragment({ hash: `#cart=otro&recovery=${credential}` })).toBeNull();
    expect(readCartRecoveryFragment({ hash: `#cart=${sessionId}&recovery=cr1_invalido` })).toBeNull();
  });

  it('elimina el fragmento antes de continuar', () => {
    const replaceState = vi.fn();
    clearCartRecoveryFragment(
      { pathname: '/carrito', search: '?vista=lista' },
      { replaceState }
    );
    expect(replaceState).toHaveBeenCalledWith(null, '', '/carrito?vista=lista');
  });

  it('envia la recuperacion en encabezados dedicados', () => {
    expect(buildCartRecoveryHeaders({ sessionId, recoveryToken: credential })).toEqual({
      'X-Session-Id': sessionId,
      'X-Cart-Recovery-Token': credential,
    });
  });
});
