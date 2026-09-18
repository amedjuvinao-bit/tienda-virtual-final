import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

describe('Etapa 5: alertas y respuesta de seguridad', () => {
  it('expone operaciones para revisar y responder alertas', () => {
    const api = read('frontend/src/admin/api/adminAuthApi.js');
    expect(api).toMatch(/reviewAdminSecurityAlert/);
    expect(api).toMatch(/respondAdminSecurityAlert/);
    expect(api).toMatch(/security-alerts/);
  });

  it('presenta estado persistente, trazabilidad y acciones protegidas', () => {
    const ui = read('frontend/src/admin/configuracion/sections/SeguridadSection.jsx');
    expect(ui).toMatch(/Pendiente/);
    expect(ui).toMatch(/Revisada/);
    expect(ui).toMatch(/Resuelta/);
    expect(ui).toMatch(/Marcar revisada/);
    expect(ui).toMatch(/Confirmar respuesta/);
    expect(ui).toMatch(/currentPassword/);
    expect(ui).toMatch(/alertCode/);
  });
});
