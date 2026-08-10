import variantKeyAuthority from '@shared/variant-key-authority';
import { buildCartAccessHeaders } from './cartAccess';

const { resolveVariantIdentity } = variantKeyAuthority;

function clean(value) {
  return String(value || '').trim();
}

export function cartItemIdentity(item = {}) {
  const productId = clean(item.productId || item._id || item.id);
  const identity = resolveVariantIdentity({
    variantKey:
      item.variantKey || item.variantId || item.selectedVariantKey || item.selectedVariantId,
    size: item.size,
    color: item.color,
    attributes: item.variantAttributes || item.attributes || [],
  });
  return `${productId}|${identity.variantKey}`;
}

function cloneItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => ({ ...item }));
}

function quantityOf(item) {
  const value = Number(item?.quantity ?? item?.qty ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function applyCartOperation(items, operation = {}) {
  const current = cloneItems(items);
  const type = clean(operation.type);
  const identity = clean(operation.identity);

  if (type === 'add') {
    const incoming = { ...(operation.item || {}) };
    const incomingIdentity = cartItemIdentity(incoming);
    const amount = Math.max(1, quantityOf(incoming) || Number(operation.amount) || 1);
    const index = current.findIndex((item) => cartItemIdentity(item) === incomingIdentity);
    if (index < 0) return [...current, { ...incoming, quantity: amount }];
    current[index] = {
      ...current[index],
      quantity: Math.max(1, quantityOf(current[index]) + amount),
    };
    return current;
  }

  if (type === 'increase' || type === 'decrease') {
    const delta = type === 'increase' ? 1 : -1;
    return current.map((item) => {
      if (cartItemIdentity(item) !== identity) return item;
      return {
        ...item,
        quantity: Math.max(1, quantityOf(item) + delta),
      };
    });
  }

  if (type === 'remove') {
    return current.filter((item) => cartItemIdentity(item) !== identity);
  }

  if (type === 'clear') {
    const targets = new Set(
      (Array.isArray(operation.targetIdentities) ? operation.targetIdentities : [])
        .map(clean)
        .filter(Boolean)
    );
    return targets.size
      ? current.filter((item) => !targets.has(cartItemIdentity(item)))
      : current;
  }

  if (type === 'replace_validated') {
    const replacements = new Map(
      cloneItems(operation.items).map((item) => [cartItemIdentity(item), item])
    );
    return current.map((item) => {
      const replacement = replacements.get(cartItemIdentity(item));
      return replacement ? { ...item, ...replacement } : item;
    });
  }

  return current;
}

export function normalizeCartSnapshot(value = {}) {
  const cart = value?.cart && typeof value.cart === 'object' ? value.cart : value;
  return {
    items: cloneItems(cart?.items),
    version: clean(value?.version || cart?.version || cart?.updatedAt),
  };
}

export function isCartWriteConflict(error) {
  return Boolean(
    error?.response?.status === 409 &&
    error?.response?.data?.error === 'CART_WRITE_CONFLICT'
  );
}

export function writeVersionedCart({ api, access, version, items }) {
  return api.put(
    `/api/cart/${encodeURIComponent(access.sessionId)}`,
    { items },
    {
      headers: {
        ...buildCartAccessHeaders(access),
        'If-Match-Updated-At': version,
      },
    }
  );
}

export function createCartMutationCoordinator({
  getSnapshot,
  write,
  reload,
  adopt,
  onTerminalConflict,
} = {}) {
  let queue = Promise.resolve();

  async function execute(operation) {
    let snapshot = normalizeCartSnapshot(await getSnapshot());
    let desired = applyCartOperation(snapshot.items, operation);

    try {
      const written = normalizeCartSnapshot(await write({
        items: desired,
        version: snapshot.version,
        operation,
        retry: false,
      }));
      adopt(written, { operation, retried: false });
      return { ...written, retried: false };
    } catch (error) {
      if (!isCartWriteConflict(error)) throw error;
    }

    const reloaded = normalizeCartSnapshot(await reload());
    adopt(reloaded, { operation, reloaded: true });
    desired = applyCartOperation(reloaded.items, operation);

    try {
      const written = normalizeCartSnapshot(await write({
        items: desired,
        version: reloaded.version,
        operation,
        retry: true,
      }));
      adopt(written, { operation, retried: true });
      return { ...written, retried: true };
    } catch (error) {
      if (!isCartWriteConflict(error)) throw error;
      const server = normalizeCartSnapshot(error?.response?.data || {});
      adopt(server, { operation, terminalConflict: true });
      onTerminalConflict?.(server, operation);
      const controlled = new Error('El carrito volvio a cambiar. Se conservo la version del servidor.');
      controlled.code = 'CART_WRITE_CONFLICT';
      controlled.response = error.response;
      throw controlled;
    }
  }

  function enqueue(operation) {
    const task = queue.then(() => execute(operation));
    queue = task.catch(() => undefined);
    return task;
  }

  return { enqueue };
}
