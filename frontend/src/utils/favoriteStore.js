import {
  FAVORITE_ACCESS_KEY,
  buildFavoriteAccessHeaders,
  getFavoriteAccess,
  issueFavoriteAccess,
  storeFavoriteAccess,
  withFavoriteLock,
} from './favoriteAccess';
import {
  applyFavoriteOperations,
  favoriteKey,
  normalizeFavoriteItem,
  normalizeFavorites,
} from './favoriteModel';
const SNAPSHOT = 'favorite_snapshot';
const OUTBOX = 'favorite_pending';
function read(storage, key) {
  try {
    return JSON.parse(storage.getItem(key) || 'null');
  } catch {
    return null;
  }
}
function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* Keep in-memory selections if browser storage is full. */
  }
}
function safeStorage(view, name) {
  try {
    return view[name];
  } catch {
    return { getItem: () => null, setItem: () => {} };
  }
}
export function createFavoriteStore(api, view = window) {
  const local = safeStorage(view, 'localStorage'),
    session = safeStorage(view, 'sessionStorage');
  let access = getFavoriteAccess();
  const cached = read(local, SNAPSHOT);
  let confirmed = normalizeFavorites(
    cached && cached.sessionId === access?.sessionId
      ? cached.items
      : cached && access
        ? []
        : read(local, 'favorites')
  );
  const saved = read(session, OUTBOX);
  let pending =
    (saved?.sessionId === (access?.sessionId || '') ||
      (access && saved?.sessionId)) &&
    Array.isArray(saved.operations)
      ? saved.operations
          .filter(
            (op) =>
              op && ['add', 'remove'].includes(op.type) && op.item?.productId
          )
          .map((op) => ({ ...op, item: normalizeFavoriteItem(op.item) }))
          .filter((op) => op.item.productId)
      : [];
  // Only a legacy list without a capability is imported. A server-backed list
  // always replaces its cache; stale local removals cannot be merged back in.
  if (!access && !pending.length)
    pending = confirmed.map((item) => ({ type: 'add', item }));
  let initialized = false,
    busy = false,
    error = '',
    message = '',
    flight,
    again = false,
    active = false,
    channel;
  const listeners = new Set();
  let state;
  const emit = () => {
    state = {
      favorites: applyFavoriteOperations(confirmed, pending),
      isInitialized: initialized,
      loading: busy,
      syncError: Boolean(error),
      error,
      message,
      pendingCount: pending.length,
    };
    for (const listener of listeners) listener(state);
  };
  const savePending = () =>
    write(session, OUTBOX, {
      sessionId: access?.sessionId || '',
      operations: pending,
    });
  const accept = (data) => {
    confirmed = normalizeFavorites(data?.items);
    write(local, SNAPSHOT, {
      sessionId: access?.sessionId,
      items: confirmed,
    });
    write(local, 'favorites', confirmed);
  };
  const announce = () => {
    try {
      channel?.postMessage({ type: 'changed', sessionId: access?.sessionId });
    } catch {
      /* Storage event and focus refresh remain available. */
    }
  };
  const requestOptions = () => ({
    headers: buildFavoriteAccessHeaders(access),
  });
  const url = () => `/api/favorites/${encodeURIComponent(access.sessionId)}`;
  const readServer = async () => {
    try {
      return (await api.get(url(), requestOptions())).data;
    } catch (failure) {
      if (
        failure?.response?.status !== 404 ||
        failure?.response?.data?.error !== 'FAVORITE_ACCESS_NOT_FOUND'
      )
        throw failure;
      // An authenticated empty list is HTTP 200. This 404 means the signed
      // access expired/changed, not that the customer removed all products.
      const restoredAccess = await issueFavoriteAccess(api);
      const { data } = await api.put(
        `/api/favorites/${encodeURIComponent(restoredAccess.sessionId)}`,
        { items: confirmed, revision: null },
        { headers: buildFavoriteAccessHeaders(restoredAccess) }
      );
      if (!storeFavoriteAccess(restoredAccess.sessionId, restoredAccess.token))
        throw new Error('No se pudo conservar el acceso recuperado.');
      access = restoredAccess;
      savePending();
      announce();
      message = 'Recuperamos tus favoritos conservando tu selección.';
      return data.favorites;
    }
  };
  const perform = async () => {
    access = getFavoriteAccess();
    if (!access && !pending.length) {
      initialized = true;
      return;
    }
    if (!access) {
      const issued = await issueFavoriteAccess(api);
      const concurrent = getFavoriteAccess();
      if (!concurrent && !storeFavoriteAccess(issued.sessionId, issued.token))
        throw new Error(
          'No fue posible conservar el acceso seguro a favoritos.'
        );
      access = concurrent || issued;
      savePending();
    }
    let server = await readServer();
    const adoptConcurrentAccess = async () => {
      const current = getFavoriteAccess();
      if (
        !current ||
        (current.sessionId === access.sessionId &&
          current.token === access.token)
      )
        return false;
      access = current;
      savePending();
      server = await readServer();
      return true;
    };
    await adoptConcurrentAccess();
    accept(server);
    initialized = true;
    emit();
    while (pending.length) {
      const operation = pending[0];
      let written = false;
      for (let attempt = 0; attempt < 4; attempt++) {
        await adoptConcurrentAccess();
        const items = applyFavoriteOperations(
          normalizeFavorites(server.items),
          [operation]
        );
        if (items.length > 200) {
          pending.shift();
          savePending();
          message =
            'Puedes guardar hasta 200 favoritos. Retira uno para añadir otro.';
          written = true;
          break;
        }
        try {
          const { data } = await api.put(
            url(),
            { items, revision: server.revision },
            requestOptions()
          );
          server = data.favorites;
          if (!server || !Array.isArray(server.items))
            throw new Error('No se pudo confirmar el guardado de favoritos.');
          // Browsers without Web Locks can change capabilities during a first
          // save. Reapply this single intent to the winning shared session.
          if (await adoptConcurrentAccess()) continue;
          accept(server);
          pending.shift();
          savePending();
          if (
            operation.type === 'add' &&
            !confirmed.some(
              (item) => favoriteKey(item) === favoriteKey(operation.item)
            )
          )
            message = 'Ese producto ya no está disponible para guardarlo.';
          announce();
          emit();
          written = true;
          break;
        } catch (failure) {
          if (failure?.response?.status !== 409 || attempt === 3) throw failure;
          server = await readServer();
          accept(server);
        }
      }
      if (!written) throw new Error('No se pudieron confirmar tus cambios.');
    }
  };
  const sync = () => {
    if (!active) return Promise.resolve(false);
    if (flight) {
      again = true;
      return flight;
    }
    busy = true;
    error = '';
    emit();
    flight = (async () => {
      try {
        do {
          again = false;
          await withFavoriteLock(perform);
        } while (again && active);
        return true;
      } catch (failure) {
        error = pending.length
          ? 'Tus cambios están pendientes. Conservamos tu selección; vuelve a intentar sincronizar.'
          : 'No pudimos actualizar tus favoritos. Conservamos tu lista; vuelve a intentarlo.';
        return false;
      } finally {
        flight = null;
        initialized = true;
        busy = false;
        emit();
      }
    })();
    return flight;
  };
  const change = (type, raw) => {
    const item = normalizeFavoriteItem(raw);
    if (!item.productId) return;
    const current = applyFavoriteOperations(confirmed, pending);
    if (
      type === 'add' &&
      current.some((row) => favoriteKey(row) === favoriteKey(item))
    )
      return;
    if (
      type === 'remove' &&
      !current.some((row) => favoriteKey(row) === favoriteKey(item))
    )
      return;
    if (type === 'add' && current.length >= 200) {
      message = 'Puedes guardar hasta 200 favoritos.';
      emit();
      return;
    }
    pending.push({ type, item });
    message = '';
    savePending();
    emit();
    void sync();
  };
  const changed = (event) => {
    if (
      event?.type === 'storage' &&
      ![FAVORITE_ACCESS_KEY, SNAPSHOT].includes(event.key)
    )
      return;
    if (
      event?.data &&
      (event.data.type !== 'changed' ||
        event.data.sessionId !== getFavoriteAccess()?.sessionId)
    )
      return;
    void sync();
  };
  emit();
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      active = true;
      view.addEventListener('storage', changed);
      view.addEventListener('focus', changed);
      view.addEventListener('online', changed);
      try {
        channel = new view.BroadcastChannel('storefront-favorites-v1');
        channel.addEventListener('message', changed);
      } catch {
        /* Optional notification transport. */
      }
      void sync();
    },
    stop() {
      active = false;
      view.removeEventListener('storage', changed);
      view.removeEventListener('focus', changed);
      view.removeEventListener('online', changed);
      channel?.close();
      channel = null;
    },
    sync,
    add: (item) => change('add', item),
    remove: (item) => change('remove', item),
    toggle(item) {
      change(
        state.favorites.some((row) => favoriteKey(row) === favoriteKey(item))
          ? 'remove'
          : 'add',
        item
      );
    },
  };
}
