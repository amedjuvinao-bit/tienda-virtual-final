import policy from '../../../shared/storefrontPrivacyPreferences.json';

export { policy as PRIVACY_PREFERENCES_POLICY };
export const PRIVACY_PREFERENCES_KEY = policy.storageKey;
const MAX_AGE = policy.maxAgeDays * 86400000;
const METHODS = ['accept_all', 'reject_optional', 'custom'];
const listeners = new Set();
let initialized = false;
let current = null;
let volatile = false;
let expiryTimer;

export function parsePrivacyPreference(raw, now = Date.now()) {
  try {
    const record = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!record || record.version !== policy.version || !METHODS.includes(record.method)
      || typeof record.choices?.social !== 'boolean' || typeof record.choices?.maps !== 'boolean'
      || !Number.isFinite(record.recordedAt) || !Number.isFinite(record.expiresAt)
      || record.recordedAt > now + 300000 || record.expiresAt <= now
      || record.expiresAt <= record.recordedAt || record.expiresAt - record.recordedAt > MAX_AGE) return null;
    return { version: record.version, method: record.method,
      choices: { social: record.choices.social, maps: record.choices.maps },
      recordedAt: record.recordedAt, expiresAt: record.expiresAt,
      notice: policy.notice, categories: policy.categories };
  } catch { return null; }
}

function notify() { for (const listener of listeners) listener(); }
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (!current || !listeners.size) return;
  expiryTimer = setTimeout(() => {
    if (current && current.expiresAt <= Date.now()) { current = null; notify(); }
    scheduleExpiry();
  }, Math.min(Math.max(1, current.expiresAt - Date.now()), 2147483647));
}
function readStored() {
  if (volatile) return current;
  try { return parsePrivacyPreference(window.localStorage.getItem(policy.storageKey)); }
  catch { return current; }
}
function initialize() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  current = readStored();
}
function onStorage(event) {
  if (event.key !== null && event.key !== policy.storageKey) return;
  volatile = false;
  current = event.key === null ? null : parsePrivacyPreference(event.newValue);
  scheduleExpiry();
  notify();
}
function onFocus() {
  const stored = readStored();
  if (JSON.stringify(stored) !== JSON.stringify(current)) { current = stored; notify(); }
  scheduleExpiry();
}
export function getPrivacyPreference() {
  initialize();
  if (!listeners.size && typeof window !== 'undefined') {
    const stored = readStored();
    if (JSON.stringify(stored) !== JSON.stringify(current)) current = stored;
  }
  if (current && current.expiresAt <= Date.now()) current = null;
  return current;
}
export function subscribePrivacyPreferences(listener) {
  initialize();
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    onFocus();
  }
  scheduleExpiry();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(expiryTimer);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    }
  };
}
export function savePrivacyPreference(choices, method = 'custom') {
  const now = Date.now();
  const record = parsePrivacyPreference({ version: policy.version, method,
    choices: { social: choices.social === true, maps: choices.maps === true },
    recordedAt: now, expiresAt: now + MAX_AGE }, now);
  if (!record) throw new Error('La preferencia no es válida.');
  current = record;
  initialized = true;
  let persisted = false;
  try { window.localStorage.setItem(policy.storageKey, JSON.stringify(record)); persisted = true; }
  catch { /* Keep the current decision in memory when storage is unavailable. */ }
  volatile = !persisted;
  scheduleExpiry();
  notify();
  return { record, persisted };
}
export function openPrivacyPreferences() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('rb_open_privacy_preferences'));
}
