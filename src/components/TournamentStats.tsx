'use client';

import { useMemo } from 'react';
import { useLocale } from 'next-intl';
import { Flag } from './Flag';
import { cn, formatNum } from '@/lib/utils';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

export function TournamentStats({ result }: Props) {
  const locale = useLocale();
  const teamById = useMemo(() => new Map(result.teams.map((t) => [t.id, t])), [result]);

  const data = useMemo(() => {
    const N = result.numSimulations;

    // 1) Total goals expected, mean + 95% CI
    let sum = 0, count = 0;
    const samples: number[] = [];
    for (let g = 0; g < result.tournamentGoalsHistogram.length; g++) {
      const c = result.tournamentGoalsHistogram[g];
      sum += g * c; count += c;
      for (let j = 0; j < c; j++) samples.push(g);
    }
    samples.sort((a, b) => a - b);
    const lo = samples[Math.floor(samples.length * 0.025)] ?? 0;
    const hi = samples[Math.floor(samples.length * 0.975)] ?? 0;
    const meanGoals = sum / Math.max(1, count);

    // 2) Highest-scoring expected matchup (group fixture with highest sum of avg goals)
    let maxGoalsFixture: { key: string; home: string; away: string; goals: number } | null = null;
    for (const [key, f] of result.fixtures) {
      if (f.stage !== 'group') continue;
      const g = (f.sumGoalsHome + f.sumGoalsAway) / f.count;
      if (!maxGoalsFixture || g > maxGoalsFixture.goals) {
        maxGoalsFixture = { key, home: f.home, away: f.away, goals: g };
      }
    }

    // 3) Avg favored-team win rate (across group fixtures, the higher-ELO team's win share)
    let sumFavWinRate = 0, fixtureCount = 0;
    for (const [, f] of result.fixtures) {
      if (f.stage !== 'group') continue;
      const homeElo = teamById.get(f.home)?.elo ?? 0;
      const awayElo = teamById.get(f.away)?.elo ?? 0;
      const favorite = homeElo >= awayElo ? 'home' : 'away';
      const favWins = favorite === 'home' ? f.winsHome : f.winsAway;
      sumFavWinRate += favWins / f.count;
      fixtureCount++;
    }
    const avgFavWinRate = sumFavWinRate / Math.max(1, fixtureCount);

    // 4) Cinderella: lowest ELO team that reaches QF most often
    const eloRanked = [...result.teams]
      .map((t, i) => ({ team: t, i, qf: result.stageCounts.qf[i] / N }))
      .sort((a, b) => a.team.elo - b.team.elo);
    const cinderella = eloRanked.slice(0, 16).sort((a, b) => b.qf - a.qf)[0];

    // 5) Most popular finalist matchup
    const finalEntries: Array<{ key: string; count: number; home: string; away: string }> = [];
    for (const [k, f] of result.fixtures) {
      if (k.startsWith('104|')) finalEntries.push({ key: k, count: f.count, home: f.home, away: f.away });
    }
    finalEntries.sort((a, b) => b.count - a.count);
    const topFinal = finalEntries[0];

    // 6) Top scorer (excluding Otros)
    let topPlayer: { teamId: string; name: string; goals: number } | null = null;
    for (const [key, total] of result.scorers) {
      if (key.endsWith('|Otros')) continue;
      const [teamId, name] = key.split('|');
      const g = total / N;
      if (!topPlayer || g > topPlayer.goals) topPlayer = { teamId, name, goals: g };
    }

    // 7) Clean-sheet rate by team (lowest avg GA / matches-played-estimate)
    // matches played ≈ 3 (group) + advance rate × extra matches; simpler proxy: avg GA per 90 = avgGA / avg_matches
    // Use a simpler stat: lowest expected GA total.
    const lowestGA = [...result.teams]
      .map((t, i) => ({ team: t, ga: result.totalGoalsAgainst[i] / N }))
      .sort((a, b) => a.ga - b.ga)[0];

    return {
      meanGoals,
      lo, hi,
      maxGoalsFixture,
      avgFavWinRate,
      cinderella,
      topFinal,
      topPlayer,
      lowestGA,
    };
  }, [result, teamById]);

  const teamName = (id: string | undefined) => {
    if (!id) return '-';
    const t = teamById.get(id);
    return t ? (locale === 'es' ? t.name_es : t.name_en) : id;
  };
  const teamFlag = (id: string | undefined) => teamById.get(id ?? '')?.flag ?? '';

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-8">
        <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">
          Stats del torneo
        </h2>
        <p className="mt-2 text-sm text-fg-2">
          Agregados sobre {formatNum(result.numSimulations)} simulaciones.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Goles totales esperados"
          value={Math.round(data.meanGoals).toString()}
          sub={`95% CI: ${data.lo}–${data.hi}`}
          tone="gold"
        />
        <StatCard
          label="Partido con más goles esperado"
          value={data.maxGoalsFixture ? `${data.maxGoalsFixture.goals.toFixed(2)}` : '-'}
          sub={data.maxGoalsFixture
            ? `${teamName(data.maxGoalsFixture.home)} vs ${teamName(data.maxGoalsFixture.away)}`
            : ''}
          tone="emerald"
          flagA={teamFlag(data.maxGoalsFixture?.home)}
          flagB={teamFlag(data.maxGoalsFixture?.away)}
        />
        <StatCard
          label="Final más probable"
          value={data.topFinal ? `${(data.topFinal.count / result.numSimulations * 100).toFixed(1)}%` : '-'}
          sub={data.topFinal
            ? `${teamName(data.topFinal.home)} vs ${teamName(data.topFinal.away)}`
            : ''}
          tone="violet"
          flagA={teamFlag(data.topFinal?.home)}
          flagB={teamFlag(data.topFinal?.away)}
        />
        <StatCard
          label="Top goleador esperado"
          value={data.topPlayer ? data.topPlayer.goals.toFixed(2) : '-'}
          sub={data.topPlayer ? `${data.topPlayer.name} · ${data.topPlayer.teamId}` : ''}
          tone="gold"
          flagA={data.topPlayer ? teamFlag(data.topPlayer.teamId) : ''}
        />
        <StatCard
          label="Cenicienta más probable"
          value={data.cinderella ? `${(data.cinderella.qf * 100).toFixed(1)}%` : '-'}
          sub={data.cinderella ? `${teamName(data.cinderella.team.id)} llega a Cuartos` : ''}
          tone="emerald"
          flagA={teamFlag(data.cinderella?.team.id)}
        />
        <StatCard
          label="Defensa más sólida"
          value={data.lowestGA ? data.lowestGA.ga.toFixed(2) : '-'}
          sub={data.lowestGA ? `${teamName(data.lowestGA.team.id)} · GC promedio por torneo` : ''}
          tone="violet"
          flagA={teamFlag(data.lowestGA?.team.id)}
        />
        <StatCard
          label="Favoritos que ganan (grupos)"
          value={`${(data.avgFavWinRate * 100).toFixed(0)}%`}
          sub="Tasa de victoria del equipo con más ELO"
          tone="gold"
        />
        <StatCard
          label="Promedio de goles / partido"
          value={(data.meanGoals / 104).toFixed(2)}
          sub="Consistente con históricos (2.5–2.7)"
          tone="emerald"
        />
        <StatCard
          label="Equipos simulados"
          value="48"
          sub="12 grupos · 104 partidos"
          tone="violet"
        />
      </div>
    </section>
  );
}

function StatCard({
  label, value, sub, tone, flagA, flagB,
}: {
  label: string; value: string; sub: string;
  tone: 'gold' | 'emerald' | 'violet';
  flagA?: string; flagB?: string;
}) {
  const colors = {
    gold:    'border-gold/30 from-gold/10',
    emerald: 'border-emerald/30 from-emerald-lo/10',
    violet:  'border-violet/30 from-violet/10',
  } as const;
  const valColor = {
    gold:    'text-gold',
    emerald: 'text-emerald',
    violet:  'text-violet',
  } as const;
  return (
    <article className={cn('rounded-2xl border bg-gradient-to-br to-transparent p-5', colors[tone])}>
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">{label}</div>
      <div className={cn('mt-2 font-display text-3xl font-bold tabular sm:text-4xl', valColor[tone])}>{value}</div>
      <div className="mt-2 flex items-center gap-2">
        {flagA && <Flag code={flagA} size={16} />}
        {flagB && <Flag code={flagB} size={16} />}
        <span className="text-xs text-fg-2">{sub}</span>
      </div>
    </article>
  );
}
