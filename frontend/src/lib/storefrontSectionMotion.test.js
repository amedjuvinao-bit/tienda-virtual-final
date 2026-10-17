import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountStorefrontSectionMotion } from './storefrontSectionMotion';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('transiciones de secciones de la tienda', () => {
  it('anima entrada y salida cada vez que se avanza y se regresa', () => {
    const container = document.createElement('div');
    const sections = [0, 800, 1600].map((top) => {
      const section = document.createElement('section');
      Object.defineProperties(section, {
        offsetTop: { get: () => top },
        offsetHeight: { get: () => 800 },
      });
      container.append(section);
      return section;
    });
    document.body.append(container);
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    let scrollY = 0;
    Object.defineProperty(window, 'scrollY', { configurable: true, get: () => scrollY });
    let scheduled;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => { scheduled = callback; return 1; });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    const unmount = mountStorefrontSectionMotion(container);
    scheduled();
    expect(sections[0].dataset.sectionMotion).toBe('entering');
    scrollY = 800;
    window.dispatchEvent(new Event('scroll'));
    scheduled();
    expect(sections[0].dataset.sectionMotion).toBe('leaving');
    expect(sections[1].dataset.sectionMotion).toBe('entering');
    expect(sections[1].dataset.sectionDirection).toBe('down');
    scrollY = 0;
    window.dispatchEvent(new Event('scroll'));
    scheduled();
    expect(sections[1].dataset.sectionMotion).toBe('leaving');
    expect(sections[0].dataset.sectionMotion).toBe('entering');
    expect(sections[0].dataset.sectionDirection).toBe('up');
    unmount();
  });
});
