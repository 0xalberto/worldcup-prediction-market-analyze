'use client';

import { useEffect, useRef } from 'react';

/**
 * Lightweight animated mesh gradient - two oklch blobs that drift slowly,
 * with mouse-parallax. Pure CSS animation, no WebGL. Renders behind the hero.
 */
export function MeshGradient() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 24;
      const y = (e.clientY / window.innerHeight - 0.5) * 24;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const fadeMask = 'linear-gradient(to bottom, black 0%, black 10%, transparent 65%)';

  return (
    <div
      ref={ref}
      className="absolute inset-0 -z-10 overflow-hidden"
      style={{ maskImage: fadeMask, WebkitMaskImage: fadeMask }}
      aria-hidden
    >
      <div
        className="absolute top-[10%] left-[5%] h-[640px] w-[640px] rounded-full opacity-50 blur-[120px] motion-safe:animate-[drift1_22s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, oklch(0.76 0.13 180 / 0.55), transparent 65%)',
          transform: 'translate(var(--mx, 0px), var(--my, 0px))',
        }}
      />
      <div
        className="absolute top-[5%] right-[5%] h-[720px] w-[720px] rounded-full opacity-40 blur-[140px] motion-safe:animate-[drift2_28s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(circle at 50% 50%, oklch(0.65 0.20 295 / 0.45), transparent 65%)',
          transform: 'translate(calc(-1 * var(--mx, 0px)), calc(-1 * var(--my, 0px)))',
        }}
      />

      <style>{`
        @keyframes drift1 {
          0%, 100% { transform: translate(var(--mx, 0px), var(--my, 0px)) scale(1); }
          50%      { transform: translate(calc(var(--mx, 0px) + 80px), calc(var(--my, 0px) - 40px)) scale(1.08); }
        }
        @keyframes drift2 {
          0%, 100% { transform: translate(calc(-1 * var(--mx, 0px)), calc(-1 * var(--my, 0px))) scale(1); }
          50%      { transform: translate(calc(-1 * var(--mx, 0px) - 60px), calc(-1 * var(--my, 0px) + 60px)) scale(0.95); }
        }
      `}</style>
    </div>
  );
}
