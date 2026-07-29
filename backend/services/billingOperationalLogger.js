'use strict';

const SENSITIVE_KEY =
  /(authorization|cookie|secret|password|token|credential|api[-_]?key|client[-_]?secret|private[-_]?key|locktoken|activationfingerprint)/i;
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 25;
const MAX_TEXT_LENGTH = 1000;

function redactText(value, max = MAX_TEXT_LENGTH) {
  return String(value ?? '')
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/=-]+/gi, '$1 [REDACTED]')
    .replace(
      /\b(client[_-]?secret|password|token|api[_-]?key|authorization)\s*[:=]\s*([^\s,;]+)/gi,
      '$1=[REDACTED]'
    )
    .replace(
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      '[REDACTED_JWT]'
    )
    .trim()
    .slice(0, Math.max(1, Number(max || MAX_TEXT_LENGTH)));
}

function sanitizeOperationalValue(value, depth = 0, seen = new WeakSet()) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') return redactText(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: redactText(value.name, 120),
      code: redactText(value.code, 160),
      message: redactText(value.message),
    };
  }
  if (typeof value !== 'object') return redactText(value);
  if (depth >= MAX_DEPTH) return '[MAX_DEPTH]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeOperationalValue(item, depth + 1, seen));
  }

  return Object.entries(value).reduce((output, [key, item]) => {
    output[key] = SENSITIVE_KEY.test(key)
      ? '[REDACTED]'
      : sanitizeOperationalValue(item, depth + 1, seen);
    return output;
  }, {});
}

function createBillingOperationalLogger({
  now = () => new Date(),
  consoleImpl = console,
} = {}) {
  function write(level, event, metadata = {}) {
    const normalizedLevel = ['info', 'warn', 'error'].includes(level)
      ? level
      : 'info';
    const payload = {
      timestamp: now().toISOString(),
      level: normalizedLevel,
      module: 'billing',
      event: redactText(event, 160) || 'billing_operational_event',
      metadata: sanitizeOperationalValue(metadata),
    };
    const method =
      normalizedLevel === 'error'
        ? 'error'
        : normalizedLevel === 'warn'
          ? 'warn'
          : 'log';

    consoleImpl[method](`[billing-operations] ${JSON.stringify(payload)}`);
    return payload;
  }

  return {
    error: (event, metadata) => write('error', event, metadata),
    info: (event, metadata) => write('info', event, metadata),
    warn: (event, metadata) => write('warn', event, metadata),
    write,
  };
}

const defaultLogger = createBillingOperationalLogger();

module.exports = {
  createBillingOperationalLogger,
  redactText,
  sanitizeOperationalValue,
  error: defaultLogger.error,
  info: defaultLogger.info,
  warn: defaultLogger.warn,
  write: defaultLogger.write,
};
