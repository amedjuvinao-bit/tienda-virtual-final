const maps = new WeakMap();
const DISPLACEMENT_SCALE = 28;

function paintDisplacement(canvas, width, height, pointerX, pointerY) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const image = context.createImageData(width, height);
  const pixels = image.data;
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = 128;
    pixels[index + 1] = 128;
    pixels[index + 3] = 255;
  }
  const radius = Math.min(72, Math.max(43, height * 1.05));
  const left = Math.max(0, Math.floor(pointerX - radius));
  const right = Math.min(width, Math.ceil(pointerX + radius));
  const top = Math.max(0, Math.floor(pointerY - radius));
  const bottom = Math.min(height, Math.ceil(pointerY + radius));
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const dx = x - pointerX;
      const dy = y - pointerY;
      const distance = (dx * dx + dy * dy) / (radius * radius);
      if (distance >= 1) continue;
      const falloff = (1 - distance) ** 2;
      const index = (y * width + x) * 4;
      const pull = -.92 * falloff;
      const swirl = .08 * falloff;
      pixels[index] = Math.max(0, Math.min(255, Math.round(128 + (dx * pull - dy * swirl) * 255 / DISPLACEMENT_SCALE)));
      pixels[index + 1] = Math.max(0, Math.min(255, Math.round(128 + (dy * pull + dx * swirl) * 255 / DISPLACEMENT_SCALE)));
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

export function moveLiquidGlass(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  target.style.setProperty('--rb-pointer-x', `${x}px`);
  target.style.setProperty('--rb-pointer-y', `${y}px`);
  target.dataset.refracting = 'true';

  const lens = target.querySelector('.rb-glass-lens');
  const image = target.querySelector('[data-glass-map]');
  if (!lens || !image) return;
  let state = maps.get(target);
  if (!state) {
    state = { canvas: document.createElement('canvas'), frame: null, point: null };
    maps.set(target, state);
  }
  state.point = { x, y, width: Math.ceil(rect.width), height: Math.ceil(rect.height) };
  if (state.frame !== null) return;
  state.frame = window.requestAnimationFrame(() => {
    state.frame = null;
    if (!target.isConnected || !target.dataset.refracting) return;
    const point = state.point;
    try {
      const map = paintDisplacement(state.canvas, point.width, point.height, point.x, point.y);
      if (!map) return;
      image.setAttribute('href', map);
      // El filtro debe actuar sobre el fondo visto A TRAVÉS del vidrio.
      // filter: url(...) solo deforma los píxeles de la capa transparente.
      lens.style.backdropFilter = `url(#${lens.dataset.glassFilter}) saturate(145%)`;
      lens.style.webkitBackdropFilter = lens.style.backdropFilter;
    } catch {
      // La apertura local sigue visible si Canvas/SVG no está disponible.
      lens.style.backdropFilter = '';
      lens.style.webkitBackdropFilter = '';
    }
  });
}

export function clearLiquidGlass(event) {
  const target = event.currentTarget;
  delete target.dataset.refracting;
  const state = maps.get(target);
  if (state?.frame !== null && state?.frame !== undefined) window.cancelAnimationFrame(state.frame);
  if (state) state.frame = null;
  const lens = target.querySelector('.rb-glass-lens');
  if (lens) {
    lens.style.backdropFilter = '';
    lens.style.webkitBackdropFilter = '';
  }
}
