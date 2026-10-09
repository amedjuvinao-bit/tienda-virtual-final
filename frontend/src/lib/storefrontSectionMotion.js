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
    if (active) active.dataset.sectionMotion = 'leaving';
    next.dataset.sectionMotion = 'entering';
    active = next;
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
