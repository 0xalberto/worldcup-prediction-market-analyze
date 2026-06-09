import type { Team, AggregateResult, MatchAggregate, SampleSim } from './types';
import { XoshiroRNG } from './rng';
import { simulateTournament } from './tournament';
import { distributeGoals } from './scorers';

import teamsData from '@/data/teams.json';

const SCORE_HIST_SIZE = 64; // 8×8 grid (goalsHome 0..7 × goalsAway 0..7)
/** Number of full simulations to retain verbatim for the "browse simulations" UI. */
const SAMPLE_SIM_TARGET = 300;

export const TEAMS: Team[] = (teamsData as { teams: Team[] }).teams;
const TEAM_IDX = new Map(TEAMS.map((t, i) => [t.id, i] as const));

export interface RunOptions {
  numSimulations: number;
  seed?: number;
  onProgress?: (completed: number, total: number) => void;
  /** progress callback frequency in number of simulations */
  progressEvery?: number;
}

const MAX_TOURNAMENT_GOALS = 400; // upper bound for histogram bucket count

export function runSimulations(opts: RunOptions): AggregateResult {
  const N = opts.numSimulations;
  const teams = TEAMS;
  const T = teams.length;

  const rng = new XoshiroRNG(opts.seed ?? Date.now());

  const result: AggregateResult = {
    numSimulations: N,
    teams,
    stageCounts: {
      r32:      new Int32Array(T),
      r16:      new Int32Array(T),
      qf:       new Int32Array(T),
      sf:       new Int32Array(T),
      final:    new Int32Array(T),
      third:    new Int32Array(T),
      champion: new Int32Array(T),
    },
    totalGoalsFor: new Float64Array(T),
    totalGoalsAgainst: new Float64Array(T),
    groupFinish: {
      first:          new Int32Array(T),
      second:         new Int32Array(T),
      thirdAdvances:  new Int32Array(T),
      thirdOut:       new Int32Array(T),
      fourth:         new Int32Array(T),
    },
    tournamentGoalsHistogram: new Int32Array(MAX_TOURNAMENT_GOALS),
    fixtures: new Map(),
    scorers: new Map(),
    sampleSims: [],
  };

  // Snapshot every k-th sim into result.sampleSims. For N < SAMPLE_SIM_TARGET we
  // capture every sim; for larger N we space them out evenly.
  const sampleEvery = Math.max(1, Math.floor(N / SAMPLE_SIM_TARGET));
  // currentSampleMatches lives across the call to simulateTournament - we
  // populate it via the upsertFixture wrapper below.
  let currentSampleMatches: SampleSim['matches'] | null = null;

  // Helper to upsert a fixture aggregate + distribute goals to scorers.
  const upsertFixture = (
    stage: 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | '3rd',
    slotId: string,
    group: string | undefined,
    homeIdx: number,
    awayIdx: number,
    gh: number,
    ga: number,
  ) => {
    const homeId = teams[homeIdx].id;
    const awayId = teams[awayIdx].id;
    const key = stage === 'group' ? slotId : `${slotId}|${homeId}-${awayId}`;
    let f = result.fixtures.get(key);
    if (!f) {
      f = {
        slotId, stage, group, home: homeId, away: awayId,
        count: 0, winsHome: 0, draws: 0, winsAway: 0,
        sumGoalsHome: 0, sumGoalsAway: 0,
        scoreHist: new Int32Array(SCORE_HIST_SIZE),
      } satisfies MatchAggregate;
      result.fixtures.set(key, f);
    }
    f.count++;
    f.sumGoalsHome += gh;
    f.sumGoalsAway += ga;
    if (gh > ga) f.winsHome++;
    else if (gh < ga) f.winsAway++;
    else f.draws++;
    const h = Math.min(gh, 7);
    const a = Math.min(ga, 7);
    f.scoreHist[h * 8 + a]++;
    // Per-player goal distribution (multinomial draw per goal).
    distributeGoals(homeId, gh, rng, result.scorers);
    distributeGoals(awayId, ga, rng, result.scorers);

    // If this sim is on the sample track, retain the match.
    if (currentSampleMatches) {
      currentSampleMatches.push({ stage, slotId, home: homeIdx, away: awayIdx, gh, ga });
    }
  };

  const progressEvery = opts.progressEvery ?? Math.max(500, Math.floor(N / 100));

  for (let sim = 0; sim < N; sim++) {
    const onSampleTrack = sim % sampleEvery === 0 && result.sampleSims.length < SAMPLE_SIM_TARGET;
    currentSampleMatches = onSampleTrack ? [] : null;

    const t = simulateTournament(teams, TEAM_IDX, rng, upsertFixture);

    if (onSampleTrack && currentSampleMatches) {
      result.sampleSims.push({
        simIdx: sim,
        matches: currentSampleMatches,
        champion: t.champion,
        runnerUp: t.runnerUp,
        thirdPlace: t.thirdPlace,
        fourthPlace: t.fourthPlace,
      });
    }
    currentSampleMatches = null;

    // accumulate stage counts: any team that reached stage X also reached all stages ≤ X.
    for (let i = 0; i < T; i++) {
      const s = t.stageReached[i];
      const reachedR32 = s !== 'group';
      const reachedR16 = reachedR32 && s !== 'r32';
      const reachedQF  = reachedR16 && s !== 'r16';
      const reachedSF  = reachedQF  && s !== 'qf';
      const reachedF   = reachedSF  && s !== 'sf';
      const reachedChamp = s === 'champion';
      if (reachedR32) result.stageCounts.r32[i]++;
      if (reachedR16) result.stageCounts.r16[i]++;
      if (reachedQF)  result.stageCounts.qf[i]++;
      if (reachedSF)  result.stageCounts.sf[i]++;
      if (reachedF)   result.stageCounts.final[i]++;
      if (reachedChamp) result.stageCounts.champion[i]++;
    }

    // 3rd-place finisher (winner of the 3rd-place playoff)
    result.stageCounts.third[t.thirdPlace]++;

    // group-stage finish breakdown
    for (let i = 0; i < T; i++) {
      result.groupFinish[t.groupFinish[i]][i]++;
    }

    // goal totals
    let tournamentGoals = 0;
    for (let i = 0; i < T; i++) {
      result.totalGoalsFor[i] += t.goalsFor[i];
      result.totalGoalsAgainst[i] += t.goalsAgainst[i];
      tournamentGoals += t.goalsFor[i];
    }
    if (tournamentGoals < MAX_TOURNAMENT_GOALS) {
      result.tournamentGoalsHistogram[tournamentGoals]++;
    }

    if ((sim + 1) % progressEvery === 0 || sim === N - 1) {
      opts.onProgress?.(sim + 1, N);
    }
  }

  return result;
}

/** Convenience: compute per-team probabilities (sorted by champion % desc). */
export function championProbabilities(agg: AggregateResult): Array<{
  team: Team;
  pct: number;
  count: number;
}> {
  return agg.teams
    .map((team, i) => ({
      team,
      pct: agg.stageCounts.champion[i] / agg.numSimulations,
      count: agg.stageCounts.champion[i],
    }))
    .sort((a, b) => b.pct - a.pct);
}

export function stageProbabilityMatrix(agg: AggregateResult) {
  return agg.teams.map((team, i) => ({
    team,
    r32:     agg.stageCounts.r32[i] / agg.numSimulations,
    r16:     agg.stageCounts.r16[i] / agg.numSimulations,
    qf:      agg.stageCounts.qf[i] / agg.numSimulations,
    sf:      agg.stageCounts.sf[i] / agg.numSimulations,
    final:   agg.stageCounts.final[i] / agg.numSimulations,
    champ:   agg.stageCounts.champion[i] / agg.numSimulations,
    avgGF:   agg.totalGoalsFor[i] / agg.numSimulations,
    avgGA:   agg.totalGoalsAgainst[i] / agg.numSimulations,
  }));
}
