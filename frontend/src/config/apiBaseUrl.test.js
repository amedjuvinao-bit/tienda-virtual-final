import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  ApiBaseUrlConfigurationError,
  resolveApiBaseUrl,
} from './apiBaseUrl';

describe('autoridad de VITE_API_BASE_URL', () => {
  it('utiliza exactamente la URL canonica configurada', () => {
    expect(resolveApiBaseUrl({
      VITE_API_BASE_URL: 'https://api.example.test/',
      DEV: false,
      PROD: true,
    })).toBe('https://api.example.test');
  });

  it('en produccion sin variable falla antes de construir localhost', () => {
    expect(() => resolveApiBaseUrl({ DEV: false, PROD: true })).toThrowError(
      expect.objectContaining({
        name: 'ApiBaseUrlConfigurationError',
        code: 'API_BASE_URL_REQUIRED',
      })
    );
    try {
      resolveApiBaseUrl({ DEV: false, PROD: true });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiBaseUrlConfigurationError);
      expect(error.message).not.toContain('localhost');
    }
  });

  it('permite localhost solamente cuando Vite declara desarrollo', () => {
    expect(resolveApiBaseUrl({ DEV: true, PROD: false })).toBe(
      'http://localhost:5000'
    );
    expect(() => resolveApiBaseUrl({ DEV: false, PROD: false })).toThrowError(
      expect.objectContaining({ code: 'API_BASE_URL_REQUIRED' })
    );
  });

  it('no conserva referencias de ejecucion a VITE_API_URL', () => {
    const sourceRoot = path.resolve(process.cwd(), 'src');
    const files = [];
    const collect = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) collect(target);
        else if (/\.(?:js|jsx)$/.test(entry.name)) files.push(target);
      }
    };
    collect(sourceRoot);
    const runtimeSource = files
      .filter((file) => !file.endsWith('.test.js') && !file.endsWith('.test.jsx'))
      .map((file) => fs.readFileSync(file, 'utf8'))
      .join('\n');
    expect(runtimeSource).not.toMatch(/\bVITE_API_URL\b/);
  });
});
