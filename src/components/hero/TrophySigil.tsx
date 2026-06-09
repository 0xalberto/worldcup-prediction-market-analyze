'use client';

/**
 * Hero visual: a static, premium emblem.
 *
 *  - A clean SVG line-art FIFA-style trophy at the center.
 *  - A faint rotating conic gradient ring behind it (slow, ambient).
 *  - Concentric ELO-level rings with tabular numbers - ties the visual
 *    back to the model's substance.
 *  - No WebGL, no wheel-event hijacking, no ugly geometry.
 */
export function TrophySigil() {
  return (
    <div className="relative aspect-square w-full max-w-[420px]">
      {/* ambient halo */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, oklch(0.76 0.13 180 / 0.35), transparent 60%)',
        }}
      />

      {/* slow rotating conic ring */}
      <div
        className="absolute inset-0 rounded-full motion-safe:animate-[spin-slow_22s_linear_infinite]"
        style={{
          background:
            'conic-gradient(from 0deg, transparent 0deg, oklch(0.76 0.13 180 / 0.55) 60deg, transparent 120deg, transparent 240deg, oklch(0.60 0.10 180 / 0.4) 300deg, transparent 360deg)',
          mask: 'radial-gradient(circle, transparent 60%, black 61%, black 64%, transparent 65%)',
          WebkitMask: 'radial-gradient(circle, transparent 60%, black 61%, black 64%, transparent 65%)',
        }}
      />

      {/* concentric tick rings - ELO levels (2100, 1900, 1700, 1500) */}
      {[
        { r: 0.84, label: '2100' },
        { r: 0.70, label: '1900' },
        { r: 0.56, label: '1700' },
        { r: 0.42, label: '1500' },
      ].map((ring, i) => (
        <div
          key={i}
          className="absolute rounded-full border border-dashed border-fg-3/25"
          style={{
            top: `${50 - ring.r * 50}%`,
            left: `${50 - ring.r * 50}%`,
            width: `${ring.r * 100}%`,
            height: `${ring.r * 100}%`,
          }}
          aria-hidden
        />
      ))}

      {/* tick labels */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.18em] text-fg-3">
        2100
      </div>
      <div className="absolute top-1/2 -right-1 -translate-y-1/2 font-mono text-[10px] tracking-[0.18em] text-fg-3 [writing-mode:vertical-rl]">
        2026
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.18em] text-fg-3">
        1500
      </div>
      <div className="absolute top-1/2 -left-1 -translate-y-1/2 font-mono text-[10px] tracking-[0.18em] text-fg-3 [writing-mode:vertical-rl] rotate-180">
        ELO
      </div>

      {/* center trophy SVG */}
      <svg
        viewBox="0 0 200 220"
        className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 motion-safe:animate-[float_6s_ease-in-out_infinite]"
        aria-hidden
      >
        <defs>
          <linearGradient id="trophyFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.85 0.09 180)" />
            <stop offset="50%" stopColor="oklch(0.76 0.13 180)" />
            <stop offset="100%" stopColor="oklch(0.42 0.07 180)" />
          </linearGradient>
          <linearGradient id="trophyStroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.92 0.06 180)" />
            <stop offset="100%" stopColor="oklch(0.46 0.08 180)" />
          </linearGradient>
          <filter id="trophyGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g filter="url(#trophyGlow)" fill="url(#trophyFill)" stroke="url(#trophyStroke)" strokeWidth="1.6" strokeLinejoin="round">
          {/* Cup body */}
          <path d="M60 35 L140 35 L138 70 C 138 95 122 115 100 115 C 78 115 62 95 62 70 Z" />
          {/* Left handle */}
          <path d="M60 40 C 35 40 30 55 32 70 C 33 82 42 88 55 88" fill="none" />
          {/* Right handle */}
          <path d="M140 40 C 165 40 170 55 168 70 C 167 82 158 88 145 88" fill="none" />
          {/* Stem ring */}
          <rect x="92" y="115" width="16" height="6" rx="1.5" />
          {/* Stem */}
          <path d="M90 121 L110 121 L106 145 L94 145 Z" />
          {/* Base ring top */}
          <rect x="78" y="145" width="44" height="5" rx="1.5" />
          {/* Base */}
          <path d="M70 150 L130 150 L126 175 L74 175 Z" />
          {/* Plinth */}
          <rect x="62" y="175" width="76" height="9" rx="2" />
        </g>

        {/* Subtle inner highlight on the cup */}
        <path
          d="M75 48 C 80 55 80 78 75 92"
          stroke="oklch(1 0 0 / 0.55)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>

      {/* corner micro-data */}
      <div className="absolute top-4 left-4 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-3">
        ELO · POISSON
      </div>
      <div className="absolute bottom-4 right-4 font-mono text-[10px] uppercase tracking-[0.2em] text-fg-3">
        MONTE CARLO · N=100K
      </div>
    </div>
  );
}
