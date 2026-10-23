import { afterEach, expect, it, vi } from 'vitest';
import { mountStorefrontActionFeedback } from './storefrontActionFeedback';

let stop;
const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
afterEach(() => {
  stop?.(); stop = null; document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers();
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else delete Element.prototype.animate;
});

function setup(html = '<button><svg><path/></svg>Comprar</button>') {
  vi.useFakeTimers();
  const reduced = new EventTarget(); reduced.matches = false;
  vi.stubGlobal('matchMedia', () => reduced);
  const calls = [];
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ left: 30, top: 50, width: 180, height: 48 });
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, writable: true, value: vi.fn(function (frames, options) {
    const animation = { cancel: vi.fn(), onfinish: null };
    calls.push({ control: this, frames, options, animation });
    return animation;
  }) });
  document.body.innerHTML = html;
  stop = mountStorefrontActionFeedback(document);
  return { calls, reduced, button: document.querySelector('button') };
}
function pointer(target, name, props = {}) {
  const event = new Event(name, { bubbles: true, cancelable: true });
  Object.assign(event, { pointerType: 'mouse', pointerId: 1, button: 0, clientX: 60, clientY: 70, ...props });
  target.dispatchEvent(event);
  return event;
}

it('animates the nearest action once, preserves transforms and lets the original click execute immediately', () => {
  const { calls, button } = setup('<button style="transform:translate(-50%,-50%);translate:0 12px"><svg><path/></svg>Ver</button>');
  const action = vi.fn(); button.addEventListener('click', action);
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1, clientX: 60, clientY: 70 });
  button.querySelector('path').dispatchEvent(event);
  expect(action).toHaveBeenCalledOnce(); expect(event.defaultPrevented).toBe(false);
  expect(calls).toHaveLength(1); expect(calls[0].control).toBe(button); expect(calls[0].options.composite).toBe('add');
  expect(button.style.transform).toBe('translate(-50%,-50%)'); expect(button.style.translate).toBe('0 12px');
  expect(button.children).toHaveLength(1);
  expect(document.querySelectorAll('.storefront-action-light')).toHaveLength(1);
  vi.advanceTimersByTime(800);
  expect(document.querySelector('.storefront-action-light')).toBeNull(); expect(calls[0].animation.cancel).toHaveBeenCalled();
});

it('covers controls mounted after startup and bounds repeated click effects', () => {
  const { calls } = setup('');
  const link = document.createElement('a'); link.href = '#coleccion'; link.textContent = 'Colección'; link.style.borderRadius = '24px'; document.body.append(link);
  for (let i = 0; i < 20; i++) link.click();
  expect(calls).toHaveLength(20); expect(calls[0].animation.cancel).toHaveBeenCalledOnce();
  expect(document.querySelectorAll('.storefront-action-light')).toHaveLength(1);
});

it('animates the whole TikTok card while preserving independent selection and external actions', () => {
  const { calls, button } = setup('<article class="tk-stage__item"><button class="tk-stage__select">Seleccionar</button><a href="#video">Abrir</a></article>');
  const select = vi.fn(); button.addEventListener('click', select); button.click();
  expect(calls[0].control).toBe(button.closest('article')); expect(select).toHaveBeenCalledOnce();
  document.querySelector('a').click(); expect(calls[1].control).toBe(document.querySelector('a')); expect(select).toHaveBeenCalledOnce();
});

it('keeps native animations, disabled controls, admin surfaces and explicit exclusions untouched', () => {
  const { calls } = setup('<button disabled>Disabled</button><fieldset disabled><button>Fieldset</button></fieldset><button aria-disabled="true">Wait</button><div class="admin-area"><button>Admin</button></div><div inert><button>Inert</button></div><div data-action-feedback="off"><button>Off</button></div><button class="storefront-liquid-icon">Scroll</button><a href="#" class="rb-liquid-button">Banner</a><footer class="footer-ed"><button>Footer</button></footer><button data-action-feedback="native">Own</button>');
  document.querySelectorAll('button, a').forEach(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(calls).toHaveLength(0); expect(document.querySelector('.storefront-action-light')).toBeNull();
});

it('adds hover lift only when a control has no native movement and ignores movement between its children', () => {
  const { calls, button } = setup();
  pointer(button, 'pointerover'); pointer(button.querySelector('svg'), 'pointerover', { relatedTarget: button });
  expect(calls).toHaveLength(1); expect(calls[0].options.fill).toBe('forwards');
  expect(document.querySelector('.storefront-action-light')).toBeNull();
  pointer(button, 'pointerout', { relatedTarget: document.body });
  expect(calls).toHaveLength(2); expect(calls[1].frames.at(-1).transform).toBe('none');
  button.style.transform = 'translateY(-3px)';
  pointer(button, 'pointerover'); pointer(button, 'pointerout', { relatedTarget: document.body });
  expect(calls).toHaveLength(2);
});

it('never draws a rectangular pane over hover or keyboard focus in any section', () => {
  const { calls } = setup(['tendencia', 'look', 'categorias', 'instagram', 'tiktok', 'informacion'].map(id => `<section id="${id}"><a href="#detalle"><article style="border-radius:28px">Tarjeta</article></a></section>`).join(''));
  document.querySelectorAll('article').forEach(card => {
    pointer(card, 'pointerover'); pointer(card, 'pointerout', { relatedTarget: document.body });
    card.parentElement.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    card.parentElement.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
  });
  expect(calls.length).toBeGreaterThan(0); expect(document.querySelector('.storefront-action-light')).toBeNull();
});

it('keeps card clicks animated without adding a pane across their separate surfaces', () => {
  const { calls } = setup('<a href="#detalle"><div class="trending-card--floating-glass"><figure style="border-radius:28px"></figure><div class="trending-card__dock"></div></div></a>');
  const card = document.querySelector('a'); card.getBoundingClientRect = () => ({ left: 30, top: 50, width: 300, height: 520 });
  card.click(); expect(calls).toHaveLength(1); expect(document.querySelector('.storefront-action-light')).toBeNull();
});

it('omits external click lights on clipped, inclined, perspective and text-only controls', () => {
  const { calls } = setup('<div style="overflow:hidden"><button>A</button></div><div style="transform:rotate(6deg)"><button>B</button></div><div style="perspective:600px"><button>C</button></div><button style="clip-path:circle(40%)">D</button><a href="#texto">Texto</a><button style="transform:matrix(.99,.05,-.05,.99,0,0)">E</button>');
  document.querySelectorAll('button,a').forEach(control => control.click());
  expect(calls).toHaveLength(6); expect(document.querySelector('.storefront-action-light')).toBeNull();
});

it('responds to touch presses but cancels a scroll gesture without a click flash', () => {
  const { calls, button } = setup();
  pointer(button, 'pointerover', { pointerType: 'touch' }); expect(calls).toHaveLength(0);
  pointer(button, 'pointerdown', { pointerType: 'touch' }); expect(calls).toHaveLength(1);
  pointer(window, 'pointercancel', { pointerType: 'touch' });
  expect(calls[0].animation.cancel).toHaveBeenCalled();
  expect(document.querySelector('[data-phase="press"]')).toBeNull();
  vi.advanceTimersByTime(400); expect(calls.at(-1).animation.cancel).toHaveBeenCalled();
});

it('continues a physical press into one rebound rather than compressing the button twice', () => {
  const { calls, button } = setup();
  pointer(button, 'pointerdown'); pointer(window, 'pointerup'); button.click();
  expect(calls.at(-1).frames).toHaveLength(3);
  expect(calls.at(-1).frames[0].transform).toBe('scale(.93)');
  expect(calls.at(-1).frames[1].transform).toContain('1.045');
});

it('supports keyboard activation without trapping Space on links or changing focus', () => {
  const { calls, button } = setup('<button>Comprar</button><a href="#look">Look</a>');
  button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(calls).toHaveLength(1); button.click();
  expect(calls).toHaveLength(2);
  expect(document.querySelector('.storefront-action-light').style.getPropertyValue('--action-x')).toBe('50%');
  document.querySelector('a').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
  expect(calls).toHaveLength(2);
});

it('does not intercept modified clicks and cancels every effect when reduced motion is enabled live', () => {
  const { calls, button, reduced } = setup();
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })); expect(calls).toHaveLength(0);
  button.click(); expect(calls).toHaveLength(1);
  reduced.matches = true; reduced.dispatchEvent(new Event('change'));
  expect(calls[0].animation.cancel).toHaveBeenCalled(); expect(document.querySelector('.storefront-action-light')).toBeNull();
  button.click(); pointer(button, 'pointerover'); expect(calls).toHaveLength(1);
  reduced.matches = false; reduced.dispatchEvent(new Event('change')); button.click(); expect(calls).toHaveLength(2);
});

it('cleans up removed controls, listeners, held presses and pending frames on route exit', () => {
  const { calls, button } = setup();
  button.click(); button.remove(); vi.advanceTimersByTime(32);
  expect(document.querySelector('.storefront-action-light')).toBeNull();
  document.body.append(button); pointer(button, 'pointerdown'); stop(); stop = null;
  expect(calls.every(call => call.animation.cancel.mock.calls.length === 1)).toBe(true);
  const count = calls.length; button.click(); pointer(button, 'pointerover'); expect(calls).toHaveLength(count);
  expect(vi.getTimerCount()).toBe(0);
});
