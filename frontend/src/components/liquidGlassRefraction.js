const states = new WeakMap();
const CELL = 3;

function imageSource(template, clientX, clientY) {
  const media = Array.from(template.querySelectorAll('.rb-template__picture img, .rb-template__picture video'));
  const ready = (element) => element.tagName === 'VIDEO'
    ? element.readyState >= 2
    : element.complete && element.naturalWidth > 0;
  return media.find((element) => {
    const box = element.getBoundingClientRect();
    return ready(element) && box.left <= clientX && clientX <= box.right && box.top <= clientY && clientY <= box.bottom;
  }) || media.find(ready);
}

function mediaGeometry(media) {
  const box = media.getBoundingClientRect();
  const width = media.videoWidth || media.naturalWidth;
  const height = media.videoHeight || media.naturalHeight;
  if (!width || !height || !box.width || !box.height) return null;
  const style = window.getComputedStyle(media);
  const factor = style.objectFit === 'contain'
    ? Math.min(box.width / width, box.height / height)
    : Math.max(box.width / width, box.height / height);
  const displayedWidth = style.objectFit === 'fill' ? box.width : width * factor;
  const displayedHeight = style.objectFit === 'fill' ? box.height : height * factor;
  const [horizontal = '50%', vertical = '50%'] = (style.objectPosition || '50% 50%').split(/\s+/);
  const position = (value, remaining) => value.endsWith('%') ? remaining * (parseFloat(value) || 0) / 100 : parseFloat(value) || 0;
  return {
    box, width, height,
    scaleX: width / displayedWidth,
    scaleY: height / displayedHeight,
    offsetX: position(horizontal, box.width - displayedWidth),
    offsetY: position(vertical, box.height - displayedHeight),
  };
}

function paint(target, state) {
  const { canvas, point } = state;
  const media = imageSource(target.closest('.rb-template'), point.clientX, point.clientY);
  const geometry = media && mediaGeometry(media);
  if (!geometry) return false;
  const { rect, x: pointerX, y: pointerY } = point;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);
  if (canvas.width !== Math.ceil(width * ratio) || canvas.height !== Math.ceil(height * ratio)) {
    canvas.width = Math.ceil(width * ratio);
    canvas.height = Math.ceil(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  const radius = Math.min(76, Math.max(48, height * 1.15));
  const left = Math.max(0, Math.floor((pointerX - radius) / CELL) * CELL);
  const top = Math.max(0, Math.floor((pointerY - radius) / CELL) * CELL);
  const right = Math.min(width, Math.ceil((pointerX + radius) / CELL) * CELL);
  const bottom = Math.min(height, Math.ceil((pointerY + radius) / CELL) * CELL);

  for (let y = top; y < bottom; y += CELL) {
    for (let x = left; x < right; x += CELL) {
      const tileWidth = Math.min(CELL, width - x);
      const tileHeight = Math.min(CELL, height - y);
      const dx = x + tileWidth / 2 - pointerX;
      const dy = y + tileHeight / 2 - pointerY;
      const distance = (dx * dx + dy * dy) / (radius * radius);
      if (distance >= 1) continue;
      const strength = (1 - distance) ** 2;
      // La muestra de imagen se mueve hacia el centro del puntero; texto y forma permanecen estables.
      const screenX = rect.left + x - (dx * .72 - dy * .06) * strength;
      const screenY = rect.top + y - (dy * .72 + dx * .06) * strength;
      const sourceWidth = tileWidth * geometry.scaleX;
      const sourceHeight = tileHeight * geometry.scaleY;
      const sourceX = Math.max(0, Math.min(geometry.width - sourceWidth, (screenX - geometry.box.left - geometry.offsetX) * geometry.scaleX));
      const sourceY = Math.max(0, Math.min(geometry.height - sourceHeight, (screenY - geometry.box.top - geometry.offsetY) * geometry.scaleY));
      ctx.drawImage(media, sourceX, sourceY, sourceWidth, sourceHeight, x, y, tileWidth, tileHeight);
    }
  }
  return true;
}

function queuePaint(target, state) {
  if (state.frame !== null) return;
  state.frame = window.requestAnimationFrame((time) => {
    state.frame = null;
    if (!target.isConnected || !state.point) return;
    const video = target.closest('.rb-template')?.querySelector('.rb-template__picture video');
    const playingVideo = video && !video.paused;
    if (!playingVideo || !state.lastVideoFrame || time - state.lastVideoFrame >= 32) {
      try {
        if (paint(target, state)) target.dataset.refracting = 'true';
        else delete target.dataset.refracting;
      } catch {
        delete target.dataset.refracting;
      }
      state.lastVideoFrame = time;
    }
    if (playingVideo && state.point) queuePaint(target, state);
  });
}

export function moveLiquidGlass(event) {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const target = event.currentTarget;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height || !target.closest('.rb-template')) return;
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  target.style.setProperty('--rb-pointer-x', `${x}px`);
  target.style.setProperty('--rb-pointer-y', `${y}px`);
  let state = states.get(target);
  if (!state) {
    state = { canvas: target.querySelector('.rb-glass-lens'), frame: null, point: null, lastVideoFrame: 0 };
    states.set(target, state);
  }
  if (!state.canvas) return;
  state.point = { x, y, rect, clientX: event.clientX, clientY: event.clientY };
  queuePaint(target, state);
}

export function clearLiquidGlass(event) {
  const target = event.currentTarget;
  delete target.dataset.refracting;
  const state = states.get(target);
  if (state?.frame !== null && state?.frame !== undefined) window.cancelAnimationFrame(state.frame);
  if (state) {
    state.frame = null;
    state.point = null;
    state.lastVideoFrame = 0;
  }
}
