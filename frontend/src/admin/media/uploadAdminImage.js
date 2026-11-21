import { adminFetch } from "../../lib/api";
import { API_BASE_URL } from "../../config/apiBaseUrl";
export async function uploadAdminImage(file, { signal } = {}) {
  const body = new FormData();
  body.append("image", file);
  const response = await adminFetch(`${API_BASE_URL}/api/uploads`, {
    method: "POST",
    body,
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.url !== "string" || !data.url.trim()) {
    throw new Error(
      data.message ||
        data.error ||
        "No se pudo cargar la imagen. Inténtalo de nuevo.",
    );
  }
  return data.url;
}
