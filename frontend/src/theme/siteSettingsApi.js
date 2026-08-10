// frontend/src/theme/siteSettingsApi.js
import { API_BASE_URL } from '../config/apiBaseUrl';

const API_BASE = API_BASE_URL;

/**
 * GET /api/site-settings
 * Devuelve el objeto completo:
 * { theme: {...}, menus: {...}, ... }
 */
export async function fetchSiteSettings() {
  const url = `${API_BASE}/api/site-settings`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Error HTTP ${res.status} en ${url} – Respuesta: ${text.slice(0, 200)}`
    );
  }

  try {
    const data = await res.json();
    return data;
  } catch (err) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Respuesta no es JSON válido en ${url}. Empieza por: ${text.slice(0, 80)}`
    );
  }
}

/**
 * PUT /api/site-settings
 * payload: { theme?, menus?, updatedBy? }
 * Devuelve el documento actualizado.
 */
export async function updateSiteSettings(payload) {
  const url = `${API_BASE}/api/site-settings`;

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    credentials: 'include', // por si usas cookies en requireAdmin
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Error HTTP ${res.status} en PUT ${url} – Respuesta: ${text.slice(
        0,
        200
      )}`
    );
  }

  try {
    const data = await res.json();
    return data;
  } catch (err) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Respuesta no es JSON válido en PUT ${url}. Empieza por: ${text.slice(
        0,
        80
      )}`
    );
  }
}
