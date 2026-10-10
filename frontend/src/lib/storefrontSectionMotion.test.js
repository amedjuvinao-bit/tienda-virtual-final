import { afterEach, describe, expect, it, vi } from 'vitest';
import { animateStorefrontEntrance, mountStorefrontSectionMotion, STOREFRONT_SECTION_CHANGE } from './storefrontSectionMotion';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('transiciones de secciones de la tienda', () => {
  it('anima entrada y salida cada vez que se avanza y se regresa', () => {
    const sectionChanges = vi.fn();
    window.addEventListener(STOREFRONT_SECTION_CHANGE, sectionChanges);
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
    expect(sectionChanges).toHaveBeenCalledTimes(1);
    window.dispatchEvent(new Event('resize'));
    scheduled();
    expect(sectionChanges).toHaveBeenCalledTimes(1);
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
    expect(sectionChanges).toHaveBeenCalledTimes(3);
    unmount();
    window.removeEventListener(STOREFRONT_SECTION_CHANGE, sectionChanges);
  });

  it('usa la misma entrada escalonada de los botones y respeta movimiento reducido', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    const animate = vi.fn(() => ({ cancel: vi.fn() }));
    first.animate = animate;
    second.animate = animate;
    expect(animateStorefrontEntrance([first, second], { delay: 380 })).toHaveLength(2);
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 840, delay: 380 });
    expect(animate.mock.calls[1][1]).toMatchObject({ duration: 840, delay: 485 });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    expect(animateStorefrontEntrance([first])).toHaveLength(0);
    expect(animate).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });
});
