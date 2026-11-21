import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function validateProductionApi(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Configura VITE_API_BASE_URL con la URL HTTPS del backend.'); }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      url.pathname !== '/' || hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.trycloudflare.com')) {
    throw new Error('VITE_API_BASE_URL debe ser el origen HTTPS permanente del backend, sin /api ni credenciales.');
  }
  return url.origin;
}

function build() {
  process.env.VITE_API_BASE_URL = validateProductionApi(process.env.VITE_API_BASE_URL);
  const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
  const result = spawnSync(process.execPath, [path.join(frontend, 'node_modules/vite/bin/vite.js'), 'build'], {
    cwd: frontend, env: process.env, stdio: 'inherit',
  });
  if (result.error || result.status !== 0) throw new Error('No se completó la compilación del frontend.');
  // Keep the old development/TikTok registration pages in source control, but
  // exclude their development-only policies from the commercial artifact.
  rmSync(path.join(frontend, 'dist/legal'), { recursive: true, force: true });
  for (const file of ['index.html', 'page-preview.html']) {
    if (!existsSync(path.join(frontend, 'dist', file))) throw new Error(`Falta la entrada publicada ${file}.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { build(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
