// Keep a fixed hit area during each pointer visit; transformed bounds would feed back into tilt.
const pointerBounds = new WeakMap();
const angles = [[5, -13], [-3, 5], [-6, -13], [8, 14], [5, -10]];

export function instagramDepthStyle(layout, slot, config) {
  const depth = config.editorialDepthEnabled
    ? Math.min(config.editorialDepth * (0.25 + layout.layer * 0.2), config.editorialDepth * 1.2) : 0;
  const [x, y] = angles[slot] || [3, -5];
  return {
    '--photo-depth': `${depth}px`,
    // Compensate perspective enlargement so the configured frame size remains stable.
    '--photo-rest-scale': 1 - depth / config.editorialPerspective,
    '--photo-tilt-x': `${config.editorialTilt ? x * config.editorialTilt3D / 10 : 0}deg`,
    '--photo-tilt-y': `${config.editorialTilt ? y * config.editorialTilt3D / 10 : 0}deg`,
  };
}
export function moveInstagramDepth(event, config) {
  if (!config.editorialDepthEnabled || !config.editorialPointer3D || config.editorialMotion === 'none'
    || event.pointerType === 'touch' || !window.matchMedia?.('(hover: hover) and (pointer: fine)').matches
    || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const card = event.currentTarget;
  let rect = pointerBounds.get(card);
  if (!rect) {rect = card.getBoundingClientRect();pointerBounds.set(card, rect);}
  const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1));
  const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height) * 2 - 1));
  card.style.setProperty('--photo-pointer-x', `${-y * config.editorialParallax}deg`);
  card.style.setProperty('--photo-pointer-y', `${x * config.editorialParallax}deg`);
  card.style.setProperty('--photo-light-x', `${(x + 1) * 50}%`);
  card.style.setProperty('--photo-light-y', `${(y + 1) * 50}%`);
}
export function resetInstagramDepth(event) {
  const card = event.currentTarget;
  pointerBounds.delete(card);
  for (const name of ['--photo-pointer-x', '--photo-pointer-y', '--photo-light-x', '--photo-light-y']) {
    card.style.removeProperty(name);
  }
}
