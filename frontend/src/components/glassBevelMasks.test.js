import { expect, it } from 'vitest';
import { glassBevelPixels } from './glassBevelMasks';

const width = 200, height = 160;
const masks = glassBevelPixels(width, height, 24, 13, width, height);
const alpha = (channel, x, y) => masks[channel][(y * width + x) * 4 + 3];

it('leaves the entire face and the space outside rounded corners unpainted', () => {
  for (const name of ['light', 'shade']) {
    expect(alpha(name, 0, 0)).toBe(0);
    for (let y = 24; y < height - 24; y++) {
      for (let x = 24; x < width - 24; x++) expect(alpha(name, x, y)).toBe(0);
    }
  }
});

it('separates the bright return from the contact shade instead of making a uniform white strip', () => {
  const light = Array.from({ length: 13 }, (_, x) => alpha('light', x, 80));
  const shade = Array.from({ length: 13 }, (_, x) => alpha('shade', x, 80));
  expect(Math.max(...light)).toBeGreaterThan(210);
  expect(Math.min(...light)).toBeLessThan(35);
  expect(light.indexOf(Math.max(...light))).not.toBe(shade.indexOf(Math.max(...shade)));
});

it('keeps reflection direction and geometry consistent when the image resolution changes', () => {
  const enlarged = glassBevelPixels(width, height, 24, 13, width * 2, height * 2);
  for (const name of ['light', 'shade']) {
    expect(enlarged[name][((height * 2 / 2) * width * 2 + width) * 4 + 3]).toBe(0);
  }
  expect(alpha('light', 100, 151)).toBeGreaterThan(alpha('light', 100, 8));
});
