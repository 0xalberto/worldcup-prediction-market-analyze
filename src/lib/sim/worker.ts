/// <reference lib="webworker" />

import { runSimulations } from './engine';
import { setEngineAbsencesEnabled } from './absences';
import type { AggregateResult, MatchAggregateSerialized, SampleSim } from './types';

export type WorkerInbound =
  | { type: 'run'; numSimulations: number; seed?: number };

/**
 * Progress messages tag which scenario is currently being computed so the
 * loading bar can show "Pasada 1/2 - con lesiones · 47%" etc. The `done`
 * message carries BOTH results.
 */
export type WorkerOutbound =
  | { type: 'progress'; completed: number; total: number; scenario: 'withAbsences' | 'noAbsences' }
  | { type: 'done'; result: SerializedResult; resultNoAbsences: SerializedResult; durationMs: number }
  | { type: 'error'; message: string };

/**
 * AggregateResult includes typed arrays (Int32Array, Float64Array). They
 * survive postMessage via the structured-clone algorithm, but we can also
 * mark them transferable to avoid a copy of large buffers.
 *
 * For readability on the receiving side, we serialize counts as plain arrays
 * - the data is small (48 teams × a handful of fields) and the legibility
 * win is bigger than the perf cost.
 */
export interface SerializedResult {
  numSimulations: number;
  teams: AggregateResult['teams'];
  stageCounts: {
    r32: number[];
    r16: number[];
    qf: number[];
    sf: number[];
    final: number[];
    third: number[];
    champion: number[];
  };
  totalGoalsFor: number[];
  totalGoalsAgainst: number[];
  groupFinish: {
    first: number[];
    second: number[];
    thirdAdvances: number[];
    thirdOut: number[];
    fourth: number[];
  };
  tournamentGoalsHistogram: number[];
  /** Each [key, fixture] entry from the engine's fixtures Map. */
  fixtures: Array<[string, MatchAggregateSerialized]>;
  /** Each [key, totalGoals] entry from the scorers Map. */
  scorers: Array<[string, number]>;
  /** Captured sample of full simulations for the "browse simulations" UI. */
  sampleSims: SampleSim[];
}

function serialize(agg: AggregateResult): SerializedResult {
  const ta = (arr: Int32Array | Float64Array) => Array.from(arr);
  const fixtures: Array<[string, MatchAggregateSerialized]> = [];
  for (const [k, f] of agg.fixtures) {
    fixtures.push([k, { ...f, scoreHist: Array.from(f.scoreHist) }]);
  }
  return {
    numSimulations: agg.numSimulations,
    teams: agg.teams,
    stageCounts: {
      r32:      ta(agg.stageCounts.r32),
      r16:      ta(agg.stageCounts.r16),
      qf:       ta(agg.stageCounts.qf),
      sf:       ta(agg.stageCounts.sf),
      final:    ta(agg.stageCounts.final),
      third:    ta(agg.stageCounts.third),
      champion: ta(agg.stageCounts.champion),
    },
    totalGoalsFor: ta(agg.totalGoalsFor),
    totalGoalsAgainst: ta(agg.totalGoalsAgainst),
    groupFinish: {
      first:         ta(agg.groupFinish.first),
      second:        ta(agg.groupFinish.second),
      thirdAdvances: ta(agg.groupFinish.thirdAdvances),
      thirdOut:      ta(agg.groupFinish.thirdOut),
      fourth:        ta(agg.groupFinish.fourth),
    },
    tournamentGoalsHistogram: ta(agg.tournamentGoalsHistogram),
    fixtures,
    scorers: Array.from(agg.scorers.entries()),
    sampleSims: agg.sampleSims,
  };
}

self.onmessage = (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  if (msg.type === 'run') {
    try {
      const t0 = performance.now();

      // Pass 1: with absences (default engine state).
      setEngineAbsencesEnabled(true);
      const withAbs = runSimulations({
        numSimulations: msg.numSimulations,
        seed: msg.seed,
        onProgress: (completed, total) => {
          (self as unknown as Worker).postMessage({
            type: 'progress', completed, total, scenario: 'withAbsences',
          } satisfies WorkerOutbound);
        },
      });

      // Pass 2: counterfactual without absences. Same seed so the only delta
      // comes from the absence penalty - easier to interpret the difference.
      setEngineAbsencesEnabled(false);
      const noAbs = runSimulations({
        numSimulations: msg.numSimulations,
        seed: msg.seed,
        onProgress: (completed, total) => {
          (self as unknown as Worker).postMessage({
            type: 'progress', completed, total, scenario: 'noAbsences',
          } satisfies WorkerOutbound);
        },
      });

      // Restore default for safety even though the worker terminates.
      setEngineAbsencesEnabled(true);

      const durationMs = performance.now() - t0;
      (self as unknown as Worker).postMessage({
        type: 'done',
        result: serialize(withAbs),
        resultNoAbsences: serialize(noAbs),
        durationMs,
      } satisfies WorkerOutbound);
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      } satisfies WorkerOutbound);
    }
  }
};
