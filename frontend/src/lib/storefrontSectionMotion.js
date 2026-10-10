export const STOREFRONT_SECTION_CHANGE = 'storefront:section-change';

export function animateStorefrontEntrance(elements, { from = '0 32px', scale = .86, delay = 0 } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return [];
  return Array.from(elements).filter((element) => element?.animate).map((element, index) => element.animate([
    { opacity: 0, translate: from, scale },
    { opacity: 1, translate: '0 0', scale: 1 },
  ], { duration: 840, delay: delay + index * 105, easing: 'cubic-bezier(.16,1,.3,1)' }));
}

export function mountStorefrontSectionMotion(container) {
  const sections = Array.from(container?.children || []).filter((node) => node.tagName === 'SECTION');
  if (!sections.length) return () => {};
  let active = null;
  let frame = 0;

  const update = () => {
    frame = 0;
    const anchor = window.scrollY + window.innerHeight * 0.42;
    const next = sections.find((section) => section.offsetTop <= anchor &&
      section.offsetTop + section.offsetHeight > anchor)
      || [...sections].reverse().find((section) => section.offsetTop <= anchor)
      || sections[0];
    if (next === active) return;
    const direction = active && sections.indexOf(next) < sections.indexOf(active) ? 'up' : 'down';
    if (active) {
      active.dataset.sectionDirection = direction;
      active.dataset.sectionMotion = 'leaving';
    }
    next.dataset.sectionDirection = direction;
    next.dataset.sectionMotion = 'entering';
    active = next;
    window.dispatchEvent(new CustomEvent(STOREFRONT_SECTION_CHANGE, { detail: { direction, sectionId: next.id } }));
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
  schedule();
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    if (frame) window.cancelAnimationFrame(frame);
  };
}
