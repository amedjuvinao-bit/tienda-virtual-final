// src/lib/siteSettingsApi.js
import api from "./api"; // tu helper existente (con baseURL y token admin)

export async function fetchSiteSettings() {
  const { data } = await api.get("/api/site-settings");
  return data; // { theme, menus, ... }
}

export async function fetchAdminSiteSettings() {
  const { data } = await api.get("/api/site-settings/admin");
  return data;
}

export async function saveSiteSettings(payload) {
  const { data } = await api.put("/api/site-settings", payload);
  return data;
}
