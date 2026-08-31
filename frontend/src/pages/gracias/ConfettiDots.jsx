import { useMemo } from 'react';

export default function ConfettiDots({ accent, accent2 }) {
  const dots = useMemo(() => {
    const colors = [accent, accent2, '#fbbf24', '#34d399', '#60a5fa'];
    return Array.from({ length: 12 }, (_, index) => ({
      left: `${8 + (index * 7.5) % 84}%`,
      top: `${(index * 17) % 60}%`,
      color: colors[index % colors.length],
      delay: `${(index * 0.12).toFixed(2)}s`,
      size: `${4 + (index % 3) * 2}px`,
    }));
  }, [accent, accent2]);

  return <div className="gp-confetti-wrap" aria-hidden="true">
    {dots.map((dot, index) => <div key={index} className="gp-confetti-dot" style={{
      left: dot.left, top: dot.top, width: dot.size, height: dot.size,
      backgroundColor: dot.color, animationDelay: dot.delay,
    }} />)}
  </div>;
}
