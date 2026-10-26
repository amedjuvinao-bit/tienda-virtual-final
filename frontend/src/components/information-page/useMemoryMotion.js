import { useEffect, useLayoutEffect, useRef } from "react";
export default function useMemoryMotion(plane, signature, enabled) {
  const positions = useRef(new Map()),
    animations = useRef([]);
  const measure = () =>
    new Map(
      [...(plane.current?.children || [])].map((node) => [
        node.dataset.memoryId,
        {
          node,
          x: node.offsetLeft,
          y: node.offsetTop,
          w: node.offsetWidth,
          h: node.offsetHeight,
        },
      ]),
    );
  useLayoutEffect(() => {
    const next = measure();
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    const animate =
      enabled &&
      window.matchMedia?.(
        "(min-width: 1000px) and (prefers-reduced-motion: no-preference)",
      )?.matches;
    if (animate)
      for (const [id, current] of next) {
        const old = positions.current.get(id);
        if (
          !old ||
          !current.w ||
          !current.h ||
          !current.node.animate ||
          (old.x === current.x &&
            old.y === current.y &&
            old.w === current.w &&
            old.h === current.h)
        )
          continue;
        animations.current.push(
          current.node.animate(
            [
              {
                transform: `translate(${old.x - current.x}px, ${old.y - current.y}px) scale(${old.w / current.w}, ${old.h / current.h})`,
                transformOrigin: "top left",
              },
              { transform: "none", transformOrigin: "top left" },
            ],
            { duration: 440, easing: "cubic-bezier(.2,.75,.2,1)" },
          ),
        );
      }
    positions.current = next;
  }, [signature, enabled]);
  useEffect(() => {
    const resize = () => {
      animations.current.forEach((animation) => animation.cancel());
      positions.current = measure();
    };
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      animations.current.forEach((animation) => animation.cancel());
    };
  }, []);
}
