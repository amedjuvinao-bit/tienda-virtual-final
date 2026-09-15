'use strict';

function toOrigin(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch {
    return '';
  }
}

function buildCorsOptions(env = {}) {
  if (env.nodeEnv !== 'production') {
    return {
      origin: true,
      credentials: true,
    };
  }

  const allowedOrigins = new Set(
    [env.frontendUrl, env.backendUrl].map(toOrigin).filter(Boolean)
  );

  return {
    credentials: true,
    origin(requestOrigin, callback) {
      if (!requestOrigin || allowedOrigins.has(toOrigin(requestOrigin))) {
        return callback(null, true);
      }

      return callback(null, false);
    },
  };
}

module.exports = {
  buildCorsOptions,
  toOrigin,
};
