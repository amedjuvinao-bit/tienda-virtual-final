'use strict';

function normalizeEnvironment(value) {
  return String(value || '').trim().toLowerCase();
}

function getMongooseIndexPolicy({ nodeEnv = process.env.NODE_ENV } = {}) {
  const production = normalizeEnvironment(nodeEnv) === 'production';
  return Object.freeze({
    autoIndex: !production,
    production,
  });
}

function applyMongooseIndexPolicy(
  mongooseInstance,
  { nodeEnv = process.env.NODE_ENV } = {}
) {
  if (!mongooseInstance || typeof mongooseInstance.set !== 'function') {
    throw new TypeError('Se requiere una instancia valida de Mongoose.');
  }
  const policy = getMongooseIndexPolicy({ nodeEnv });
  mongooseInstance.set('autoIndex', policy.autoIndex);
  return policy;
}

module.exports = {
  applyMongooseIndexPolicy,
  getMongooseIndexPolicy,
};
