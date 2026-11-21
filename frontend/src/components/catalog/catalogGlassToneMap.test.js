import { expect, it } from 'vitest';
import { catalogGlassToneTables } from './catalogGlassToneMap';

const settings = { color:'#ffffff', depthColor:'#562633', depth:.38, reflectionColor:'#ffffff', reflection:.82 };
const channels = settings => catalogGlassToneTables(settings).map(table => table.split(' ').map(Number));

it('conserva diferencias de luz en cristal blanco para no borrar su relieve', () => {
  const [r, g, b] = channels(settings);
  for (const channel of [r, g, b]) {
    expect(channel[24]).toBeLessThan(channel[28]);
    expect(channel[28]).toBeLessThan(channel[32]);
    expect(channel[32]).toBe(1);
    expect(Math.min(...channel)).toBeGreaterThan(.65);
  }
});

it('respeta colores e intensidades elegidos sin introducir tonos cálidos de la imagen', () => {
  const [r, g, b] = channels({...settings, depthColor:'#2244cc'});
  expect(b[24]).toBeGreaterThan(g[24]);
  expect(g[24]).toBeGreaterThan(r[24]);
  const flat = channels({...settings, color:'#2266ff', depth:0, reflection:0});
  expect(new Set(flat[0])).toEqual(new Set([Number((0x22/255).toFixed(6))]));
  expect(new Set(flat[1])).toEqual(new Set([.4]));
  expect(new Set(flat[2])).toEqual(new Set([1]));
});

it('conserva el relieve del bisel cuando su tinte y profundidad tienen el mismo color', () => {
  const [r, g, b] = channels({...settings,color:'#ff99cc',depthColor:'#ff99cc',shadeScale:.6});
  expect(r[24]).toBeLessThan(r[28]);
  expect(g[24]).toBeLessThan(g[28]);
  expect(b[24]).toBeLessThan(b[28]);
  expect(r[24]).toBeGreaterThan(b[24]);
  expect(b[24]).toBeGreaterThan(g[24]);
});
