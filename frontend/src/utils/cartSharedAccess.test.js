import { expect, it, vi } from 'vitest';
import { mergeCartSelections, readSharedCart } from './cartSharedAccess';
const access = { sessionId: 'shared', token: 'safe' };
const item = (id, qty) => ({
  _id: id,
  productId: id,
  qty,
  quantity: qty,
  variantKey: 'default__default',
  price: 100,
});
const toBackendItem = (item) => item;
it('unifica carritos separados sin duplicar cantidades de la misma variante', () => {
  expect(
    mergeCartSelections([item('a', 2)], [item('a', 1), item('b', 3)]).map(
      (row) => [row._id, row.qty]
    )
  ).toEqual([
    ['a', 2],
    ['b', 3],
  ]);
});
it('no resucita artículos de una copia antigua cuando las pestañas ya usan el mismo carrito', async () => {
  const api = {
    get: vi.fn().mockResolvedValue({ data: { items: [], version: 'v1' } }),
    post: vi.fn(),
    put: vi.fn(),
  };
  const snapshot = await readSharedCart({
    api,
    access,
    previousItems: [item('deleted', 1)],
    previousSessionId: 'shared',
    toBackendItem,
  });
  expect(snapshot.items).toEqual([]);
  expect(api.put).not.toHaveBeenCalled();
  await readSharedCart({
    api,
    access,
    previousItems: [item('optimistic', 1)],
    toBackendItem,
  });
  expect(api.put).not.toHaveBeenCalled();
});
it('valida la unión y reintenta un conflicto con la versión más reciente sin perder otras filas', async () => {
  const api = {
    get: vi
      .fn()
      .mockResolvedValueOnce({ data: { items: [item('a', 1)], version: 'v1' } })
      .mockResolvedValueOnce({
        data: { items: [item('a', 2), item('c', 1)], version: 'v2' },
      }),
    post: vi.fn(async (_path, body) => ({ data: { items: body.items } })),
    put: vi
      .fn()
      .mockRejectedValueOnce({
        response: { status: 409, data: { error: 'CART_WRITE_CONFLICT' } },
      })
      .mockImplementationOnce(async (_path, body) => ({
        data: { cart: { items: body.items }, version: 'v3' },
      })),
  };
  const result = await readSharedCart({
    api,
    access,
    previousItems: [item('a', 1), item('b', 3)],
    previousSessionId: 'separate',
    toBackendItem,
  });
  expect(result.items.map((row) => [row._id, row.qty])).toEqual([
    ['a', 2],
    ['c', 1],
    ['b', 3],
  ]);
  expect(api.put.mock.lastCall[2].headers).toMatchObject({
    'X-Session-Id': 'shared',
    'X-Cart-Access-Token': 'safe',
    'If-Match-Updated-At': 'v2',
  });
});
it('rechaza una respuesta incompleta sin escribir ni vaciar el respaldo', async () => {
  const api = {
    get: vi.fn().mockResolvedValue({ data: { version: 'v1' } }),
    put: vi.fn(),
  };
  await expect(readSharedCart({ api, access, toBackendItem })).rejects.toThrow(
    'CART_SHARED_RESPONSE_INVALID'
  );
  expect(api.put).not.toHaveBeenCalled();
});
