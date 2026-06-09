'use client';

import { useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { Flag } from './Flag';
import { cn, formatPct } from '@/lib/utils';
import { useSelection } from '@/hooks/useSelection';
import type { SerializedResult } from '@/lib/sim/worker';

interface Props { result: SerializedResult; }

interface Row {
  key: string;
  stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd';
  stageLabel: string;
  group?: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  homeFlag: string;
  awayFlag: string;
  modalScore: string;
  winsHome: number;
  draws: number;
  winsAway: number;
  matchupProb: number;
  expectedGoals: number;
}

const STAGE_LABEL_ES: Record<Row['stage'], string> = {
  group: 'Grupos',
  r32:   'R32',
  r16:   'R16',
  qf:    'Cuartos',
  sf:    'Semifinal',
  final: 'Final',
  '3rd': '3er puesto',
};

const STAGE_ORDER: Row['stage'][] = ['group', 'r32', 'r16', 'qf', 'sf', '3rd', 'final'];

export function MatchCalendar({ result }: Props) {
  const locale = useLocale();
  const openFixture = useSelection((s) => s.openFixture);
  const [stageFilter, setStageFilter] = useState<Row['stage'] | 'all'>('all');
  const [teamFilter, setTeamFilter] = useState<string>('');

  const teamById = useMemo(() => new Map(result.teams.map((t) => [t.id, t])), [result]);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const [key, f] of result.fixtures) {
      // For knockout, only keep the dominant matchup per slot to avoid clutter.
      // We surface alternatives in the drawer.
      const homeTeam = teamById.get(f.home);
      const awayTeam = teamById.get(f.away);
      if (!homeTeam || !awayTeam) continue;

      // For each knockout slot we'd like to show only the most likely matchup.
      // We'll dedupe after by slotId for non-group stages.

      // modal score from histogram
      let bestIdx = 0; let bestC = 0;
      for (let i = 0; i < 64; i++) {
        if (f.scoreHist[i] > bestC) { bestC = f.scoreHist[i]; bestIdx = i; }
      }
      const h = Math.floor(bestIdx / 8);
      const a = bestIdx % 8;

      out.push({
        key,
        stage: f.stage,
        stageLabel: STAGE_LABEL_ES[f.stage],
        group: f.group,
        homeId: f.home, awayId: f.away,
        homeName: locale === 'es' ? homeTeam.name_es : homeTeam.name_en,
        awayName: locale === 'es' ? awayTeam.name_es : awayTeam.name_en,
        homeFlag: homeTeam.flag, awayFlag: awayTeam.flag,
        modalScore: `${h}-${a}`,
        winsHome: f.count > 0 ? f.winsHome / f.count : 0,
        draws:    f.count > 0 ? f.draws    / f.count : 0,
        winsAway: f.count > 0 ? f.winsAway / f.count : 0,
        matchupProb: f.count / result.numSimulations,
        expectedGoals: f.count > 0 ? (f.sumGoalsHome + f.sumGoalsAway) / f.count : 0,
      });
    }

    // For knockout: keep only the top matchup per slotId.
    const bySlot = new Map<string, Row>();
    const groupRows: Row[] = [];
    for (const r of out) {
      if (r.stage === 'group') {
        groupRows.push(r);
        continue;
      }
      // key for knockout: "73|HOME-AWAY"; slotId = part before |
      const slotId = r.key.split('|')[0];
      const existing = bySlot.get(slotId);
      if (!existing || r.matchupProb > existing.matchupProb) {
        bySlot.set(slotId, r);
      }
    }
    const knockoutRows = Array.from(bySlot.values());
    return [...groupRows, ...knockoutRows];
  }, [result, locale, teamById]);

  const filtered = useMemo(() => {
    let r = rows;
    if (stageFilter !== 'all') r = r.filter((x) => x.stage === stageFilter);
    if (teamFilter) r = r.filter((x) => x.homeId === teamFilter || x.awayId === teamFilter);
    // sort by stage then by group-pair index (group order is already insertion)
    r = [...r].sort((a, b) => {
      const sA = STAGE_ORDER.indexOf(a.stage);
      const sB = STAGE_ORDER.indexOf(b.stage);
      if (sA !== sB) return sA - sB;
      if (a.stage === 'group') return a.key.localeCompare(b.key);
      return parseInt(a.key.split('|')[0], 10) - parseInt(b.key.split('|')[0], 10);
    });
    return r;
  }, [rows, stageFilter, teamFilter]);

  const stages: Array<{ k: Row['stage'] | 'all'; label: string }> = [
    { k: 'all',   label: 'Todos' },
    { k: 'group', label: 'Grupos' },
    { k: 'r32',   label: 'R32' },
    { k: 'r16',   label: 'R16' },
    { k: 'qf',    label: 'Cuartos' },
    { k: 'sf',    label: 'Semis' },
    { k: 'final', label: 'Final' },
  ];

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-20">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-fg-0 sm:text-4xl lg:text-5xl">
            Calendario · 104 partidos
          </h2>
          <p className="mt-2 text-sm text-fg-2">
            Cada partido con su resultado modal, probabilidades W/D/L y goles esperados.
            Click en una fila para ver la distribución completa, anotadores y córners.
          </p>
        </div>
      </header>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {stages.map((s) => (
          <button
            key={s.k}
            onClick={() => setStageFilter(s.k)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition-colors',
              stageFilter === s.k
                ? 'border-gold/40 bg-gold/10 text-gold'
                : 'border-border bg-bg-1/30 text-fg-2 hover:text-fg-1',
            )}
          >
            {s.label}
          </button>
        ))}
        <select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          className="mt-1 w-full rounded-full border border-border bg-bg-1/40 px-3 py-1.5 text-xs text-fg-1 sm:ml-auto sm:mt-0 sm:w-auto"
        >
          <option value="">Todos los equipos</option>
          {result.teams.map((t) => (
            <option key={t.id} value={t.id}>{locale === 'es' ? t.name_es : t.name_en}</option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border glass">
        <table className="min-w-full">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.18em] text-fg-3 font-mono">
              <th className="px-4 py-3 text-left">Etapa</th>
              <th className="px-4 py-3 text-right">Local</th>
              <th className="px-2 py-3 text-center">Score</th>
              <th className="px-4 py-3 text-left">Visitante</th>
              <th className="px-3 py-3 text-center">L</th>
              <th className="px-3 py-3 text-center">E</th>
              <th className="px-3 py-3 text-center">V</th>
              <th className="px-3 py-3 text-right">Goles</th>
              <th className="px-3 py-3 text-right">P(matchup)</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.key}
                onClick={() => openFixture(r.key)}
                className="cursor-pointer border-t border-border/40 transition-colors hover:bg-bg-2/40"
              >
                <td className="px-4 py-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
                    {r.stageLabel}{r.group && ` ${r.group}`}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-fg-1">{r.homeName}</span>
                    <Flag code={r.homeFlag} size={18} />
                  </div>
                </td>
                <td className="px-2 py-2.5 text-center">
                  <span className="font-mono text-sm tabular text-fg-0">{r.modalScore}</span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Flag code={r.awayFlag} size={18} />
                    <span className="text-sm text-fg-1">{r.awayName}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-xs tabular text-emerald">
                  {formatPct(r.winsHome, 0)}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-xs tabular text-fg-2">
                  {formatPct(r.draws, 0)}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-xs tabular text-violet">
                  {formatPct(r.winsAway, 0)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-0">
                  {r.expectedGoals.toFixed(1)}
                </td>
                <td className="px-3 py-2.5 text-right font-mono text-xs tabular text-fg-3">
                  {r.stage === 'group' ? '100%' : formatPct(r.matchupProb, 1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-[10px] text-fg-3">
        En eliminatoria mostramos el matchup más probable por slot. La columna P(matchup) indica la probabilidad
        de que ese cruce específico ocurra; el resto se reparte entre matchups alternativos.
      </p>
    </section>
  );
}
