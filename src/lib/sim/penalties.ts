/**
 * Penalty shoot-out outcome model (Tier 1 #3).
 *
 * When a knockout match ends 0-0 in regulation, the previous engine flipped a
 * fair coin. This is wrong - historical data shows clear per-team patterns
 * (Germany ~83% in WC shootouts, England ~30%, etc.) but the small samples
 * also forbid trusting raw rates blindly. We use an Empirical Bayes shrinkage:
 *
 *   rate(team) = (n_obs * obs_rate + k * 0.5) / (n_obs + k)
 *
 * where k=10 is the shrinkage strength (chosen to require ~10 actual
 * shootouts before the estimate meaningfully departs from 50%).
 *
 * For head-to-head:
 *
 *   P(A wins shootout) = rate(A) / (rate(A) + rate(B))
 *
 * No cap - let the data speak. Hosts, GK quality, recency are NOT modeled in
 * v1 (deferred to Tier 1.5 if backtest justifies the complexity).
 *
 * For backtest honesty, callers can pass a `cutoffYear` so the rate only
 * includes shootouts strictly before that year - preventing look-ahead bias
 * when scoring historical WCs.
 */

import shootoutsData from '@/data/shootouts.json';

interface ShootoutEntry {
  year: number;
  tournament: string;
  round: string;
  winner: string;
  loser: string;
  score: string;
}

interface ShootoutsFile {
  _meta: Record<string, unknown>;
  shootouts: ShootoutEntry[];
}

export const SHRINKAGE_K = 10;
export const PRIOR_RATE = 0.5;

const FILE = shootoutsData as unknown as ShootoutsFile;
const ALL: ShootoutEntry[] = FILE.shootouts;

/** Default cutoff = year after the latest shootout in the dataset. */
function maxYearPlus1(): number {
  let m = 0;
  for (const s of ALL) if (s.year > m) m = s.year;
  return m + 1;
}

const DEFAULT_CUTOFF = maxYearPlus1();

/**
 * Return EB-shrunk shoot-out win rate for `teamId` using all entries with
 * `year < cutoffYear`. With k=10 and prior=0.5, a team with zero shootouts
 * gets exactly 0.5.
 */
export function shootoutRate(teamId: string, cutoffYear: number = DEFAULT_CUTOFF): number {
  let wins = 0, losses = 0;
  for (const s of ALL) {
    if (s.year >= cutoffYear) continue;
    if (s.winner === teamId) wins++;
    else if (s.loser === teamId) losses++;
  }
  const n = wins + losses;
  return (wins + SHRINKAGE_K * PRIOR_RATE) / (n + SHRINKAGE_K);
}

/** Per-team sample size (number of shootouts played before cutoff). */
export function shootoutSampleSize(teamId: string, cutoffYear: number = DEFAULT_CUTOFF): number {
  let n = 0;
  for (const s of ALL) {
    if (s.year >= cutoffYear) continue;
    if (s.winner === teamId || s.loser === teamId) n++;
  }
  return n;
}

/** Raw (un-shrunk) win rate. Returns null if the team has zero observations. */
export function rawShootoutRate(teamId: string, cutoffYear: number = DEFAULT_CUTOFF): number | null {
  let wins = 0, losses = 0;
  for (const s of ALL) {
    if (s.year >= cutoffYear) continue;
    if (s.winner === teamId) wins++;
    else if (s.loser === teamId) losses++;
  }
  const n = wins + losses;
  return n === 0 ? null : wins / n;
}

/**
 * Probability that team A wins a shoot-out against team B, computed from the
 * head-to-head ratio of their shrunk rates.
 */
export function shootoutWinProb(teamAId: string, teamBId: string, cutoffYear: number = DEFAULT_CUTOFF): number {
  const rA = shootoutRate(teamAId, cutoffYear);
  const rB = shootoutRate(teamBId, cutoffYear);
  return rA / (rA + rB);
}
