// src/utils/getSessionId.js
const SESSION_ID_KEY = 'session_id';

export function getSessionId() {
  try {
    return String(localStorage.getItem(SESSION_ID_KEY) || '').trim();
  } catch {
    return '';
  }
}
