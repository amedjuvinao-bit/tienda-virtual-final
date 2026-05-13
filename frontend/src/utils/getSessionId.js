// src/utils/getSessionId.js
const SESSION_ID_KEY = 'session_id';

export function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}
