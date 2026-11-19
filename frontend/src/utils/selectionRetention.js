export const SELECTION_RETENTION_DAYS = 30;
const RETENTION_MS = SELECTION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const ACTIVITY_EVENT = 'storefront-selection-activity';
const memory = new WeakMap();
const selectionKeys = {
  cart: {
    local: ['cart', 'session_id', 'cart_shared_session', 'cart_access_token'],
    session: ['cart_snapshot', 'cart_access', 'cart_access_token'],
  },
  favorites: {
    local: ['favorites', 'favorite_snapshot', 'favorite_access', 'favorite_session_id', 'favorite_access_token'],
    session: ['favorite_pending'],
  },
};

export const selectionRetentionKey = (kind) => `rb_${kind}_retention_v1`;

function storageFor(view, name) {
  try {
    return view[name];
  } catch {
    return null;
  }
}

function read(storage, key) {
  try {
    return { available: Boolean(storage), value: storage?.getItem(key) ?? null };
  } catch {
    return { available: false, value: null };
  }
}

function write(storage, key, value) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    /* The current page retains its in-memory activity date. */
  }
}

function remove(storage, keys) {
  for (const key of keys) {
    try {
      storage?.removeItem(key);
    } catch {
      /* Continue with the remaining selection keys. */
    }
  }
}

function parseRecord(value) {
  try {
    const record = JSON.parse(value);
    return record?.version === 1 &&
      Number.isSafeInteger(record.generation) && record.generation > 0 &&
      Number.isFinite(record.lastActivityAt) && record.lastActivityAt >= 0
      ? record
      : null;
  } catch {
    return null;
  }
}

function remember(kind, view, record, local, session) {
  let records = memory.get(view);
  if (!records) {
    records = new Map();
    memory.set(view, records);
  }
  records.set(kind, record);
  write(local, selectionRetentionKey(kind), record);
  write(session, selectionRetentionKey(kind), record);
}

export function readSelectionRetention(kind, view = typeof window === 'undefined' ? null : window) {
  if (!view) return { generation: 0, expired: false, expiresAt: null };
  const keys = selectionKeys[kind];
  const local = storageFor(view, 'localStorage');
  const session = storageFor(view, 'sessionStorage');
  const key = selectionRetentionKey(kind);
  const localValue = read(local, key);
  const sessionValue = read(session, key);
  const tabRecord = parseRecord(sessionValue.value);
  const raw = localValue.value ?? sessionValue.value;
  const now = Date.now();
  let record = parseRecord(raw);
  if (record && tabRecord && (
    tabRecord.generation > record.generation ||
    tabRecord.generation === record.generation && tabRecord.lastActivityAt > record.lastActivityAt
  )) record = tabRecord;

  if (!localValue.available && !sessionValue.available)
    record = memory.get(view)?.get(kind) || null;

  if (!record) {
    const legacy = keys.local.some((name) => {
      const value = read(local, name).value;
      return value !== null && value !== '' && value !== '[]';
    }) || keys.session.some((name) => read(session, name).value !== null);
    if (raw === null && !legacy)
      return { generation: 0, expired: false, expiresAt: null };
    record = {
      version: 1,
      generation: Math.max(1, now),
      // A legacy selection without a date receives its first dated period.
      lastActivityAt: raw === null ? now : Math.max(0, now - RETENTION_MS),
    };
    remember(kind, view, record, local, session);
  }

  if (record.lastActivityAt > now) {
    record = { ...record, lastActivityAt: now };
    remember(kind, view, record, local, session);
  }

  if (tabRecord && tabRecord.generation !== record.generation)
    remove(session, keys.session);

  const expiresAt = record.lastActivityAt + RETENTION_MS;
  const expired = now >= expiresAt;
  if (expired) {
    remove(local, keys.local);
    remove(session, keys.session);
  }
  // Keep the expired generation so another tab can discard its old capability.
  remember(kind, view, record, null, session);
  return { generation: record.generation, expired, expiresAt };
}

export function recordSelectionActivity(kind, view = typeof window === 'undefined' ? null : window) {
  if (!view) return 0;
  const previous = readSelectionRetention(kind, view);
  const now = Date.now();
  const record = {
    version: 1,
    generation: previous.expired || !previous.generation
      ? Math.max(now, previous.generation + 1, 1)
      : previous.generation,
    lastActivityAt: now,
  };
  remember(kind, view, record,
    storageFor(view, 'localStorage'), storageFor(view, 'sessionStorage'));
  if (typeof view.Event === 'function')
    view.dispatchEvent?.(new view.Event(`${ACTIVITY_EVENT}-${kind}`));
  return record.generation;
}

export function assertSelectionCurrent(kind, generation, view = typeof window === 'undefined' ? null : window) {
  const state = readSelectionRetention(kind, view);
  if (state.expired || state.generation !== generation) {
    throw Object.assign(new Error('La selección guardada venció. Vuelve a elegir tus productos.'), {
      code: 'SELECTION_RETENTION_EXPIRED',
    });
  }
}

export function watchSelectionRetention(kind, onExpired, view = typeof window === 'undefined' ? null : window) {
  if (!view) return () => {};
  let previous = readSelectionRetention(kind, view);
  let timer;
  const schedule = () => {
    view.clearTimeout(timer);
    if (!previous.expired && previous.expiresAt !== null)
      timer = view.setTimeout(check, Math.min(
        Math.max(1, previous.expiresAt - Date.now()), 2_147_483_647
      ));
  };
  const check = () => {
    const current = readSelectionRetention(kind, view);
    const invalidated = current.expired && !previous.expired ||
      current.generation !== previous.generation;
    previous = current;
    schedule();
    if (invalidated) onExpired(current);
  };
  const activity = () => {
    previous = readSelectionRetention(kind, view);
    schedule();
  };
  const storage = (event) => {
    if (event.key === null || event.key === selectionRetentionKey(kind)) check();
  };
  view.addEventListener('storage', storage);
  view.addEventListener('focus', check);
  view.addEventListener('online', check);
  view.addEventListener(`${ACTIVITY_EVENT}-${kind}`, activity);
  schedule();
  return () => {
    view.clearTimeout(timer);
    view.removeEventListener('storage', storage);
    view.removeEventListener('focus', check);
    view.removeEventListener('online', check);
    view.removeEventListener(`${ACTIVITY_EVENT}-${kind}`, activity);
  };
}
