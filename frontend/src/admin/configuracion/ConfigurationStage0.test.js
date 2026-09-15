import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

describe('Configuración Nivel Plus Etapa 0', () => {
  it('retira solo Facturación del grupo Configuración y conserva su módulo principal', () => {
    const layout = source('../AdminLayout.jsx');
    const configurationPage = source('../ConfiguracionPage.jsx');
    const app = source('../../App.jsx');

    expect(layout).not.toContain("'/admin/configuracion/facturacion'");
    expect(configurationPage).not.toContain("id: 'facturacion'");
    expect(configurationPage).not.toContain('FacturacionSection');
    expect(app).toContain(
      'path="configuracion/facturacion" element={<Navigate to="/admin/facturacion/configuracion" replace />}'
    );
    expect(app).toContain('path="facturacion/:tab"');
  });

  it('consulta Logs desde la ruta protegida coherente', () => {
    const logsSection = source('./sections/LogsSection.jsx');

    expect(logsSection).toContain("api.get('/api/admin/audit-logs'");
    expect(logsSection).toContain('params: { scope, page: 1, limit: 100 }');
    expect(logsSection).toContain("setScope('operations')");
    expect(logsSection).not.toContain('/api/admin/auth/logs');
  });

  it('envía desde Envíos únicamente la sección que le pertenece', () => {
    const shippingSection = source('./sections/EnviosSection.jsx');

    expect(shippingSection).toContain('envios: payloadEnvios');
    expect(shippingSection).not.toContain('...data,\n        theme:');
  });
});
