'use client';

import { useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { Flag } from './Flag';
import { Trophy, ArrowRight, AlertTriangle } from 'lucide-react';
import { cn, formatPct } from '@/lib/utils';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

export function SurpriseCards({ result }: Props) {
  const t = useTranslations('surprises');
  const locale = useLocale();

  const { underdogReachesQF, favoriteOutInGroups, biggestUpset } = useMemo(() => {
    // Find underdogs (bottom 20 by ELO) with highest QF probability.
    const withElo = result.teams.map((team, i) => ({
      team, idx: i, elo: team.elo,
      pQF: result.stageCounts.qf[i] / result.numSimulations,
      pAdv: result.stageCounts.r32[i] / result.numSimulations,
    }));
    const byElo = [...withElo].sort((a, b) => a.elo - b.elo);
    const underdogs = byElo.slice(0, 20);
    const top10 = [...withElo].sort((a, b) => b.elo - a.elo).slice(0, 10);

    const underdogReachesQF = [...underdogs].sort((a, b) => b.pQF - a.pQF)[0];
    const favoriteOutInGroups = [...top10].sort((a, b) => (1 - a.pAdv) - (1 - b.pAdv))[0];
    const biggestUpset = [...withElo].sort((a, b) =>
      (b.elo > 1900 ? 0 : b.pQF) - (a.elo > 1900 ? 0 : a.pQF)
    )[0];

    return { underdogReachesQF, favoriteOutInGroups, biggestUpset };
  }, [result]);

  const teamName = (team: typeof result.teams[number]) =>
    locale === 'es' ? team.name_es : team.name_en;

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">{t('title')}</h2>
        <p className="mt-2 text-sm text-fg-2">{t('subtitle')}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <SurpriseCard
          tone="emerald"
          icon={<Trophy className="h-5 w-5" />}
          pct={underdogReachesQF.pQF}
          headline={
            <>
              <Flag code={underdogReachesQF.team.flag} size={28} className="inline-block align-middle mr-2" />
              <span>{teamName(underdogReachesQF.team)}</span>
              <ArrowRight className="inline-block mx-2 h-4 w-4 text-fg-3" />
              <span className="text-fg-1 font-medium">QF</span>
            </>
          }
          caption={`Underdog (ELO ${underdogReachesQF.team.elo}) llega a cuartos.`}
        />
        <SurpriseCard
          tone="rose"
          icon={<AlertTriangle className="h-5 w-5" />}
          pct={1 - favoriteOutInGroups.pAdv}
          headline={
            <>
              <Flag code={favoriteOutInGroups.team.flag} size={28} className="inline-block align-middle mr-2" />
              <span>{teamName(favoriteOutInGroups.team)}</span>
              <ArrowRight className="inline-block mx-2 h-4 w-4 text-fg-3" />
              <span className="text-rose font-medium">OUT</span>
            </>
          }
          caption={`Top-10 mundial fuera en fase de grupos.`}
        />
        <SurpriseCard
          tone="violet"
          icon={<Trophy className="h-5 w-5" />}
          pct={biggestUpset.pQF}
          headline={
            <>
              <Flag code={biggestUpset.team.flag} size={28} className="inline-block align-middle mr-2" />
              <span>{teamName(biggestUpset.team)}</span>
              <ArrowRight className="inline-block mx-2 h-4 w-4 text-fg-3" />
              <span className="text-fg-1 font-medium">QF</span>
            </>
          }
          caption={`Cenicienta posible (ELO ${biggestUpset.team.elo}).`}
        />
      </div>
    </section>
  );
}

function SurpriseCard({
  tone, icon, pct, headline, caption,
}: {
  tone: 'emerald' | 'rose' | 'violet';
  icon: React.ReactNode;
  pct: number;
  headline: React.ReactNode;
  caption: string;
}) {
  const tones = {
    emerald: { glow: 'oklch(0.72 0.17 155 / 0.4)', text: 'text-emerald', bg: 'from-emerald-lo/15' },
    rose: { glow: 'oklch(0.65 0.22 18 / 0.4)', text: 'text-rose', bg: 'from-rose/10' },
    violet: { glow: 'oklch(0.65 0.20 295 / 0.4)', text: 'text-violet', bg: 'from-violet/10' },
  } as const;
  const c = tones[tone];

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border glass p-6 transition-all hover:border-border-strong hover:translate-y-[-2px]',
        'bg-gradient-to-br', c.bg, 'to-transparent',
      )}
      style={{ boxShadow: `0 24px 64px -16px ${c.glow}` }}
    >
      <div className={cn('mb-4 flex items-center gap-2', c.text)}>
        {icon}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Probabilidad</span>
      </div>
      <div className="font-display text-5xl font-bold text-fg-0 tabular">
        {formatPct(pct, 1)}
      </div>
      <div className="mt-4 text-lg text-fg-0">{headline}</div>
      <p className="mt-2 text-sm text-fg-2">{caption}</p>
    </article>
  );
}
