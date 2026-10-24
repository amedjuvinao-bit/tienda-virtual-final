import { expect, it } from 'vitest';
import { glassRefractionPixels } from './glassRefractionMap';

const width = 200, height = 160;
const data = glassRefractionPixels(width, height, 24, 12, width, height);
const pixel = (x, y) => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 4)];

it('keeps the face and the space outside rounded corners free of displacement', () => {
  expect(pixel(100, 80)).toEqual([128, 128, 255, 255]);
  expect(pixel(0, 0)).toEqual([128, 128, 0, 255]);
  expect(pixel(24, 80).slice(0, 2)).toEqual([128, 128]);
});

it('bends opposite edges in opposite directions without changing the perpendicular axis', () => {
  expect(pixel(4, 80)[0]).toBeLessThan(128);
  expect(pixel(195, 80)[0]).toBeGreaterThan(128);
  expect(pixel(4, 80)[0] + pixel(195, 80)[0]).toBe(256);
  expect(pixel(4, 80)[1]).toBe(128);
  expect(pixel(100, 4)[1]).toBeLessThan(128);
  expect(pixel(100, 155)[1]).toBeGreaterThan(128);
  expect(pixel(100, 4)[0]).toBe(128);
});

it('curves both displacement channels through a rounded corner and builds a convex height', () => {
  expect(pixel(8, 8)[0]).toBeLessThan(128);
  expect(pixel(8, 8)[0]).toBe(pixel(8, 8)[1]);
  expect(pixel(0, 80)[2]).toBeLessThan(pixel(4, 80)[2]);
  expect(pixel(4, 80)[2]).toBeLessThan(pixel(11, 80)[2]);
});
