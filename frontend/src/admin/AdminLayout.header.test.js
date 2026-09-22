import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

function source(relativeUrl) {
  return fs.readFileSync(new URL(relativeUrl, import.meta.url), 'utf8');
}

const layoutSource = source('./AdminLayout.jsx');
const globalStylesSource = source('./theme/adminGlobalStyles.js');

describe('encabezado principal del panel administrativo', () => {
  it('permanece visible y adopta una versión compacta durante el scroll', () => {
    expect(layoutSource).toContain('setHeaderCondensed(window.scrollY > 56)');
    expect(layoutSource).toContain('data-condensed={headerCondensed}');
    expect(layoutSource).toMatch(
      /\.admin-area \.admin-header-panel\s*\{[^}]*position: sticky;[^}]*top: var\(--admin-padding\);/s,
    );
    expect(layoutSource).toContain('.admin-area .admin-header-panel[data-condensed="true"]');
  });

  it('mantiene visibles el nombre y el tipo de usuario en escritorio', () => {
    expect(layoutSource).toContain('<strong>{activeAdminName}</strong>');
    expect(layoutSource).toContain('Tipo de usuario: <b>{activeAdminRoleLabel}</b>');
    expect(layoutSource).not.toContain(
      '.admin-profile-compact > div:last-child { display: none; }',
    );
  });

  it('muestra el fondo personalizado en una capa fija que no tapa el tema', () => {
    expect(layoutSource).toContain(
      'className="admin-panel-custom-background"'
    );
    expect(globalStylesSource).toMatch(
      /\.admin-panel-custom-background\s*\{[^}]*position: fixed;[^}]*background-image:/s,
    );
    expect(globalStylesSource).toContain(
      'html[data-admin-panel-background="image"] .admin-panel-custom-background',
    );
  });
});
