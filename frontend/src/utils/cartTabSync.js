const TARGET_KEY = 'cart_shared_session';
const CHANNEL_NAME = 'storefront-cart-sync-v1';
const safeAccess = (value) =>
  typeof value?.sessionId === 'string' &&
  value.sessionId &&
  typeof value?.token === 'string' &&
  value.token
    ? { sessionId: value.sessionId, token: value.token }
    : null;
function readTarget() {
  try {
    return (
      localStorage.getItem(TARGET_KEY) ||
      localStorage.getItem('session_id') ||
      ''
    );
  } catch {
    return '';
  }
}
function writeTarget(sessionId) {
  try {
    localStorage.setItem(TARGET_KEY, sessionId);
  } catch {
    /* ignore */
  }
}

// Capabilities travel only between live, same-origin tabs. Persistent storage
// holds an identifier, never an access token or a broadcast payload.
export function createCartTabSync({
  getAccess,
  onChange,
  view = window,
  waitMs = 200,
}) {
  const unavailable = {
    resolve: async () => null,
    publishAccess: () => {},
    publishReady: () => {},
    publishChange: () => {},
    close: () => {},
  };
  if (typeof view.BroadcastChannel !== 'function') return unavailable;
  let channel;
  try {
    channel = new view.BroadcastChannel(CHANNEL_NAME);
  } catch {
    return unavailable;
  }
  const requests = new Map();
  let pendingAccess = null,
    sequence = 0,
    closed = false,
    announced = '';
  const send = (message) => {
    if (!closed)
      try {
        channel.postMessage(message);
      } catch {
        /* ignore */
      }
  };
  const receive = ({ data }) => {
    if (data?.type === 'request') {
      const access = getAccess();
      if (access && (!data.sessionId || access.sessionId === data.sessionId))
        send({ type: 'response', requestId: data.requestId, access });
    } else if (data?.type === 'response') {
      const access = safeAccess(data.access),
        request = requests.get(data.requestId);
      if (
        access &&
        request &&
        (!request.sessionId || access.sessionId === request.sessionId)
      )
        request.finish(access);
    } else if (data?.type === 'access') {
      const access = safeAccess(data.access);
      if (access && access.sessionId === readTarget()) {
        pendingAccess = access;
        onChange();
      }
    } else if (
      data?.type === 'changed' &&
      (data.sessionId === readTarget() ||
        data.sessionId === getAccess()?.sessionId)
    )
      onChange();
  };
  channel.addEventListener('message', receive);
  const storage = (event) => {
    if (event.key === TARGET_KEY) onChange();
  };
  view.addEventListener('storage', storage);
  const own = getAccess();
  if (own && !readTarget()) writeTarget(own.sessionId);
  return {
    resolve() {
      const target = readTarget();
      if (pendingAccess?.sessionId === target) {
        const value = pendingAccess;
        pendingAccess = null;
        return Promise.resolve(value);
      }
      pendingAccess = null;
      if (target && target === getAccess()?.sessionId)
        return Promise.resolve(null);
      const requestId = `${Date.now()}-${Math.random()}-${++sequence}`;
      return new Promise((resolve) => {
        const finish = (value) => {
          const request = requests.get(requestId);
          if (!request) return;
          view.clearTimeout(request.timer);
          requests.delete(requestId);
          resolve(value);
        };
        const timer = view.setTimeout(() => finish(null), waitMs);
        requests.set(requestId, { sessionId: target, timer, finish });
        send({ type: 'request', requestId, sessionId: target });
      });
    },
    publishAccess(access = getAccess()) {
      if (!access) return;
      writeTarget(access.sessionId);
      announced = JSON.stringify(access);
      send({ type: 'access', access });
    },
    publishReady() {
      const access = getAccess();
      if (
        !access ||
        access.sessionId !== readTarget() ||
        announced === JSON.stringify(access)
      )
        return;
      announced = JSON.stringify(access);
      send({ type: 'access', access });
    },
    publishChange() {
      const access = getAccess();
      if (!access) return;
      if (readTarget() !== access.sessionId) {
        writeTarget(access.sessionId);
        send({ type: 'access', access });
      } else send({ type: 'changed', sessionId: access.sessionId });
    },
    close() {
      closed = true;
      for (const request of [...requests.values()]) request.finish(null);
      view.removeEventListener('storage', storage);
      channel.removeEventListener('message', receive);
      channel.close();
    },
  };
}

export function withCartBootstrapLock(task) {
  return typeof navigator.locks?.request === 'function'
    ? navigator.locks.request('storefront-cart-bootstrap', task)
    : task();
}
