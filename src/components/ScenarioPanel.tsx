'use client';

import { useMemo, useState } from 'react';
import { cn, formatPct } from '@/lib/utils';
import {
  type Absence,
  type Position,
  criticality,
  playerPenalty,
  teamPenalty,
  DEFAULT_ABSENCE_WEIGHTS,
} from '@/lib/sim/absences';
import squadsData from '@/data/squads.json';

const POSITION_LABEL: Record<Position, string> = {
  GK: 'Arq', CB: 'Def', FB: 'Lat', DM: 'MD', CM: 'MC', AM: 'EM', WG: 'Ext', ATT: 'Del',
};

interface SquadPlayer {
  player: string;
  position: Position;
  market_value_mil: number | null;
  injured?: boolean;
}

interface SquadsFile {
  _meta?: unknown;
  squads?: Record<string, SquadPlayer[]>;
}

const SQUADS = ((squadsData as SquadsFile).squads ?? {}) as Record<string, SquadPlayer[]>;

interface Props {
  teamId: string;
  /** Champion probability under the current MC run (with real injuries applied). */
  championProbCurrent: number;
  /** Champion probability under the counterfactual run with no injuries. Used to calibrate dP/dELO. */
  championProbNoAbsences: number;
  /** Currently flagged-injured absences for this team. Sourced from absences.json. */
  currentAbsences: Absence[];
}

/**
 * Scenario panel: lets the user toggle squad members as "absent" beyond the
 * real-world injury list, and shows an estimated champion-probability delta.
 *
 * The estimate is closed-form: we use the (P_current, P_no_absences) pair
 * already computed by the worker's two MC passes to fit a per-team linear
 * dP/dELO. Then for any hypothetical penalty we extrapolate. The result is
 * an approximation - exact only at the two calibration points - but it's
 * instant (no extra worker pass) and the direction / order of magnitude are
 * faithful for small to moderate scenarios.
 */
export function ScenarioPanel({
  teamId,
  championProbCurrent,
  championProbNoAbsences,
  currentAbsences,
}: Props) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const a of currentAbsences) init[a.player] = true;
    return init;
  });

  const squad = SQUADS[teamId];
  if (!squad || squad.length === 0) return null;

  // Sensitivity: slope = ΔP / ΔELO from the two MC passes.
  // current ELO offset is negative; no-absences offset is 0. Solve for slope.
  const currentElo = teamPenalty(currentAbsences, DEFAULT_ABSENCE_WEIGHTS, 'group');
  const dP = championProbNoAbsences - championProbCurrent;
  const dELO = 0 - currentElo;
  // Guard against zero-absence teams: fall back to a conservative slope from
  // the average MC sensitivity. For a top-10 contender, +100 ELO ≈ +5pp champ
  // prob - we use 0.0005 per ELO point as the default.
  const slope = dELO > 1 ? dP / dELO : 0.0005;

  // Row list: always include every currently-injured player so the baseline
  // matches what the engine actually uses, then fill with the highest-value
  // healthy players up to ~24 total. Keeps the panel focused but never hides
  // an absence that's silently affecting the prediction.
  const rows = useMemo(() => {
    const injuredNames = new Set(currentAbsences.map((a) => a.player));
    const injuredRows = squad.filter((p) => injuredNames.has(p.player));
    const healthyTop = squad
      .filter((p) => !injuredNames.has(p.player) && (p.market_value_mil ?? 0) > 1)
      .sort((a, b) => (b.market_value_mil ?? 0) - (a.market_value_mil ?? 0))
      .slice(0, Math.max(8, 24 - injuredRows.length));
    return [...injuredRows, ...healthyTop].sort(
      (a, b) => (b.market_value_mil ?? 0) - (a.market_value_mil ?? 0),
    );
  }, [squad, currentAbsences]);

  // Build the hypothetical absence list. Walk both rows AND currentAbsences
  // so we don't silently drop an absence that's not in the visible top-22
  // (rare: scraper saw the player in absences.json but not in squads.json).
  const hypothetical: Absence[] = useMemo(() => {
    const arr: Absence[] = [];
    const seen = new Set<string>();
    for (const p of rows) {
      if (!overrides[p.player]) continue;
      arr.push({
        player: p.player,
        position: p.position,
        minutes_qual: 0,
        market_value_mil: p.market_value_mil ?? 0,
        reason: 'Scenario',
      });
      seen.add(p.player);
    }
    for (const a of currentAbsences) {
      if (seen.has(a.player)) continue;
      if (!overrides[a.player]) continue;
      arr.push(a);
    }
    return arr;
  }, [rows, overrides, currentAbsences]);

  const hypoElo = teamPenalty(hypothetical, DEFAULT_ABSENCE_WEIGHTS, 'group');
  // Predicted prob = P_no_absences + slope * hypoElo (hypoElo is ≤ 0)
  const predictedChamp = Math.max(0, Math.min(1, championProbNoAbsences + slope * hypoElo));
  const eloDelta = hypoElo - currentElo;
  const probDelta = predictedChamp - championProbCurrent;

  const resetToCurrent = () => {
    const init: Record<string, boolean> = {};
    for (const a of currentAbsences) init[a.player] = true;
    setOverrides(init);
  };
  const allHealthy = () => setOverrides({});

  return (
    <section>
      <h3 className="mb-3 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-fg-3">
        <span>Escenario personalizado <span className="text-fg-3">· marcá ausencias hipotéticas</span></span>
        <div className="flex gap-2">
          <button
            onClick={resetToCurrent}
            className="rounded border border-border bg-bg-2/40 px-2 py-0.5 text-[9px] tracking-normal text-fg-2 transition-colors hover:bg-bg-2/60 hover:text-fg-1"
          >
            Reset
          </button>
          <button
            onClick={allHealthy}
            className="rounded border border-border bg-bg-2/40 px-2 py-0.5 text-[9px] tracking-normal text-fg-2 transition-colors hover:bg-bg-2/60 hover:text-fg-1"
          >
            Plantel completo
          </button>
        </div>
      </h3>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-bg-2/30 p-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-3">
            Prob. campeón estimada
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tabular text-gold">
              {formatPct(predictedChamp, 1)}
            </span>
            <span className="font-mono text-[10px] text-fg-3">
              vs {formatPct(championProbCurrent, 1)} actual
            </span>
          </div>
          <div className={cn(
            'mt-0.5 font-mono text-[10px] tabular',
            Math.abs(probDelta) < 0.002 ? 'text-fg-3' : probDelta > 0 ? 'text-emerald' : 'text-rose',
          )}>
            {probDelta > 0 ? '+' : ''}{formatPct(probDelta, 2)}
          </div>
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-fg-3">
            Δ ELO efectivo
          </div>
          <div className="mt-1 font-display text-2xl font-bold tabular text-fg-0">
            {Math.round(eloDelta) > 0 ? '+' : ''}{Math.round(eloDelta)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-fg-3 tabular">
            vs {Math.round(currentElo)} (actual)
          </div>
        </div>
      </div>

      <ul className="space-y-1 max-h-[280px] overflow-y-auto pr-1">
        {rows.map((p) => {
          const isOut = !!overrides[p.player];
          const wasInjured = currentAbsences.some((a) => a.player === p.player);
          const hypoPenalty = playerPenalty({
            player: p.player,
            position: p.position,
            minutes_qual: 0,
            market_value_mil: p.market_value_mil ?? 0,
            reason: '',
          }, DEFAULT_ABSENCE_WEIGHTS);
          return (
            <li
              key={p.player}
              className={cn(
                'flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors cursor-pointer',
                isOut
                  ? 'border-rose/30 bg-rose/5'
                  : 'border-border bg-bg-2/20 hover:bg-bg-2/40',
              )}
              onClick={() => setOverrides((o) => ({ ...o, [p.player]: !o[p.player] }))}
            >
              <span
                className={cn(
                  'flex h-3.5 w-3.5 flex-none items-center justify-center rounded border tabular',
                  isOut ? 'border-rose bg-rose text-bg-0' : 'border-border bg-transparent',
                )}
              >
                {isOut && <span className="text-[10px] leading-none">×</span>}
              </span>
              <span className={cn('flex-1 truncate', isOut ? 'text-rose/80 line-through' : 'text-fg-0')}>
                {p.player}
                {wasInjured && (
                  <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-rose/80">lesion.</span>
                )}
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-fg-3 tabular">
                {POSITION_LABEL[p.position]} · €{(p.market_value_mil ?? 0).toFixed(0)}m
              </span>
              <span className={cn(
                'w-12 text-right font-mono text-[10px] tabular',
                isOut ? 'text-rose' : 'text-fg-3',
              )}>
                {Math.round(hypoPenalty)}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-[10px] text-fg-3 leading-relaxed">
        Aproximación lineal calibrada con la corrida con/sin lesiones del simulador. El cambio direccional es fiable pero el magnitud es estimación
        - para el valor exacto, recargá la simulación con la nueva configuración.
      </p>
    </section>
  );
}
