import hosts from '../../../shared/socialMediaDelivery.json';
import { API_BASE_URL } from '../config/apiBaseUrl';

// Only media CDNs audited for server delivery, never platform pages/players.
export function isSocialMediaFile(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\s\u0000-\u001f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.port && !url.username && !url.password && !url.hash && !url.searchParams.has('access_token')
      && Object.values(hosts).flat().some(host => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch { return false; }
}
export function storeSocialMedia(value, kind = 'image') {
  return isSocialMediaFile(value) ? `${API_BASE_URL}/api/storefront-media?kind=${kind}&url=${encodeURIComponent(value)}` : value;
}
