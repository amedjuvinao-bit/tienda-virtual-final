const ACTION = 'button, a[href], [role="button"], input[type="submit"], input[type="button"], summary';
// These controls already own a complete press animation, including its timing.
const NATIVE = '[data-action-feedback="native"], .rb-liquid-button, .rb-template__card, .rb-template__spot-card, .storefront-liquid-icon, .trending-liquid-button, .header-menu a, .footer-ed a, .footer-ed button';
const EXCLUDED = '[data-action-feedback="off"], .admin-area, [inert], [aria-hidden="true"]';
const EASE = 'cubic-bezier(.2,.8,.2,1)';

export function mountStorefrontActionFeedback(root = document) {
  const doc = root.ownerDocument || root, view = doc.defaultView;
  const reduced = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const animations = new Map(), lights = new Set();
  let hovered = null, hoverMoved = false, held = null, lastRelease = null, disposed = false;
  const visualFor = control => control.matches('.tk-stage__select') ? control.closest('.tk-stage__item') || control : control;

  function controlFor(event) {
    if (disposed || reduced?.matches || event.button > 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return null;
    const control = event.target?.closest?.(ACTION);
    if (!control || !root.contains(control) || control.matches(NATIVE) || control.closest(EXCLUDED) || control.matches(':disabled, [aria-disabled="true"]') || control.closest('[aria-disabled="true"]')) return null;
    if (typeof control.animate !== 'function') return null;
    const rect = control.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? control : null;
  }

  function stopMotion(control) {
    const entry = animations.get(control);
    if (!entry) return;
    view.clearTimeout(entry.timer);
    entry.animation.cancel();
    animations.delete(control);
  }

  function motion(control, frames, duration, hold = false) {
    stopMotion(control);
    // Add to the native transform rather than replacing centering, hover or
    // carousel transforms. No layout, media node or parallax property changes.
    const animation = visualFor(control).animate(frames.map(transform => ({ transform })), {
      duration, easing: EASE, composite: 'add', fill: hold ? 'forwards' : 'none',
    });
    const entry = { animation, timer: 0 };
    animations.set(control, entry);
    const finish = () => { if (animations.get(control) === entry) stopMotion(control); };
    if (!hold) {
      animation.onfinish = finish;
      entry.timer = view.setTimeout(finish, duration + 100);
    }
  }

  function poses(control) {
    const rect = visualFor(control).getBoundingClientRect(), card = rect.height > 100 || rect.width > 360;
    return card
      ? { hover: 'translateY(-1px) scale(1.008)', press: 'scale(.985)', rebound: 'scale(1.008)' }
      : { hover: 'translateY(-2px) scale(1.035)', press: 'scale(.93)', rebound: 'translateY(-1px) scale(1.045)' };
  }

  function illuminate(control, event) {
    const visual = visualFor(control), rect = visual.getBoundingClientRect(), css = view.getComputedStyle(visual);
    // A viewport-aligned rectangle cannot represent a card's inner rounded
    // surfaces, clipping or perspective. Keep its own glass and movement.
    if (rect.height > 96 || rect.width > 360) return;
    if (control.matches('a') && (!css.borderRadius || /^0(?:px)?(?:\s+0(?:px)?)*$/.test(css.borderRadius))) return;
    for (let node = visual; node && node !== doc.body; node = node.parentElement) {
      const style = view.getComputedStyle(node);
      if (style.clipPath && style.clipPath !== 'none' || style.perspective && style.perspective !== 'none' || /hidden|clip|auto|scroll/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`)) return;
      // A control's own press is uniformly scaled and centered. Transformed
      // parents can rotate or skew it, making an external light inaccurate.
      if (node !== visual && style.transform && style.transform !== 'none') return;
      if (style.transform && style.transform !== 'none') {
        const matrix = style.transform.match(/^matrix\(([^)]+)\)$/)?.[1].split(',').map(Number);
        if (matrix ? Math.abs(matrix[1]) > .0001 || Math.abs(matrix[2]) > .0001 : /rotate|skew|perspective|matrix3d/.test(style.transform)) return;
      }
      if (node !== visual && style.scale && style.scale !== 'none' && style.scale !== '1') return;
      if (style.rotate && style.rotate !== 'none' && style.rotate !== '0deg') return;
    }
    // One temporary surface per control; rapid taps never build an overlay queue.
    for (const light of lights) if (light.control === control) light.remove();
    if (lights.size >= 6) lights.values().next().value.remove();
    const surface = doc.createElement('span');
    surface.className = 'storefront-action-light';
    surface.dataset.phase = 'press';
    surface.setAttribute('aria-hidden', 'true');
    surface.style.borderRadius = css.borderRadius || '12px';
    surface.style.setProperty('--action-ink', css.color);
    const pointer = event.detail !== 0 && Number.isFinite(event.clientX) && Number.isFinite(event.clientY);
    const x = pointer ? Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)) : 50;
    const y = pointer ? Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) : 50;
    surface.style.setProperty('--action-x', `${x}%`);
    surface.style.setProperty('--action-y', `${y}%`);
    for (const name of ['rim', 'sheen', 'bloom']) {
      const layer = doc.createElement('i');
      layer.className = `storefront-action-light__${name}`;
      surface.append(layer);
    }
    let frame = 0, timer = 0;
    const light = { control, remove: () => {
      view.cancelAnimationFrame(frame);
      view.clearTimeout(timer);
      surface.remove();
      lights.delete(light);
    } };
    const follow = () => {
      if (!control.isConnected || reduced?.matches || disposed) return light.remove();
      const bounds = visual.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return light.remove();
      Object.assign(surface.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
      frame = view.requestAnimationFrame(follow);
    };
    lights.add(light);
    doc.body.append(surface);
    follow();
    timer = view.setTimeout(light.remove, 640);
  }

  function leave(control) {
    if (hovered !== control) return;
    hovered = null;
    if (!hoverMoved || held?.control === control) return;
    motion(control, [poses(control).hover, 'none'], 180);
  }

  function enter(event) {
    if (event.type === 'pointerover' && event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
    const control = controlFor(event);
    if (!control || control.contains(event.relatedTarget) || hovered === control || held) return;
    if (hovered) leave(hovered);
    hovered = control;
    // Existing CSS hover transforms continue to provide the movement. Only
    // controls without their own movement receive the shared lift.
    const css = view.getComputedStyle(visualFor(control));
    hoverMoved = (!css.transform || css.transform === 'none') && (!css.scale || css.scale === 'none') && (!css.animationName || css.animationName === 'none');
    if (hoverMoved) {
      motion(control, ['none', poses(control).hover], 240, true);
    }
  }

  function exit(event) {
    if (hovered && !hovered.contains(event.relatedTarget)) leave(hovered);
  }

  function down(event) {
    if (event.type === 'keydown' && (!['Enter', ' '].includes(event.key) || event.repeat || event.target?.matches('a[href], summary') && event.key === ' ')) return;
    const control = controlFor(event);
    if (!control) return;
    if (held) stopMotion(held.control);
    lastRelease = null;
    held = { control, pointerId: event.pointerId };
    hovered = null;
    motion(control, ['none', poses(control).press], 95, true);
  }

  function release(event) {
    if (!held || event.type === 'keyup' && !['Enter', ' '].includes(event.key)) return;
    if (event.pointerId != null && held.pointerId !== event.pointerId) return;
    const { control } = held;
    held = null;
    lastRelease = event.type === 'pointercancel' ? null : { control, at: view.performance.now() };
    motion(control, [poses(control).press, 'none'], 180);
  }

  function click(event) {
    const control = controlFor(event);
    if (!control) return;
    const pressed = held?.control === control || lastRelease?.control === control && view.performance.now() - lastRelease.at < 160;
    held = null;
    lastRelease = null;
    hovered = null;
    const pose = poses(control);
    motion(control, pressed ? [pose.press, pose.rebound, 'none'] : ['none', pose.press, pose.rebound, 'none'], pressed ? 420 : 460);
    illuminate(control, event);
  }

  function clear() {
    hovered = null;
    held = null;
    lastRelease = null;
    for (const control of animations.keys()) stopMotion(control);
    for (const light of lights) light.remove();
  }
  const onReduced = () => { if (reduced.matches) clear(); };
  const listeners = { pointerover: enter, pointerout: exit, focusin: enter, focusout: exit, pointerdown: down, keydown: down, click };
  for (const [name, handler] of Object.entries(listeners)) root.addEventListener(name, handler, true);
  for (const name of ['pointerup', 'pointercancel', 'keyup']) view.addEventListener(name, release, true);
  view.addEventListener('blur', clear);
  reduced?.addEventListener('change', onReduced);
  return () => {
    disposed = true;
    clear();
    for (const [name, handler] of Object.entries(listeners)) root.removeEventListener(name, handler, true);
    for (const name of ['pointerup', 'pointercancel', 'keyup']) view.removeEventListener(name, release, true);
    view.removeEventListener('blur', clear);
    reduced?.removeEventListener('change', onReduced);
  };
}
