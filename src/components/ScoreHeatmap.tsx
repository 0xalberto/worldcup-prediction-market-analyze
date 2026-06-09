'use client';

import { useMemo } from 'react';
import { cn, formatPct } from '@/lib/utils';

interface Props {
  /** 64-cell probability grid (8×8). Index = h*8 + a. */
  scoreProb: Float64Array | number[];
  /** Optional fixed max for color scale; defaults to grid max. */
  maxOverride?: number;
  homeLabel?: string;
  awayLabel?: string;
  /** How many cells per axis to display. Default 6 (0-5 goals). */
  size?: number;
}

export function ScoreHeatmap({ scoreProb, maxOverride, homeLabel = 'L', awayLabel = 'V', size = 6 }: Props) {
  const arr = useMemo(() => Array.from(scoreProb), [scoreProb]);
  const max = useMemo(() => {
    if (maxOverride !== undefined) return maxOverride;
    let m = 0;
    for (const v of arr) if (v > m) m = v;
    return m || 1;
  }, [arr, maxOverride]);

  // Find the modal cell (excluding the trivial 0-0 if max equals it but for clarity highlight regardless).
  const modalIdx = useMemo(() => {
    let best = 0;
    let bestIdx = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] > best) { best = arr[i]; bestIdx = i; }
    }
    return bestIdx;
  }, [arr]);

  const cell = (h: number, a: number) => {
    const v = arr[h * 8 + a] ?? 0;
    const t = Math.sqrt(Math.min(1, v / max));
    const L = 0.18 + t * 0.52;
    const C = 0.025 + t * 0.16;
    const bg = `oklch(${L.toFixed(3)} ${C.toFixed(3)} 75)`;
    const isModal = h * 8 + a === modalIdx && v > 0;
    return (
      <div
        key={`${h}-${a}`}
        className={cn(
          'relative aspect-square flex items-center justify-center text-[10px] font-mono tabular transition-all',
          isModal ? 'ring-1 ring-gold/80 z-10' : 'ring-1 ring-border/40',
        )}
        style={{ backgroundColor: bg, color: t > 0.4 ? 'var(--color-fg-0)' : 'var(--color-fg-2)' }}
        title={`${h}-${a}: ${formatPct(v, 2)}`}
      >
        {v > 0.005 ? formatPct(v, 0) : ''}
      </div>
    );
  };

  return (
    <div className="inline-block">
      <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
        <span className="ml-7">{awayLabel} →</span>
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col items-center justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
          <span className="[writing-mode:vertical-rl] rotate-180">↑ {homeLabel}</span>
        </div>
        <div>
          <div className="mb-1 grid gap-px text-center text-[9px] font-mono text-fg-3" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
            {Array.from({ length: size }, (_, a) => (<span key={a}>{a}</span>))}
          </div>
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${size}, 32px)`, gridTemplateRows: `repeat(${size}, 32px)` }}>
            {Array.from({ length: size }, (_, h) =>
              Array.from({ length: size }, (_, a) => cell(h, a))
            ).flat()}
          </div>
          <div className="mt-1 flex justify-between text-[9px] font-mono text-fg-3">
            {Array.from({ length: size }, (_, h) => (<span key={h} className="w-8 text-center">{h}</span>))}
          </div>
        </div>
      </div>
    </div>
  );
}
