import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const checkoutModuleDirectory = path.resolve(process.cwd(), 'src/checkout/page');
const thanksModuleDirectory = path.resolve(process.cwd(), 'src/pages/gracias');
const PAGE_FILES = [
  path.resolve(process.cwd(), 'src/pages/CheckoutPage.jsx'),
  path.resolve(process.cwd(), 'src/pages/GraciasPage.jsx'),
  ...fs
    .readdirSync(checkoutModuleDirectory)
    .filter(
      (fileName) =>
        /\.(?:js|jsx)$/.test(fileName) && !fileName.includes('.test.')
    )
    .map((fileName) => path.join(checkoutModuleDirectory, fileName)),
  ...fs
    .readdirSync(thanksModuleDirectory)
    .filter(
      (fileName) =>
        /\.(?:js|jsx)$/.test(fileName) && !fileName.includes('.test.')
    )
    .map((fileName) => path.join(thanksModuleDirectory, fileName)),
];

describe('páginas de pago sin registros sensibles', () => {
  it('no imprime respuestas completas de PayU o Wompi', () => {
    for (const file of PAGE_FILES) {
      const source = fs.readFileSync(file, 'utf8');

      expect(source, file).not.toMatch(/console\.(?:log|debug|info)\s*\(/);
      expect(source, file).not.toContain('PAYU CHECKOUT DATA');
      expect(source, file).not.toContain('WOMPI TX DATA');
    }
  });

  it('no entrega objetos de error completos a la consola', () => {
    for (const file of PAGE_FILES) {
      const source = fs.readFileSync(file, 'utf8');

      expect(source, file).not.toMatch(
        /console\.error\([^;]*,\s*(?:error|err|data|response)\s*\)/s
      );
    }
  });
});
