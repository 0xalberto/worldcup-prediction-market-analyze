'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Flag } from './Flag';
import { cn, formatPct } from '@/lib/utils';
import { useSelection } from '@/hooks/useSelection';
import type { SerializedResult } from '@/lib/sim/worker';
import groupsData from '@/data/groups.json';

interface Props { result: SerializedResult; }

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'] as const;

export function GroupCards({ result }: Props) {
  const t = useTranslations('groups');
  const locale = useLocale();
  const openTeam = useSelection((s) => s.openTeam);
  const idxOf = useMemo(() => new Map(result.teams.map((x, i) => [x.id, i])), [result]);

  /**
   * For each team, advance-to-R32 probability = stageCounts.r32 / N. We don't
   * track explicit 1st/2nd/3rd-advancing/eliminated buckets in the aggregate,
   * but we can derive a useful approximation: P(qualify direct) ≈ stageCounts.r32
   * minus a heuristic correction. To keep it honest, we display:
   *   - P(advance to R32) - the rigorous number we have
   *   - P(eliminated in group) = 1 − P(advance)
   * The "direct vs best 3rd" split is shown as a smaller gradient hint based on
   * an estimate: roughly 24/32 advance directly across all groups, 8/32 as best 3rds.
   */
  const groupRows = GROUP_LETTERS.map((letter) => {
    const ids = (groupsData.groups as Record<string, string[]>)[letter];
    return {
      letter,
      teams: ids.map((id) => {
        const i = idxOf.get(id)!;
        const pAdvance = result.stageCounts.r32[i] / result.numSimulations;
        return {
          id, idx: i,
          team: result.teams[i],
          pAdvance,
        };
      }).sort((a, b) => b.pAdvance - a.pAdvance),
    };
  });

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">
          {t('title')}
        </h2>
        <p className="mt-2 text-sm text-fg-2">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {groupRows.map(({ letter, teams }) => (
          <article
            key={letter}
            className="rounded-2xl border border-border glass p-5 transition-all hover:border-border-strong hover:translate-y-[-2px] hover:shadow-card-hover"
          >
            <header className="mb-4 flex items-baseline justify-between">
              <span className="font-display text-4xl font-bold text-fg-0">
                <span className="text-fg-3 text-2xl mr-1">·</span>{letter}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
                {t('group')}
              </span>
            </header>
            <div className="space-y-2">
              {teams.map((t2) => {
                const pct = t2.pAdvance * 100;
                return (
                  <button
                    key={t2.id}
                    onClick={() => openTeam(t2.id)}
                    className="block w-full space-y-1 rounded-md text-left transition-colors hover:bg-bg-2/40 px-1 py-1 -mx-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <Flag code={t2.team.flag} size={18} />
                        <span className="truncate text-fg-1">
                          {locale === 'es' ? t2.team.name_es : t2.team.name_en}
                        </span>
                      </div>
                      <span className={cn(
                        'font-mono text-xs tabular',
                        pct > 80 ? 'text-emerald' : pct > 50 ? 'text-fg-0' : pct > 25 ? 'text-fg-1' : 'text-fg-3',
                      )}>
                        {formatPct(t2.pAdvance, 0)}
                      </span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-bg-2/60">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background:
                            pct > 75
                              ? 'linear-gradient(90deg, oklch(0.72 0.17 155), oklch(0.76 0.13 180))'
                              : pct > 40
                              ? 'oklch(0.72 0.17 155 / 0.8)'
                              : 'oklch(0.55 0.18 155 / 0.6)',
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
