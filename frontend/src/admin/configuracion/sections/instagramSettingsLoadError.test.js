import { describe, expect, it } from 'vitest';
import { instagramSettingsEndpoint, instagramSettingsLoadError } from './instagramSettingsLoadError';
describe('diagnóstico de carga de Instagram', () => {
  it('distingue ruta, sesión, permisos y fallo interno sin culpar a las credenciales', () => {
    for (const status of [401,403,404,500,503]) {
      const result = instagramSettingsLoadError({ response: { status, data: { message: 'SECRET_PROVIDER_RESPONSE' } } });
      expect(result.status).toBe(`HTTP ${status}`); expect(JSON.stringify(result)).not.toContain('SECRET_PROVIDER_RESPONSE');
    }
    expect(instagramSettingsLoadError({ response: { status: 404 } }).title).toMatch(/no encuentra la ruta/);
    expect(instagramSettingsLoadError({ response: { status: 500 } }).title).toMatch(/backend falló/);
  });
  it('no inventa un estado HTTP para errores de red o tiempo de espera', () => {
    expect(instagramSettingsLoadError(new Error()).status).toBe('Sin respuesta HTTP');
    expect(instagramSettingsLoadError({code:'ECONNABORTED'}).title).toMatch(/tardó demasiado/);
  });
  it('el enlace de diagnóstico usa el backend configurado y elimina credenciales y parámetros', () => {
    expect(instagramSettingsEndpoint('https://user:secret@api.example.com/path?access_token=private')).toBe('https://api.example.com/api/admin/instagram-settings');
  });
});
