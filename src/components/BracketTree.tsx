'use client';

import { useMemo, useRef, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { gsap } from 'gsap';
import { entrancePlayed, markEntrancePlayed } from '@/lib/entranceAnimation';
import { Flag } from './Flag';
import { cn, formatPct } from '@/lib/utils';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

/**
 * Bracket visualization: for each of the 6 knockout stages (R32 → Champion),
 * show the 4 most likely teams to *reach* that stage as a stacked column,
 * connected with curved lines to the next stage. The champion path glows.
 */
export function BracketTree({ result }: Props) {
  const t = useTranslations('bracket');
  const locale = useLocale();
  const containerRef = useRef<HTMLDivElement>(null);

  const data = useMemo(() => {
    const byStage = (counts: number[], top: number) =>
      result.teams
        .map((team, i) => ({ team, idx: i, p: counts[i] / result.numSimulations }))
        .sort((a, b) => b.p - a.p)
        .slice(0, top);

    return {
      r32: byStage([...result.stageCounts.r32], 8),
      r16: byStage([...result.stageCounts.r16], 8),
      qf:  byStage([...result.stageCounts.qf], 6),
      sf:  byStage([...result.stageCounts.sf], 4),
      final: byStage([...result.stageCounts.final], 3),
      champ: byStage([...result.stageCounts.champion], 1),
    };
  }, [result]);

  const championId = data.champ[0]?.team.id;

  useEffect(() => {
    if (!containerRef.current) return;
    const cards = containerRef.current.querySelectorAll('[data-card]');
    if (!cards.length) return;

    const key = `bracket-${locale}`;

    if (entrancePlayed(key)) {
      gsap.set(cards, { y: 0, opacity: 1 });
      return;
    }

    markEntrancePlayed(key);
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cards,
        { y: 16, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.03, duration: 0.5, ease: 'expo.out' },
      );
    }, containerRef);
    return () => ctx.revert();
  }, [result, locale]);

  const stages = [
    { key: 'r32',   label: 'R32',      rows: data.r32 },
    { key: 'r16',   label: 'R16',      rows: data.r16 },
    { key: 'qf',    label: 'QF',       rows: data.qf },
    { key: 'sf',    label: 'SF',       rows: data.sf },
    { key: 'final', label: 'FINAL',    rows: data.final },
    { key: 'champ', label: 'CHAMPION', rows: data.champ },
  ];

  const teamName = (team: typeof result.teams[number]) =>
    locale === 'es' ? team.name_es : team.name_en;

  return (
    <section className="mx-auto max-w-[1440px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">{t('title')}</h2>
        <p className="mt-2 text-sm text-fg-2">{t('subtitle')}</p>
        <p className="mt-1 text-xs text-fg-3">{t('hover_hint')}</p>
      </header>

      <div ref={containerRef} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-6 gap-3">
          {stages.map((stage) => (
            <div key={stage.key} className="flex flex-col">
              <header className="mb-3 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-fg-3">
                {stage.label}
              </header>
              <div className="space-y-2">
                {stage.rows.map((row, i) => {
                  const isChampion = stage.key === 'champ';
                  const isChampionPath = row.team.id === championId;
                  return (
                    <div
                      key={row.team.id}
                      data-card
                      className={cn(
                        'group relative flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all',
                        isChampion
                          ? 'border-gold/60 bg-gradient-to-r from-gold/20 to-gold/5 shadow-[0_8px_32px_-8px_oklch(0.80_0.18_75/0.6)]'
                          : isChampionPath
                          ? 'border-gold/30 bg-gold/5'
                          : 'border-border bg-bg-1/40 hover:border-border-strong',
                      )}
                    >
                      <Flag code={row.team.flag} size={18} />
                      <span className={cn(
                        'flex-1 truncate text-xs',
                        isChampion ? 'font-display text-base text-fg-0' : 'text-fg-1',
                      )}>
                        {teamName(row.team)}
                      </span>
                      <span className={cn(
                        'font-mono text-[10px] tabular',
                        isChampion ? 'text-gold' : 'text-fg-3',
                      )}>
                        {formatPct(row.p, 1)}
                      </span>
                      {isChampion && (
                        <span className="absolute -top-2 left-2 rounded-full bg-gold px-2 py-0.5 font-mono text-[9px] font-bold tracking-[0.15em] text-bg-0">
                          🏆
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
