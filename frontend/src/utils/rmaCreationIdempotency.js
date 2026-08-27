const MIN_KEY_LENGTH = 8;
const MAX_KEY_LENGTH = 200;

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalize(item)));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        if (value[key] !== undefined) result[key] = canonicalize(value[key]);
        return result;
      }, {});
  }

  if (typeof value === 'number' && !Number.isFinite(value)) return null;
  return value;
}

function payloadIdentity(value) {
  return JSON.stringify(canonicalize(value));
}

export function createRmaIdempotencyKey(cryptoSource = globalThis.crypto) {
  let randomPart = '';

  if (typeof cryptoSource?.randomUUID === 'function') {
    randomPart = cryptoSource.randomUUID();
  } else if (typeof cryptoSource?.getRandomValues === 'function') {
    const bytes = new Uint8Array(20);
    cryptoSource.getRandomValues(bytes);
    randomPart = [...bytes]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } else {
    throw new Error('RMA_SECURE_RANDOM_UNAVAILABLE');
  }

  const key = `rma-v1-${String(randomPart).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    throw new Error('RMA_IDEMPOTENCY_KEY_INVALID');
  }
  return key;
}

export function createRmaCreationIdempotency(options = {}) {
  const cryptoSource = options.cryptoSource || globalThis.crypto;
  let activeAttempt = null;

  return {
    keyFor(requestDescriptor) {
      const identity = payloadIdentity(requestDescriptor);
      if (!activeAttempt || activeAttempt.identity !== identity) {
        activeAttempt = {
          identity,
          key: createRmaIdempotencyKey(cryptoSource),
        };
      }
      return activeAttempt.key;
    },

    complete(requestDescriptor, key) {
      const identity = payloadIdentity(requestDescriptor);
      if (
        activeAttempt?.identity === identity &&
        activeAttempt?.key === String(key || '')
      ) {
        activeAttempt = null;
        return true;
      }
      return false;
    },

    reset() {
      activeAttempt = null;
    },
  };
}

export const RMA_IDEMPOTENCY_KEY_LIMITS = Object.freeze({
  min: MIN_KEY_LENGTH,
  max: MAX_KEY_LENGTH,
});
