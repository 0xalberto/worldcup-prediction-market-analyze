'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Play, RotateCcw } from 'lucide-react';
import { cn, formatNum } from '@/lib/utils';
import type { SimState } from '@/hooks/useSimulation';

const OPTIONS = [1_000, 10_000, 50_000, 100_000] as const;

interface Props {
  state: SimState;
  onRun: (n: number) => void;
}

export function SimulationControls({ state, onRun }: Props) {
  const t = useTranslations('hero');
  const tc = useTranslations('controls');
  const [selected, setSelected] = useState<number>(10_000);
  const startRef = useRef<number | null>(null);
  const isRunning = state.status === 'running';
  const isDone = state.status === 'done';
  const pct = state.total > 0 ? (state.completed / state.total) * 100 : 0;

  useEffect(() => {
    if (isRunning && startRef.current === null) startRef.current = performance.now();
    if (!isRunning) startRef.current = null;
  }, [isRunning]);

  const remaining =
    isRunning && state.completed > 0 && startRef.current !== null
      ? Math.max(0, Math.round(((performance.now() - startRef.current) / state.completed) * (state.total - state.completed) / 1000))
      : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-5">
      <div className="min-w-0 flex-1">
        <div className="text-xs uppercase tracking-[0.18em] text-fg-2 font-mono">{tc('label')}</div>

        <div className="mt-2 flex flex-wrap gap-2">
          {OPTIONS.map((n) => {
            const active = selected === n;
            return (
              <button
                key={n}
                disabled={isRunning}
                onClick={() => setSelected(n)}
                className={cn(
                  'rounded-full border px-4 py-1.5 font-mono text-xs tracking-wider transition-all',
                  active
                    ? 'border-gold/40 bg-bg-1/50 text-fg-1'
                    : 'border-border bg-bg-1/30 text-fg-2 hover:border-border-strong hover:text-fg-1',
                  isRunning && 'opacity-50',
                )}
              >
                {n >= 1000 ? `${n / 1000}K` : n}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full shrink-0 sm:w-auto sm:min-w-[13rem] lg:min-w-[15rem]">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 motion-safe:animate-[halo-pulse_4s_ease-in-out_infinite] opacity-90"
          style={{
            width: '200%',
            height: '480%',
            transform: 'translate(-50%, -50%)',
            background:
              'radial-gradient(ellipse 55% 40% at 50% 50%, oklch(0.88 0.11 180 / 0.55), oklch(0.76 0.13 180 / 0.25) 45%, transparent 70%)',
            filter: 'blur(36px)',
          }}
        />

        <button
          onClick={() => onRun(selected)}
          disabled={isRunning}
          className={cn(
            'group relative h-14 w-full overflow-hidden rounded-xl sm:h-16 sm:rounded-2xl',
            'border transition-all duration-200',
            'hover:scale-[1.03] active:scale-[0.98]',
            isRunning
              ? 'border-gold/40 bg-bg-2/95 text-fg-0 shadow-[inset_0_1px_0_oklch(1_0_0/0.06)] hover:scale-100'
              : cn(
                  'border-gold-hi/50 bg-gradient-to-b from-gold-hi via-gold to-gold-lo',
                  'text-bg-0 shadow-glow-gold',
                  'hover:border-gold-hi hover:from-[oklch(0.92_0.12_180)] hover:via-gold-hi hover:to-gold',
                ),
          )}
        >
          {!isRunning && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/25 to-transparent"
            />
          )}
        {/* Progress fill */}
        {isRunning && (
          <span
            className="absolute inset-0 origin-left bg-gradient-to-r from-gold/50 via-gold-hi/40 to-gold/20"
            style={{ transform: `scaleX(${pct / 100})`, transition: 'transform 200ms linear' }}
          />
        )}

        {/* Shimmer when running */}
        {isRunning && (
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                'linear-gradient(110deg, transparent 25%, oklch(1 0 0 / 0.18) 50%, transparent 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.4s linear infinite',
            }}
          />
        )}

        <span className="relative z-10 flex items-center justify-center gap-2.5 px-4">
          {isRunning ? (
            <>
              <span className="font-mono text-sm font-semibold tabular-nums sm:text-base">
                {formatNum(state.completed)} / {formatNum(state.total)}
              </span>
              {remaining !== null && (
                <span className="font-mono text-xs text-fg-2">· {remaining}s</span>
              )}
            </>
          ) : isDone ? (
            <>
              <RotateCcw className="h-5 w-5 shrink-0" aria-hidden />
              <span className="font-display text-lg font-bold uppercase tracking-[0.06em] sm:text-xl">
                {t('cta_finished')}
              </span>
            </>
          ) : (
            <>
              <Play className="h-5 w-5 shrink-0 fill-bg-0/80" aria-hidden />
              <span className="font-display text-lg font-bold uppercase tracking-[0.06em] sm:text-xl">
                {t('cta_simulate')}
              </span>
            </>
          )}
        </span>
        </button>
      </div>
    </div>
  );
}
