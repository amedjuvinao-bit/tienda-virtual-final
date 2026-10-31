import { readCartSession } from './cartSessionStorage';

export function getSessionId() {
  const access = readCartSession();
  if (access) return access.sessionId;
  try {
    return String(localStorage.getItem('session_id') || '').trim();
  } catch {
    return '';
  }
}
