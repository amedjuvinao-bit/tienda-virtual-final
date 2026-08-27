'use strict';

function clean(value, maxLength = 300) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function idValue(value) {
  return String(value?._id || value || '').trim();
}

module.exports = {
  clean,
  idValue,
};
