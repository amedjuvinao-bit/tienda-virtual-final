const bounds = new WeakMap();

export function moveJournalGlass(event, settings) {
  const el = event.currentTarget;
  if (!settings.journalGlassEnabled || !settings.journalGlassInteractive || event.pointerType === 'touch') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;
  if (!window.matchMedia?.('(hover: hover) and (pointer: fine)')?.matches) return;
  if ((el.closest('.ig-journal')?.clientWidth ?? 0) < 768) return;
  // A preview inside the side panel controls its own light, without moving its parent.
  if (event.target?.closest?.('[data-igj-glass]') !== el) return;
  let rect = bounds.get(el);
  if (!rect) { rect = el.getBoundingClientRect(); bounds.set(el, rect); }
  if (!rect.width || !rect.height) return;
  const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
  const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
  const tilt = el.dataset.igjGlass === 'preview' ? 0 : settings.journalGlassTilt;
  el.style.setProperty('--igj-light-x', `${(x * 100).toFixed(2)}%`);
  el.style.setProperty('--igj-light-y', `${(y * 100).toFixed(2)}%`);
  el.style.setProperty('--igj-pointer-x', `${((.5 - y) * tilt * 2).toFixed(3)}deg`);
  el.style.setProperty('--igj-pointer-y', `${((x - .5) * tilt * 2).toFixed(3)}deg`);
}
export function resetJournalGlass(event) {
  const el = event.currentTarget;
  bounds.delete(el);
  ['--igj-light-x', '--igj-light-y', '--igj-pointer-x', '--igj-pointer-y'].forEach(key => el.style.removeProperty(key));
}
