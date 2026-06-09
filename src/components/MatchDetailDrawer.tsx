'use client';

import { useMemo } from 'react';
import { Drawer } from 'vaul';
import { useLocale } from 'next-intl';
import { X } from 'lucide-react';
import { useSelection } from '@/hooks/useSelection';
import { Flag } from './Flag';
import { ScoreHeatmap } from './ScoreHeatmap';
import { buildMatchStats } from '@/lib/sim/match-stats';
import { getScorers } from '@/lib/sim/scorers';
import { cn, formatPct } from '@/lib/utils';
import { AbsenceBadge } from './TeamAbsencesPanel';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

const STAGE_LABEL: Record<string, string> = {
  group: 'Fase de grupos',
  r32:   '16vos · Round of 32',
  r16:   'Octavos · Round of 16',
  qf:    'Cuartos · Quarter-final',
  sf:    'Semifinal',
  final: 'Final',
  '3rd': '3er puesto',
};

export function MatchDetailDrawer({ result }: Props) {
  const locale = useLocale();
  const { selectedFixtureKey, closeFixture } = useSelection();

  const teamById = useMemo(() => new Map(result.teams.map((t) => [t.id, t])), [result]);
  const fixtureMap = useMemo(() => new Map(result.fixtures), [result.fixtures]);

  const fixture = selectedFixtureKey ? fixtureMap.get(selectedFixtureKey) : null;
  const stats = useMemo(() => (fixture ? buildMatchStats(fixture, teamById) : null), [fixture, teamById]);

  const open = !!selectedFixtureKey && !!stats;

  return (
    <Drawer.Root open={open} onClose={closeFixture} direction="right">
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[640px] flex-col border-l border-border bg-bg-1/90 backdrop-blur-2xl outline-none">
          <Drawer.Title className="sr-only">Match details</Drawer.Title>
          {stats && fixture && (
            <>
              <header className="flex items-start justify-between border-b border-border px-6 py-4">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
                    {STAGE_LABEL[fixture.stage]}
                    {fixture.group && ` · Grupo ${fixture.group}`}
                  </div>
                  <h2 className="mt-1 font-display text-2xl font-bold text-fg-0">
                    {locale === 'es' ? stats.homeTeam.name_es : stats.homeTeam.name_en}
                    <span className="mx-2 text-fg-3">vs</span>
                    {locale === 'es' ? stats.awayTeam.name_es : stats.awayTeam.name_en}
                  </h2>
                </div>
                <button onClick={closeFixture} className="rounded-full p-2 text-fg-3 hover:bg-bg-2/60 hover:text-fg-0">
                  <X className="h-4 w-4" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
                {/* Big scoreboard */}
                <section className="flex items-center justify-around rounded-2xl border border-border bg-bg-0/40 p-6">
                  <TeamSide team={stats.homeTeam} mean={stats.meanGoalsHome} />
                  <div className="text-center">
                    <div className="font-display text-4xl font-bold text-gold tabular">
                      {stats.topScores[0]?.home ?? 0}
                      <span className="mx-2 text-fg-3">-</span>
                      {stats.topScores[0]?.away ?? 0}
                    </div>
                    <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
                      Resultado modal
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-fg-2 tabular">
                      {formatPct(stats.topScores[0]?.prob ?? 0, 1)}
                    </div>
                  </div>
                  <TeamSide team={stats.awayTeam} mean={stats.meanGoalsAway} alignRight />
                </section>

                {/* W/D/L */}
                <section>
                  <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">Probabilidades</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <Probability label={locale === 'es' ? stats.homeTeam.name_es : stats.homeTeam.name_en} value={stats.winsHome} tone="emerald" />
                    <Probability label="Empate" value={stats.draws} tone="muted" />
                    <Probability label={locale === 'es' ? stats.awayTeam.name_es : stats.awayTeam.name_en} value={stats.winsAway} tone="violet" />
                  </div>
                </section>

                {/* Heatmap */}
                <section>
                  <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">Distribución de marcadores</h3>
                  <div className="rounded-2xl border border-border bg-bg-0/40 p-4 overflow-x-auto">
                    <ScoreHeatmap
                      scoreProb={stats.scoreProb}
                      homeLabel={stats.homeTeam.id}
                      awayLabel={stats.awayTeam.id}
                      size={6}
                    />
                  </div>
                  <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {stats.topScores.map((s, i) => (
                      <li key={`${s.home}-${s.away}-${i}`} className="flex justify-between rounded-lg border border-border bg-bg-2/40 px-3 py-1.5">
                        <span className="font-mono tabular text-fg-0">{s.home}-{s.away}</span>
                        <span className="font-mono tabular text-fg-2">{formatPct(s.prob, 1)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Scorers */}
                <section>
                  <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
                    Anotadores esperados <span className="text-fg-3">· aproximación</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <ScorersList teamId={stats.homeTeam.id} lambda={stats.lambdaHome} />
                    <ScorersList teamId={stats.awayTeam.id} lambda={stats.lambdaAway} />
                  </div>
                </section>

                {/* Stat extras */}
                <section>
                  <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
                    Otros <span className="text-fg-3">· estimaciones simples</span>
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <StatLine label="Córners (local)"    value={stats.cornersHome.toFixed(1)} />
                    <StatLine label="Córners (visit.)"   value={stats.cornersAway.toFixed(1)} />
                    <StatLine label="Amarillas (local)"  value={stats.yellowsHome.toFixed(1)} />
                    <StatLine label="Amarillas (visit.)" value={stats.yellowsAway.toFixed(1)} />
                    <StatLine label="λ local"            value={stats.lambdaHome.toFixed(2)} />
                    <StatLine label="λ visitante"        value={stats.lambdaAway.toFixed(2)} />
                  </div>
                </section>

                <p className="text-[10px] text-fg-3 leading-relaxed">
                  Probabilidades calculadas con el modelo ELO + Poisson sobre {result.numSimulations.toLocaleString()} simulaciones.
                  Los anotadores y los córners/tarjetas son <strong>aproximaciones</strong> basadas en goal-share manual y promedios históricos -
                  ver <a className="underline decoration-gold/40 underline-offset-2" href="/methodology">metodología</a>.
                </p>
              </div>
            </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

function TeamSide({ team, mean, alignRight = false }: { team: { id: string; flag: string; name_es: string; name_en: string; elo: number }; mean: number; alignRight?: boolean }) {
  const locale = useLocale();
  return (
    <div className={cn('flex flex-col items-center gap-1', alignRight && 'items-center')}>
      <Flag code={team.flag} size={40} />
      <span className="font-display text-sm text-fg-0 truncate max-w-[100px]">
        {locale === 'es' ? team.name_es : team.name_en}
      </span>
      <span className="font-mono text-[10px] text-fg-3 tabular">
        ELO {team.elo} · μ {mean.toFixed(2)}
      </span>
      <AbsenceBadge teamId={team.id} />
    </div>
  );
}

function Probability({ label, value, tone }: { label: string; value: number; tone: 'emerald' | 'muted' | 'violet' }) {
  const colors = {
    emerald: 'text-emerald border-emerald/40 bg-emerald-lo/10',
    muted:   'text-fg-1 border-border bg-bg-2/40',
    violet:  'text-violet border-violet/40 bg-violet/10',
  } as const;
  return (
    <div className={cn('rounded-xl border px-3 py-3 text-center', colors[tone])}>
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-70 truncate">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold tabular">{formatPct(value, 1)}</div>
    </div>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-bg-2/30 px-3 py-2">
      <span className="text-fg-2 text-xs">{label}</span>
      <span className="font-mono tabular text-fg-0">{value}</span>
    </div>
  );
}

function ScorersList({ teamId, lambda }: { teamId: string; lambda: number }) {
  const scorers = getScorers(teamId).filter((s) => s.name !== 'Otros');
  return (
    <div className="rounded-xl border border-border bg-bg-2/30 p-3">
      <div className="mb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-fg-3">{teamId}</div>
      <ul className="space-y-1.5">
        {scorers.map((s) => (
          <li key={s.name} className="flex items-center justify-between text-xs">
            <span className="truncate text-fg-1">{s.name}</span>
            <span className="font-mono tabular text-fg-2 shrink-0">
              {(s.share * lambda).toFixed(2)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
