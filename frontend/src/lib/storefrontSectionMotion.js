export function mountStorefrontSectionMotion(container) {
  if (!container) return () => {};
  let active = null;
  let frame = 0;

  const update = () => {
    frame = 0;
    const sections = Array.from(container.children).filter((node) =>
      node.tagName === 'SECTION' && !node.matches('.storefront-section-shell:empty')
    );
    if (!sections.length) return;
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
  };
  const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
  schedule();
  const observer = new MutationObserver(schedule);
  observer.observe(container, { childList: true, subtree: true });
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  return () => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    observer.disconnect();
    if (frame) window.cancelAnimationFrame(frame);
  };
}
