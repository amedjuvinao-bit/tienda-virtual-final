import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateProductionApi } from './build-frontend.mjs';

test('la publicación requiere un origen HTTPS permanente sin /api ni secretos', () => {
  assert.equal(validateProductionApi('https://api.example.com/'), 'https://api.example.com');
  for (const invalid of [undefined, '', 'not-a-url', 'http://api.example.com',
    'https://localhost', 'https://store.localhost', 'https://127.0.0.1', 'https://[::1]',
    'https://temporary.trycloudflare.com', 'https://api.example.com/api',
    'https://api.example.com/?token=private', 'https://api.example.com/#private',
    'https://user:pass@api.example.com']) {
    assert.throws(() => validateProductionApi(invalid));
  }
});
