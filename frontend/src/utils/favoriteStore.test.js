import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createFavoriteStore } from './favoriteStore';
import { getFavoriteAccess, storeFavoriteAccess } from './favoriteAccess';
import { favoriteKey } from './favoriteModel';
const a = { _id: 'product-a', title: 'Producto A', price: 100 };
const b = { _id: 'product-b', title: 'Producto B', price: 200 };
const stores = [];
function apiFor(items = []) {
  let rows = items,
    version = 0;
  const api = {
    post: vi.fn(async () => ({
      data: { sessionId: 'new-session', favoriteAccessToken: 'new-token' },
    })),
    get: vi.fn(async () => ({
      data: { items: rows, revision: `doc:${version}` },
    })),
    put: vi.fn(async (_url, body) => {
      if (
        body.revision !== `doc:${version}` &&
        !(body.revision === null && rows.length === 0)
      )
        throw { response: { status: 409 } };
      rows = body.items;
      version++;
      return {
        data: { favorites: { items: rows, revision: `doc:${version}` } },
      };
    }),
    replace(items) {
      rows = items;
      version++;
    },
    rows: () => rows,
  };
  return api;
}
function create(api) {
  const store = createFavoriteStore(api);
  stores.push(store);
  store.start();
  return store;
}
const settled = (store) =>
  vi.waitFor(() => expect(store.getState().loading).toBe(false));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  storeFavoriteAccess('session', 'token');
});
afterEach(() => {
  stores.splice(0).forEach((store) => store.stop());
  vi.restoreAllMocks();
});
it('adopta una lista vacía del servidor sin resucitar el respaldo ni escribir al leer', async () => {
  localStorage.setItem('favorites', JSON.stringify([a]));
  const api = apiFor([]),
    store = create(api);
  await settled(store);
  expect(store.getState().favorites).toEqual([]);
  expect(api.put).not.toHaveBeenCalled();
});
it('dos clics rápidos alternan usando el estado actual y conservan la última intención', async () => {
  const api = apiFor(),
    store = create(api);
  await settled(store);
  store.toggle(a);
  store.toggle(a);
  await settled(store);
  expect(store.getState().favorites).toEqual([]);
  expect(api.rows()).toEqual([]);
});
it('un conflicto vuelve a leer y aplica solo el cambio pendiente sin perder otra pestaña', async () => {
  const api = apiFor([a]);
  const put = api.put.getMockImplementation();
  let race = true;
  api.put.mockImplementation(async (...args) => {
    if (race) {
      race = false;
      api.replace([a, b]);
    }
    return put(...args);
  });
  const store = create(api);
  await settled(store);
  store.remove(a);
  await settled(store);
  expect(api.rows().map(favoriteKey)).toEqual([favoriteKey(b)]);
  expect(api.put).toHaveBeenCalledTimes(2);
});
it('mantiene una acción fallida, la restaura al recargar y reintenta sin duplicados', async () => {
  const api = apiFor([a]);
  api.put.mockRejectedValueOnce(new Error('Sin conexión'));
  const store = create(api);
  await settled(store);
  store.add(b);
  await settled(store);
  expect(store.getState()).toMatchObject({ syncError: true, pendingCount: 1 });
  expect(store.getState().favorites.map(favoriteKey)).toEqual([
    favoriteKey(a),
    favoriteKey(b),
  ]);
  store.stop();
  const restored = create(api);
  await settled(restored);
  expect(restored.getState()).toMatchObject({
    syncError: false,
    pendingCount: 0,
  });
  expect(api.rows().map(favoriteKey)).toEqual([favoriteKey(a), favoriteKey(b)]);
});
it('una notificación de otra pestaña actualiza eliminaciones sin hacer escrituras', async () => {
  const api = apiFor([a, b]),
    store = create(api);
  await settled(store);
  api.replace([b]);
  window.dispatchEvent(
    new StorageEvent('storage', { key: 'favorite_snapshot' })
  );
  await settled(store);
  expect(store.getState().favorites.map(favoriteKey)).toEqual([favoriteKey(b)]);
  expect(api.put).not.toHaveBeenCalled();
});
it('conserva el estado si falla la lectura y permite reintentar al volver la conexión', async () => {
  const api = apiFor([a]),
    store = create(api);
  await settled(store);
  api.get.mockRejectedValueOnce(new Error('503'));
  await store.sync();
  expect(store.getState().syncError).toBe(true);
  expect(store.getState().favorites).toHaveLength(1);
  await store.sync();
  expect(store.getState().syncError).toBe(false);
});
it('recupera acceso inválido solamente después de confirmar la restauración en el servidor', async () => {
  localStorage.setItem('favorites', JSON.stringify([a]));
  const api = apiFor();
  api.get.mockRejectedValueOnce({
    response: { status: 404, data: { error: 'FAVORITE_ACCESS_NOT_FOUND' } },
  });
  const store = create(api);
  await settled(store);
  expect(api.rows()).toHaveLength(1);
  expect(getFavoriteAccess()).toEqual({
    sessionId: 'new-session',
    token: 'new-token',
  });
  expect(store.getState().message).toContain('Recuperamos');
});
it('no cambia credenciales ni borra favoritos si la recuperación falla', async () => {
  localStorage.setItem('favorites', JSON.stringify([a]));
  const api = apiFor();
  api.get.mockRejectedValueOnce({
    response: { status: 404, data: { error: 'FAVORITE_ACCESS_NOT_FOUND' } },
  });
  api.put.mockRejectedValueOnce(new Error('503'));
  const store = create(api);
  await settled(store);
  expect(getFavoriteAccess()).toEqual({ sessionId: 'session', token: 'token' });
  expect(store.getState().favorites).toHaveLength(1);
  expect(store.getState().syncError).toBe(true);
});
it('rebasa un guardado a la sesión ganadora si otra pestaña cambia el acceso sin Web Locks', async () => {
  const lists = new Map([
    ['session', [a]],
    ['winning', [b]],
  ]);
  const versions = new Map([
    ['session', 0],
    ['winning', 0],
  ]);
  let switched = false;
  const api = {
    get: vi.fn(async (_url, options) => {
      const id = options.headers['X-Favorite-Session-Id'];
      return {
        data: { items: lists.get(id), revision: id + ':' + versions.get(id) },
      };
    }),
    put: vi.fn(async (_url, body, options) => {
      const id = options.headers['X-Favorite-Session-Id'];
      lists.set(id, body.items);
      versions.set(id, versions.get(id) + 1);
      if (!switched) {
        switched = true;
        storeFavoriteAccess('winning', 'winning-token');
      }
      return {
        data: {
          favorites: {
            items: body.items,
            revision: id + ':' + versions.get(id),
          },
        },
      };
    }),
  };
  const store = create(api);
  await settled(store);
  store.remove(a);
  await settled(store);
  expect(store.getState().syncError).toBe(false);
  expect(store.getState().favorites.map(favoriteKey)).toEqual([favoriteKey(b)]);
  expect(lists.get('winning').map(favoriteKey)).toEqual([favoriteKey(b)]);
  expect(api.put).toHaveBeenCalledTimes(2);
});
it('descarta filas dañadas del respaldo sin impedir abrir la tienda', async () => {
  localStorage.setItem(
    'favorites',
    JSON.stringify([
      null,
      { productId: 'x', variantKey: 'm__red', size: 'L', color: 'blue' },
      a,
    ])
  );
  const api = apiFor([a]),
    store = create(api);
  await settled(store);
  expect(store.getState().favorites).toHaveLength(1);
  expect(store.getState().syncError).toBe(false);
});
