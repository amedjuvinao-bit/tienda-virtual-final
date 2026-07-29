'use strict';

async function fetchFactus(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function trimSafe(value, max = 500) {
  return String(value || '').trim().slice(0, max);
}

function isValidEmail(value) {
  const email = trimSafe(value, 180);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function toMoney(value) {
  return Number(toNumber(value, 0).toFixed(2));
}

module.exports = {
  fetchFactus,
  isValidEmail,
  toMoney,
  toNumber,
  trimSafe,
};
