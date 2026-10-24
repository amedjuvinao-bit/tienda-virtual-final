import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import PolishedGlassRim from './PolishedGlassRim';
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('keeps the face unpainted and measures layout independently of entrance transforms', () => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 600, height: 30 });
  const { container } = render(<PolishedGlassRim/>);
  expect(container.querySelector('svg')).toHaveAttribute('viewBox', '0 0 600 240');
  expect([...container.querySelectorAll('rect')].every(rect => rect.getAttribute('fill') === 'none')).toBe(true);
  expect(container.querySelector('image')).toBeNull();
});

it('updates its geometry on resize, isolates gradients and disconnects observers', () => {
  let width = 600, height = 240;
  const callbacks = [], disconnect = vi.fn();
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
  vi.spyOn(window, 'getComputedStyle').mockReturnValue({ borderTopLeftRadius: '0px' });
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { callbacks.push(callback); }
    observe() {}
    disconnect = disconnect;
  });
  const { container, unmount } = render(<><PolishedGlassRim/><PolishedGlassRim/></>);
  const ids = [...container.querySelectorAll('[id]')].map(node => node.id);
  expect(new Set(ids).size).toBe(ids.length);
  width = 280; height = 400;
  act(() => callbacks.forEach(callback => callback()));
  expect([...container.querySelectorAll('svg')].every(svg => svg.getAttribute('viewBox') === '0 0 280 400')).toBe(true);
  expect([...container.querySelectorAll('rect')].every(rect => rect.getAttribute('rx') === '0')).toBe(true);
  unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
});
