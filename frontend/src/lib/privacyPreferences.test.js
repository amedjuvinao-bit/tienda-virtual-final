import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPrivacyPreference, parsePrivacyPreference, savePrivacyPreference,
  subscribePrivacyPreferences, PRIVACY_PREFERENCES_KEY as key,
  PRIVACY_PREFERENCES_POLICY as policy,
} from './privacyPreferences';

function reset() {
  localStorage.removeItem(key);
  window.dispatchEvent(new StorageEvent('storage', { key }));
}
let unsubscribe;
beforeEach(() => { unsubscribe = subscribePrivacyPreferences(() => {}); reset(); });
afterEach(() => { vi.restoreAllMocks(); reset(); unsubscribe(); vi.useRealTimers(); });
describe('preferencias locales de contenidos externos', () => {
  it('no autoriza nada antes de una decisión ni crea un registro por visitar', () => {
    expect(getPrivacyPreference()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });
  it('registra decisiones separadas con versión, aviso, método y vencimiento', () => {
    const result = savePrivacyPreference({ social: true, maps: false });
    expect(result.persisted).toBe(true);
    expect(getPrivacyPreference()).toMatchObject({ version: policy.version, method: 'custom', choices: { social: true, maps: false }, notice: policy.notice });
    expect(result.record.expiresAt - result.record.recordedAt).toBe(policy.maxAgeDays * 86400000);
    expect(JSON.parse(localStorage.getItem(key)).categories.social.providers).toBe('Instagram y TikTok');
  });
  it('rechaza versiones antiguas, cadenas booleanas, vencimientos inválidos y métodos desconocidos', () => {
    const { record } = savePrivacyPreference({ social: true, maps: true }, 'accept_all');
    for (const change of [
      { version: 'old' }, { choices: { social: 'true', maps: false } },
      { expiresAt: Date.now() - 1 }, { recordedAt: Date.now() + 3600000 },
      { expiresAt: record.recordedAt + 181 * 86400000 }, { method: 'scroll' },
    ]) expect(parsePrivacyPreference({ ...record, ...change })).toBeNull();
    expect(parsePrivacyPreference('{')).toBeNull();
  });
  it('la retirada no borra carrito, favoritos ni otras claves del navegador', () => {
    localStorage.setItem('cart', '["producto"]');
    localStorage.setItem('favorites', '["favorito"]');
    savePrivacyPreference({ social: false, maps: false }, 'reject_optional');
    expect(getPrivacyPreference().choices).toEqual({ social: false, maps: false });
    expect(localStorage.getItem('cart')).toBe('["producto"]');
    expect(localStorage.getItem('favorites')).toBe('["favorito"]');
  });
  it('una decisión de otra pestaña revoca el permiso en la pestaña abierta', () => {
    savePrivacyPreference({ social: true, maps: true }, 'accept_all');
    const record = { ...getPrivacyPreference(), choices: { social: false, maps: false }, method: 'reject_optional' };
    localStorage.setItem(key, JSON.stringify(record));
    window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(record) }));
    expect(getPrivacyPreference().choices.social).toBe(false);
  });
  it('si el navegador impide guardar, mantiene la decisión en memoria al recuperar el foco', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(savePrivacyPreference({ social: true, maps: false }).persisted).toBe(false);
    window.dispatchEvent(new Event('focus'));
    expect(getPrivacyPreference().choices.social).toBe(true);
  });
  it('el vencimiento retira permisos aunque la pestaña permanezca abierta', () => {
    vi.useFakeTimers();
    savePrivacyPreference({ social: true, maps: true }, 'accept_all');
    vi.advanceTimersByTime(180 * 86400000 + 1);
    expect(getPrivacyPreference()).toBeNull();
  });
});
