import { useEffect, useRef, useState } from 'react';

const reduced = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
export function pressJournalHighlight(element, settings) {
  if (!element || !settings.journalMotionEnabled || settings.journalHighlightMotion === 'none' || reduced()) return;
  const frame = element.querySelector('.ig-journal__highlight-ring'), wave = element.querySelector('.ig-journal__highlight-wave');
  for (const target of [frame, wave]) target?.getAnimations?.().filter(animation => animation.id === 'journal-highlight-feedback').forEach(animation => animation.cancel());
  const options = { duration: settings.journalMotionDuration, easing: 'cubic-bezier(.2,.8,.2,1)' };
  const animation = frame?.animate?.([{ scale: 1 }, { scale: .94, offset: .2 }, { scale: 1.06, offset: .6 }, { scale: 1 }], options);
  if (animation) animation.id = 'journal-highlight-feedback';
  const ripple = wave?.animate?.([{ opacity: .85, scale: .92 }, { opacity: 0, scale: 1.3 }], options);
  if (ripple) ripple.id = 'journal-highlight-feedback';
}

export default function useJournalMotion({ root, main, settings, postId, onReturn }) {
  const [cycle, setCycle] = useState(0), [entered, setEntered] = useState(false);
  const returnAction = useRef(onReturn); returnAction.current = onReturn;
  const ready = Boolean(postId);
  useEffect(() => {
    if (!ready || !root.current || typeof IntersectionObserver !== 'function') return;
    let wasVisible = false, visited = false;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      if (visible && !wasVisible) {
        if (visited && settings.journalResetOnEnter) returnAction.current();
        visited = true; setCycle(value => value + 1);
      }
      wasVisible = visible; setEntered(visible);
    }, { threshold: [0, .12] });
    observer.observe(root.current);
    return () => observer.disconnect();
  }, [root, ready, settings.journalResetOnEnter]);
  useEffect(() => {
    if (!ready || !settings.journalMotionEnabled || settings.journalMotion === 'none' || reduced()) return;
    // Animate the media inside its clipped frame. The section keeps its size and position.
    const target = main.current?.querySelector('.ig-journal__media > *');
    const strength = settings.journalMotionStrength;
    const starts = {
      fade: { opacity: .25 }, glide: { opacity: .35, transform: `translateX(${18 * strength}px)` },
      focus: { opacity: .4, filter: `blur(${5 * strength}px)` }, zoom: { opacity: .4, scale: 1 + .045 * strength }
    };
    const animation = target?.animate?.([starts[settings.journalMotion], { opacity: 1, transform: 'translateX(0)', filter: 'blur(0)', scale: 1 }], {
      duration: settings.journalMotionDuration, easing: 'cubic-bezier(.2,.75,.25,1)'
    });
    if (animation) animation.id = 'journal-post-transition';
    return () => animation?.cancel();
  }, [main, ready, postId, cycle, settings.journalMotionEnabled, settings.journalMotion, settings.journalMotionDuration, settings.journalMotionStrength]);
  return { entered, feedback: event => { pressJournalHighlight(event?.currentTarget, settings); setCycle(value => value + 1); } };
}
